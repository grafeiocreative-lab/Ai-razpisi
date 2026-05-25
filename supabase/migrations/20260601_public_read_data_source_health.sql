alter table public.data_source_health enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'data_source_health'
      and policyname = 'data_source_health_public_read'
  ) then
    create policy data_source_health_public_read
      on public.data_source_health
      for select
      using (true);
  end if;
end $$;
