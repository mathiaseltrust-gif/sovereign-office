-- Backfill pre-SRAE organization and repository-deed records into the
-- canonical document registry without copying file bytes.
--
-- Idempotency:
--   * document_registry rows are matched by storage_key.
--   * document associations use the existing unique association index.
--   * aliases use the existing unique alias index.

-- ---------------------------------------------------------------------------
-- 1. Existing organization documents -> one canonical document per file_key.
--    If several organizations already point at the same file, preserve that
--    as one registry record with several associations.
-- ---------------------------------------------------------------------------
WITH canonical_org_sources AS (
  SELECT DISTINCT ON (file_key)
    id,
    file_key,
    filename,
    label,
    doc_type,
    uploaded_by,
    uploaded_at
  FROM org_documents
  WHERE file_key IS NOT NULL
    AND btrim(file_key) <> ''
  ORDER BY file_key, id
)
INSERT INTO document_registry (
  document_ref,
  title,
  original_filename,
  storage_provider,
  storage_key,
  source_channel,
  classification,
  verification_state,
  sensitivity_level,
  metadata,
  created_by,
  created_at,
  updated_at
)
SELECT
  'DOC-LEGACY-ORG-' || lpad(source.id::text, 6, '0'),
  source.label,
  source.filename,
  'office_object_storage',
  source.file_key,
  'organization_upload',
  source.doc_type,
  'received',
  'internal',
  jsonb_build_object(
    'backfilled', true,
    'legacyOrgDocumentId', source.id
  ),
  NULL,
  COALESCE(source.uploaded_at, now()),
  now()
FROM canonical_org_sources source
WHERE NOT EXISTS (
  SELECT 1
  FROM document_registry existing
  WHERE existing.storage_key = source.file_key
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO document_associations (
  document_id,
  entity_type,
  entity_id,
  relationship_type,
  confidence,
  resolution_method,
  status,
  metadata,
  verified_by,
  verified_at
)
SELECT
  registry.id,
  'organization',
  org_doc.org_id,
  CASE WHEN org_doc.doc_type = 'evidence' THEN 'evidence' ELSE 'governing_instrument' END,
  'exact',
  'system_created',
  'active',
  jsonb_build_object(
    'backfilled', true,
    'orgDocumentId', org_doc.id,
    'label', org_doc.label,
    'docType', org_doc.doc_type
  ),
  NULL,
  now()
FROM org_documents org_doc
JOIN document_registry registry
  ON registry.storage_key = org_doc.file_key
WHERE org_doc.file_key IS NOT NULL
  AND btrim(org_doc.file_key) <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO document_associations (
  document_id,
  entity_type,
  entity_id,
  relationship_type,
  confidence,
  resolution_method,
  status,
  metadata,
  verified_by,
  verified_at
)
SELECT
  registry.id,
  'organization_document',
  org_doc.id::text,
  'source_record',
  'exact',
  'system_created',
  'active',
  jsonb_build_object(
    'backfilled', true,
    'orgId', org_doc.org_id
  ),
  NULL,
  now()
FROM org_documents org_doc
JOIN document_registry registry
  ON registry.storage_key = org_doc.file_key
WHERE org_doc.file_key IS NOT NULL
  AND btrim(org_doc.file_key) <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Existing organization identifiers become verified resolver aliases.
-- ---------------------------------------------------------------------------
INSERT INTO entity_aliases (
  entity_type,
  entity_id,
  alias_type,
  alias_value,
  normalized_value,
  verified,
  source,
  created_by
)
SELECT
  'organization',
  profile.org_id,
  'legalName',
  profile.legal_name,
  regexp_replace(lower(profile.legal_name), '[^a-z0-9]', '', 'g'),
  true,
  'org_profile_backfill',
  profile.updated_by
FROM org_profiles profile
WHERE profile.legal_name IS NOT NULL
  AND btrim(profile.legal_name) <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO entity_aliases (
  entity_type,
  entity_id,
  alias_type,
  alias_value,
  normalized_value,
  verified,
  source,
  created_by
)
SELECT
  'organization',
  profile.org_id,
  'ein',
  profile.ein,
  regexp_replace(lower(profile.ein), '[^a-z0-9]', '', 'g'),
  true,
  'org_profile_backfill',
  profile.updated_by
FROM org_profiles profile
WHERE profile.ein IS NOT NULL
  AND btrim(profile.ein) <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Existing parcel identifiers become verified aliases.
-- ---------------------------------------------------------------------------
INSERT INTO entity_aliases (
  entity_type,
  entity_id,
  alias_type,
  alias_value,
  normalized_value,
  verified,
  source
)
SELECT
  'parcel',
  parcel.id::text,
  alias.alias_type,
  alias.alias_value,
  regexp_replace(lower(alias.alias_value), '[^a-z0-9]', '', 'g'),
  true,
  'land_registry_backfill'
FROM land_parcels parcel
CROSS JOIN LATERAL (
  VALUES
    ('parcelId', parcel.parcel_id),
    ('tractNumber', parcel.tract_number),
    ('biaTractNumber', parcel.bia_tract_number),
    ('tribalRef', parcel.tribal_ref)
) AS alias(alias_type, alias_value)
WHERE alias.alias_value IS NOT NULL
  AND btrim(alias.alias_value) <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Preserve known alternate identifiers for the existing Kern parcel when the
-- parcel is already registered. These aliases point to the existing parcel row
-- and do not create a second parcel.
INSERT INTO entity_aliases (
  entity_type,
  entity_id,
  alias_type,
  alias_value,
  normalized_value,
  verified,
  source
)
SELECT
  'parcel',
  parcel.id::text,
  alias.alias_type,
  alias.alias_value,
  regexp_replace(lower(alias.alias_value), '[^a-z0-9]', '', 'g'),
  true,
  'repository_deed_backfill'
FROM land_parcels parcel
CROSS JOIN (
  VALUES
    ('atn', '514-364-11-00-1'),
    ('parcelId', '514-364-11-6'),
    ('apn', '514-300-03'),
    ('tractNumber', 'MET-TL-BC-001')
) AS alias(alias_type, alias_value)
WHERE
  parcel.parcel_id IN ('514-364-11-6', '514-364-11-00-1')
  OR parcel.tract_number = 'MET-TL-BC-001'
  OR parcel.tribal_ref = 'MET-TL-BC-001'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Existing repository-backed land deeds -> canonical repository documents.
-- ---------------------------------------------------------------------------
WITH canonical_repository_deeds AS (
  SELECT DISTINCT ON (file_key)
    id,
    parcel_id,
    deed_type,
    file_key,
    file_name,
    file_url,
    grantor,
    grantee,
    recording_jurisdiction,
    created_at
  FROM land_deeds
  WHERE file_key LIKE 'repository:%'
  ORDER BY file_key, id
)
INSERT INTO document_registry (
  document_ref,
  title,
  original_filename,
  storage_provider,
  storage_key,
  external_id,
  source_channel,
  source_uri,
  classification,
  verification_state,
  sensitivity_level,
  metadata,
  created_by,
  created_at,
  updated_at
)
SELECT
  'DOC-LEGACY-LAND-' || lpad(deed.id::text, 6, '0'),
  COALESCE(deed.file_name, 'Repository land deed'),
  COALESCE(deed.file_name, replace(deed.file_key, 'repository:', '') || '.pdf'),
  'repository_asset',
  deed.file_key,
  replace(deed.file_key, 'repository:', ''),
  'repository_asset',
  deed.file_url,
  deed.deed_type,
  'repository_verified',
  'internal',
  jsonb_build_object(
    'backfilled', true,
    'legacyLandDeedId', deed.id,
    'grantor', deed.grantor,
    'grantee', deed.grantee,
    'recordingJurisdiction', deed.recording_jurisdiction
  ),
  NULL,
  COALESCE(deed.created_at, now()),
  now()
FROM canonical_repository_deeds deed
WHERE NOT EXISTS (
  SELECT 1
  FROM document_registry existing
  WHERE existing.storage_key = deed.file_key
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO document_associations (
  document_id,
  entity_type,
  entity_id,
  relationship_type,
  confidence,
  resolution_method,
  status,
  metadata,
  verified_by,
  verified_at
)
SELECT
  registry.id,
  'parcel',
  deed.parcel_id::text,
  'related_property',
  'exact',
  'system_created',
  'active',
  jsonb_build_object(
    'backfilled', true,
    'landDeedId', deed.id,
    'fileKey', deed.file_key
  ),
  NULL,
  now()
FROM land_deeds deed
JOIN document_registry registry
  ON registry.storage_key = deed.file_key
WHERE deed.file_key LIKE 'repository:%'
  AND deed.parcel_id IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO document_associations (
  document_id,
  entity_type,
  entity_id,
  relationship_type,
  confidence,
  resolution_method,
  status,
  metadata,
  verified_by,
  verified_at
)
SELECT
  registry.id,
  'land_deed',
  deed.id::text,
  'source_record',
  'exact',
  'system_created',
  'active',
  jsonb_build_object(
    'backfilled', true,
    'parcelId', deed.parcel_id
  ),
  NULL,
  now()
FROM land_deeds deed
JOIN document_registry registry
  ON registry.storage_key = deed.file_key
WHERE deed.file_key LIKE 'repository:%'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- One audit-style listener event per newly recognizable legacy canonical record.
INSERT INTO document_listener_events (
  document_id,
  listener_name,
  event_type,
  action_state,
  payload
)
SELECT
  registry.id,
  'legacy-backfill',
  'LEGACY_DOCUMENT_CANONICALIZED',
  'active',
  jsonb_build_object(
    'storageKey', registry.storage_key,
    'storageProvider', registry.storage_provider
  )
FROM document_registry registry
WHERE registry.metadata @> '{"backfilled": true}'::jsonb
  AND NOT EXISTS (
    SELECT 1
    FROM document_listener_events event
    WHERE event.document_id = registry.id
      AND event.listener_name = 'legacy-backfill'
      AND event.event_type = 'LEGACY_DOCUMENT_CANONICALIZED'
  );
