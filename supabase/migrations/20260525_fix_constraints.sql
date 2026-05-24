alter table companies
  add column if not exists registration_number text;

alter table companies
  drop constraint if exists companies_registration_number_key;

alter table companies
  add constraint companies_registration_number_key unique (registration_number);
