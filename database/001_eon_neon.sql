-- EON — THE LIVING CITY
-- Migration 001 / PostgreSQL (Neon)
-- Execute on a NEW, EMPTY EON database. Do not run in the ATLAS database.
-- Requires PostgreSQL with gen_random_uuid() (built-in on supported modern versions).
-- All simulations are illustrative models, not real-world forecasts.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_not_blank CHECK (length(btrim(email)) > 3),
  CONSTRAINT users_name_not_blank CHECK (length(btrim(display_name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT sessions_valid_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  seed BIGINT NOT NULL CHECK (seed BETWEEN 0 AND 2147483647),
  generator_version VARCHAR(30) NOT NULL DEFAULT 'citygen-1.0.0',
  grid_width SMALLINT NOT NULL DEFAULT 24 CHECK (grid_width BETWEEN 8 AND 128),
  grid_height SMALLINT NOT NULL DEFAULT 24 CHECK (grid_height BETWEEN 8 AND 128),
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cities_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS cities_owner_updated_idx ON cities (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  parent_scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  baseline_config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(baseline_config) = 'object'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scenarios_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT scenarios_not_own_parent CHECK (parent_scenario_id IS DISTINCT FROM id)
);
CREATE INDEX IF NOT EXISTS scenarios_city_updated_idx ON scenarios (city_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS scenario_actions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL CHECK (tick >= 0),
  sequence SMALLINT NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  action_type VARCHAR(40) NOT NULL CHECK (action_type IN (
    'set_transit_budget',
    'add_solar_capacity',
    'set_density',
    'close_road',
    'reopen_road',
    'set_green_space'
  )),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scenario_actions_order_unique UNIQUE (scenario_id, tick, sequence)
);
CREATE INDEX IF NOT EXISTS scenario_actions_timeline_idx ON scenario_actions (scenario_id, tick, sequence);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  engine_version VARCHAR(30) NOT NULL,
  seed BIGINT NOT NULL CHECK (seed BETWEEN 0 AND 2147483647),
  horizon_ticks INTEGER NOT NULL CHECK (horizon_ticks BETWEEN 1 AND 2016),
  input_snapshot JSONB NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  input_sha256 CHAR(64) NOT NULL,
  summary JSONB CHECK (summary IS NULL OR jsonb_typeof(summary) = 'object'),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS simulation_runs_scenario_created_idx
  ON simulation_runs (scenario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS simulation_runs_status_created_idx
  ON simulation_runs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS simulation_frames (
  run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL CHECK (tick >= 0),
  metrics JSONB NOT NULL CHECK (jsonb_typeof(metrics) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, tick)
);

CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  run_id UUID REFERENCES simulation_runs(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT share_links_valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS share_links_scenario_idx ON share_links (scenario_id, created_at DESC);

-- Keep timestamps accurate for entities that can be edited.
CREATE OR REPLACE FUNCTION eon_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
CREATE TRIGGER users_touch_updated_at
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION eon_touch_updated_at();

DROP TRIGGER IF EXISTS cities_touch_updated_at ON cities;
CREATE TRIGGER cities_touch_updated_at
BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION eon_touch_updated_at();

DROP TRIGGER IF EXISTS scenarios_touch_updated_at ON scenarios;
CREATE TRIGGER scenarios_touch_updated_at
BEFORE UPDATE ON scenarios FOR EACH ROW EXECUTE FUNCTION eon_touch_updated_at();

COMMIT;

-- Post-install read-only check: expect 8 rows, all present.
SELECT name, CASE WHEN to_regclass('public.' || name) IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (VALUES
  ('users'), ('sessions'), ('cities'), ('scenarios'),
  ('scenario_actions'), ('simulation_runs'), ('simulation_frames'), ('share_links')
) AS expected(name)
ORDER BY name;
