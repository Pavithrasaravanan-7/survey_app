-- Survey App — PostgreSQL schema
-- Run once against a fresh database: psql "$DATABASE_URL" -f server/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id        BIGINT PRIMARY KEY,
  name      TEXT NOT NULL,
  username  TEXT NOT NULL UNIQUE,
  pass      TEXT NOT NULL,
  role      TEXT NOT NULL,
  zone      TEXT DEFAULT '',
  co        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS visits (
  id           BIGINT PRIMARY KEY,
  off_id       BIGINT NOT NULL,
  off_name     TEXT NOT NULL,
  co           TEXT NOT NULL,
  asn          TEXT DEFAULT '',
  dno          TEXT DEFAULT '',
  st           TEXT DEFAULT '',
  reg          TEXT DEFAULT '',
  contact      TEXT DEFAULT '',
  docs         JSONB DEFAULT '{}',
  description  TEXT DEFAULT '',
  wd           TEXT DEFAULT '',
  zn           TEXT DEFAULT '',
  is_new       BOOLEAN DEFAULT false,
  pay          TEXT DEFAULT '',
  amt          NUMERIC DEFAULT 0,
  app_status   TEXT DEFAULT '',
  app_remarks  TEXT DEFAULT '',
  lat          TEXT,
  lng          TEXT,
  ph           TEXT,
  phf          TEXT,
  pay_mode     TEXT DEFAULT '',
  receipt_collected TEXT DEFAULT '',
  receipt_photo TEXT DEFAULT '',
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  date         DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_visits_off_id ON visits(off_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date);

CREATE TABLE IF NOT EXISTS track (
  off_id      BIGINT PRIMARY KEY,
  name        TEXT NOT NULL,
  last_seen   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS track_points (
  id      BIGSERIAL PRIMARY KEY,
  off_id  BIGINT NOT NULL REFERENCES track(off_id) ON DELETE CASCADE,
  lat     TEXT NOT NULL,
  lng     TEXT NOT NULL,
  ts      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_track_points_off_id ON track_points(off_id, ts);

CREATE TABLE IF NOT EXISTS alerts (
  id        BIGINT PRIMARY KEY,
  off_id    BIGINT,
  off_name  TEXT,
  co        TEXT,
  asn       TEXT,
  reason    TEXT,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id            BIGINT PRIMARY KEY,
  off_id        BIGINT NOT NULL,
  off_name      TEXT,
  date          DATE NOT NULL,
  status        TEXT NOT NULL,
  present_time  TEXT,
  remarks       TEXT,
  photo         TEXT,
  lat           TEXT,
  lng           TEXT,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(off_id, date)
);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS pay_mode TEXT DEFAULT '';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS receipt_collected TEXT DEFAULT '';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS receipt_photo TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS permissions (
  id        BIGINT PRIMARY KEY,
  off_id    BIGINT,
  off_name  TEXT,
  date      DATE,
  duration  NUMERIC,
  reason    TEXT,
  remarks   TEXT,
  status    TEXT,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default admin account (matches previous db.json seed)
INSERT INTO users (id, name, username, pass, role, zone, co)
VALUES (1, 'Admin User', 'admin', 'admin123', 'admin', '', '')
ON CONFLICT (id) DO NOTHING;
