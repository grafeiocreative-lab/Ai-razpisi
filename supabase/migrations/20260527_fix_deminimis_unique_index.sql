-- Replace partial unique index with a full one so ON CONFLICT works.
-- The partial index (WHERE mssi_number IS NOT NULL) is not usable for ON CONFLICT.
drop index if exists de_minimis_records_uidx;

create unique index de_minimis_records_uidx
  on de_minimis_records(company_id, mssi_number, granted_date, amount)
  nulls not distinct;
