import { z } from "zod";

/**
 * Ancestry Blueprint Schema
 *
 * Purpose:
 * A small 2-3 generation upload, a 3ET file, or a larger GEDCOM import should be
 * normalized into this shape before it is used by the People Platform.
 *
 * This prevents JSON/schema drift across Profile, Atlas, Land, Companion, Intake,
 * Documents, and future Builder's Hand screens.
 */

export const BlueprintPersonRoleSchema = z.enum([
  "self",
  "parent",
  "grandparent",
  "great_grandparent",
  "child",
  "spouse",
  "kinship_member",
  "collateral_relative",
  "protected_ancestor",
  "unknown",
]);

export const BlueprintLivingStatusSchema = z.enum([
  "living",
  "presumed_deceased",
  "confirmed_deceased",
  "unknown",
]);

export const BlueprintLocationTypeSchema = z.enum([
  "birth",
  "residence",
  "marriage",
  "death",
  "burial",
  "census",
  "traditional_community",
  "relocation",
  "land_interest",
  "other",
]);

export const BlueprintSourceTypeSchema = z.enum([
  "3et_upload",
  "gedcom_upload",
  "ancestry_export",
  "manual_entry",
  "document_evidence",
  "officer_review",
  "existing_reference_tree",
]);

export const BlueprintReviewStatusSchema = z.enum([
  "unreviewed",
  "auto_matched",
  "needs_officer_review",
  "lineage_approved",
  "lineage_rejected",
  "needs_more_evidence",
]);

export const BlueprintLocationSchema = z.object({
  id: z.string().optional(),
  personLocalId: z.string(),
  locationType: BlueprintLocationTypeSchema,
  locationName: z.string().nullable().optional(),
  placeText: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  dateText: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
});

export const BlueprintRelationshipSchema = z.object({
  id: z.string().optional(),
  fromPersonLocalId: z.string(),
  toPersonLocalId: z.string(),
  relationshipType: z.enum([
    "parent",
    "child",
    "spouse",
    "sibling",
    "ancestor",
    "descendant",
    "kinship",
    "unknown",
  ]),
  generationDistance: z.number().int().nullable().optional(),
  evidenceRef: z.string().nullable().optional(),
});

export const BlueprintPersonSchema = z.object({
  localId: z.string(),
  externalId: z.string().nullable().optional(),
  fullName: z.string(),
  givenName: z.string().nullable().optional(),
  surname: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  roleToApplicant: BlueprintPersonRoleSchema.default("unknown"),
  generationDistance: z.number().int().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  deathDate: z.string().nullable().optional(),
  deathYear: z.number().int().nullable().optional(),
  livingStatus: BlueprintLivingStatusSchema.default("unknown"),
  sourceCount: z.number().int().default(0),
  mediaCount: z.number().int().default(0),
  profilePhotoRef: z.string().nullable().optional(),
  reviewStatus: BlueprintReviewStatusSchema.default("unreviewed"),
  notes: z.array(z.string()).default([]),
});

export const ThreeGenerationUploadSchema = z.object({
  uploadKind: z.literal("three_generation_upload"),
  applicantProfileId: z.string().nullable().optional(),
  submittedByUserId: z.string().nullable().optional(),
  sourceType: BlueprintSourceTypeSchema.default("3et_upload"),
  submittedAt: z.string().datetime().optional(),
  people: z.array(BlueprintPersonSchema),
  relationships: z.array(BlueprintRelationshipSchema).default([]),
  locations: z.array(BlueprintLocationSchema).default([]),
  sourceNotes: z.array(z.string()).default([]),
});

export const ReferenceTreeBlueprintSchema = z.object({
  uploadKind: z.literal("reference_tree"),
  sourceType: BlueprintSourceTypeSchema.default("existing_reference_tree"),
  referenceName: z.string().default("Mathias El Tribe Reference Lineage"),
  people: z.array(BlueprintPersonSchema),
  relationships: z.array(BlueprintRelationshipSchema).default([]),
  locations: z.array(BlueprintLocationSchema).default([]),
  sourceNotes: z.array(z.string()).default([]),
});

export const AncestryBlueprintSchema = z.discriminatedUnion("uploadKind", [
  ThreeGenerationUploadSchema,
  ReferenceTreeBlueprintSchema,
]);

export type BlueprintPerson = z.infer<typeof BlueprintPersonSchema>;
export type BlueprintRelationship = z.infer<typeof BlueprintRelationshipSchema>;
export type BlueprintLocation = z.infer<typeof BlueprintLocationSchema>;
export type ThreeGenerationUpload = z.infer<typeof ThreeGenerationUploadSchema>;
export type ReferenceTreeBlueprint = z.infer<typeof ReferenceTreeBlueprintSchema>;
export type AncestryBlueprint = z.infer<typeof AncestryBlueprintSchema>;

export function validateAncestryBlueprint(input: unknown): AncestryBlueprint {
  return AncestryBlueprintSchema.parse(input);
}
