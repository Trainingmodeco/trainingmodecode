# Stripe → entitlements webhook

Turns a completed Stripe payment into the buyer's `entitlements` row. It is the
only thing that can grant Pro: the app reads that row and RLS gives clients no
write path.

**Status: written, NOT deployed.** Nothing about the beta changes until every
step below is done — and even then the app stays fully unlocked for everyone
while `PAYWALL_ENABLED` is `false` in `components/training-mode/data/entitlements.js`.

## The chain

```
Stripe Payment Link  →  this webhook  →  public.entitlements  →  app unlocks Pro
(tags checkout with       (writes with     (client-readable,      (only when
 client_reference_id       service_role)    never client-        PAYWALL_ENABLED
 = Supabase user id)                        writable)             is true)
```

## Activating it, when you're ready

1. **Deploy**
   ```bash
   npx supabase functions deploy stripe-webhook --project-ref adtxjmqshckhmyziehpv
   ```
   `config.toml` already sets `verify_jwt = false` for this function (Stripe
   sends its own signature, not a Supabase JWT).

2. **Set the secrets** — Supabase dashboard → Edge Functions → Secrets. Paste
   them there, never into code, git, or chat:
   - `STRIPE_SECRET_KEY` — `sk_live_…`
   - `STRIPE_WEBHOOK_SECRET` — `whsec_…`, shown when you create the endpoint in step 3

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

3. **Point Stripe at it** — Stripe dashboard → Developers → Webhooks → Add
   endpoint:
   - URL: `https://adtxjmqshckhmyziehpv.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`

4. **Test with Stripe test mode first.** Use a test-mode key + endpoint, buy
   with card `4242 4242 4242 4242`, then confirm the row:
   ```sql
   select user_id, plan, is_pro, status, current_period_end from public.entitlements;
   ```
   Stripe's dashboard shows the delivery attempt and this function's response.

5. **Only then**, when you want money gates on for real users, flip
   `PAYWALL_ENABLED` to `true`. Until that flip, everyone — paying or not —
   keeps full access, which is what the beta wants.

## How plans are decided

From what Stripe actually charged, not hardcoded price ids, so rotating a
Payment Link or price never silently breaks Pro:

| Stripe                    | plan      | is_pro                                   |
|---------------------------|-----------|------------------------------------------|
| one-off payment           | `founder` | always (lifetime, no `current_period_end`)|
| recurring, yearly         | `annual`  | while status is active/trialing/past_due |
| recurring, monthly        | `monthly` | while status is active/trialing/past_due |
| subscription deleted      | `free`    | false (row kept, so a resubscribe re-links)|

## Safety properties

- The raw request body is verified against `STRIPE_WEBHOOK_SECRET` before
  anything is trusted; an unverified payload is rejected with 400.
- Identity comes only from `client_reference_id` (set by our own checkout URL)
  or from Stripe ids already recorded on the row — never from anything else in
  the payload.
- A payment with no attached account is logged and acknowledged, not guessed at.
- Transient failures return 500 so Stripe retries with backoff; upserts are
  idempotent, so retries are harmless.
