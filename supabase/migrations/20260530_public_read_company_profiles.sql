alter table public.companies enable row level security;
alter table public.de_minimis_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'companies_public_read'
  ) then
    create policy companies_public_read
      on public.companies
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'de_minimis_records'
      and policyname = 'de_minimis_records_public_read'
  ) then
    create policy de_minimis_records_public_read
      on public.de_minimis_records
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
