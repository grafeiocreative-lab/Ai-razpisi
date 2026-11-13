-- Posnetek sheme `ai_razpisi` iz žive baze (projekt cseifhrfmemvizwbmyjd, Grafeio Workspace).
-- Narejen 2026-11-13 iz pg_catalog, ne ročno. Namen: ponovljiva postavitev iz nič
-- (nov projekt, preview branch). Za obstoječo bazo tega NE poganjaj.
--
-- Zakaj to ni v supabase/migrations/: tamkajšnje datoteke so zgodovina STAREGA projekta
-- (shema `public`, projekt fhoayfzwfsalnnpxxlak) in z živo bazo niso skladne. Glej supabase/README.md.
--
-- Vrstni red: shema, tabele, ključi in unikatnosti, tuji ključi, indeksi,
-- RLS, pravilniki, pravice. Podatki za skd_lookup so v ai_razpisi_skd_lookup_seed.sql.
-- Po tej datoteki je treba v Supabase Dashboard (Settings → API → Exposed schemas) izpostaviti shemo ai_razpisi.

create schema if not exists ai_razpisi;
grant usage on schema ai_razpisi to anon, authenticated, service_role;

-- ── Tabele ────────────────────────────────────────────────────────────────

create table if not exists ai_razpisi.ai_usage (
  usage_date date not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  request_count integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create table if not exists ai_razpisi.companies (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  company_name text,
  registration_number text,
  tax_number text,
  legal_form text,
  main_activity_code text,
  main_activity_name text,
  size_class text,
  region text,
  municipality text,
  address text,
  source text default 'manual'::text,
  source_payload jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  interests jsonb default '[]'::jsonb,
  dm_free numeric default 200000,
  skd_code text,
  skd_label text
);

create table if not exists ai_razpisi.grant_sources (
  id uuid not null default gen_random_uuid(),
  name text not null,
  source_type text not null,
  base_url text,
  api_url text,
  active boolean not null default true,
  last_checked_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now()
);

create table if not exists ai_razpisi.crawl_log (
  id uuid not null default gen_random_uuid(),
  source_id uuid,
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone,
  status text default 'started'::text,
  items_found integer default 0,
  items_inserted integer default 0,
  items_updated integer default 0,
  error_message text,
  raw_log jsonb
);

create table if not exists ai_razpisi.data_source_health (
  id uuid not null default gen_random_uuid(),
  source text not null,
  last_success timestamp with time zone,
  last_failure timestamp with time zone,
  failure_count integer default 0,
  last_error text,
  updated_at timestamp with time zone not null default now()
);

create table if not exists ai_razpisi.de_minimis_records (
  id uuid not null default gen_random_uuid(),
  company_id uuid,
  provider text,
  programme text,
  amount numeric not null,
  granted_date date not null,
  source_url text,
  source_payload jsonb,
  created_at timestamp with time zone not null default now(),
  mssi_number text
);

create table if not exists ai_razpisi.grants (
  id uuid not null default gen_random_uuid(),
  source_id uuid,
  title text not null,
  provider text,
  source_url text not null,
  status text default 'unknown'::text,
  published_at date,
  deadline_at timestamp with time zone,
  is_de_minimis boolean default false,
  max_aid_amount numeric,
  funding_rate numeric,
  eligible_company_sizes text[],
  eligible_regions text[],
  eligible_sectors text[],
  eligible_costs text[],
  investment_types text[],
  raw_summary text,
  plain_language_summary text,
  requirements text,
  required_documents text[],
  raw_payload jsonb,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists ai_razpisi.grant_matches (
  id uuid not null default gen_random_uuid(),
  company_id uuid,
  grant_id uuid,
  match_score numeric default 0,
  sector_score numeric default 0,
  region_score numeric default 0,
  size_score numeric default 0,
  cost_score numeric default 0,
  de_minimis_score numeric default 0,
  match_status text default 'unknown'::text,
  risk_level text default 'unknown'::text,
  reason text,
  warnings text[],
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  score_breakdown jsonb
);

create table if not exists ai_razpisi.plan_interest (
  id uuid not null default gen_random_uuid(),
  plan_name text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists ai_razpisi.prs_cache (
  id uuid not null default gen_random_uuid(),
  registration_number text not null,
  company_name text not null,
  tax_number text,
  legal_form text,
  address text,
  municipality text,
  region text,
  main_activity_code text,
  main_activity_name text,
  raw_payload jsonb,
  source text default 'opsi-prs'::text,
  imported_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists ai_razpisi.skd_lookup (
  code text not null,
  normalized_code text not null,
  level integer not null,
  section_code text,
  descriptor_sl text not null,
  descriptor_en text,
  parent_code text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- ── Primarni in unikatni ključi ───────────────────────────────────────────

alter table ai_razpisi.ai_usage add constraint ai_usage_pkey primary key (usage_date);
alter table ai_razpisi.companies add constraint companies_pkey primary key (id);
alter table ai_razpisi.companies add constraint companies_registration_number_key unique (registration_number);
alter table ai_razpisi.crawl_log add constraint crawl_log_pkey primary key (id);
alter table ai_razpisi.data_source_health add constraint data_source_health_pkey primary key (id);
alter table ai_razpisi.data_source_health add constraint data_source_health_source_key unique (source);
alter table ai_razpisi.de_minimis_records add constraint de_minimis_records_pkey primary key (id);
alter table ai_razpisi.grant_matches add constraint grant_matches_pkey primary key (id);
alter table ai_razpisi.grant_sources add constraint grant_sources_pkey primary key (id);
alter table ai_razpisi.grants add constraint grants_pkey primary key (id);
alter table ai_razpisi.plan_interest add constraint plan_interest_pkey primary key (id);
alter table ai_razpisi.prs_cache add constraint prs_cache_pkey primary key (id);
alter table ai_razpisi.skd_lookup add constraint skd_lookup_pkey primary key (code);
alter table ai_razpisi.skd_lookup add constraint skd_lookup_normalized_code_key unique (normalized_code);

-- ── Tuji ključi ───────────────────────────────────────────────────────────

alter table ai_razpisi.crawl_log add constraint crawl_log_source_id_fkey foreign key (source_id) references ai_razpisi.grant_sources(id);
alter table ai_razpisi.de_minimis_records add constraint de_minimis_records_company_id_fkey foreign key (company_id) references ai_razpisi.companies(id);
alter table ai_razpisi.grant_matches add constraint grant_matches_company_id_fkey foreign key (company_id) references ai_razpisi.companies(id);
alter table ai_razpisi.grant_matches add constraint grant_matches_grant_id_fkey foreign key (grant_id) references ai_razpisi.grants(id);
alter table ai_razpisi.grants add constraint grants_source_id_fkey foreign key (source_id) references ai_razpisi.grant_sources(id);

-- ── Indeksi ───────────────────────────────────────────────────────────────

create unique index de_minimis_records_uidx on ai_razpisi.de_minimis_records using btree (company_id, mssi_number, granted_date, amount) nulls not distinct;
create index grant_matches_company_idx on ai_razpisi.grant_matches using btree (company_id);
create index grant_matches_score_idx on ai_razpisi.grant_matches using btree (company_id, match_score desc);
create unique index grant_matches_company_grant_uidx on ai_razpisi.grant_matches using btree (company_id, grant_id);
create unique index prs_cache_registration_number_uidx on ai_razpisi.prs_cache using btree (registration_number);
create index skd_lookup_level_idx on ai_razpisi.skd_lookup using btree (level);
create index skd_lookup_parent_idx on ai_razpisi.skd_lookup using btree (parent_code);
create index skd_lookup_section_idx on ai_razpisi.skd_lookup using btree (section_code);

-- ── Row level security ────────────────────────────────────────────────────
-- ai_usage, crawl_log, grant_sources in prs_cache imajo RLS brez pravilnikov: dostop imata samo
-- service_role (edge funkcije) in lastnik. To je namerno.

alter table ai_razpisi.ai_usage enable row level security;
alter table ai_razpisi.companies enable row level security;
alter table ai_razpisi.crawl_log enable row level security;
alter table ai_razpisi.data_source_health enable row level security;
alter table ai_razpisi.de_minimis_records enable row level security;
alter table ai_razpisi.grant_matches enable row level security;
alter table ai_razpisi.grant_sources enable row level security;
alter table ai_razpisi.grants enable row level security;
alter table ai_razpisi.plan_interest enable row level security;
alter table ai_razpisi.prs_cache enable row level security;
alter table ai_razpisi.skd_lookup enable row level security;

create policy companies_public_read on ai_razpisi.companies as permissive for select to anon, authenticated using (true);
create policy data_source_health_public_read on ai_razpisi.data_source_health as permissive for select to public using (true);
create policy de_minimis_records_public_read on ai_razpisi.de_minimis_records as permissive for select to anon, authenticated using (true);
create policy grant_matches_public_read on ai_razpisi.grant_matches as permissive for select to anon, authenticated using (true);
create policy grants_public_read on ai_razpisi.grants as permissive for select to anon, authenticated using (true);
create policy "anon lahko zabelezi interes" on ai_razpisi.plan_interest as permissive for insert to anon with check (true);
create policy skd_lookup_public_read on ai_razpisi.skd_lookup as permissive for select to public using (true);

-- ── Pravice (RLS sam ne zadostuje: service_role potrebuje izrecen GRANT) ──

grant insert, select, update on ai_razpisi.ai_usage to service_role;
grant delete, insert, select, update on ai_razpisi.companies to service_role;
grant select on ai_razpisi.companies to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.crawl_log to service_role;
grant select on ai_razpisi.crawl_log to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.data_source_health to service_role;
grant select on ai_razpisi.data_source_health to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.de_minimis_records to service_role;
grant select on ai_razpisi.de_minimis_records to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.grant_matches to service_role;
grant select on ai_razpisi.grant_matches to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.grant_sources to service_role;
grant select on ai_razpisi.grant_sources to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.grants to service_role;
grant select on ai_razpisi.grants to anon, authenticated;
grant insert on ai_razpisi.plan_interest to anon;
grant delete, insert, select, update on ai_razpisi.prs_cache to service_role;
grant select on ai_razpisi.prs_cache to anon, authenticated;
grant delete, insert, select, update on ai_razpisi.skd_lookup to service_role;
grant select on ai_razpisi.skd_lookup to anon, authenticated;
