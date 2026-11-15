-- Zaplanirana opravila v bazi (pg_cron). Dnevni tek scrape-grants teče v Supabase Cron, ne v GitHub Actions
-- (GitHub cron zamuja za več ur). Skrivnost je v Vaultu in se nikoli ne zapiše v to datoteko.
--
-- 1. Enkrat shrani skrivnost (vrednost SCRAPE_GRANTS_SECRET):
--    select vault.create_secret('<SKRIVNOST>', 'scrape_grants_secret', 'Skrivnost za klic scrape-grants iz pg_cron');
-- 2. Zaplaniraj dnevni tek ob 05:15 UTC:
select cron.schedule(
  'scrape-grants-daily',
  '15 5 * * *',
  $$select net.http_post(
    url := 'https://cseifhrfmemvizwbmyjd.supabase.co/functions/v1/scrape-grants',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_grants_secret'),
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 170000
  )$$
);
-- Pregled izvajanja: select * from cron.job_run_details order by start_time desc limit 10;
-- Odgovori funkcije:  select id, status_code, left(content::text, 200) from net._http_response order by id desc limit 5;
