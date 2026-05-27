-- grant_matches: tabela je že ustvarjena, samo dodamo score_breakdown in index
ALTER TABLE grant_matches ADD COLUMN IF NOT EXISTS score_breakdown jsonb;

CREATE INDEX IF NOT EXISTS grant_matches_company_idx ON grant_matches(company_id);
CREATE INDEX IF NOT EXISTS grant_matches_score_idx   ON grant_matches(company_id, match_score DESC);
