import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const traceAnalysisTable = pgTable("trace_analysis", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull(),
  version: integer("version").notNull().default(1),
  requiredProcedure: text("required_procedure"),
  actualConduct: text("actual_conduct"),
  proceduralGaps: jsonb("procedural_gaps").default([]).$type<string[]>(),
  authorityMap: jsonb("authority_map").default({}).$type<{
    statutes: string[];
    regulations: string[];
    treaties: string[];
    guidance: string[];
  }>(),
  oversightMap: jsonb("oversight_map").default({}).$type<{
    agencies: string[];
    pathways: string[];
    triggers: string[];
  }>(),
  riskScore: integer("risk_score").default(0),
  escalationRecs: jsonb("escalation_recs").default([]).$type<string[]>(),
  rawAiResponse: text("raw_ai_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTraceAnalysisSchema = createInsertSchema(traceAnalysisTable).omit({
  id: true,
  createdAt: true,
});

export type TraceAnalysis = typeof traceAnalysisTable.$inferSelect;
export type InsertTraceAnalysis = z.infer<typeof insertTraceAnalysisSchema>;
