-- TRACE: Tribal Rights & Administrative Compliance Engine tables

CREATE TABLE IF NOT EXISTS trace_matters (
  id              SERIAL PRIMARY KEY,
  created_by      INTEGER NOT NULL,
  assigned_to     INTEGER,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  source_type     VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_ref      TEXT,
  matter_type     VARCHAR(80) NOT NULL DEFAULT 'general',
  status          VARCHAR(50) NOT NULL DEFAULT 'pending',
  risk_level      VARCHAR(20) NOT NULL DEFAULT 'low',
  niac_pathway    BOOLEAN NOT NULL DEFAULT false,
  intake_link_id  INTEGER,
  deadline_at     TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trace_analysis (
  id                  SERIAL PRIMARY KEY,
  matter_id           INTEGER NOT NULL REFERENCES trace_matters(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL DEFAULT 1,
  required_procedure  TEXT,
  actual_conduct      TEXT,
  procedural_gaps     JSONB DEFAULT '[]',
  authority_map       JSONB DEFAULT '{}',
  oversight_map       JSONB DEFAULT '{}',
  risk_score          INTEGER DEFAULT 0,
  escalation_recs     JSONB DEFAULT '[]',
  raw_ai_response     TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trace_drafts (
  id           SERIAL PRIMARY KEY,
  matter_id    INTEGER NOT NULL REFERENCES trace_matters(id) ON DELETE CASCADE,
  draft_type   VARCHAR(50) NOT NULL DEFAULT 'summary',
  content      TEXT NOT NULL,
  approved     BOOLEAN NOT NULL DEFAULT false,
  approved_by  INTEGER,
  approved_at  TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trace_matters_status ON trace_matters(status);
CREATE INDEX IF NOT EXISTS idx_trace_matters_created_by ON trace_matters(created_by);
CREATE INDEX IF NOT EXISTS idx_trace_matters_niac_pathway ON trace_matters(niac_pathway);
CREATE INDEX IF NOT EXISTS idx_trace_analysis_matter_id ON trace_analysis(matter_id);
CREATE INDEX IF NOT EXISTS idx_trace_drafts_matter_id ON trace_drafts(matter_id);
