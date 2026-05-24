update public.grants
set status = 'closed',
    updated_at = now()
where deadline_at is not null
  and deadline_at < now()
  and status in ('open', 'upcoming');

delete from public.grants
where title in ('Aktualen - Evropska sredstva', 'Napovedan - Evropska sredstva');
