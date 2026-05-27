ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS interests  jsonb    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dm_free    numeric  DEFAULT 200000;
