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

## 5. Test, then go live

1. Do a full run in Stripe **test mode** (test card `4242 4242 4242 4242`): sign
   in → open the paywall → pick a plan → pay → land back on the app → confirm
   the `entitlements` row shows `is_pro = true` and the account reads as Pro.
2. Flip the switch: in `components/training-mode/data/entitlements.js` set
   `PAYWALL_ENABLED = true`, commit, push. Free-tier limits (arcade stages 1–3,
   1 routine slot) then start applying to non-Pro users.

Tell Claude "flip the paywall on" once steps 1–4 are done and tested, and it'll
handle step 5's code change.
