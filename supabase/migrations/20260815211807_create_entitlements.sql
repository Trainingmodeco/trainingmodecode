-- Training Mode Pro entitlements.
-- Read by the app (authClient.fetchEntitlement selects plan, is_pro,
-- current_period_end). WRITTEN ONLY by the Stripe webhook using the service_role
-- key, which bypasses RLS — there is deliberately no insert/update/delete policy
-- for end users, so nobody can grant themselves Pro from the client.

create table if not exists public.entitlements (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  -- matches data/stripe.js PLANS ids
  plan                   text        not null default 'free'
                           check (plan in ('free', 'monthly', 'annual', 'founder')),
  is_pro                 boolean     not null default false,
  -- raw Stripe subscription status: active, trialing, past_due, canceled, ...
  status                 text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  -- null for the founder (lifetime) plan — nothing to renew
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.entitlements is
  'Pro entitlement per user. Client-readable (own row only); written exclusively by the Stripe webhook via service_role.';

-- Webhook lookups come in keyed by Stripe ids.
create unique index if not exists entitlements_stripe_customer_id_key
  on public.entitlements (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists entitlements_stripe_subscription_id_key
  on public.entitlements (stripe_subscription_id) where stripe_subscription_id is not null;

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch
  before insert or update on public.entitlements
  for each row execute function public.tm_touch_updated_at();

alter table public.entitlements enable row level security;

-- Read your own entitlement. That is the ONLY client-side permission.
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own"
  on public.entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Every new account starts on the free plan so the row always exists.
create or replace function public.tm_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.entitlements (user_id, plan, is_pro)
  values (new.id, 'free', false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_entitlement on auth.users;
create trigger on_auth_user_created_entitlement
  after insert on auth.users
  for each row execute function public.tm_handle_new_user();

-- Backfill anyone who signed up before this table existed.
insert into public.entitlements (user_id, plan, is_pro)
select u.id, 'free', false from auth.users u
on conflict (user_id) do nothing;
