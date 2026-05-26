alter table public.skd_lookup enable row level security;

drop policy if exists skd_lookup_public_read on public.skd_lookup;

create policy skd_lookup_public_read
  on public.skd_lookup
  for select
  using (true);
