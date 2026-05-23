CREATE TABLE IF NOT EXISTS ancestor_life_events (
  id SERIAL PRIMARY KEY,
  ancestor_id INTEGER NOT NULL REFERENCES ancestors(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_date VARCHAR(100),
  event_year INTEGER,
  event_place VARCHAR(500),
  raw_event JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ancestor_life_events_ancestor_id
  ON ancestor_life_events(ancestor_id);

CREATE INDEX IF NOT EXISTS idx_ancestor_life_events_type
  ON ancestor_life_events(event_type);

CREATE INDEX IF NOT EXISTS idx_ancestor_life_events_year
  ON ancestor_life_events(event_year);
