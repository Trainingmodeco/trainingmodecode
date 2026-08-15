// Stripe → Supabase entitlement webhook (Supabase Edge Function, Deno).
//
// THE MISSING LINK in the paywall chain: Stripe Payment Links tag checkout with
// client_reference_id = the Supabase user id (see data/stripe.js), and this
// function turns a completed payment into that user's `entitlements` row. The
// app only ever READS that row — RLS gives clients no write path — so this is
// the single place Pro can be granted.
//
// NOT ACTIVE until it is deployed AND its secrets are set AND Stripe points at
// it. Even then it grants nothing visible while PAYWALL_ENABLED is false: the
// app treats everyone as Pro during the beta. See ./README.md.
//
// Secrets (Supabase → Edge Functions → Secrets; NEVER in this file or in git):
//   STRIPE_SECRET_KEY        sk_live_… / sk_test_…
//   STRIPE_WEBHOOK_SECRET    whsec_…  (from the Stripe endpoint you create)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-01-27.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});
// Deno's crypto is async, so signature verification must use the subtle provider.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  // service_role bypasses RLS — the whole point: only the server can grant Pro.
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// Plans are derived from what Stripe actually charged rather than hardcoded
// price ids, so rotating a Payment Link or price never silently breaks Pro.
//   one-off payment  → founder (lifetime)
//   yearly recurring → annual
//   monthly recurring→ monthly
function planFromSubscription(sub: Stripe.Subscription | null, isOneOff: boolean): string {
  if (isOneOff) return 'founder';
  const interval = sub?.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === 'year') return 'annual';
  if (interval === 'month') return 'monthly';
  return 'monthly';
}

const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

type EntitlementPatch = {
  plan: string;
  is_pro: boolean;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

async function writeEntitlement(userId: string, patch: EntitlementPatch) {
  const { error } = await admin
    .from('entitlements')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  if (error) throw new Error(`entitlement upsert failed: ${error.message}`);
}

// Later subscription events carry no client_reference_id, so the Stripe customer
// (or subscription) id recorded at checkout is how we find the account again.
async function userIdFromStripeIds(customerId?: string | null, subscriptionId?: string | null) {
  if (customerId) {
    const { data } = await admin.from('entitlements').select('user_id')
      .eq('stripe_customer_id', customerId).maybeSingle();
    if (data?.user_id) return data.user_id as string;
  }
  if (subscriptionId) {
    const { data } = await admin.from('entitlements').select('user_id')
      .eq('stripe_subscription_id', subscriptionId).maybeSingle();
    if (data?.user_id) return data.user_id as string;
  }
  return null;
}

const iso = (unixSeconds?: number | null) =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return new Response('not configured', { status: 400 });

  // The RAW body is required — parsing it first would break the signature.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret, undefined, cryptoProvider);
  } catch (err) {
    // An unverified payload is an impostor. Never act on it.
    return new Response(`signature verification failed: ${err}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // The moment a purchase completes — the only event carrying the account id.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId) {
          // Someone paid through a bare link with no account attached. Don't
          // guess — 200 so Stripe stops retrying, and leave a trace to reconcile.
          console.warn('checkout.session.completed without client_reference_id', session.id);
          break;
        }
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;

        const isOneOff = session.mode === 'payment';
        let sub: Stripe.Subscription | null = null;
        if (subscriptionId) sub = await stripe.subscriptions.retrieve(subscriptionId);

        await writeEntitlement(userId, {
          plan: planFromSubscription(sub, isOneOff),
          // A lifetime purchase never expires; a subscription must be in a paid state.
          is_pro: isOneOff ? true : PRO_STATUSES.has(sub?.status ?? ''),
          status: isOneOff ? 'lifetime' : sub?.status ?? null,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: isOneOff ? null : iso(sub?.current_period_end),
          cancel_at_period_end: sub?.cancel_at_period_end ?? false,
        });
        break;
      }

      // Renewals, upgrades, cancellations, payment failures.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
        const userId = await userIdFromStripeIds(customerId, sub.id);
        if (!userId) {
          console.warn('subscription event for an unknown account', sub.id);
          break;
        }
        const ended = event.type === 'customer.subscription.deleted';
        await writeEntitlement(userId, {
          // Losing Pro returns the account to free rather than deleting the row,
          // so history (customer id) survives for a future resubscribe.
          plan: ended ? 'free' : planFromSubscription(sub, false),
          is_pro: !ended && PRO_STATUSES.has(sub.status),
          status: ended ? 'canceled' : sub.status,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          current_period_end: iso(sub.current_period_end),
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
        });
        break;
      }

      default:
        // Everything else is acknowledged and ignored.
        break;
    }
  } catch (err) {
    // 500 makes Stripe retry with backoff — right for a transient DB blip.
    console.error('handler error', event.type, err);
    return new Response(`handler error: ${err}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
