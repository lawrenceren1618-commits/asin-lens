-- Own vs competitor roles + industry/optimization reports

ALTER TABLE asins
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'competitor';

ALTER TABLE asins
  ADD COLUMN IF NOT EXISTS manual_cvr_60d numeric(8, 4);

ALTER TABLE asin_snapshots
  ADD COLUMN IF NOT EXISTS keyword_traffic jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS industry_opt_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  mode text NOT NULL,
  summary_md text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS industry_opt_reports_project_date_uidx
  ON industry_opt_reports (project_id, report_date);

CREATE INDEX IF NOT EXISTS industry_opt_reports_project_id_idx
  ON industry_opt_reports (project_id);
