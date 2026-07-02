import { z } from "zod";

export const SectionStatus = z.enum(["ready", "partial", "missing", "needs_review"]);
export const Level = z.enum(["critical", "elevated", "active", "watch", "none"]);

export const Identity = z.object({
  profileId: z.string().nullable(),
  userId: z.string().nullable(),
  email: z.string().nullable().optional(),
  legalName: z.string().nullable().optional(),
  preferredName: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  membershipStatus: z.string().nullable().optional(),
  lineageStatus: z.string().nullable().optional(),
  profilePhoto: z.string().nullable().optional()
});

export const Section = z.object({
  status: SectionStatus,
  summary: z.string().optional(),
  records: z.array(z.unknown()).default([])
});

export const Interest = z.object({
  type: z.string(),
  basis: z.string(),
  source: z.string().optional(),
  sourceId: z.string().optional(),
  level: Level.default("watch")
});

export const Signal = z.object({
  type: z.string(),
  source: z.string(),
  status: z.enum(["open", "watch", "resolved", "needs_review"]).default("watch"),
  summary: z.string().optional()
});

export const Capability = z.object({
  capability: z.enum(["see", "learn", "organize", "remember", "protect", "self_govern", "evaluate", "create", "build", "steward"]),
  available: z.boolean(),
  tools: z.array(z.string()).default([])
});

export const ProfileView = z.object({
  identity: Identity,
  household: Section,
  land: Section,
  lineage: Section,
  atlas: Section,
  governance: Section,
  interests: z.array(Interest).default([]),
  signals: z.array(Signal).default([]),
  trace: Section,
  nfr: Section,
  documents: Section,
  companion: z.object({
    guidance: z.array(z.string()).default([]),
    recommendedPathways: z.array(z.string()).default([])
  }),
  builderHand: z.array(Capability).default([]),
  indicators: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  meta: z.object({
    status: z.enum(["generated", "partial", "needs_review", "error"]),
    confidenceScore: z.number().min(0).max(100),
    generatedAt: z.string(),
    missingSources: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([])
  })
});

export type ProfileView = z.infer<typeof ProfileView>;
export type Interest = z.infer<typeof Interest>;
export type Signal = z.infer<typeof Signal>;
export type Capability = z.infer<typeof Capability>;
