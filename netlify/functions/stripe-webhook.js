// Stripe webhook → keeps the Supabase `entitlements` row true to Stripe.
// Runs as a Netlify Function (server-side) so it can hold secrets and write
// past Row Level Security with the service_role key. Zero npm deps — Stripe
// signature verification is done with Node's crypto, and the Supabase writes
// are plain REST calls.
//
// Events handled:
//   checkout.session.completed      → grant Pro (monthly / annual / founder)
//   customer.subscription.created   → record status, period end, subscription id
//   customer.subscription.updated   → same; Pro follows the subscription status
//   customer.subscription.deleted   → revoke Pro (never for founder / lifetime)
//   invoice.payment_failed          → status past_due (Pro kept while Stripe retries)
//
// Every Supabase write is CHECKED. A failed write returns 500 so Stripe retries
// the event (it retries for up to three days), instead of a 200 that would make
// a paying customer silently never receive Pro.
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

// Plan from a subscription's first price: yearly interval → annual.
function planForSubscription(sub) {
  const price = sub?.items?.data?.[0]?.price;
  if (!price) return null;
  if (price.recurring?.interval === 'year') return 'annual';
  if (price.recurring?.interval === 'month') return 'monthly';
  return planForAmount(price.unit_amount || 0, 'subscription');
}

// Stripe statuses that keep the doors open. past_due keeps Pro while Stripe
// retries the card; `deleted` (after retries fail) is what revokes.
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

// Newer Stripe API versions moved current_period_end onto the item.
function periodEndOf(sub) {
  const raw = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
  return raw ? new Date(raw * 1000).toISOString() : null;
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

// ── Supabase REST, checked ────────────────────────────────────────────────
class SupabaseError extends Error {}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new SupabaseError('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  return { url, key };
}

async function supabaseRest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: [prefer, 'return=representation'].filter(Boolean).join(','),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new SupabaseError(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : []; } catch { return []; }
}

// Upsert on user_id. Returns the row.
async function upsertEntitlement(row) {
  const rows = await supabaseRest('entitlements', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: { ...row, updated_at: new Date().toISOString() },
  });
  return rows[0] || null;
}

// Patch rows matching a Stripe id. Returns the rows touched (may be empty —
// e.g. a founder one-time purchase has no subscription).
async function patchWhere(filter, patch) {
  return supabaseRest(`entitlements?${filter}`, {
    method: 'PATCH',
    body: { ...patch, updated_at: new Date().toISOString() },
  });
}

async function findByStripe(sub) {
  const q = sub.id ? `stripe_subscription_id=eq.${encodeURIComponent(sub.id)}` : null;
  if (q) {
    const rows = await supabaseRest(`entitlements?select=user_id,plan&${q}`);
    if (rows.length) return { rows, filter: q };
  }
  if (sub.customer) {
    const c = `stripe_customer_id=eq.${encodeURIComponent(sub.customer)}`;
    const rows = await supabaseRest(`entitlements?select=user_id,plan&${c}`);
    if (rows.length) return { rows, filter: c };
  }
  return { rows: [], filter: null };
}

// ── Event handlers ────────────────────────────────────────────────────────
async function onCheckoutCompleted(s) {
  const userId = s.client_reference_id;   // the Supabase user id we tagged
  if (!userId) { console.warn('[stripe-webhook] checkout without client_reference_id', s.id); return 'ignored: no user'; }
  const plan = planForAmount(s.amount_total, s.mode);
  await upsertEntitlement({
    user_id: userId,
    plan,
    is_pro: true,
    status: s.mode === 'payment' ? 'lifetime' : 'active',
    stripe_customer_id: s.customer || null,
    stripe_subscription_id: s.subscription || null,
    current_period_end: null,               // filled by customer.subscription.*
    cancel_at_period_end: false,
  });
  return `granted ${plan} to ${userId}`;
}

async function onSubscriptionChanged(sub) {
  const { rows, filter } = await findByStripe(sub);
  if (!rows.length) return 'ignored: no matching entitlement yet';
  if (rows.every(r => r.plan === 'founder')) return 'ignored: founder is lifetime';
  const status = sub.status || 'active';
  const patch = {
    status,
    is_pro: PRO_STATUSES.has(status),
    current_period_end: periodEndOf(sub),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_subscription_id: sub.id || null,
    stripe_customer_id: sub.customer || null,
  };
  const plan = planForSubscription(sub);
  if (plan) patch.plan = PRO_STATUSES.has(status) ? plan : 'free';
  await patchWhere(filter, patch);
  return `subscription ${sub.id} → ${status}, pro=${patch.is_pro}`;
}

async function onSubscriptionDeleted(sub) {
  const { rows, filter } = await findByStripe(sub);
  if (!rows.length) return 'ignored: no matching entitlement';
  if (rows.every(r => r.plan === 'founder')) return 'ignored: founder is lifetime';
  await patchWhere(filter, {
    is_pro: false,
    plan: 'free',
    status: 'canceled',
    cancel_at_period_end: false,
    current_period_end: periodEndOf(sub),
  });
  return `revoked ${sub.id}`;
}

async function onPaymentFailed(invoice) {
  const subId = invoice.subscription || invoice.parent?.subscription_details?.subscription || null;
  const probe = { id: typeof subId === 'string' ? subId : subId?.id, customer: invoice.customer };
  const { rows, filter } = await findByStripe(probe);
  if (!rows.length) return 'ignored: no matching entitlement';
  if (rows.every(r => r.plan === 'founder')) return 'ignored: founder is lifetime';
  // Pro is kept: Stripe retries the card, and customer.subscription.deleted
  // arrives if every retry fails. The status lets the app say "update your card".
  await patchWhere(filter, { status: 'past_due' });
  return `payment failed on ${probe.id || invoice.customer} → past_due`;
}

exports.handler = async (event) => {
  const rawBody = event.body || '';
  const sigHeader = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verifyStripeSignature(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET)) {
    return { statusCode: 400, body: 'invalid signature' };
  }

  let evt;
  try { evt = JSON.parse(rawBody); } catch { return { statusCode: 400, body: 'bad json' }; }

  const obj = evt?.data?.object || {};
  try {
    let outcome = 'ignored: unhandled event type';
    switch (evt.type) {
      case 'checkout.session.completed': outcome = await onCheckoutCompleted(obj); break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated': outcome = await onSubscriptionChanged(obj); break;
      case 'customer.subscription.deleted': outcome = await onSubscriptionDeleted(obj); break;
      case 'invoice.payment_failed': outcome = await onPaymentFailed(obj); break;
      default: break;
    }
    console.log(`[stripe-webhook] ${evt.type} ${evt.id || ''}: ${outcome}`);
    return { statusCode: 200, body: outcome };
  } catch (e) {
    // 500 makes Stripe retry. A Supabase outage must not become a lost sale.
    console.error(`[stripe-webhook] ${evt.type} ${evt.id || ''} FAILED: ${e.message}`);
    return { statusCode: 500, body: `handler error: ${e.message}` };
  }
};

// Exposed for tests.
exports._internal = { planForAmount, planForSubscription, periodEndOf, verifyStripeSignature, PRO_STATUSES };
