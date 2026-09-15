> ## PROMPT MONEY-90 — the 90-day monetization build
> ### (truth pass · coach channel · Founder 100 · referral loop · retention metrics)
>
> Run this in the Training Mode revamp app. It is the whole 90-day monetization
> plan expressed as code you can ship, plus the things only the owner can do in a
> dashboard, plus the policies that have to exist in writing before money changes
> hands.
>
> Nothing here invents a feature. Every file, key, line number and gate named
> below was verified against the working tree on 2026-09-14 (`git rev-parse
> --short HEAD` → `2011819`, branch `claude/fight-mode-improvements-se9gas`; the
> monetization paths under `components/training-mode/data`, `netlify/` and
> `supabase/` are byte-identical to `origin/app`). **Line numbers drift.** Treat
> every one below as a hint, not an address: re-read the file and match on the
> quoted symbol or string literal before you edit. Where a number was wrong in
> an earlier draft of this prompt it has been corrected and the correction is
> called out, so you do not re-introduce it from memory.
>
> ---
>
> ## 0. What we are trying to prove, and what it pays
>
> The target is 100–150 real users and a working payment path by day 90. Four
> plays get us there, and every engineering item below serves one of them:
>
> 1. **The coach channel (B2B2C).** One coach assigns the app to 10–40 athletes.
>    Five coaches is the entire user target. Coaches get free lifetime Pro and a
>    code their athletes enter once.
> 2. **The Founder 100.** The $59 lifetime link, publicly capped at 100 seats.
>    Sold one to one, by the owner, in DMs.
> 3. **The proof loop.** Daily share-card posts by the owner; weekly
>    challenge-link threads in combat-sports communities.
> 4. **The retention engine.** Week-2 retention decides whether growth is worth
>    buying at all. Day-3 and day-10 personal check-ins from the owner, plus the
>    in-app reminder card that already ships (`shared/ReminderCard.jsx`, mounted
>    once at `HomeDashboard.jsx:178`).
>
> ### The economics, with the downside included
>
> These are **estimates with no comparable behind them** — this cohort has never
> been asked to pay, so there is no observed conversion rate to cite. They are
> stated as a band so the plan is sized against the bad end, not the good one.
> Basis: users × conversion × $59 (the founder price; an annual-heavy mix pulls
> the total down, since annual is $34.99).
>
> | Scenario | Users | Conversion | Payers | Collected (90d) |
> |---|---|---|---|---|
> | Bad | 100 | 3% | 3 | ~$180 |
> | Low | 100 | 10% | 10 | ~$590 |
> | Mid | 150 | 10% | 15 | ~$885 |
> | Good | 150 | 15% | 22 | ~$1,300 |
>
> **Roughly $180 to $1,300 across the whole 90 days.** That is proof the payment
> path works and that somebody will pay. It is not a salary, and nothing you
> build should be sized as if it were. Every item below is scoped to days, not
> weeks, and to be deletable cheaply if the play it serves fails.
>
> The conversion figure is an assumption with an expiry date: §7's digest
> replaces it with the real number at day 60, and §8 says what to do when it does.
>
> **Ground rules.** No new training content. No new modes. No new gates beyond
> the three that already exist. No new runtime dependency. No paid subscription
> the plan cannot justify against the table above. And **nothing displayed to a
> user that is not true.**
>
> ---
>
> ## 1. FIRST — the truth pass. Nothing else ships before this.
>
> ### Why
>
> `Paywall.jsx:12-17` currently sells four benefits:
>
> ```js
> const BENEFITS = [
>   'All Arcade protocols & boss stages',
>   'Unlimited Workout Builder & routines',
>   'Every avatar tier + exclusive skins',
>   'Full voice coaching + game-link rewards',
> ];
> ```
>
> Only the first two map to a real gate. There is no avatar-tier gate, no skins
> data model anywhere in the repo, no voice-coaching gate and no game-link
> reward. `ManageSubscription.jsx:14-18` already tells the truth:
>
> ```js
> const PERKS = [
>   'All Arcade protocols & boss stages',
>   'Training Camp levels 4–12',
>   'Unlimited saved Builder routines',
> ];
> ```
>
> **The same untrue claim ships in two more places, and they are the two highest-
> traffic paywall entry points:**
> - `Profile.jsx:433` — `'Unlock all protocols, builder & skins'` (the PRO banner)
> - `Profile.jsx:649` — `sub: 'Unlock all protocols, builder & skins.'` (settings row)
>
> A grep scoped to `Paywall.jsx` alone passes green while the claim survives in
> production. Do not scope it that way.
>
> `GameLink.jsx:10-11` and `HowItWorksGuide.jsx:118` also say "skins", but both
> are explicitly framed as a future companion game ("IN THE WORKS", "Soon you'll
> link…"). Those stay — a stated roadmap is not a sold benefit. `Profile.jsx:651`
> promises "GAME LINK — Connect your fighter — **launches 2026**". With under
> four months left in 2026 that is either a commitment or it comes out; decide it
> now and either remove the date or keep it and mean it.
>
> ### Build
>
> **1a. Paywall copy.** Replace `BENEFITS` with the three enforced perks from
> `ManageSubscription.jsx:14-18`, in that order. If you want a fourth line, the
> only honest one today is `'Founder: lifetime, including everything we ship
> next'`, and it may appear **only on the founder plan card**, never in the
> shared benefits list.
>
> **1b. Profile copy.** `Profile.jsx:433` and `Profile.jsx:649` both become
> `'Unlock every Arcade stage, Camp level & Builder routine'`. Decide on
> `Profile.jsx:651`'s "launches 2026" and act on the decision.
>
> **1c. The `comp` plan.** The owner needs a way to grant Pro without faking a
> purchase — for coaches, for the beta cohort, and for referral rewards. New
> migration `supabase/migrations/<ts>_add_comp_plan.sql`:
>
> ```sql
> alter table public.entitlements
>   drop constraint if exists entitlements_plan_check;
> alter table public.entitlements
>   add constraint entitlements_plan_check
>   check (plan in ('free','monthly','annual','founder','comp'));
> ```
>
> The `if exists` is not decoration: the original check is declared inline and
> unnamed (`20260815211807_create_entitlements.sql:10-11`), so its name is
> inferred. Every migration in this repo is idempotent; keep it that way.
>
> `comp` is deliberately **not** `founder`. Comps must never touch the Founder 100
> counter in §3, and §3a's count is built so they cannot.
>
> **1d. ManageSubscription must render `comp` honestly.** This is the part an
> earlier draft asserted and did not implement, and the current code produces a
> three-way lie for a comped user. Verified today:
>
> - `ManageSubscription.jsx:57` — `const isFounder = ent?.plan === 'founder'`
> - `PLANS['comp']` is undefined, so `plan` is `null` and `planLine` falls through
>   to `'Free plan'` (`:64`) while the account is fully unlocked
> - `renewLine` (`:65-72`) reaches `isPro && 'Renews automatically.'` — a renewal
>   on something nobody bought
> - `:121` and `:126` both match `user && isPro && !isFounder`, so a comped user
>   is shown **MANAGE BILLING** and told to *"use the link in your Stripe receipt
>   email"* — a receipt that does not exist
>
> Add, next to `isFounder`:
>
> ```js
> const isComp = ent?.plan === 'comp';
> ```
>
> and branch **before** every `isFounder` check:
> - `planLine` → `'Complimentary Pro · on the house'`
> - `renewLine` → `'Nothing to renew, nothing to cancel. Thank you for testing.'`
> - `statusChip` → a distinct `COMP` chip, not `ACTIVE`
> - `:121` MANAGE BILLING → `user && isPro && !isFounder && !isComp && STRIPE_PORTAL_URL`
> - `:126` Stripe-receipt copy → same guard
>
> **1e. Protect comps from the subscription webhook.** `stripe-webhook.js:145`
> and `:166` guard only founder:
>
> ```js
> if (rows.every(r => r.plan === 'founder')) return 'ignored: founder is lifetime';
> ```
>
> A comped coach who later subscribes and cancels gets flipped to
> `plan='free', is_pro=false` and silently loses the comp. Change both to:
>
> ```js
> if (rows.every(r => r.plan === 'founder' || r.plan === 'comp')) return 'ignored: lifetime/comp';
> ```
>
> ### Verify
>
> - `grep -rn "skins\|avatar tier\|game-link" components/training-mode/` returns
>   hits **only** in `GameLink.jsx` and `HowItWorksGuide.jsx` (the two roadmap
>   surfaces). Anything in `Paywall.jsx` or `Profile.jsx` is a fail.
> - The three strings in `Paywall.jsx` BENEFITS and `ManageSubscription.jsx`
>   PERKS are identical.
> - **Run the comp test with `?paywall=preview` on.** Without it the test is
>   vacuous: `entitlements.js:80-81` returns `true` from `isPro()` for everyone
>   while `PAYWALL_ENABLED` is `false` (`:27`), so a comp row "unlocking the app"
>   proves nothing. With preview on:
>   - a `plan='free', is_pro=false` account is gated at all three walls;
>   - a `plan='comp', is_pro=true` account is unlocked, and the subscription
>     screen shows COMP, no renewal line, no MANAGE BILLING, no receipt copy.
> - **Expect a refresh lag.** `refreshEntitlement()` runs only on
>   `?checkout=success` (`App.jsx:400`), when `ManageSubscription` mounts
>   (`:45`), and on auth change inside `AccountCard` (`:50`, which lives on
>   Profile). There is no refresh on ordinary app boot, so a SQL-granted comp
>   does not reach an open client until the user opens Profile or Subscription.
>   That is acceptable; just know it, and say so in §9 so the owner does not
>   think a grant failed.
>
> ---
>
> ## 2. COACH MODE — a code, an attribution, a consent step, and an honest roster
>
> ### Why
>
> Nothing for this exists. A repo-wide grep for
> referral/coach/team/roster/affiliate/promo/coupon returns zero hits.
> `checkoutUrl()` (`data/stripe.js:18-25`) carries only `client_reference_id` and
> `prefilled_email`, so there is no channel to Stripe for a coach id even if one
> existed. The only thing a coach can hand an athlete today is a challenge code
> (`TMC1.`) whose sender field is a 24-character display name and nothing else.
>
> ### The roster decision: v1 has no coach-facing screen, and that is correct
>
> A roster view genuinely needs a server — localStorage is per-device, so an
> in-app roster could only ever show a coach their own phone. But at five coaches
> the roster is a weekly email the owner sends, sourced from one SQL query,
> because every signed-in athlete's `tm_coach_link` rides inside the
> `progress_snapshots.data` blob `cloudSync.js` already pushes. Zero new tables,
> zero new RLS, zero new endpoints. Build §2e only when the trigger fires.
>
> ### 2a. The code itself
>
> New file `components/training-mode/data/coachCode.js`:
>
> - `const KEY = 'tm_coach_link'`, value
>   `{ code, coachName, joinedAt, via, consentedAt }` where `via` is
>   `'url' | 'onboarding' | 'profile'`.
> - **Codes are typed by humans in a gym, not scanned. Do not base64 anything.**
>   One canonical pattern, used by the client *and* by the v2 DB check so they
>   can never disagree:
>   ```js
>   export const COACH_CODE_RE = /^[A-Z0-9]{3,12}-[A-Z0-9]{2,6}$/;
>   ```
>   e.g. `MARCUS-7K2`. `normalizeCoachCode(raw)` uppercases, strips everything
>   outside `[A-Z0-9-]`, collapses repeated dashes, caps at 24 chars.
> - v1 validates against a registry shipped in the bundle:
>   ```js
>   export const COACH_REGISTRY = {
>     // 'MARCUS-7K2': { name: 'Coach Marcus', gym: 'Southside BJJ' },
>   };
>   ```
>   State the tradeoff in the file header: adding a coach needs a deploy. At five
>   coaches that is correct — it buys zero server surface and zero code-guessing.
>   **Trigger for v2: more than eight active coaches, or a coach who must be
>   onboarded the same day.**
> - `getCoachLink()`, `setCoachLink(code, via)` — first write wins on `joinedAt`;
>   a later different code updates `code`/`coachName` but never rewrites
>   `joinedAt`. `clearCoachLink()` for the mistyped case.
> - Unknown code → `{ ok: false, reason: 'unknown' }`. Copy: *"That code isn't
>   active. Check it with your coach."* Never silently accept.
>
> `data/cloudSync.js` — add `'tm_coach_link'` to `SYNC_KEYS` (the array is at
> `:29-46`, in the `// identity + progression` block). That one line is what
> makes the whole roster query possible.
>
> ### 2b. Consent is not optional
>
> Applying a coach code discloses an athlete's training data to a third party.
> The URL door must **not** silently write the link on page load. Instead:
>
> 1. `?coach=` sets a **pending** link in memory and opens a one-screen sheet:
>    - `<COACH NAME> WANTS TO ADD YOU TO THEIR ROSTER`
>    - *"They'll see: your first name, how many sessions you've done, and when
>      you last trained. They will not see your weight, your profile, or anything
>      you write."* (Keep this list accurate against the §2d query — if you add a
>      column there, add it here.)
>    - `✓ JOIN THE ROSTER` / `NO THANKS`
> 2. Only on accept: `setCoachLink(code, 'url')` with `consentedAt`, toast
>    *"You're on <Coach Name>'s roster."*, `trackEvent('coach_code_applied')`.
> 3. Strip the param with the same `history.replaceState` pattern
>    `clearChallengeFromURL()` uses (`challengeCodes.js:97-106`).
>
> **Minors.** Combat-sports gyms routinely enrol under-16s. The coach onboarding
> note (§9) must state that codes are for athletes 16 and over, and the consent
> sheet carries one line: *"You must be 16 or older to join a coach's roster."*
> That is the minimum; if the owner wants under-16s in the product, that is a
> separate legal conversation and this plan does not cover it.
>
> ### 2c. Where the athlete enters it (three doors, no new funnel step)
>
> 1. **URL** — the flow in §2b. Coaches hand out
>    `https://apptrainingmode.com/?coach=MARCUS-7K2`.
> 2. **Onboarding** — `Onboarding.jsx` is seven steps (`const STEP = {` at `:38`,
>    `const TOTAL_STEPS = 7` at `:47`). **Do not add an eighth step.** This funnel
>    is the thing we are protecting. Put a collapsed optional row on the existing
>    `STEP.RECOMMEND` screen (`:408`): `HAVE A COACH CODE?` → expands to one input
>    + APPLY, which runs the same consent copy inline. Skipping costs nothing and
>    the dot count at `:209` does not change.
> 3. **Profile** — add a row to the settings list at `Profile.jsx:649` (same shape
>    as the existing rows): emoji `🧑‍🏫`, title `COACH CODE`, sub = the joined
>    coach's name when linked, `Add your coach's code.` otherwise. Tapping opens a
>    sheet with the input, **a plain statement of who currently sees the athlete's
>    data**, and a REMOVE button when linked. An athlete must always be able to
>    see and undo this.
>
> **The sign-in nudge.** An athlete who never signs in has no
> `progress_snapshots` row, so their work is invisible to the coach forever. After
> a successful `coach_code_applied`, show a one-time card: *"Sign in so <Coach>
> can see your work."* with the Google button, and fire
> `signin_started { source: 'coach_code' }` (§6).
>
> **And handle the ones who say no.** Store `tm_coach_link.pendingSignin = true`
> when a linked athlete is still signed out, and re-show the nudge once more after
> their **third** completed session — that is an athlete demonstrably using the
> app whose coach cannot see it. Fire `coach_signin_nudge_shown { attempt }` so
> §7 can report how big the silent-loss group is. Do not nudge a third time.
>
> Events: `coach_code_applied`, `coach_code_declined`, `coach_code_rejected
> { reason }`, `coach_code_prompt_shown { surface }`, `coach_signin_nudge_shown`.
>
> ### 2d. The roster — v1 is SQL the owner runs, not a screen you build
>
> Add a section to `SETUP-MONETIZATION.md`. **Reference it by title, not number:**
> that file already has duplicate numbering (two `## 5` headings, at lines 88 and
> 103, plus a `## 4b`), so "§9" would land after a broken sequence. Title the new
> section `## Coach roster (weekly)`.
>
> Every value inside `data` is a raw localStorage **string** (that is how
> `collectSnapshot()` writes it, `cloudSync.js:79-87`), so each one needs a cast —
> and a single malformed value would abort the whole query. Ship the safe cast
> first:
>
> ```sql
> create or replace function public.tm_jsonb(t text)
> returns jsonb language plpgsql immutable as $$
> begin
>   return t::jsonb;
> exception when others then
>   return null;
> end $$;
> ```
>
> ```sql
> with s as (
>   select ps.user_id,
>          public.tm_jsonb(ps.data->>'tm_coach_link')   ->> 'code' as coach_code,
>          public.tm_jsonb(ps.data->>'tm_user_profile') ->> 'name' as athlete,
>          public.tm_jsonb(ps.data->>'tm_user_stats')   ->  'sessions' as sessions,
>          ps.updated_at
>   from public.progress_snapshots ps
>   where ps.data ? 'tm_coach_link'
> )
> select coach_code,
>        athlete,
>        jsonb_array_length(coalesce(sessions,'[]'::jsonb)) as sessions_total,
>        (select count(*) from jsonb_array_elements(coalesce(sessions,'[]'::jsonb)) e
>           where e->>'completedAt' ~ '^\d{4}-\d{2}-\d{2}'
>             and (e->>'completedAt')::timestamptz > now() - interval '7 days')
>          as sessions_7d,
>        updated_at as last_sync
> from s
> where coach_code is not null
> order by coach_code, sessions_7d desc;
> ```
>
> Write into that doc, for the owner: athletes who never signed in do not appear —
> a real limitation, not a bug, and §7 reports how many there are.
>
> ### 2e. Coach v2 — only when the §2a trigger fires
>
> New migration `<ts>_create_coach_channel.sql`:
>
> ```sql
> create table public.coaches (
>   code           text primary key check (code ~ '^[A-Z0-9]{3,12}-[A-Z0-9]{2,6}$'),
>   owner_user_id  uuid references auth.users(id) on delete set null,
>   display_name   text not null,
>   active         boolean not null default true,
>   created_at     timestamptz not null default now()
> );
> alter table public.coaches enable row level security;
> create policy coaches_select_active on public.coaches
>   for select to anon, authenticated using (active);
>
> create table public.coach_athletes (
>   user_id     uuid primary key references auth.users(id) on delete cascade,
>   coach_code  text not null references public.coaches(code),
>   joined_at   timestamptz not null default now()
> );
> alter table public.coach_athletes enable row level security;
> create policy coach_athletes_insert_own on public.coach_athletes
>   for insert to authenticated with check ((select auth.uid()) = user_id);
> create policy coach_athletes_select_own on public.coach_athletes
>   for select to authenticated using ((select auth.uid()) = user_id);
> create policy coach_athletes_delete_own on public.coach_athletes
>   for delete to authenticated using ((select auth.uid()) = user_id);
> ```
>
> Note the DB check regex is now **the same pattern as `COACH_CODE_RE`**. A code
> the database accepts must be a code a human can type into the client.
>
> The coach never reads `coach_athletes` directly — they must not be able to
> select other people's rows. Give them one function:
>
> ```sql
> create or replace function public.coach_roster(p_code text)
> returns table (athlete text, sessions_total int, sessions_7d int, last_sync timestamptz)
> language sql security definer set search_path = '' stable as $$
>   select public.tm_jsonb(ps.data->>'tm_user_profile') ->> 'name',
>          jsonb_array_length(coalesce(public.tm_jsonb(ps.data->>'tm_user_stats')->'sessions','[]'::jsonb))::int,
>          (select count(*)::int from jsonb_array_elements(
>              coalesce(public.tm_jsonb(ps.data->>'tm_user_stats')->'sessions','[]'::jsonb)) e
>            where e->>'completedAt' ~ '^\d{4}-\d{2}-\d{2}'
>              and (e->>'completedAt')::timestamptz > now() - interval '7 days'),
>          ps.updated_at
>   from public.coach_athletes ca
>   join public.progress_snapshots ps on ps.user_id = ca.user_id
>   where ca.coach_code = p_code
>     and exists (select 1 from public.coaches c
>                  where c.code = p_code and c.owner_user_id = (select auth.uid()));
> $$;
> revoke all on function public.coach_roster(text) from public, anon;
> grant execute on function public.coach_roster(text) to authenticated;
> ```
>
> **The revoke is not boilerplate.** Migration
> `20260815211834_lock_down_trigger_functions.sql` exists in this repo precisely
> because Postgres grants EXECUTE to PUBLIC by default, and that had exposed a
> SECURITY DEFINER function as a REST RPC. Every function you add gets
> revoke-then-grant, or you have reopened that hole.
>
> **Coach lifecycle, written into the doc:** to rotate a code, insert the new one
> and set `active=false` on the old — linked athletes keep working (the join is on
> `coach_athletes.coach_code`, and inactive codes only stop *new* joins). To end a
> relationship, the owner deletes the `coach_athletes` rows; the athlete can do the
> same from the Profile REMOVE button. A coach who churns loses visibility the
> moment `owner_user_id` no longer matches, because `coach_roster` checks it on
> every call.
>
> ### Verify
>
> - `?coach=MARCUS-7K2` with that code in the registry: the consent sheet opens,
>   NO THANKS writes nothing, JOIN writes `tm_coach_link` with `consentedAt`, the
>   URL is clean after load, Profile shows the coach, a reload does not re-prompt.
> - Unknown code: rejection copy, nothing written, `coach_code_rejected` fires.
> - Sign in on a second browser, let cloud sync run, then run the §2d SQL: that
>   athlete appears under the right `coach_code` with the right `sessions_total`.
> - Corrupt one `tm_user_stats` value in a test row to a non-JSON string: the
>   query still returns every other athlete.
> - `grep -rn "CoachRoster" components/` returns nothing in v1. If you built a
>   coach screen, delete it.
>
> ---
>
> ## 3. THE FOUNDER 100 — a count sourced from payments, never invented
>
> ### Why
>
> `PLANS.founder` (`data/stripe.js:11`) is a plain hosted Payment Link with a
> static subline `'Lifetime · beta founders only'`. Nothing counts purchases;
> nothing can stop sales at 100; Stripe has no public count endpoint.
>
> **The ethical rule, absolute: if the real number cannot be fetched, the paywall
> shows NO number.** Not a cached guess, not a rounded-up number, not "almost
> gone", not a seeded starting count, not a countdown. A scarcity claim is a
> factual claim about the world. We make it only when we can source it.
>
> ### 3a. Count paid checkouts, not entitlement rows
>
> An earlier design counted `entitlements` rows with `plan='founder'`. That
> **under-reports real sales**, because `stripe-webhook.js:129` drops any checkout
> without a user id:
>
> ```js
> const userId = s.client_reference_id;
> if (!userId) { console.warn('[stripe-webhook] checkout without client_reference_id', s.id); return 'ignored: no user'; }
> ```
>
> A hosted Payment Link only carries `client_reference_id` when opened through
> `startCheckout()` (`data/stripe.js:30-35`). A link that was copied, bookmarked,
> screenshotted from a DM or forwarded between two athletes has no params. So the
> owner could sell 105 seats and the public counter read 98 — a false scarcity
> number, sourced from the database, displayed with confidence. That is exactly
> what this section forbids.
>
> Count from Stripe events instead. New migration `<ts>_founder_seats.sql`:
>
> ```sql
> create table public.founder_sales (
>   stripe_session_id text primary key,
>   user_id           uuid references auth.users(id) on delete set null,
>   amount_total      integer not null,
>   refunded          boolean not null default false,
>   created_at        timestamptz not null default now()
> );
> alter table public.founder_sales enable row level security;
> -- No policies. service_role (the webhook) only. The public reads the count
> -- through the function below, never the rows.
>
> create or replace function public.founder_seats_claimed()
> returns integer language sql security definer set search_path = '' stable as $$
>   select count(*)::int
>     from public.founder_sales
>    where refunded = false
>      and amount_total > 0;
> $$;
> revoke all on function public.founder_seats_claimed() from public;
> grant execute on function public.founder_seats_claimed() to anon, authenticated;
> ```
>
> `anon` is granted deliberately — the paywall shows the count before sign-in, and
> the only thing leaked is a number we are publishing anyway.
>
> `amount_total > 0` is a second line of defence: a 100%-off checkout would not
> consume a seat. (§4 removes the coupon path entirely, so this should never
> fire — belt and braces.)
>
> ### 3b. Webhook changes
>
> In `onCheckoutCompleted` (`stripe-webhook.js:127-142`), **record the sale before
> anything else, and record it even when the user is unknown**:
>
> ```js
> async function onCheckoutCompleted(s) {
>   if (s.mode === 'payment') {
>     await supabaseRest('founder_sales', {
>       method: 'POST',
>       prefer: 'resolution=ignore-duplicates',
>       body: { stripe_session_id: s.id, user_id: s.client_reference_id || null,
>               amount_total: s.amount_total || 0 },
>     });
>   }
>   const userId = s.client_reference_id;
>   if (!userId) {
>     console.error(`[stripe-webhook] ORPHAN CHECKOUT ${s.id} ${s.customer_details?.email || ''} — paid, no account`);
>     return 'orphan: paid with no user, needs manual grant';
>   }
>   …existing upsert…
> }
> ```
>
> An orphan checkout is **a customer who paid and got nothing.** `console.warn`
> in a Netlify log nobody reads is not good enough. The `console.error` plus the
> `founder_sales` row with `user_id = null` means §7's digest can surface it, and
> §9 tells the owner what to do about it.
>
> **Add refund and dispute handling** to the switch at `stripe-webhook.js:200-206`:
>
> ```js
> case 'charge.refunded':
> case 'charge.dispute.created': outcome = await onMoneyBack(obj); break;
> ```
>
> `onMoneyBack(charge)`: set `founder_sales.refunded = true` where
> `stripe_session_id` matches (look it up via `payment_intent`, or store the PI on
> the row and match on that), and patch the entitlement to
> `is_pro=false, plan='free', status='refunded'`. That frees the seat and revokes
> access in one event, and it is the only place in the system that can do both.
>
> ### 3c. The cap is honoured, not enforced by the client
>
> A hosted Payment Link stays live until the owner archives it in Stripe. The
> client guard in §3d is a courtesy, not a lock. So write the policy down and
> implement it:
>
> **Policy: every paid founder purchase is honoured, at the price paid, for
> life.** If seat 101 arrives, they get founder. We do not downgrade a paying
> customer to a comp to protect a marketing number. The count **displays clamped**
> at the cap (`Math.min(seats, FOUNDER_CAP)`) so the paywall can never read
> "103 OF 100 CLAIMED", and the owner archives the link. This is in §9 as an owner
> task and in `SETUP-MONETIZATION.md` as the stated policy.
>
> ### 3d. The client
>
> New file `components/training-mode/data/founderSeats.js`:
>
> - `export const FOUNDER_CAP = 100;` — cap and count live together, not in
>   `stripe.js`.
> - `fetchFounderSeats()` — `POST ${SUPABASE_URL}/rest/v1/rpc/founder_seats_claimed`
>   with `apikey` + `Authorization: Bearer <anon>`, reusing the exports at
>   `data/authClient.js:15-16`. Returns an integer or `null`. Never throws.
> - Cache in `localStorage.tm_founder_seats` = `{ n, at }`, TTL 10 minutes.
>   **Do not add this key to `SYNC_KEYS`** — it is a server-derived display value,
>   not progress.
> - `cachedFounderSeats()` returns `null` when the cache is missing **or older
>   than 24 hours**. A day-old scarcity number is a lie with a timestamp on it.
> - `export const FOUNDER_NEXT_PRICE = null;`
>
> `Paywall.jsx`:
> - On mount, alongside `trackEvent('paywall_viewed')` (`:24`), call
>   `fetchFounderSeats()` into state.
> - In the `PLAN_ORDER.map` at `:74`, for `id === 'founder'` only, and **only when
>   `seats != null`**, render under the price a 3px bar and the line
>   `{Math.min(seats, FOUNDER_CAP)} OF 100 CLAIMED` — gold `#fde047` fill on
>   `rgba(255,255,255,0.06)` track, Orbitron 800 / 7px to match the badge at `:79`.
>   When `seats == null`, render the existing `p.sub` and nothing else.
> - **Sold out** (`seats >= FOUNDER_CAP`): the card renders non-interactive
>   (opacity 0.45, no border glow), label `100 OF 100 CLAIMED · CLOSED`, selecting
>   it is a no-op. If `plan === 'founder'` when the count arrives, fall back to
>   `'annual'` **and say so** — render one line above the plan list: *"Founder is
>   sold out — showing Annual."* Never silently change what someone is about to
>   buy.
> - Guard `proceed()` (`:31`) so a founder checkout cannot start when sold out.
> - The price-rise line `Price rises to {FOUNDER_NEXT_PRICE} after 100` renders
>   **only** when the owner sets that constant to a real string. Default `null`
>   means the promise is not made — and §9 tells the owner not to promise a rise
>   in a DM unless the constant is set. (§0 says the price "rises when it fills";
>   that is the owner's *intent*, and the product deliberately declines to state
>   it until it is committed. Both are true; the product is the conservative one.)
>
> Events: `{ seats }` prop on `paywall_viewed` when known;
> `founder_sold_out_viewed` when the closed card renders.
>
> ### Verify
>
> - `curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/founder_seats_claimed" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"`
>   returns an integer for a signed-out caller.
> - Insert `plan='comp', is_pro=true`: the number does not move.
> - Stripe test mode, one $59 founder checkout **started from inside the app**:
>   the number moves by one, `founder_sales` has the row with a `user_id`.
> - Stripe test mode, one founder checkout opened **directly from the Payment Link
>   URL** with no params: the number still moves by one, `founder_sales.user_id` is
>   null, and the Netlify log carries an `ORPHAN CHECKOUT` line with the email.
> - Refund that test charge: `refunded=true`, the count drops, the entitlement
>   goes back to free.
> - Block the RPC (offline / bad key): the founder card shows its static subline
>   and **no count and no bar**. Screenshot this; it is the case that matters.
> - Force the count to 100: the card is closed, tapping does nothing, the fallback
>   line renders, and the CTA cannot start a founder checkout.
> - Force the count to 103: the card reads `100 OF 100 CLAIMED · CLOSED`.
>
> ---
>
> ## 4. THE REFERRAL LOOP — built on `TMC1.` and the share card
>
> ### Why
>
> The pieces are here and unwired: `data/challengeCodes.js` encodes a stage into a
> `TMC1.` URL-safe base64 token whose fifth field is the sender's display name;
> `shared/ChallengeShareModal.jsx` renders a live scannable QR of that URL via
> `shared/QRCode.jsx` → `data/qrCode.js`; `App.jsx:380-391` already consumes `?ch=`
> and fires `challenge_opened`. Missing: identity, a reward, one broken host — and
> a QR that is already silently failing.
>
> ### 4a. Fix the host first
>
> `data/links.js:1` is:
>
> ```js
> export const PUBLIC_SITE_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://trainingmode.co';
> ```
>
> `EXPO_PUBLIC_APP_URL` is not set in `netlify.toml` (its `[build.environment]`
> block has only `NODE_VERSION` and `NODE_OPTIONS`), and the app and Plausible
> both live on `apptrainingmode.com`. Do both: change the fallback to
> `'https://apptrainingmode.com'`, and have the owner set the env var (§9).
>
> `ShareActions.jsx` already imports `PUBLIC_SITE_URL` at `:4` and uses it at `:22`,
> but hardcodes `'https://trainingmode.co'` at `:86`. Replace the literal with the
> import it already has. **`EXPO_PUBLIC_*` values are inlined at build time**, so
> setting the dashboard variable changes nothing until a redeploy — fixing the
> fallback in code is what makes it right on the next deploy either way.
>
> ### 4b. The QR is already broken, and adding a field makes it worse
>
> `data/qrCode.js:1-5` caps at version 5 / EC-L / **108 data bytes** and
> `qrMatrix()` returns `null` on overflow; `shared/QRCode.jsx:9` then returns
> `null` — **no error, no fallback, the QR silently disappears.**
>
> Measured against this repo's real ids (longest series slug
> `martial-monster-protocol`, longest stage id `ARC_MARTIALMONSTER_STG10`, origin
> `https://apptrainingmode.com`):
>
> | Payload | Bytes | Fits 108? |
> |---|---|---|
> | today, 24-char name (the current `from` cap) | 141 | no |
> | today, 10-char name | 123 | no |
> | today, 6-char name | 117 | no |
> | + 8-char ref, 10-char name | 135 | no |
> | **compact stage number, 10-char name, 6-char ref** | **103** | **yes** |
>
> So this is not a regression the referral introduces — the QR is dead today for
> the longer campaigns and nobody noticed, because failure is invisible. Fix the
> encoding, then add the field.
>
> **Compact the payload** in `data/challengeCodes.js`:
>
> - `encodeChallenge()` (`:25-39`): emit the **stage number** instead of the full
>   stage id whenever the caller can supply one, cut the `from` cap from 24 to
>   **10**, and append a **6-char** `ref` as a sixth pipe field, cleaned with the
>   same `clean()`.
> - `decodeChallenge()` (`:41-64`): **keep the existing destructure names.** An
>   earlier draft proposed `[seriesId, stageId, m2, d2, from, ref]`, which would
>   shadow the resolved names and silently drop the legacy-id migration that
>   `resolveSeriesId` / `resolveStageId` (`:54-55`) exist to provide. Correct form:
>
>   ```js
>   const [rawSeriesId, rawStageId, m2, d2, from, ref] = parts;
>   …
>   const numeric = /^\d{1,2}$/.test(rawStageId);
>   return {
>     seriesId: resolveSeriesId(rawSeriesId),
>     stageId: numeric ? null : resolveStageId(rawStageId),
>     stageNumber: numeric ? Number(rawStageId) : null,
>     mode: MODE_FROM[m2] || 'fit',
>     difficulty: DIFF_FROM[d2] || 'normal',
>     from: from || null,
>     ref: ref || null,
>   };
>   ```
>
>   This is append-only and backward compatible in both directions: a
>   five-field code from a QR already in the wild decodes with `ref: null` and a
>   full `stageId`, exactly as before.
> - `resolveChallenge()` (`:67-74`) currently returns only
>   `{ series, stage, mode, difficulty, from }` — it **drops every other field**,
>   so `resolved.ref` would always be undefined. Add stage-number resolution and
>   pass the ref through:
>
>   ```js
>   const stage = decoded.stageNumber
>     ? (series.stages || [])[decoded.stageNumber - 1]
>     : (series.stages || []).find(s => s.id === decoded.stageId);
>   …
>   return { series, stage, mode: decoded.mode, difficulty: decoded.difficulty,
>            from: decoded.from, ref: decoded.ref };
>   ```
>
>   (`stages[]` carries `stageNumber` and is capped to 10 per saga in
>   `arcadeCampaignSeries.js`, so index and number agree.)
> - `challengeFromStage()` (`:115-118`) is **synchronous and takes no user**, so it
>   cannot call an async `getCurrentUser()`. It reads the cached
>   `localStorage.tm_my_ref` (§4c) and emits no ref when signed out.
>
> **Give the QR a visible fallback.** In `ChallengeShareModal`, when `QRCode`
> renders null, show the code and link with a line: *"Too long for a QR — send the
> link instead."* An empty box is worse than an explanation.
>
> ### 4c. Identity, with no new table
>
> New file `components/training-mode/data/referral.js`:
>
> - `myRefCode(user)` = `user.id.replace(/-/g,'').slice(0,6).toUpperCase()`.
>   Six hex characters off the Supabase uuid. Describe it accurately in the file
>   header: **this is a truncated prefix of the account id that we publish
>   deliberately** — not a hash, not opaque. That is the point: the owner can
>   resolve it in SQL with `where replace(user_id::text,'-','') ilike 'ABC123%'`,
>   which a hash would not allow. Collisions are possible at six chars; §7's
>   digest flags any prefix that matches more than one user and the owner resolves
>   those by hand. At 150 users that will essentially never fire.
> - `captureReferral({ code, via })` writes `localStorage.tm_referred_by` =
>   `{ code, at, via }`. **First write wins, forever.** Ignore a code equal to
>   `tm_my_ref`. Add `'tm_referred_by'` to `SYNC_KEYS`.
> - `referralUrl()` = `${PUBLIC_SITE_URL}/?r=${myRef}`.
>
> **Signed-out senders.** `myRefCode` needs a `user.id`, and `Onboarding.jsx` never
> asks for an email or offers sign-in — so most of the beta cohort has no code.
> Handle it explicitly rather than emitting bare links:
> - `App.jsx` caches `tm_my_ref` whenever auth resolves (see §6 for where that
>   hook has to be added, because App.jsx has no auth awareness today).
> - `buildShareText()` appends `referralUrl()` when `tm_my_ref` exists and the
>   plain `PUBLIC_SITE_URL` when it does not. Never a broken `?r=undefined`.
> - The Profile INVITE row (§4e) is **gated behind sign-in** and shows the same
>   one-time nudge card §2c designs when tapped while signed out.
> - §7 reports referral attribution against `signin_completed`, not installs, and
>   says so in the digest body.
>
> ### 4d. Capture, in its own effect
>
> `?r=` must **not** go inside the `?ch=` effect. That effect early-returns:
>
> ```js
> try { if (sessionStorage.getItem('tm_challenge_seen') === key) { clearChallengeFromURL(); return; } } catch { }
> ```
>
> (`App.jsx:386`). A `?r=` read placed after it is skipped on every reload and
> repeat visit, which would fail this section's own verify step. Add a **separate**
> `useEffect`, placed above the challenge effect:
>
> - Read `?r=` from the query, `captureReferral({ code, via: 'url' })`, strip the
>   param, fire `referral_captured { via }`.
> - Then, inside the existing challenge effect, when `resolved.ref` is present and
>   nothing is stored yet, `captureReferral({ code: resolved.ref, via: 'challenge' })`.
> - **Precedence:** first write wins, so an explicit `?r=` in the same URL as a
>   `?ch=` wins only because it runs first. That is the correct order — the athlete
>   clicked *that* person's link.
>
> ### 4e. Both sides get something real
>
> **Receiver (automatic, in-app).** On the first completed session where
> `tm_referred_by` exists and the bonus has not been granted: **+100 XP welcome
> bonus.** Add `addReferralBonus()` to `data/userStats.js`, modelled on
> `addComboBonus()` (`userStats.js:205-212`) — it adds XP and pushes **no session
> row**, deliberately, so a bonus never touches the streak, the weekly count or
> the fit/fight split. Toast: *"Welcome bonus: +100 XP — invited by <CODE>"*. Fire
> `referral_bonus_granted`.
>
> **Store the granted flag inside `tm_user_stats`, not on `tm_referred_by`.**
> `cloudSync` does whole-snapshot last-writer-wins with a `tm_sync_backup` stash,
> so a restore can roll a sibling key back independently and re-grant the bonus.
> Putting `referralBonusGranted: true` in the same object the XP lands in makes
> the flag and the payout atomic under every restore path.
>
> (Note while you are in `userStats.js`: `addComboBonus` takes one argument, but
> `comboStreak.js:101` calls it as `addComboBonus(MILESTONE_XP, 'Combo ×N')` and
> the label is silently discarded. Give `addReferralBonus(xp, label)` a real second
> parameter rather than copying that bug.)
>
> **Sender (manual, and say so).** The app cannot see other people's devices, so
> **do not build a recruit counter.** A number the client cannot verify is a
> number the client will get wrong, and a wrong recruit count is worse than none.
>
> Add to `Profile.jsx`'s settings list (next to COACH CODE) an `INVITE A TRAINING
> PARTNER` row opening a sheet with: the athlete's link, a COPY button
> (`invite_link_copied { surface }`), the live QR component, and the offer —
> **stated with every term the owner can actually honour**:
>
> > **Three confirmed recruits = founder lifetime, on us.**
> > Confirmed = they sign in and complete a session. Confirmed weekly, by hand.
> > Runs until `<DATE>` or the Founder 100 fills, whichever is first.
>
> `<DATE>` is a constant in `referral.js` the owner sets; the row does not render
> the offer at all until it is set. The reward is paid as a **`plan='comp'`,
> `status='referral_reward'` row** — never as a Stripe coupon, and never as a
> founder seat.
>
> **Why the coupon path is banned outright:** `stripe-webhook.js:26-30` keys the
> plan off **mode only** —
>
> ```js
> function planForAmount(amountTotal, mode) {
>   if (mode === 'payment') return 'founder';
>   …
> }
> ```
>
> A 100%-off founder checkout is still `mode='payment'` with `amount_total = 0`,
> so it would write `plan='founder', is_pro=true` and — under any
> entitlements-based count — inflate the public scarcity number with a
> non-payment. §3a's `amount_total > 0` filter defends against it, but the clean
> answer is not to create the coupon. Rewards are comps.
>
> **Abuse.** The only cheap client check (`ignore your own code`) is defeated by a
> second Google account in thirty seconds. Defend it where it is actually paid
> out: §7's digest flags referred accounts that signed up within minutes of each
> other, share a referrer with more than five recruits in a week, or have zero
> sessions. The owner confirms by hand before granting. At this scale, a human
> reading a short list is a better fraud system than anything you can build in a
> week.
>
> ### 4f. Make sharing measurable while you are in there
>
> - `data/shareUtils.js:65` fires capital-S `'Share'` while `:42` and
>   `ShareCardSheet.jsx:54,73` fire `'share'`. Plausible counts those as two
>   separate goals. Change `:65` to `trackEvent('share', { type: 'rank_up' })`.
> - `buildShareText()` (`shareUtils.js:20-38`) ends with
>   `Start your training arc at ${APP_URL}` (`:34`). Change to `referralUrl()`,
>   with the signed-out fallback from §4c.
> - `ShareActions.jsx` fires **no analytics at all** across its six buttons. Add
>   `trackEvent('share', { kind })` to all five handlers — `handleShare` at `:88`
>   (the primary button, and the one an earlier draft's line range omitted),
>   `handleText` `:117`, `handleEmail` `:128`, `handleCopyLink` `:140`,
>   `handleSaveImage` `:145` — with `kind` in `image|text|email|link|save`.
> - **Do not touch the baked QR in the share-card artwork.** `data/shareCard.js:12-18`
>   says it plainly: the QR is painted into
>   `/social/training_mode_share_story_1.webp` and the post template. It is one
>   static QR for everybody and it cannot carry a referral. Leave it, and never
>   describe it as personalised. The referral travels in the post text and in the
>   challenge link.
>
> ### 4g. A capacity check that actually runs
>
> There is **no test runner** in this repo: `package.json` has no `test` script
> and no jest/vitest/mocha is installed. (`stripe-webhook.js:219` exports
> `_internal` "for tests" that do not exist.) So an instruction to "add a test"
> has nowhere to land. Instead, add a plain node script wired into the existing
> build preflight:
>
> `scripts/check-challenge-codes.mjs`:
> 1. Assert a hardcoded five-field `TMC1.` fixture still decodes to the right
>    series, stage, mode, difficulty and `ref: null`.
> 2. Assert a six-field code round-trips with the ref intact.
> 3. For **every** series × stage 10 × a 10-char name × a 6-char ref, assert
>    `qrMatrix(challengeURL(code)) !== null`. This is the regression that ships
>    invisibly otherwise.
>
> Wire it into `build:web` next to `check-public-assets.mjs` and `lock-assets.mjs`,
> and add a `"check:codes"` script so it can be run alone.
>
> ### Verify
>
> - `node scripts/check-challenge-codes.mjs` passes, and fails if you restore the
>   24-char `from` cap.
> - Old five-field `TMC1.` code still decodes, still deep-links, still resolves a
>   legacy series id.
> - New code decodes with a ref; opening it on a clean profile writes
>   `tm_referred_by` once, and a second open does not overwrite it.
> - `?r=ABC123` alone captures, strips the param, **and survives a reload** (this
>   is the test that catches the early-return placement bug).
> - Your own code is ignored.
> - Complete a session as the referred user: +100 XP, no new row in
>   `tm_user_stats.sessions`, streak unchanged, flag set. A second session grants
>   nothing.
> - **Multi-device:** grant on device A, let it sync, restore on device B, complete
>   a session — no second grant.
> - Signed out: the share text carries a bare link with no `?r=`, and the INVITE
>   row prompts sign-in.
> - `grep -rn "trainingmode\.co" components/` returns only the privacy/link-error
>   copy, never a share target.
> - `grep -rn "trackEvent('Share'" components/` returns nothing.
>
> ---
>
> ## 5. PAYWALL PLACEMENT — where the wall falls, and the refactor that makes it work
>
> ### Where it falls today
>
> Exactly three gates, all reading `paywallActive()` (`entitlements.js:59-61`), all
> currently inert because `PAYWALL_ENABLED = false` (`:27`):
>
> | Gate | Call site | Fires when |
> |---|---|---|
> | Arcade stage 4+ | `ArcadeSeriesDetail.jsx:214` → `:253` | START on a gated stage |
> | Training Camp level 4+ | `TrainingCampMap.jsx:209` → `:220` | START, before readiness/gear |
> | 2nd saved Builder routine | `FitBuilderWorkout.jsx:361-372` | SAVE of a new routine |
>
> ### Assessment
>
> - **Arcade stage 4 — right moment, keep it.** The athlete has cleared three
>   stages. They have evidence the product works on their own body before being
>   asked for money. Best wall in the app.
> - **Camp level 4 — right moment, keep it.** Same logic, slower to reach.
> - **Builder 2nd routine — right wall, wrong moment, and it destroys work.**
>   Verified at `FitBuilderWorkout.jsx:367-372`: on hitting the limit it runs
>   `setSaveOpen(false); setRoutineName(''); onPaywall();` — so the punishment for
>   hitting the wall is losing the name you just typed, and landing on a sales
>   screen.
>
> ### The one refactor that fixes three problems: make the paywall an overlay
>
> An earlier draft proposed "store `{ screen, params }` and restore on close".
> **There is no params object.** `App.jsx:153` is a single
> `const [screen, setScreen] = useState('start')` alongside roughly fifteen
> parallel state variables (`disc`, `cfg`, `comboCfg`, `fitCfg`, `qmCfg`,
> `ccMission`, `arcadeSeries`, `arcadeStage`, `arcadeMode`, `arcadeOrder`,
> `arcadeSettings`, `campCtx`, `cardioContext`, …) that `resumeSession` has to
> restore by hand. And the thing the user wants back is not screen-level anyway:
> `TrainingCampMap.jsx:220` does `onPaywall?.(); setOpenLevel(null);` — it throws
> its own sheet away before navigating — and `ArcadeSeriesDetail` holds the open
> stage in local state. Restoring `screen` lands you on a bare ladder.
>
> Worse, `goPaywall` is a bare `setScreen('paywall')` (`App.jsx:568`) and
> `ScreenRouter.jsx:643-644` renders `<Paywall onClose={goProfile}/>`. So opening
> the paywall **unmounts the gated component entirely**, destroying
> `FitBuilderWorkout`'s `exercises`, `cfg`, `routineName` and `saveOpen`. The
> existing resume plumbing does not save you either: `onStateChange`
> (`FitBuilderWorkout.jsx:731-732`) persists only `{ completed, skipped }`, and
> `goPaywall` never calls `pauseCurrentSession()`.
>
> **So: render the paywall as an overlay above the current screen, not as a
> screen.** App.jsx already hosts app-level overlays (`ChallengeInboundModal` is
> mounted there around `:929`). Add:
>
> ```js
> const [paywallCtx, setPaywallCtx] = useState(null);   // { source } | null
> …
> goPaywall: (source) => setPaywallCtx({ source }),
> …
> {paywallCtx && (
>   <div style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
>     <Paywall source={paywallCtx.source} onClose={() => setPaywallCtx(null)} />
>   </div>
> )}
> ```
>
> Keep the `'paywall'` screen route only long enough to remove its references
> (`ScreenRouter.jsx:255, 557, 632, 653, 672` pass `onPaywall={goPaywall}`; those
> keep working unchanged, they just get a `source` argument).
>
> This single change fixes:
> 1. **Return to content** — closing lands exactly where you were, on all five
>    entry points, with no restore logic at all.
> 2. **The Builder draft** — nothing unmounts, so `exercises` and `routineName`
>    survive by construction.
> 3. **Source attribution** — `source` is now a real prop on `paywall_viewed`.
>
> ### The Builder sheet
>
> On hitting `routineSlotLimit()`, open a `RoutineLimitSheet` with two choices:
>
> - **REPLACE "<existing routine name>"** — with a **second tap to confirm**. A
>   free-tier athlete has exactly one saved routine; one mistap must not destroy
>   it. Note this is surfacing behaviour that already exists (`isReplace` at
>   `:366` already allows same-name overwrite), not adding a new destructive path.
> - **GO PRO** — opens the paywall overlay. The draft and the typed name stay.
>
> The separate hard cap `MAX_ROUTINES = 10` (`data/savedRoutines.js:4`) applies to
> Pro too and already has its own honest message (`:376`); leave it.
>
> ### Sign-in resume
>
> `Paywall.jsx:31-36` calls `signInWithGoogle()` and the comment concedes the user
> must re-open the paywall by hand. `redirectTo` is hardcoded to
> `window.location.origin` (`authClient.js:58`), so the app returns to `/` with no
> state.
>
> Write `localStorage.tm_paywall_intent = { plan, source, at }` **only in the
> `!user` branch** at `:32` — an earlier draft's condition ("on boot, if an intent
> is fresh and `getCurrentUser()` resolves") would fire on *every* boot for an
> already-signed-in user, because `getCurrentUser()` (`authClient.js:66`) reads the
> persisted session with no network call. The condition must test *"just came back
> from OAuth"*, not *"is signed in"*.
>
> On boot, open the paywall with that plan preselected when **all** of:
> - an intent exists and is under **30 minutes** old (10 is too short for someone
>   who has to create or switch a Google account mid-flow);
> - `getCurrentUser()` resolves;
> - **and** this boot is the one that flipped `tm_signed_in_once` from absent to
>   present, or the URL carried OAuth params (`detectSessionInUrl` is on).
>
> Then delete the intent. That is the difference between a converted buyer and a
> lost one.
>
> ### Grandfathering — decided, not deferred
>
> Everyone in the beta has used a fully unlocked app. Flipping `PAYWALL_ENABLED`
> takes features away from the exact 100–150 people whose retention we are
> measuring.
>
> **Decision: the beta comp is permanent, not 30 days.** An earlier draft promised
> "Pro is on us for 30 days" with nothing in the system capable of ending it —
> `isPro()` (`entitlements.js:80-86`) and `hasProEntitlement()` (`:118-123`) read
> `is_pro` only; nothing anywhere compares `current_period_end` to now; the webhook
> only touches rows it can find by Stripe id, and comp rows have none. A 30-day
> promise would have been false on day 31, and enforcing it would need an expiry
> job this plan otherwise does not have.
>
> So: grant `plan='comp', is_pro=true, status='beta_grace'` with
> **`current_period_end = null`** (§9 has the SQL), and show those users a one-time
> card:
>
> > **You were here first.** Pro is yours, on us — for good. If you want to back
> > the build, founder lifetime is $59 and there are 100 seats.
>
> **The cost of this decision, stated:** those users are permanently outside the
> paid-conversion denominator. §7's digest must therefore report conversion
> against *non-comped* accounts only, and label the comped cohort separately. It
> does **not** affect retention measurement, which is computed from sessions, not
> payments — so play 4 is unharmed.
>
> ### Verify
>
> - With `?paywall=preview` on a free account: each of the three gates fires
>   exactly one gate event (§6) and `paywall_viewed` carries the matching source.
> - Close the paywall from each gate: you are back on the stage sheet / level
>   sheet / builder — with the sheet still open, not just the screen behind it.
> - Builder: hit the limit, REPLACE → confirm → saves under the existing name.
>   Cancel the confirm → nothing lost. GO PRO → close → the draft and the typed
>   name are still there.
> - Sign-in resume: tap SIGN IN TO CONTINUE with `founder` selected, complete
>   Google, land back on the paywall with `founder` selected. Then reload while
>   already signed in — the paywall must **not** reopen. Then wait 31 minutes and
>   confirm the intent expired.
>
> ---
>
> ## 6. THE FIVE METRICS — and the honest limits of the tooling
>
> `data/analytics.js` is ten lines and forwards to `window.plausible`; the tag is
> injected at build time with `data-domain="apptrainingmode.com"` by
> `scripts/copy-public-assets.mjs:164-172`, behind a queue shim so pre-load events
> replay. Keep `trackEvent` as the single entry point — no direct
> `window.plausible` calls anywhere.
>
> ### Two constraints that shape everything below
>
> **1. Plausible is cookieless.** It cannot give you per-user anything. Two of the
> five metrics are therefore SQL, not Plausible, and pretending otherwise produces
> confident wrong numbers.
>
> **2. Custom properties and the Stats API sit above Plausible's entry tier.** An
> earlier draft specified `paywall_gate_hit { gate }` and `paywall_viewed { source }`
> and had §7 query the Stats API — while §10 forbade "growth tooling
> subscriptions". That plan required the subscription it banned.
>
> **Resolution, costing nothing: where a property matters, use a distinct event
> name.** Goals are free on every Plausible tier; props are not. Keep the props
> attached as well — they are ignored on the free tier and available immediately
> if the owner ever upgrades — but never *depend* on them.
>
> | Instead of | Fire |
> |---|---|
> | `paywall_gate_hit { gate: 'arcade_stage' }` | `paywall_gate_arcade` |
> | `paywall_gate_hit { gate: 'camp_level' }` | `paywall_gate_camp` |
> | `paywall_gate_hit { gate: 'builder_slot' }` | `paywall_gate_builder` |
> | `paywall_viewed { source: 'profile' }` | `paywall_view_profile` |
> | `paywall_viewed { source: 'subscription' }` | `paywall_view_subscription` |
>
> `paywall_viewed` stays a single name for the total. Gate-originated sources need
> no separate view event, because the matching gate event fires immediately
> before it.
>
> If the owner *does* want props and the Stats API, that is a real paid line item
> against the $180–$1,300 in §0 — check Plausible's current pricing, put the number
> in §0's table, and carve it out of §10 explicitly. Do not assume it silently.
>
> ### The five
>
> | # | Metric | Produced by | Status |
> |---|---|---|---|
> | 1 | **Installs** | Plausible unique visitors = reach; `app_installed` / `pwa_launch` = real installs | **ADD** |
> | 2 | **Sign-ins** | `signin_completed` count; new vs returning from a distinct event name | **ADD** |
> | 3 | **Sessions per user** | SQL over `progress_snapshots` (§7). Plausible gives the total only | `session_complete` EXISTS |
> | 4 | **Wall → checkout** | `paywall_gate_*` → `paywall_viewed` → `paywall_checkout_clicked` → `purchase_completed` | partly EXISTS |
> | 5 | **Week-2 return** | `return_d14` for a live read; exact cohorts from SQL | **ADD** |
>
> **Correction to carry forward:** `session_complete` has **9 call sites**, not 16.
> Verified: `App.jsx:452, 553, 617, 651, 681, 699, 716, 735, 763`, carrying seven
> `mode` values (`quickMission`, `combatConditioning`, `arcade`, `trainingCamp`,
> `fightFocus`, `comboCoach`, `fitMode`). Sixteen is the total `trackEvent(` count
> in that file. The number matters because §4e hangs the referral bonus off session
> completion.
>
> ### What to add
>
> **6a. `data/lifecycleEvents.js`** (new):
> - `tm_first_open` (ISO, written once on first ever load). **Not** in `SYNC_KEYS`
>   — it is a device fact, and syncing it would backdate a new device's cohort.
> - `tm_lifecycle_fired` — a map of event names already fired, so a
>   once-per-lifetime event is once per lifetime. Plausible has no dedupe.
> - On every boot, compute whole days since `tm_first_open` and fire the highest
>   unfired bucket among `return_d1`, `return_d3`, `return_d7`, `return_d14`.
> - `window.addEventListener('appinstalled', …)` → `app_installed`. Also fire
>   `pwa_launch` once per calendar day when
>   `matchMedia('(display-mode: standalone)').matches` — the honest proxy for iOS,
>   which does not emit `appinstalled`.
> - Called once from `App.jsx` boot, alongside the `?r=`, `?ch=` and
>   `?checkout=success` effects.
>
> **6b. Auth events — and the dependency nobody mentioned.**
> **`App.jsx` has no auth awareness at all.** It does not import
> `data/authClient`; `onAuthChange` is used only in `ManageSubscription.jsx:50`,
> `Paywall.jsx:27` and `AccountCard.jsx:53`. So "fire `signin_completed` in the
> `onAuthChange` handler in App.jsx" is not an edit — it is a new dependency, and
> the same gap blocks §4c's `tm_my_ref` cache and §5's sign-in resume.
>
> Two options; pick one and do it once:
> - **(a)** Add `import { getCurrentUser, onAuthChange } from './data/authClient'`
>   to `App.jsx` and one boot effect that subscribes, caches `tm_my_ref`, checks
>   the paywall intent and fires `signin_completed`. Cleanest, since three features
>   need it.
> - **(b)** Put `signin_completed` and the `tm_my_ref` cache in `AccountCard.jsx`
>   (`:50`), which already runs on every auth change and already calls
>   `refreshEntitlement()`. Cheaper, but only fires when Profile is open — which
>   makes it a bad home for the resume check.
>
> Take (a). Fire `signin_started { source }` at every `signInWithGoogle()` call
> site (`Paywall.jsx:34`, the account card, the coach nudge), and
> `signin_completed` plus a distinct `signin_first_time` on the boot where
> `tm_signed_in_once` flips.
>
> **6c. `purchase_completed` from the server.** `checkout_return_success`
> (`App.jsx:401`) only fires if the browser returns with `?checkout=success` — it
> misses anyone who closes the Stripe tab, which is most people on a phone. In
> `onCheckoutCompleted` (`stripe-webhook.js:127-142`), after the entitlement upsert
> succeeds, POST to `https://plausible.io/api/event` with
> `{ name: 'purchase_completed', url: 'https://apptrainingmode.com/', domain: 'apptrainingmode.com', props: { plan } }`
> and a `User-Agent` header (Plausible drops events without one).
>
> Three honest notes, in comments:
> - Wrap in try/catch and **never** let an analytics failure change the webhook's
>   status code. A Supabase failure returns 500 so Stripe retries; a Plausible
>   failure logs and returns 200.
> - There is no customer IP available here, so without `X-Forwarded-For` every
>   purchase is attributed to the Netlify egress IP. They will cluster as one or
>   two "visitors" from one region.
> - Therefore **§7 computes the paywall→purchase rate from event counts only,
>   never from Plausible's visitor count.** Say that in the digest body too.
>
> ### Verify
>
> - `grep -rn "window.plausible" components/` returns only `data/analytics.js`.
> - Fresh profile → `app_installed` (or `pwa_launch`) fires once; ten reloads do
>   not re-fire it.
> - Set `tm_first_open` back 15 days, reload: `return_d14` fires once only.
> - One full gated flow with `?paywall=preview`: `paywall_gate_arcade`,
>   `paywall_viewed`, `paywall_checkout_clicked`, and after a Stripe test-mode
>   purchase, `purchase_completed` in Plausible realtime.
> - `node --check netlify/functions/stripe-webhook.js`; replay a webhook with
>   Plausible unreachable: still 200, entitlement still granted.
> - `grep -rho "trackEvent('[a-zA-Z_]*'" components/ | sort -u` — every name in
>   that list has a goal in §9.
>
> ---
>
> ## 7. THE WEEKLY DIGEST — two functions, because Netlify requires it
>
> ### Why two
>
> **Netlify scheduled functions cannot be invoked over HTTP in production.** The
> URL does not serve them; URL invocation works only under `netlify dev`. An
> earlier draft specified a single scheduled function the owner opens on Monday,
> with a `?key=` gate and a scheduled-run exemption keyed on
> `event.headers['x-nf-event'] === 'schedule'`. Neither works: the URL is dead,
> and `x-nf-event` is not how Netlify signals a scheduled invocation (scheduled
> runs arrive as a POST carrying a `{ next_run }` body). Worse, an inbound header
> on a public function URL is attacker-controlled, so that exemption would have
> served the whole digest — athlete names, coach rosters, revenue, referral
> mappings — to `curl -H 'x-nf-event: schedule'`.
>
> So: one shared builder module, two thin functions.
>
> ### Structure
>
> ```
> netlify/functions/lib/buildDigest.js      // pure-ish: fetch → compute → markdown
> netlify/functions/weekly-digest-run.js    // scheduled; no HTTP path; writes the row
> netlify/functions/weekly-digest.js        // on-demand; key-gated; renders the stored row
> ```
>
> All CommonJS, zero npm deps, same style as `stripe-webhook.js` (plain `fetch`,
> checked responses; copy the `supabaseRest` helper at `:76-91`).
>
> **Schedule** in `netlify.toml` — TOML form, so no `@netlify/functions`
> dependency:
>
> ```toml
> [functions."weekly-digest-run"]
>   schedule = "0 14 * * 1"
> ```
>
> **Access control on `weekly-digest`:** `DIGEST_KEY` is required
> **unconditionally**, with no header exemption and a constant-time compare
> (`crypto.timingSafeEqual`). Accept it as an `x-digest-key` **header** as well as
> `?key=`, and tell the owner in §9 to use the header — a query string lands in
> browser history, Netlify access logs and any Referer the page emits, and this
> response carries names and revenue. Wrong or missing key → **404**, not 401; do
> not advertise the endpoint.
>
> The owner can also run the scheduled one on demand from Netlify's dashboard
> ("Run now" on the function). Put that in §9 — it is how they refresh between
> Mondays.
>
> ### Sources
>
> **1. Supabase, with service role.** Two reads, paginated properly:
> `progress_snapshots?select=user_id,updated_at,data` and
> `entitlements?select=user_id,plan,is_pro,status,created_at`, plus
> `founder_sales?select=*`.
>
> **Paginate with `Range` and read `Content-Range`.** An earlier draft said "bail
> out if the row count exceeds 1000" — that check can never fire, because
> PostgREST enforces a server-side max-rows cap and returns a **truncated page with
> no error**, so `rows.length > 1000` is always false and every metric would be
> computed over a silent slice. Correct form:
>
> ```js
> const res = await fetch(url, { headers: { ...auth, Range: `${from}-${from + 999}` } });
> const total = Number((res.headers.get('content-range') || '').split('/')[1] || 0);
> ```
>
> Loop until `from >= total`. Bail on **`total`**, not on page length, if it ever
> exceeds 5000 — and leave a TODO to move the aggregation into a service-role-only
> RPC.
>
> **2. Supabase Admin API** for emails on the check-in list:
> `GET ${SUPABASE_URL}/auth/v1/admin/users` with the service-role key. (The `auth`
> schema is not exposed through PostgREST, so this is the only route.)
>
> **3. Plausible — optional enrichment, never a hard dependency.** If
> `PLAUSIBLE_API_KEY` is set, fetch the goal counts for the last 7 days and the 7
> before. If it is not set (the free-tier case), the digest prints a clearly
> marked block:
>
> > **FROM PLAUSIBLE — 4 numbers to paste:** installs, sign-ins, paywall views,
> > checkout clicks → `<deep link to the pre-filtered Plausible page>`
>
> That keeps the digest useful on day one with no subscription, and upgrades
> silently if the owner ever buys one.
>
> ### Computes
>
> Remember every value inside `data` is a raw JSON **string**, so
> `JSON.parse(data.tm_user_stats)` with a try/catch per row.
>
> - **Accounts** total / new this week; athletes with ≥1 session in the last 7 days.
> - **Sessions per active athlete** — mean **and median**. Report both; the mean is
>   dragged by the owner's own account.
> - **Activation** — share of accounts whose `tm_user_stats.sessions` is non-empty.
> - **Week-2 return** — per weekly cohort keyed on the earliest `completedAt`, the
>   share with any session dated day 8–14. Print the caveat in the body:
>   `completedAt` is a client clock (`new Date()` on the device), so it is
>   directional, not forensic.
> - **Conversion** — payers ÷ **non-comped** accounts. The comped beta cohort and
>   coach comps are listed on their own line and excluded from the denominator
>   (§5). Compute the rate from **event counts**, never Plausible visitors (§6c).
> - **Founder seats** — `founder_seats_claimed()` out of 100, comps listed
>   separately, **and any `founder_sales` row with `user_id IS NULL`** flagged
>   loudly as `ORPHAN — paid, no account, grant by hand`.
> - **Coach roster** — the §2d grouping, per code, plus a count of athletes who
>   applied a code but never signed in (from `coach_signin_nudge_shown`, or as an
>   explicit "unknown — not measurable server-side" line if that event is absent).
> - **Referrals** — every `tm_referred_by.code`, resolved against
>   `replace(user_id::text,'-','')` prefixes, with each referred athlete's session
>   count. Flag: any prefix matching more than one user; any referrer with >5
>   recruits in a week; any referred account with zero sessions; any cluster of
>   sign-ups within the same few minutes. This is the list the owner confirms the
>   three-recruit reward from.
> - **CHECK-INS DUE THIS WEEK** — the section that makes play 4 executable, and the
>   one an earlier draft left out entirely. Two lists, name + email + session
>   count:
>   - accounts whose earliest session was **2–4 days ago** (the day-3 message),
>   - accounts whose earliest session was **9–11 days ago** (the day-10 message).
>
>   Without this the owner is told to "send day-3 and day-10 check-ins by hand"
>   with no way to know who that is — the highest-leverage play with the least
>   tooling. **Before this ships, confirm the privacy policy covers emailing
>   athletes about their training** (§9).
>
> ### Output
>
> Markdown, written into a new table and rendered by the on-demand function:
>
> ```sql
> create table public.digests (
>   week_start date primary key,
>   body       text not null,
>   created_at timestamptz not null default now()
> );
> alter table public.digests enable row level security;
> -- No policies: service_role only.
> ```
>
> Write with `Prefer: resolution=merge-duplicates` so a second run the same week
> **upserts** rather than erroring. Stored rows exist so next week can print
> week-over-week deltas.
>
> Email only if `RESEND_API_KEY` is set; otherwise skip silently. Do not add an
> email dependency to make this work.
>
> Lead with the five metrics from §6 in order, each with its delta; then founder /
> coach / referral / check-ins; then **"What this says"** with the decision lines:
>
> - Week-2 return below ~20% → fix retention before buying any growth.
> - `paywall_viewed → paywall_checkout_clicked` below ~10% → the offer or the
>   moment is wrong, not the traffic.
> - **Fewer than 5 payers by day 60** → the offer is wrong. Stop building
>   monetization surface, write the finding down, and go back to retention.
>   (These three thresholds are judgement calls, not benchmarks — they are stated
>   so there is a pre-committed trigger instead of a post-hoc rationalisation.)
>
> ### Verify
>
> - `curl -H "x-digest-key: $DIGEST_KEY" https://apptrainingmode.com/.netlify/functions/weekly-digest`
>   returns markdown. Without the key → 404. With `x-nf-event: schedule` and no key
>   → 404.
> - Trigger `weekly-digest-run` from the Netlify dashboard; the `digests` row
>   appears; running it again the same week updates rather than errors.
> - Seed 1100 snapshot rows in a test project: the pagination loop reads all of
>   them, and the `total` bail-out fires at the threshold you set.
> - The numbers for sessions and accounts match the §2d SQL run by hand.
> - `node --check` both functions and the lib; no `require` outside node builtins.
>
> ---
>
> ## 8. THE SEQUENCE — 21 / 60 / 90
>
> Re-cut from an earlier draft's 14/45/90, which put eight items — three new files,
> edits to `App.jsx` (947 lines), `Onboarding.jsx`, `Profile.jsx`,
> `FitBuilderWorkout.jsx` (1321 lines), `ScreenRouter.jsx`, plus a migration, a doc
> section, two-browser cloud-sync tests and hand-run SQL — into two weeks. Two of
> those items are new UI in the one funnel this document says it is protecting.
> Nothing in the ordering required the referral loop to exist before there were
> users to refer.
>
> ### Days 1–21 — make the app honest, attributable and measurable
>
> **Ship all of this before the owner recruits a single coach.** Plays 1 and 4.
>
> | Item | § |
> |---|---|
> | Paywall + Profile copy truth pass; `comp` plan migration; ManageSubscription comp branch; webhook comp guard | 1 |
> | `EXPO_PUBLIC_APP_URL` fallback in `links.js` + `ShareActions.jsx:86` | 4a |
> | Coach code v1: `data/coachCode.js`, consent sheet, `?coach=`, onboarding row, Profile row, `SYNC_KEYS` | 2a–2c |
> | Roster SQL + `tm_jsonb()` written into `SETUP-MONETIZATION.md` | 2d |
> | Paywall-as-overlay refactor + distinct gate events + `source` | 5, 6 |
> | `data/lifecycleEvents.js`: installs, `return_d1/d3/d7/d14` | 6a |
> | App.jsx auth hook: `signin_started` / `signin_completed` / `tm_my_ref` | 6b |
>
> ### Days 22–60 — turn attention into money
>
> Plays 2, 3 and 4.
>
> | Item | § |
> |---|---|
> | QR compaction + `scripts/check-challenge-codes.mjs` in `build:web` | 4b, 4g |
> | Referral capture: `data/referral.js`, its own `?r=` effect, `TMC1.` sixth field, `SYNC_KEYS` | 4c–4d |
> | Share instrumentation: `'Share'`→`'share'`, `ShareActions` events, ref in share text | 4f |
> | `founder_sales` + `founder_seats_claimed()` + webhook recording + refund/dispute handling | 3a–3b |
> | `data/founderSeats.js` + paywall counter, clamp, sold-out state | 3d |
> | Sign-in resume intent | 5 |
> | Builder `RoutineLimitSheet` with confirm | 5 |
> | `purchase_completed` from the webhook | 6c |
> | Referral welcome bonus + Profile INVITE sheet | 4e |
> | `buildDigest` + both functions + `digests` table + schedule | 7 |
> | Grandfather comps prepared; owner's go/no-go on `PAYWALL_ENABLED` | 5, 9 |
>
> ### Days 61–90 — only build what the first 60 days earned
>
> - **Coach v2** (`coaches`, `coach_athletes`, `coach_roster()`, a roster screen)
>   only if more than eight coaches are active or a coach has asked twice.
>   Otherwise the weekly email stays.
> - **Digest v2:** cohort retention table, per-mode conversion (which
>   `session_complete` mode precedes a purchase — needs the Plausible paid tier or
>   its own storage; decide then), coach-level retention.
> - One copy or placement change at a time on the paywall, each with a dated note
>   in `BUILD-PROMPTS.md`. **No A/B tests** — there is no bucketing and no user id
>   in analytics, so a "test" at this volume is two noisy weeks and a wrong
>   conclusion.
> - If week-2 return is healthy, the next build is more retention surface: the
>   reminder card is currently unmeasured (`ReminderCard.jsx` has no `trackEvent`
>   at all) and reminders default to `enabled: false`
>   (`data/reminderEngine.js:6-23`). Instrument it, then consider defaulting the
>   streak reminder on.
> - If week-2 return is not healthy, or fewer than 5 payers by day 60, nothing else
>   on this list matters. The 90 days end with that finding written down, and §9's
>   wind-down commitment governs what the founder buyers are owed.
>
> ---
>
> ## 9. OWNER-ONLY — things no code in this prompt can do
>
> ### Build-time reality, first
>
> **Every `EXPO_PUBLIC_*` value is inlined at build time.** Setting one in the
> Netlify dashboard changes nothing until a redeploy. **`PAYWALL_ENABLED` is a
> compile-time `const`** (`entitlements.js:27`), so flipping it is a commit plus a
> full `npm run build:web` deploy — and rolling it back is another one. Budget ~10
> minutes of build per flip and do it when you can watch it.
>
> ### Netlify environment variables
>
> - `EXPO_PUBLIC_APP_URL=https://apptrainingmode.com` — **first**, then redeploy.
>   Until it is set, every share and referral link points at the wrong host.
> - `EXPO_PUBLIC_STRIPE_PORTAL_URL` — until set, `data/stripe.js:41` is null and
>   MANAGE BILLING never renders, so subscribers can only cancel via their Stripe
>   receipt email.
> - `DIGEST_KEY`, optional `PLAUSIBLE_API_KEY`, optional `RESEND_API_KEY`.
> - Confirm already set: `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`,
>   `SUPABASE_SERVICE_ROLE_KEY`.
>
> ### Stripe
>
> - Activate the Customer Portal link and paste it into the env var above.
> - Keep all three Payment Links' success URL at
>   `https://apptrainingmode.com/?checkout=success`.
> - **Do not create a 100%-off founder coupon.** Referral and coach rewards are
>   `comp` rows (§4e explains exactly why: `planForAmount` would write `founder` on
>   a zero-amount payment).
> - **Turn on Stripe Tax** before the first sale, or decide in writing that the
>   prices are tax-inclusive and accept the liability. A $59 one-time sale to a UK
>   or EU buyer has VAT consequences that hosted Payment Links do not handle by
>   default. This is a real decision, not a formality.
> - **Archive the founder Payment Link when the counter reads 100.** The client
>   guard in §3d stops the app from linking to it; it does not stop a saved link.
>   Until the digest is live, check the count from the Stripe payments list — the
>   digest is weekly, and "the moment it reads 100" is faster than weekly.
> - If you intend to raise the price, set `FOUNDER_NEXT_PRICE` **and** publish the
>   new link at the same time. Do not promise a rise in a DM while that constant
>   is null.
>
> ### Supabase (SQL editor)
>
> - Apply the migrations from §1, §2d (`tm_jsonb`), §3a and §7 (and §2e only if
>   coach v2 is built).
> - Comp each coach:
>   ```sql
>   insert into public.entitlements (user_id, plan, is_pro, status)
>   values ('<uuid>', 'comp', true, 'coach')
>   on conflict (user_id) do update
>     set plan='comp', is_pro=true, status='coach', updated_at=now();
>   ```
> - Before flipping the paywall, grandfather the beta (permanent, per §5):
>   ```sql
>   update public.entitlements e
>      set plan='comp', is_pro=true, status='beta_grace',
>          current_period_end=null, updated_at=now()
>   where e.is_pro = false
>     and exists (select 1 from public.progress_snapshots p where p.user_id = e.user_id);
>   ```
> - **Grants take effect on the client when it next refreshes** — on
>   `?checkout=success`, or when the user opens Profile or Subscription. There is
>   no boot refresh. A grant that "didn't work" is usually a client that hasn't
>   looked yet.
> - Grant an orphan founder checkout by hand when the digest flags one: find the
>   email in the `ORPHAN CHECKOUT` log line or the Stripe payment, find the account,
>   upsert `plan='founder', is_pro=true, status='lifetime'`. **Do this the same
>   day** — it is a customer who paid and got nothing.
> - Run the §2d roster query weekly until the digest is live.
>
> ### Plausible — create a goal for every event name
>
> `app_installed`, `pwa_launch`, `signin_started`, `signin_completed`,
> `signin_first_time`, `session_complete`, `paywall_gate_arcade`,
> `paywall_gate_camp`, `paywall_gate_builder`, `paywall_viewed`,
> `paywall_view_profile`, `paywall_view_subscription`, `paywall_signin_clicked`,
> `paywall_checkout_clicked`, `purchase_completed`, `checkout_return_success`,
> `founder_sold_out_viewed`, `share`, `challenge_created`, `challenge_opened`,
> `coach_code_applied`, `coach_code_declined`, `coach_code_rejected`,
> `coach_code_prompt_shown`, `coach_signin_nudge_shown`, `referral_captured`,
> `referral_bonus_granted`, `invite_link_copied`, `return_d1`, `return_d3`,
> `return_d7`, `return_d14`, `js_error`.
>
> An event with no goal is fired and discarded. `coach_code_rejected` is the one
> that tells you a coach is handing out a code that was never deployed — the exact
> failure mode of the hardcoded registry.
>
> ### Policies that must exist in writing before the first sale
>
> These are not engineering items and none of them can be deferred past the
> `PAYWALL_ENABLED` flip.
>
> 1. **Privacy policy** (`public/privacy.html`) gains two clauses: coach sharing
>    (exactly the fields listed in the §2b consent sheet, nothing more) and
>    product emails to signed-in athletes (which is what §7's check-in list
>    enables). Ship the policy update **before** the first coach code goes out.
> 2. **Minors.** Codes are for 16+. It is in the consent sheet and in the coach
>    onboarding note. If the owner wants under-16s, that is a separate legal
>    conversation this plan does not cover.
> 3. **Refunds.** A stated window — "full refund within 14 days, no questions" is
>    the simplest — implemented by the `charge.refunded` handler in §3b, which
>    frees the seat and revokes access in one event.
> 4. **What "lifetime" means.** §8 contemplates the 90 days ending in a decision to
>    stop. A $59 founder buyer is owed an answer *before* they pay. The
>    commitment to publish: *"Lifetime means for as long as Training Mode runs. If
>    we shut the app down, founders get 90 days' notice and a full refund if it
>    happens within 12 months of purchase."* Adjust the terms if you like; publish
>    something, and put it on the founder card as a link.
> 5. **Oversold seats.** Every paid founder purchase is honoured at the price paid
>    (§3c). The display clamps at 100. Archive the link.
> 6. **Rollback.** If the flip breaks unlocks for paying users: revert the
>    `PAYWALL_ENABLED` commit and redeploy (~10 min). Anyone affected in the
>    meantime gets a `comp` row immediately and an email. Decide before the flip
>    whether a broken-unlock day triggers a refund offer; the answer should be yes.
>
> ### The part that is not engineering, and is most of the outcome
>
> Recruit five coaches in person or by DM. Sell founder seats one conversation at a
> time. Post the daily share card. Send the day-3 and day-10 check-ins by hand.
>
> **Size it honestly:** five coach recruitments, ~90 daily posts, and two check-ins
> each to 150 athletes is on the order of **300+ hand-sent messages plus ~90
> posts** across the 90 days. Call it 5–8 hours a week, every week. This document
> puts precise scope on every code item; the manual work deserves the same
> treatment, because it is the larger half and it is what actually determines the
> number in §0's table. §7's check-in list is the only tooling that reduces it.
>
> **Finally: the `PAYWALL_ENABLED` flip is the owner's, not the implementer's.** It
> happens after the truth pass, after the grandfather comps land, after the
> policies in this section are published, and after a live test-mode
> purchase → cancel → revoke run-through per `SETUP-MONETIZATION.md`'s go-live
> section.
>
> ---
>
> ## 10. DO NOT
>
> - **Do NOT display a founder count you did not fetch.** No seeded number, no
>   cached-beyond-24h number, no "almost gone", no countdown, no "3 people are
>   viewing this". If the RPC fails, the paywall shows no number and no bar. This
>   is the one rule here with no exceptions.
> - **Do NOT build a recruit counter, a roster number, or any figure the client
>   cannot verify.** An unverifiable number in the UI is a fabrication.
> - **Do NOT create a 100%-off founder coupon.** It writes `plan='founder'` through
>   `planForAmount` and turns a non-payment into a scarcity claim. Rewards are
>   `comp` rows.
> - **Do NOT promise an expiry the system cannot enforce.** The beta comp is
>   permanent by decision (§5) precisely because nothing in this codebase reads
>   `current_period_end` as a gate.
> - **No dark patterns.** No pre-selected add-ons, no undismissable interstitial,
>   no hidden or obstructed cancel path, no fake "someone just bought" toasts, no
>   urgency copy without a deadline the owner has actually committed to, no
>   guilt-worded dismiss buttons ("No thanks, I don't want to get stronger"), and
>   no silently changing which plan someone is about to buy.
> - **No paid ads, no influencer payments, no growth tooling subscriptions** in
>   this window — **with one named exception**: if the owner decides the Plausible
>   paid tier is worth it for custom properties and the Stats API, that is a
>   legitimate, budgeted line item that goes into §0's table first (§6). Every
>   other subscription is out.
> - **No new training modes, no new campaigns, no new arcade content, no game
>   work.** If you find yourself editing `protocol/`, `trainingArcadeData.js` or
>   anything under `game-sync/`, stop.
> - **Do NOT add a fourth gate.** Three is the agreed free tier (`GATES`,
>   `entitlements.js:19-23`), and the beta cohort has been using the app unlocked.
> - **Do NOT reintroduce paywall copy for anything no gate enforces.** That is the
>   §1 fix and it will regress the moment someone writes marketing copy in
>   `Paywall.jsx` or `Profile.jsx`.
> - **Do NOT invent a third portable-token dialect.** Extend `TMC1.` append-only.
>   (`TMG1.` in `ghostBattles.js:76` is already a second, incompatible dialect —
>   standard base64 with padding where `TMC1.` is URL-safe without. Do not copy its
>   pattern, and note that `importGhostCode` trusts a `verified: true` field inside
>   the attacker-supplied payload (`:83`) and pays 75 XP on a win. Build nothing
>   money-adjacent on top of it.)
> - **Do NOT write `entitlements` from the client.** The table has exactly one RLS
>   policy — select-own — by design
>   (`20260815211807_create_entitlements.sql:38-45`). Pro comes from the webhook or
>   the owner, never from the browser.
> - **Do NOT ship a secret in the bundle.** The Supabase anon key
>   (`authClient.js:15-16`) stays the only public key. `DIGEST_KEY`,
>   `PLAUSIBLE_API_KEY` and the service-role key are server-side only, and the
>   digest must not be reachable from the app.
> - **Do NOT put the digest key in a query string** when a header will do.
> - **Do NOT forget the revoke.** Every new SQL function gets
>   `revoke all … from public, anon` before its `grant`, for the reason recorded in
>   `20260815211834_lock_down_trigger_functions.sql`.
> - **Do NOT flip `PAYWALL_ENABLED`, and do NOT commit `dist/`.**
>
> ---
>
> ## 11. DONE MEANS
>
> - `npm run typecheck`, `npx expo lint` and `npm run build:web` all clean — and
>   `build:web` now runs `scripts/check-challenge-codes.mjs`, which fails on a QR
>   overflow or a broken legacy code.
> - Every verify block in §1–§7 passes, with `?paywall=preview` on wherever a gate
>   or an entitlement is being tested.
> - `?paywall=preview` walks all three gates end to end: the right distinct gate
>   event, the right `source`, the paywall opening **as an overlay**, closing back
>   onto the exact sheet the user was in, and the sign-in resume firing once after
>   OAuth and never on a plain reload.
> - The founder counter reads a real number sourced from `founder_sales`,
>   disappears entirely when the RPC is unreachable, clamps at 100, and closes the
>   card at the cap. A test-mode refund frees the seat and revokes access.
> - An orphan checkout (Payment Link opened directly, no params) records a
>   `founder_sales` row, logs `ORPHAN CHECKOUT`, and appears in the digest.
> - `weekly-digest-run` triggered from the Netlify dashboard writes a `digests`
>   row; `weekly-digest` with the header key renders it; without the key, and with
>   a forged `x-nf-event` header, both return 404. The five metrics match the
>   hand-run SQL, and the check-in lists name real accounts.
> - `grep -rho "trackEvent('[a-zA-Z_]*'" components/ | sort -u` matches the §9 goal
>   list exactly.
> - `grep -rn "skins" components/training-mode/Paywall.jsx components/training-mode/Profile.jsx`
>   returns nothing.
> - The policies in §9 are published, not drafted — privacy clauses, minors, refund
>   window, what "lifetime" means, oversold-seat policy, rollback plan.
> - `PAYWALL_ENABLED` is still `false`.
> - Your commit message names which of the four plays each change serves.