import { sql } from "drizzle-orm";
import { db, entityAliasesTable } from "@workspace/db";
import {
  associateDocument,
  recordListenerEvent,
  type AssociationConfidence,
  type ResolutionMethod,
} from "./document-association";

export interface EntityCandidate {
  entityType: "parcel" | "organization" | "person" | "member" | "case";
  entityId: string;
  displayLabel: string;
  relationshipType: string;
  confidence: AssociationConfidence;
  resolutionMethod: ResolutionMethod;
  matchedField: string;
  matchedValue: string;
  metadata?: Record<string, unknown>;
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEntityAlias(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,:;'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushUnique(target: EntityCandidate[], candidate: EntityCandidate) {
  const key = [
    candidate.entityType,
    candidate.entityId,
    candidate.relationshipType,
    candidate.matchedField,
  ].join(":");
  if (!target.some((item) => [
    item.entityType,
    item.entityId,
    item.relationshipType,
    item.matchedField,
  ].join(":") === key)) {
    target.push(candidate);
  }
}

async function resolveVerifiedAlias(
  entityType: string,
  aliasType: string | null,
  value: string,
): Promise<Array<{ entityId: string; aliasValue: string }>> {
  const normalized = normalizeEntityAlias(value);
  if (!normalized) return [];

  const result = await db.execute(sql`
    SELECT entity_id, alias_value
    FROM entity_aliases
    WHERE entity_type = ${entityType}
      AND (${aliasType}::text IS NULL OR alias_type = ${aliasType})
      AND normalized_value = ${normalized}
      AND verified = true
    ORDER BY id ASC
    LIMIT 10
  `);

  return result.rows.map((row) => ({
    entityId: String((row as Record<string, unknown>).entity_id),
    aliasValue: String((row as Record<string, unknown>).alias_value),
  }));
}

async function resolveParcelIdentifier(
  field: string,
  value: string,
  target: EntityCandidate[],
) {
  const normalized = normalizeEntityAlias(value);
  if (!normalized) return;

  const direct = await db.execute(sql`
    SELECT id, parcel_id, tract_number, bia_tract_number, tribal_ref
    FROM land_parcels
    WHERE regexp_replace(lower(COALESCE(parcel_id, '')), '[^a-z0-9]', '', 'g') = ${normalized}
       OR regexp_replace(lower(COALESCE(tract_number, '')), '[^a-z0-9]', '', 'g') = ${normalized}
       OR regexp_replace(lower(COALESCE(bia_tract_number, '')), '[^a-z0-9]', '', 'g') = ${normalized}
       OR regexp_replace(lower(COALESCE(tribal_ref, '')), '[^a-z0-9]', '', 'g') = ${normalized}
    ORDER BY id ASC
    LIMIT 10
  `);

  for (const row of direct.rows as Record<string, unknown>[]) {
    const label = String(row.parcel_id ?? row.tract_number ?? row.tribal_ref ?? ("Parcel " + row.id));
    pushUnique(target, {
      entityType: "parcel",
      entityId: String(row.id),
      displayLabel: label,
      relationshipType: "related_property",
      confidence: "exact",
      resolutionMethod: "parcel_number",
      matchedField: field,
      matchedValue: value,
      metadata: {
        parcelId: row.parcel_id ?? null,
        tractNumber: row.tract_number ?? null,
        biaTractNumber: row.bia_tract_number ?? null,
        tribalRef: row.tribal_ref ?? null,
      },
    });
  }

  const aliases = await resolveVerifiedAlias("parcel", null, value);
  for (const alias of aliases) {
    pushUnique(target, {
      entityType: "parcel",
      entityId: alias.entityId,
      displayLabel: alias.aliasValue,
      relationshipType: "related_property",
      confidence: "exact",
      resolutionMethod: "verified_alias",
      matchedField: field,
      matchedValue: value,
    });
  }
}

async function resolveCaseNumber(value: string, target: EntityCandidate[]) {
  const result = await db.execute(sql`
    SELECT id, case_number, title
    FROM case_files
    WHERE lower(case_number) = lower(${value})
    ORDER BY id ASC
    LIMIT 10
  `);
  for (const row of result.rows as Record<string, unknown>[]) {
    pushUnique(target, {
      entityType: "case",
      entityId: String(row.id),
      displayLabel: String(row.case_number ?? row.title ?? ("Case " + row.id)),
      relationshipType: "evidence",
      confidence: "exact",
      resolutionMethod: "case_number",
      matchedField: "caseNumber",
      matchedValue: value,
      metadata: { caseNumber: row.case_number ?? null, title: row.title ?? null },
    });
  }
}

async function resolveOrganizationIdentifier(
  field: string,
  value: string,
  relationshipType: string,
  target: EntityCandidate[],
) {
  const normalizedIdentifier = normalizeEntityAlias(value);
  const normalizedLabel = normalizeName(value);

  if (field === "ein" && normalizedIdentifier) {
    const byEin = await db.execute(sql`
      SELECT org_id, legal_name, ein
      FROM org_profiles
      WHERE regexp_replace(lower(COALESCE(ein, '')), '[^a-z0-9]', '', 'g') = ${normalizedIdentifier}
      ORDER BY id ASC
      LIMIT 10
    `);
    for (const row of byEin.rows as Record<string, unknown>[]) {
      pushUnique(target, {
        entityType: "organization",
        entityId: String(row.org_id),
        displayLabel: String(row.legal_name ?? row.org_id),
        relationshipType,
        confidence: "exact",
        resolutionMethod: "external_source_id",
        matchedField: field,
        matchedValue: value,
        metadata: { ein: row.ein ?? null },
      });
    }
    return;
  }

  if (!normalizedLabel) return;
  const byName = await db.execute(sql`
    SELECT org_id, legal_name, ein
    FROM org_profiles
    WHERE regexp_replace(lower(COALESCE(legal_name, '')), '[^a-z0-9]', '', 'g') = ${normalizeEntityAlias(value)}
       OR lower(org_id) = lower(${value})
    ORDER BY id ASC
    LIMIT 10
  `);

  if (byName.rows.length === 1) {
    const row = byName.rows[0] as Record<string, unknown>;
    pushUnique(target, {
      entityType: "organization",
      entityId: String(row.org_id),
      displayLabel: String(row.legal_name ?? row.org_id),
      relationshipType,
      confidence: "high",
      resolutionMethod: "normalized_name",
      matchedField: field,
      matchedValue: value,
      metadata: { einPresent: Boolean(row.ein) },
    });
  }
}

async function resolvePersonIdentifier(
  field: string,
  value: string,
  relationshipType: string,
  target: EntityCandidate[],
) {
  if (field === "tribalIdNumber") {
    const result = await db.execute(sql`
      SELECT id, full_name, tribal_id_number, protection_level, linked_profile_user_id
      FROM family_lineage
      WHERE tribal_id_number = ${value}
      ORDER BY id ASC
      LIMIT 10
    `);
    for (const row of result.rows as Record<string, unknown>[]) {
      pushUnique(target, {
        entityType: row.linked_profile_user_id ? "member" : "person",
        entityId: String(row.id),
        displayLabel: String(row.full_name),
        relationshipType,
        confidence: "exact",
        resolutionMethod: "tribal_id",
        matchedField: field,
        matchedValue: value,
        metadata: {
          protectionLevel: row.protection_level ?? null,
          linkedProfileUserId: row.linked_profile_user_id ?? null,
        },
      });
    }
    return;
  }

  if (field === "enrollmentNumber") {
    const result = await db.execute(sql`
      SELECT id, full_name, tribal_enrollment_number, protection_level, linked_profile_user_id
      FROM family_lineage
      WHERE tribal_enrollment_number = ${value}
      ORDER BY id ASC
      LIMIT 10
    `);
    for (const row of result.rows as Record<string, unknown>[]) {
      pushUnique(target, {
        entityType: row.linked_profile_user_id ? "member" : "person",
        entityId: String(row.id),
        displayLabel: String(row.full_name),
        relationshipType,
        confidence: "exact",
        resolutionMethod: "external_source_id",
        matchedField: field,
        matchedValue: value,
        metadata: {
          protectionLevel: row.protection_level ?? null,
          linkedProfileUserId: row.linked_profile_user_id ?? null,
        },
      });
    }
    return;
  }

  if (field === "email") {
    const result = await db.execute(sql`
      SELECT id, full_name, contact_email, protection_level, linked_profile_user_id
      FROM family_lineage
      WHERE lower(contact_email) = lower(${value})
      ORDER BY id ASC
      LIMIT 10
    `);
    for (const row of result.rows as Record<string, unknown>[]) {
      pushUnique(target, {
        entityType: row.linked_profile_user_id ? "member" : "person",
        entityId: String(row.id),
        displayLabel: String(row.full_name),
        relationshipType,
        confidence: "high",
        resolutionMethod: "verified_email",
        matchedField: field,
        matchedValue: value,
        metadata: {
          protectionLevel: row.protection_level ?? null,
          linkedProfileUserId: row.linked_profile_user_id ?? null,
        },
      });
    }
    return;
  }

  const normalized = normalizeName(value);
  if (!normalized) return;
  const result = await db.execute(sql`
    SELECT id, full_name, protection_level, linked_profile_user_id
    FROM family_lineage
    WHERE regexp_replace(lower(full_name), '[^a-z0-9]', '', 'g') = ${normalizeEntityAlias(value)}
    ORDER BY id ASC
    LIMIT 10
  `);

  if (result.rows.length === 1) {
    const row = result.rows[0] as Record<string, unknown>;
    pushUnique(target, {
      entityType: row.linked_profile_user_id ? "member" : "person",
      entityId: String(row.id),
      displayLabel: String(row.full_name),
      relationshipType,
      confidence: "high",
      resolutionMethod: "normalized_name",
      matchedField: field,
      matchedValue: value,
      metadata: {
        protectionLevel: row.protection_level ?? null,
        linkedProfileUserId: row.linked_profile_user_id ?? null,
      },
    });
  }
}

export async function resolveDocumentEntities(
  fields: Record<string, unknown>,
): Promise<EntityCandidate[]> {
  const candidates: EntityCandidate[] = [];

  for (const field of ["parcelId", "apn", "atn"] as const) {
    const value = textValue(fields[field]);
    if (value) await resolveParcelIdentifier(field, value, candidates);
  }

  const caseNumber = textValue(fields.caseNumber);
  if (caseNumber) await resolveCaseNumber(caseNumber, candidates);

  const ein = textValue(fields.ein);
  if (ein) await resolveOrganizationIdentifier("ein", ein, "subject", candidates);

  for (const field of ["trustName", "tribalEntity"] as const) {
    const value = textValue(fields[field]);
    if (value) {
      await resolveOrganizationIdentifier(
        field,
        value,
        field === "trustName" ? "governing_instrument" : "subject",
        candidates,
      );
    }
  }

  for (const field of ["tribalIdNumber", "enrollmentNumber", "email"] as const) {
    const value = textValue(fields[field]);
    if (value) await resolvePersonIdentifier(field, value, "subject", candidates);
  }

  const personFields: Array<[string, string]> = [
    ["personName", "subject"],
    ["ownerOnRecord", "owner"],
    ["petitioner", "subject"],
    ["grantor", "grantor"],
    ["grantee", "grantee"],
    ["trustor", "grantor"],
    ["trustee", "trustee"],
    ["beneficiary", "beneficiary"],
  ];
  for (const [field, relationshipType] of personFields) {
    const value = textValue(fields[field]);
    if (value) await resolvePersonIdentifier(field, value, relationshipType, candidates);
  }

  return candidates;
}

export async function persistResolvedAssociations(input: {
  documentId: number;
  fields: Record<string, unknown>;
  verifiedBy?: number | null;
}) {
  const candidates = await resolveDocumentEntities(input.fields);
  const associations = [];

  for (const candidate of candidates) {
    const association = await associateDocument({
      documentId: input.documentId,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      relationshipType: candidate.relationshipType,
      confidence: candidate.confidence,
      resolutionMethod: candidate.resolutionMethod,
      metadata: {
        displayLabel: candidate.displayLabel,
        matchedField: candidate.matchedField,
        matchedValue: candidate.matchedValue,
        ...(candidate.metadata ?? {}),
      },
      verifiedBy: input.verifiedBy ?? null,
    });

    if (association) associations.push(association);

    await recordListenerEvent({
      documentId: input.documentId,
      listenerName: "entity-resolver",
      eventType: "DOCUMENT_ENTITY_MATCHED",
      actionState: association?.status ?? "existing",
      payload: {
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        displayLabel: candidate.displayLabel,
        relationshipType: candidate.relationshipType,
        confidence: candidate.confidence,
        resolutionMethod: candidate.resolutionMethod,
        matchedField: candidate.matchedField,
      },
    });

    const protectionLevel = String(candidate.metadata?.protectionLevel ?? "").toLowerCase();
    if (
      protectionLevel &&
      !["pending", "standard", "none", "null"].includes(protectionLevel)
    ) {
      await recordListenerEvent({
        documentId: input.documentId,
        listenerName: "protection-listener",
        eventType: "DOCUMENT_LINKED_TO_PROTECTED_PERSON",
        actionState: association?.status ?? "existing",
        payload: {
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          displayLabel: candidate.displayLabel,
          protectionLevel,
        },
      });
    }
  }

  return { candidates, associations };
}

export async function ensureEntityAlias(input: {
  entityType: string;
  entityId: string;
  aliasType: string;
  aliasValue: string;
  verified?: boolean;
  source?: string;
  createdBy?: number | null;
}) {
  const normalizedValue = normalizeEntityAlias(input.aliasValue);
  if (!normalizedValue) return null;

  const inserted = await db.insert(entityAliasesTable).values({
    entityType: input.entityType,
    entityId: input.entityId,
    aliasType: input.aliasType,
    aliasValue: input.aliasValue,
    normalizedValue,
    verified: input.verified ?? false,
    source: input.source ?? "manual",
    createdBy: input.createdBy ?? null,
  }).onConflictDoNothing().returning();

  return inserted[0] ?? null;
}
