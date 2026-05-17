CREATE TABLE IF NOT EXISTS family_units (
  id               SERIAL PRIMARY KEY,
  gedcom_fam_id    VARCHAR(100),
  husband_id       INTEGER REFERENCES family_lineage(id) ON DELETE SET NULL,
  wife_id          INTEGER REFERENCES family_lineage(id) ON DELETE SET NULL,
  spouse_ids       JSONB NOT NULL DEFAULT '[]',
  child_ids        JSONB NOT NULL DEFAULT '[]',
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'biological',
  source_type      VARCHAR(50) NOT NULL DEFAULT 'manual',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_units_husband_id_idx    ON family_units (husband_id);
CREATE INDEX IF NOT EXISTS family_units_wife_id_idx       ON family_units (wife_id);
CREATE INDEX IF NOT EXISTS family_units_gedcom_fam_id_idx ON family_units (gedcom_fam_id);
