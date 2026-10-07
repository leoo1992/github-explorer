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
  constraint quality_presets_user_name_key unique (user_id, name),
  constraint quality_presets_language_check check (
    language is null or language in (
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go', 'Rust',
      'PHP', 'Ruby', 'Kotlin', 'Swift', 'Dart', 'C', 'C++'
    )
  )
);

alter table public.quality_presets enable row level security;

revoke all on public.quality_presets from anon;
revoke all on public.quality_presets from authenticated;
grant select, insert, update, delete on public.quality_presets to service_role;

create index if not exists quality_presets_user_updated_idx
  on public.quality_presets(user_id, updated_at desc);

comment on table public.quality_presets is
  'Paid RepoScope user presets containing a language scope and selected quality criteria.';


create policy "Users can read own quality presets"
on public.quality_presets
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own quality presets"
on public.quality_presets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own quality presets"
on public.quality_presets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own quality presets"
on public.quality_presets
for delete
to authenticated
using ((select auth.uid()) = user_id);


-- Histórico de análises com nota persistida para busca, paginação e ranking.
alter table public.usage_events
  add column if not exists quality_score smallint,
  add column if not exists quality_profile text;

alter table public.usage_events
  drop constraint if exists usage_events_quality_score_check;

alter table public.usage_events
  add constraint usage_events_quality_score_check
  check (quality_score is null or quality_score between 0 and 100);

create index if not exists usage_events_user_quality_created_idx
  on public.usage_events (user_id, quality_score desc nulls last, created_at desc)
  where event_type = 'repository_analysis' and state = 'complete';


-- Relatórios compartilháveis somente leitura.
create table if not exists public.shared_reports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 20 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  repository text not null,
  quality_score smallint check (quality_score is null or quality_score between 0 and 100),
  quality_profile text,
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.shared_reports enable row level security;

revoke all on public.shared_reports from anon;
revoke all on public.shared_reports from authenticated;
grant select, insert, update, delete on public.shared_reports to service_role;

create index if not exists shared_reports_slug_idx on public.shared_reports(slug);
create index if not exists shared_reports_user_created_idx on public.shared_reports(user_id, created_at desc);

comment on table public.shared_reports is
  'Snapshots públicos somente leitura de análises RepoScope acessados por slug não enumerável.';
