-- Tournament Wizard database tables (Postgres).

CREATE TABLE tournaments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  team_count INTEGER NOT NULL DEFAULT 16 CHECK (team_count IN (8, 16)),
  payment_link TEXT,
  stripe_webhook_secret TEXT,
  fees_waived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  sets_to_win INTEGER NOT NULL DEFAULT 2,
  set_points INTEGER NOT NULL DEFAULT 25,
  deciding_set_points INTEGER NOT NULL DEFAULT 15,
  scoring_format TEXT NOT NULL DEFAULT 'court' CHECK (scoring_format IN ('sand','court')),
  auto_announce BOOLEAN NOT NULL DEFAULT TRUE,
  announce_minutes INTEGER NOT NULL DEFAULT 5,
  day_start TIMESTAMPTZ,
  day_end TIMESTAMPTZ,
  game_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_owners (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  pool TEXT NOT NULL CHECK (pool IN ('A','B','C','D')),
  pool_slot INTEGER NOT NULL CHECK (pool_slot BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, number),
  UNIQUE (tournament_id, pool, pool_slot)
);

CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  stage TEXT NOT NULL CHECK (stage IN ('pool','bracket')),
  pool TEXT,
  round INTEGER,
  bracket_round TEXT,
  label TEXT NOT NULL,
  court TEXT,
  team_a_id BIGINT REFERENCES teams(id),
  team_b_id BIGINT REFERENCES teams(id),
  ref_team_id BIGINT REFERENCES teams(id),
  a_sets INTEGER,
  b_sets INTEGER,
  a_pts INTEGER,
  b_pts INTEGER,
  seed_a INTEGER,
  seed_b INTEGER,
  next_match_id BIGINT REFERENCES matches(id),
  next_side TEXT CHECK (next_side IN ('a','b')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','final')),
  starts_at TIMESTAMPTZ,   -- when the automatic next-game announcement says it starts
  started_at TIMESTAMPTZ,  -- logged when a ref starts the match
  ended_at TIMESTAMPTZ,    -- logged when the match becomes final
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX matches_tournament_idx ON matches (tournament_id, stage, sort_order);

CREATE TABLE match_sets (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id),
  set_number INTEGER NOT NULL,
  a_pts INTEGER NOT NULL DEFAULT 0,
  b_pts INTEGER NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, set_number)
);

CREATE TABLE registrations (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  email TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  amount_total INTEGER,
  currency TEXT,
  source TEXT NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe','manual','venmo')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid')),
  payer_name TEXT,
  team_id BIGINT REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX registrations_team_unique ON registrations (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX registrations_tournament_idx ON registrations (tournament_id, lower(email));

CREATE TABLE players (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE viewers (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, email)
);

CREATE TABLE organizers (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, email)
);

CREATE TABLE scorekeepers (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, email)
);

CREATE TABLE announcements (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  message TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  auto BOOLEAN NOT NULL DEFAULT FALSE,
  match_id BIGINT REFERENCES matches(id),
  countdown_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX announcements_tournament_idx ON announcements (tournament_id, active, created_at DESC);

CREATE TABLE platform_payments (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
