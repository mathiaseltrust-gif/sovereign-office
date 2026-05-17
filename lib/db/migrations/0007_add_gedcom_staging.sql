CREATE TABLE IF NOT EXISTS gedcom_import_batches (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(500) NOT NULL,
  imported_by   INTEGER,
  record_count  INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  pending_count  INTEGER DEFAULT 0,
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gedcom_staging (
  id                    SERIAL PRIMARY KEY,
  batch_id              INTEGER REFERENCES gedcom_import_batches(id) ON DELETE CASCADE,
  gedcom_id             VARCHAR(100),
  full_name             VARCHAR(400) NOT NULL,
  given_name            VARCHAR(200),
  surname               VARCHAR(200),
  birth_date            VARCHAR(100),
  birth_year            INTEGER,
  birth_place           VARCHAR(500),
  death_date            VARCHAR(100),
  death_year            INTEGER,
  death_place           VARCHAR(500),
  gender                VARCHAR(50),
  father_gedcom_id      VARCHAR(100),
  mother_gedcom_id      VARCHAR(100),
  spouse_gedcom_ids     JSONB DEFAULT '[]',
  children_gedcom_ids   JSONB DEFAULT '[]',
  census_labels         JSONB DEFAULT '[]',
  source_records        JSONB DEFAULT '[]',
  notes                 TEXT,
  confidence_score      REAL DEFAULT 1.0,
  match_type            VARCHAR(50) DEFAULT 'new',
  matched_ancestor_id   INTEGER,
  matched_ancestor_name VARCHAR(400),
  duplicate_group_id    VARCHAR(100),
  status                VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gedcom_staging_batch_id_idx ON gedcom_staging (batch_id);
CREATE INDEX IF NOT EXISTS gedcom_staging_status_idx ON gedcom_staging (status);
CREATE INDEX IF NOT EXISTS gedcom_staging_match_type_idx ON gedcom_staging (match_type);
