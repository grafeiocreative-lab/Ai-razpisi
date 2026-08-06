alter table public.grant_matches enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grant_matches'
      and policyname = 'grant_matches_public_read'
  ) then
    create policy grant_matches_public_read
      on public.grant_matches
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
