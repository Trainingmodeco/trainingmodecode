// Stripe webhook → grants Pro in Supabase after a successful payment.
// Runs as a Netlify Function (server-side) so it can hold secrets and write
// past Row Level Security with the service_role key. Zero npm deps — Stripe
// signature verification is done with Node's crypto, and the Supabase write is
// a plain REST call.
//
// Required Netlify environment variables (Site config → Environment variables):
//   STRIPE_WEBHOOK_SECRET       — from the Stripe webhook endpoint ("whsec_…")
//   SUPABASE_URL                — https://adtxjmqshckhmyziehpv.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — Supabase service_role key (SECRET — dashboard only)
const crypto = require('crypto');

// Map a Stripe Payment Link / price to our plan id. We key off the amount so a
// price-id change doesn't silently break granting. Amounts are in cents.
function planForAmount(amountTotal, mode) {
  if (mode === 'payment') return 'founder';        // one-time $59
  if (amountTotal >= 3000) return 'annual';          // $34.99/yr
  return 'monthly';                                   // $5.99/mo
}

// Constant-time verify of Stripe's `Stripe-Signature` header.
function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')));
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;
  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch { return false; }
}

async function grantEntitlement({ userId, plan, customerId, periodEnd }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return;
  await fetch(`${url}/rest/v1/entitlements`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',   // upsert on the primary key (user_id)
    },
    body: JSON.stringify({
      user_id: userId,
      plan,
      is_pro: true,
      stripe_customer_id: customerId || null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  });
}

exports.handler = async (event) => {
  const rawBody = event.body || '';
  const sigHeader = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verifyStripeSignature(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET)) {
    return { statusCode: 400, body: 'invalid signature' };
  }

  let evt;
  try { evt = JSON.parse(rawBody); } catch { return { statusCode: 400, body: 'bad json' }; }

  try {
    if (evt.type === 'checkout.session.completed') {
      const s = evt.data.object;
      const userId = s.client_reference_id;   // the Supabase user id we tagged
      if (userId) {
        await grantEntitlement({
          userId,
          plan: planForAmount(s.amount_total, s.mode),
          customerId: s.customer,
          periodEnd: null,
        });
      }
    }
    // Note: cancellations/expiries (customer.subscription.deleted) can be wired
    // later to set is_pro=false; grant-on-payment is enough to launch.
  } catch (e) {
    return { statusCode: 500, body: `handler error: ${e.message}` };
  }

  return { statusCode: 200, body: 'ok' };
};
