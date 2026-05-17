import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nfrReviewSignalsTable = pgTable("nfr_review_signals", {
  id: serial("id").primaryKey(),
  investigationId: integer("investigation_id"),
  userId: integer("user_id"),
  signalType: varchar("signal_type", { length: 80 }).notNull(),
  context: text("context"),
  source: varchar("source", { length: 60 }).notNull().default("system"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNfrReviewSignalSchema = createInsertSchema(nfrReviewSignalsTable).omit({
  id: true, createdAt: true,
});
export type InsertNfrReviewSignal = z.infer<typeof insertNfrReviewSignalSchema>;
export type NfrReviewSignal = typeof nfrReviewSignalsTable.$inferSelect;
