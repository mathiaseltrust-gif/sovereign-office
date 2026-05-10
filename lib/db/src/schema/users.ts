import { pgTable, serial, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  entraId: varchar("entra_id", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  entraRequired: boolean("entra_required").notNull().default(false),
  trustPrivileges: boolean("trust_privileges").notNull().default(false),
  passwordHash: varchar("password_hash", { length: 255 }),
  passwordSalt: varchar("password_salt", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
