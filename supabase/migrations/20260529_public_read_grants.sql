alter table public.grants enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grants'
      and policyname = 'grants_public_read'
  ) then
    create policy grants_public_read
      on public.grants
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
