import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

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
  role: text("role").default("user").notNull(), // 'user', 'admin' o 'demo'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Campi per la modalità demo
  accountType: text("account_type").default("regular").notNull(), // 'regular' o 'demo'
  demoExpiresAt: timestamp("demo_expires_at"), // Data di scadenza della demo
  dataRetentionUntil: timestamp("data_retention_until"), // Data di eliminazione dei dati dopo scadenza
  isActive: boolean("is_active").default(true).notNull(), // Indica se l'account è attivo o disabilitato
});

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  activities: many(activities),
  queries: many(queries),
  signatureProjects: many(signatureProjects),
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
});

export const updateUserRoleSchema = z.object({
  userId: z.number().positive(),
  role: z.string().refine(value => ['user', 'admin', 'demo'].includes(value), {
    message: "Role must be either 'user', 'admin', or 'demo'"
  })
});

// Schema per la creazione di account demo
export const createDemoAccountSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  fullName: z.string().optional(),
  organization: z.string().optional(),
  profession: z.string().optional(),
  durationDays: z.number().default(14), // Durata in giorni (default 14)
});

// Schema per l'estensione della demo
export const extendDemoSchema = z.object({
  userId: z.number().positive(),
  additionalDays: z.number().min(1).max(365),
});

export const loginUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Types for user system
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;
// User type is already declared below

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

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  embeddings: many(documentEmbeddings),
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

// Report template schema
export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  template: json("template").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reportTemplatesRelations = relations(reportTemplates, ({ one }) => ({
  user: one(users, {
    fields: [reportTemplates.userId],
    references: [users.id],
  }),
}));

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).pick({
  userId: true,
  name: true,
  description: true,
  isPublic: true,
  template: true,
  thumbnailUrl: true,
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

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;


// Type definition for signature parameters
export interface SignatureParameters {
  // Base metrics
  width: number;
  height: number;
  aspectRatio: number;
  
  // Stroke characteristics
  strokeWidth: {
    min: number;
    max: number;
    mean: number;
    variance: number;
  };
  
  // Pressure points (if available from image analysis)
  pressurePoints: {
    count: number;
    distribution: number[];
  };
  
  // Curvature metrics
  curvatureMetrics: {
    totalAngleChanges: number;
    sharpCorners: number;
    smoothCurves: number;
  };
  
  // Spatial distribution
  spatialDistribution: {
    centerOfMassX: number;
    centerOfMassY: number;
    density: number;
  };
  
  // Connectivity and line breaks
  connectivity: {
    connectedComponents: number;
    gaps: number;
  };
  
  // Feature points
  featurePoints: {
    startPoint: [number, number];
    endPoint: [number, number];
    loopPoints: number;
    crossPoints: number;
  };
  
  // Normalized vector representation
  vectorRepresentation?: number[];
  
  // Raw image features (optional)
  rawFeatures?: any;
}

// Signature Projects schema
export const signatureProjects = pgTable("signature_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  dpi: integer("dpi").default(300).notNull(), // Valore DPI per calcolare dimensioni reali (default 300)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Signatures schema
export const signatures = pgTable("signatures", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => signatureProjects.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  isReference: boolean("is_reference").default(true).notNull(),
  parameters: jsonb("parameters").$type<SignatureParameters>(),
  dpi: integer("dpi").default(300).notNull(), // Valore DPI individuale per ogni firma (default 300)
  processingStatus: text("processing_status").default("pending").notNull(), // pending, processing, completed, failed
  comparisonResult: real("comparison_result"), // null for reference signatures, 0-1 for verification signatures
  comparisonChart: text("comparison_chart"), // Base64-encoded image of the comparison chart
  analysisReport: text("analysis_report"), // Testo del report descrittivo
  reportPath: text("report_path"), // Percorso al file DOCX del report (se generato)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const signatureProjectsRelations = relations(signatureProjects, ({ one, many }) => ({
  user: one(users, {
    fields: [signatureProjects.userId],
    references: [users.id],
  }),
  signatures: many(signatures),
}));

export const signaturesRelations = relations(signatures, ({ one }) => ({
  project: one(signatureProjects, {
    fields: [signatures.projectId],
    references: [signatureProjects.id],
  }),
}));

export const insertSignatureProjectSchema = createInsertSchema(signatureProjects).pick({
  userId: true,
  name: true,
  description: true,
  dpi: true,
});

export const insertSignatureSchema = createInsertSchema(signatures).pick({
  projectId: true,
  filename: true,
  originalFilename: true,
  fileType: true,
  fileSize: true,
  isReference: true,
  dpi: true,
});

// Questa relazione è già definita in usersRelations

// Type definitions for signature projects
export type SignatureProject = typeof signatureProjects.$inferSelect;
export type InsertSignatureProject = z.infer<typeof insertSignatureProjectSchema>;

export type Signature = typeof signatures.$inferSelect;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;

// Per adesso creeremo la tabella direttamente in SQL, perché Drizzle ha difficoltà con il tipo vector
// Questa è solo una definizione "parziale" per gestire le relazioni
export const documentEmbeddings = pgTable("document_embeddings", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id),
  chunkIndex: integer("chunk_index").notNull(),
  chunkContent: text("chunk_content").notNull(),
  // L'embedding vettoriale sarà gestito direttamente tramite SQL
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentEmbeddingsRelations = relations(documentEmbeddings, ({ one }) => ({
  document: one(documents, {
    fields: [documentEmbeddings.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentEmbeddings.userId],
    references: [users.id],
  }),
}));

export const insertDocumentEmbeddingSchema = createInsertSchema(documentEmbeddings).pick({
  documentId: true,
  userId: true,
  chunkIndex: true,
  chunkContent: true,
});

export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type InsertDocumentEmbedding = z.infer<typeof insertDocumentEmbeddingSchema>;

// Impostazioni di sistema
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  key: true,
  value: true,
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingsSchema>;

// Schema per il sistema di raccomandazione
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // 'document', 'signature', 'workflow', etc.
  relevanceScore: real("relevance_score").notNull(),
  viewed: boolean("viewed").default(false).notNull(),
  dismissed: boolean("dismissed").default(false).notNull(),
  relatedDocumentIds: json("related_document_ids").$type<number[]>().default([]),
  relatedSignatureIds: json("related_signature_ids").$type<number[]>().default([]),
  relatedQueryIds: json("related_query_ids").$type<number[]>().default([]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  user: one(users, {
    fields: [recommendations.userId],
    references: [users.id],
  }),
}));

export const insertRecommendationSchema = createInsertSchema(recommendations).pick({
  userId: true,
  title: true,
  content: true,
  category: true,
  relevanceScore: true,
  relatedDocumentIds: true,
  relatedSignatureIds: true,
  relatedQueryIds: true,
  metadata: true,
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
