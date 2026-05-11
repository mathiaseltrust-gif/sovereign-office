import { pgTable, serial, integer, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const forumPostsTable = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 100 }),
  authorId: integer("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  authorName: varchar("author_name", { length: 255 }),
  pinned: boolean("pinned").notNull().default(false),
  replyCount: integer("reply_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const forumRepliesTable = pgTable("forum_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => forumPostsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorId: integer("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  authorName: varchar("author_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ForumPost = typeof forumPostsTable.$inferSelect;
export type ForumReply = typeof forumRepliesTable.$inferSelect;
