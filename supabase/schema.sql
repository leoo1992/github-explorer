-- RepoScope billing schema
-- Execute in the Supabase SQL Editor for the production project.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

revoke all on public.subscriptions from anon;
revoke all on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;

create policy "Users can read own subscription"
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

comment on table public.subscriptions is 'Stripe subscription state used to authorize paid RepoScope features.';
