CREATE TABLE IF NOT EXISTS ki_conversations (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'diary')),
  content     TEXT NOT NULL,
  is_diary    BOOLEAN NOT NULL DEFAULT FALSE,
  mood        TEXT,
  session_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ki_conversations_user_id_idx ON ki_conversations (user_id, created_at DESC);
