import { pgTable, text, serial, integer, boolean, timestamp, json, relations } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  organization: text("organization"),
  profession: text("profession"),
  openaiApiKey: text("openai_api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  activities: many(activities),
  queries: many(queries),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  organization: true,
  profession: true,
}).extend({
  confirmPassword: z.string(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Document schema
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  content: text("content").notNull(),
  indexed: boolean("indexed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const insertDocumentSchema = createInsertSchema(documents).pick({
  userId: true,
  filename: true,
  originalFilename: true,
  fileType: true,
  fileSize: true,
  content: true,
  indexed: true,
});

// Activity schema
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'upload', 'query', 'api_key_update', etc.
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const insertActivitySchema = createInsertSchema(activities).pick({
  userId: true,
  type: true,
  details: true,
});

// Query history schema
export const queries = pgTable("queries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  response: text("response").notNull(),
  documentIds: json("document_ids").notNull().$type<number[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const queriesRelations = relations(queries, ({ one }) => ({
  user: one(users, {
    fields: [queries.userId],
    references: [users.id],
  }),
}));

export const insertQuerySchema = createInsertSchema(queries).pick({
  userId: true,
  query: true,
  response: true,
  documentIds: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Query = typeof queries.$inferSelect;
export type InsertQuery = z.infer<typeof insertQuerySchema>;
