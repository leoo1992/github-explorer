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


-- Presets de critérios personalizados (recurso do plano pago).
create table if not exists public.quality_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  language text,
  criteria_ids text[] not null check (cardinality(criteria_ids) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_presets_user_name_key unique (user_id, name)
);

alter table public.quality_presets enable row level security;

revoke all on public.quality_presets from anon;
revoke all on public.quality_presets from authenticated;
grant select, insert, update, delete on public.quality_presets to service_role;

create index if not exists quality_presets_user_updated_idx
  on public.quality_presets(user_id, updated_at desc);

comment on table public.quality_presets is
  'Paid RepoScope user presets containing a language scope and selected quality criteria.';
