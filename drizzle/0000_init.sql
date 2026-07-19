CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asin text NOT NULL,
  market text NOT NULL DEFAULT 'US',
  note text,
  role text NOT NULL DEFAULT 'competitor',
  manual_cvr_60d numeric(8, 4),
  status text NOT NULL DEFAULT 'new',
  fetch_started_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS asins_project_asin_market_uidx
  ON asins (project_id, asin, market);
CREATE INDEX IF NOT EXISTS asins_project_id_idx ON asins (project_id);

CREATE TABLE IF NOT EXISTS asin_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin_id uuid NOT NULL REFERENCES asins(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  title text,
  price numeric(12, 2),
  sales integer,
  rank integer,
  cart text,
  traffic numeric(14, 2),
  top_keywords jsonb DEFAULT '[]'::jsonb,
  keyword_traffic jsonb DEFAULT '[]'::jsonb,
  raw_refs jsonb DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS asin_snapshots_asin_date_uidx
  ON asin_snapshots (asin_id, snapshot_date);
CREATE INDEX IF NOT EXISTS asin_snapshots_asin_id_idx ON asin_snapshots (asin_id);

CREATE TABLE IF NOT EXISTS asin_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin_id uuid NOT NULL REFERENCES asins(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date NOT NULL,
  title text,
  price numeric(12, 2),
  sales integer,
  rank integer,
  cart text,
  traffic numeric(14, 2),
  top_keywords jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asin_change_log_asin_id_idx ON asin_change_log (asin_id);

CREATE TABLE IF NOT EXISTS daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  summary_md text NOT NULL DEFAULT '',
  anomalies jsonb DEFAULT '[]'::jsonb,
  sent_feishu_at timestamptz,
  sent_email_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_project_date_uidx
  ON daily_reports (project_id, report_date);

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

CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  status text NOT NULL,
  detail text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
