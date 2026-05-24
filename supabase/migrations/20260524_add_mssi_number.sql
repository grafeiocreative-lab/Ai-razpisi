alter table de_minimis_records
  add column if not exists mssi_number text;

create unique index if not exists de_minimis_records_uidx
  on de_minimis_records(company_id, mssi_number, granted_date, amount)
  where mssi_number is not null;
