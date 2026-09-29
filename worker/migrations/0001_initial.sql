CREATE TABLE IF NOT EXISTS page_views (
  slug TEXT PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_visitors (
  slug TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  view_date TEXT NOT NULL,
  PRIMARY KEY (slug, visitor_hash, view_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_visitors_date
  ON daily_visitors(view_date);
