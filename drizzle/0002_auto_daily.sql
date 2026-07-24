-- Auto daily projects: collect + reports at Beijing 09:00 cron

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS auto_daily boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS projects_auto_daily_idx
  ON projects (auto_daily)
  WHERE auto_daily = true;
