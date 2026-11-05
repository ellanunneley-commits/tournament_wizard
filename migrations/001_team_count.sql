-- Tournaments can have 8 or 16 teams. Existing tournaments keep 16.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS team_count INTEGER NOT NULL DEFAULT 16 CHECK (team_count IN (8, 16));
