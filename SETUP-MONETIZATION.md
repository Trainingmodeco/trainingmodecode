# Monetization setup — the 4 manual steps

The app code (entitlements, Stripe checkout, webhook) is already built and
deployed. The paywall is **dormant** (`PAYWALL_ENABLED = false`) — everyone is
Pro during beta. To turn payments on, complete the four steps below, test in
Stripe **test mode**, then flip the switch.

Secrets (anything called *secret* / *service_role* / `sk_live_` / `whsec_`) go
**only** into the dashboards below — never into the app code or chat.

---

## 1. Create the entitlements table (Supabase)

Supabase dashboard → **SQL Editor** → New query → paste and **Run**:

```sql
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',            -- 'free' | 'monthly' | 'annual' | 'founder'
  is_pro boolean not null default false,
  stripe_customer_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Signed-in users may read ONLY their own entitlement row.
create policy "read own entitlement"
  on public.entitlements for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy → the only writer is the Stripe webhook,
-- which uses the service_role key and bypasses RLS.
```

## 2. Set Netlify environment variables

Netlify → your site → **Site configuration → Environment variables** → add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://adtxjmqshckhmyziehpv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** key (SECRET) |
| `STRIPE_WEBHOOK_SECRET` | from step 3 (starts with `whsec_`) |

## 3. Create the Stripe webhook endpoint

Stripe (Live mode) → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL:** `https://apptrainingmode.com/.netlify/functions/stripe-webhook`
- **Events to send:** `checkout.session.completed`
- Create it, then click **Reveal** on the **Signing secret** (`whsec_…`) and put
  it in the Netlify `STRIPE_WEBHOOK_SECRET` var from step 2. Redeploy the site
  so the new env vars load.

## 4. Point the Payment Links back to the app

For each of the 3 Payment Links (Stripe → **Payment links**), edit → **After
payment** → **Redirect customers to a URL**:

```
https://apptrainingmode.com/?checkout=success
```

(The app detects `?checkout=success`, re-reads the entitlement, and shows the
account as Pro. The `client_reference_id` that ties the payment to the account
is appended automatically by the app — nothing to configure for that.)

---

## 4b. Preview the gated experience safely (no live impact)

The free-tier limits are now **wired**: a free user who taps arcade **stage 4+**,
or tries to save a **2nd Workout Builder routine**, is routed to the Paywall.
These only bite once `PAYWALL_ENABLED` is on — OR when you opt this browser into
**preview**, which changes nothing for anyone else:

- Turn on:  visit `https://apptrainingmode.com/?paywall=preview`
- Turn off: visit `https://apptrainingmode.com/?paywall=off`

With preview on you can walk the whole funnel — hit a gate → land on the Paywall
→ (once steps 1–4 are done) pay in Stripe **test mode** → confirm the account
flips to Pro and the gate opens — all without gating real beta users. Combine
with a signed-in test account to exercise the checkout → entitlement path.

## 5. Test, then go live

1. Do a full run in Stripe **test mode** (test card `4242 4242 4242 4242`): sign
   in → open the paywall → pick a plan → pay → land back on the app → confirm
   the `entitlements` row shows `is_pro = true` and the account reads as Pro.
2. Flip the switch: in `components/training-mode/data/entitlements.js` set
   `PAYWALL_ENABLED = true`, commit, push. Free-tier limits (arcade stages 1–3,
   1 routine slot) then start applying to non-Pro users.

Tell Claude "flip the paywall on" once steps 1–4 are done and tested, and it'll
handle step 5's code change.


---

## 5. Customer portal link (lets subscribers cancel without you)

Stripe → **Settings → Billing → Customer portal** → turn on "Cancel
subscriptions" and "Update payment method" → **Activate link** → copy the
`https://billing.stripe.com/p/login/…` URL.

Netlify → Environment variables → add `EXPO_PUBLIC_STRIPE_PORTAL_URL` = that
URL → redeploy. The app's SUBSCRIPTION screen then shows MANAGE BILLING for
paying subscribers. Without it the screen tells them to use the link in their
Stripe receipt email (which also works once the portal is activated).

## 6. Webhook events — add these to the endpoint from step 3

The webhook now keeps the entitlement true to Stripe, so the endpoint must
send more than `checkout.session.completed`. Edit the endpoint → **Select
events** → add:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted` (revokes Pro — founders are never revoked)
- `invoice.payment_failed` (marks PAYMENT DUE; Pro stays until Stripe gives up)

A failed Supabase write now returns 500, so Stripe retries for up to three
days instead of losing the sale. Netlify → Functions → stripe-webhook → Logs
shows one line per event: `granted annual to <user>`, `revoked sub_…`, or the
error.

## 7. Analytics + crash reporting (so the launch cohort is visible)

- **Plausible:** create the site `apptrainingmode.com` in Plausible. The tag
  is injected at build time (`scripts/copy-public-assets.mjs`) with that domain;
  nothing else to configure. Events: `session_complete`, `paywall_viewed`,
  `paywall_checkout_clicked`, `checkout_return_success`, `js_error`, and more.
- **Crash visibility:** every build reports the first three uncaught errors per
  page load as a Plausible `js_error` event (message, file, route, build id).
- **Sentry (optional, full stack traces):** create a free Sentry project →
  copy the DSN → Netlify env var `SENTRY_DSN` → redeploy. The SDK is only
  injected when the variable exists.

## 8. Go-live test, in order

1. Stripe **test mode**: create test versions of the three Payment Links, set
   the test webhook endpoint with the events above, `?paywall=preview` in the
   app, buy the monthly plan with card 4242 4242 4242 4242.
2. Profile → MANAGE SUBSCRIPTION shows `Monthly plan · $5.99/mo · Renews <date>`.
3. Cancel in the portal → the screen shows ENDING; wait for or simulate
   `customer.subscription.deleted` → FREE, and arcade stage 4 shows the paywall.
4. Switch the endpoint and links to live mode, flip `PAYWALL_ENABLED = true`,
   deploy.
