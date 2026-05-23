CREATE TABLE IF NOT EXISTS ancestors (
    id SERIAL PRIMARY KEY,
    gedcom_id VARCHAR(100) UNIQUE,

    full_name VARCHAR(400) NOT NULL,
    given_name VARCHAR(200),
    surname VARCHAR(200),

    gender VARCHAR(50),

    birth_date VARCHAR(100),
    birth_year INTEGER,
    birth_place VARCHAR(500),

    death_date VARCHAR(100),
    death_year INTEGER,
    death_place VARCHAR(500),

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    source_batch_id INTEGER
        REFERENCES gedcom_import_batches(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ancestor_relationships (
    id SERIAL PRIMARY KEY,

    ancestor_id INTEGER NOT NULL
        REFERENCES ancestors(id)
        ON DELETE CASCADE,

    related_ancestor_id INTEGER NOT NULL
        REFERENCES ancestors(id)
        ON DELETE CASCADE,

    relationship_type VARCHAR(50) NOT NULL,

    source VARCHAR(50) NOT NULL DEFAULT 'gedcom',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ancestors_gedcom_id
    ON ancestors(gedcom_id);

CREATE INDEX IF NOT EXISTS idx_ancestors_surname
    ON ancestors(surname);

CREATE INDEX IF NOT EXISTS idx_ancestors_birth_year
    ON ancestors(birth_year);

CREATE INDEX IF NOT EXISTS idx_ancestor_relationships_ancestor_id
    ON ancestor_relationships(ancestor_id);

CREATE INDEX IF NOT EXISTS idx_ancestor_relationships_related_id
    ON ancestor_relationships(related_ancestor_id);

CREATE INDEX IF NOT EXISTS idx_ancestor_relationships_type
    ON ancestor_relationships(relationship_type);
