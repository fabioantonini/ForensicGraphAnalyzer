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
  anonymizations: many(anonymizations),
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
  source: text("source").default("upload").notNull(), // 'upload', 'ocr'
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
  source: true,
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
  // Base metrics (in pixels)
  width: number;
  height: number;
  aspectRatio: number;
  
  // Real-world dimensions (in mm)
  realDimensions: {
    widthMm: number;
    heightMm: number;
    pixelsPerMm: number; // Calibration factor
  };
  
  // Stroke characteristics (normalized to real dimensions)
  strokeWidth: {
    minMm: number; // Minimum stroke width in mm
    maxMm: number; // Maximum stroke width in mm
    meanMm: number; // Average stroke width in mm
    variance: number; // Variance in stroke width
    pixelCoverage: number; // Percentage of pixels that are ink
  };
  
  // Pressure analysis (derived from stroke intensity)
  pressurePoints: {
    count: number;
    highPressureAreas: number; // Areas with thick strokes
    lightPressureAreas: number; // Areas with thin strokes
    pressureVariation: number; // 0-1, how much pressure varies
  };
  
  // Curvature metrics (in real coordinates)
  curvatureMetrics: {
    totalCurveLength: number; // Total length of curves in mm
    sharpCorners: number; // Number of sharp direction changes
    smoothCurves: number; // Number of smooth curves
    averageCurvature: number; // Average curvature per mm
  };
  
  // Spatial distribution (normalized 0-1)
  spatialDistribution: {
    centerOfMassX: number; // 0-1 relative to signature bounds
    centerOfMassY: number; // 0-1 relative to signature bounds
    inkDensity: number; // Ink pixels / total pixels
    boundingBoxRatio: number; // Used area / total signature area
  };
  
  // Connectivity and line structure
  connectivity: {
    connectedComponents: number; // Number of separate stroke groups
    gaps: number; // Number of pen lifts
    totalStrokeLength: number; // Total ink length in mm
    strokeComplexity: number; // Measure of stroke intricacy
  };
  
  // Feature points (in real coordinates)
  featurePoints: {
    startPoint: [number, number]; // mm coordinates
    endPoint: [number, number]; // mm coordinates
    loopPoints: number; // Number of closed loops
    crossPoints: number; // Number of self-intersections
    ascenders: number; // Upward strokes count
    descenders: number; // Downward strokes count
  };
  
  // Advanced geometric features
  geometricFeatures: {
    slopeVariation: number; // How much the writing angle changes
    baselineConsistency: number; // 0-1, how consistent is the baseline
    letterSpacing: number[]; // Distances between character groups (in mm)
    strokeAngles: number[]; // Main stroke angles in degrees
  };
  
  // Image processing metadata
  imageMetadata: {
    originalDpi: number;
    detectedInkColor: string; // Hex color of the ink
    backgroundNoise: number; // 0-1, amount of background noise
    imageQuality: number; // 0-1, overall image quality score
    contrastLevel: number; // 0-1, contrast between ink and background
  };
  
  // === PARAMETRI AVANZATI (opzionali) ===
  // Parametri calcolati dallo script Python del cliente
  
  // Proporzione geometrica
  proportion?: number; // Rapporto altezza/larghezza
  
  // Inclinazione
  inclination?: number; // Angolo di inclinazione medio in gradi
  
  // Analisi pressione avanzata
  pressureMean?: number; // Pressione media calcolata
  pressureStd?: number; // Deviazione standard della pressione
  
  // Curvatura avanzata
  avgCurvature?: number; // Curvatura media delle curve
  
  // Stile di scrittura
  writingStyle?: string; // Categoria di stile (es: "Fluida", "Rigida", "Mista")
  readability?: string; // Livello di leggibilità (es: "Alta", "Media", "Bassa")
  
  // Analisi delle asole
  avgAsolaSize?: number; // Dimensione media delle asole in mm
  
  // Spaziatura
  avgSpacing?: number; // Spaziatura media tra lettere/parole in mm
  
  // Velocità di esecuzione
  velocity?: number; // Velocità stimata di scrittura
  
  // Sovrapposizione tratti
  overlapRatio?: number; // Rapporto di sovrapposizione tra tratti (0-1)
  
  // Connessioni tra lettere
  letterConnections?: number; // Numero di connessioni tra lettere
  
  // Deviazione baseline
  baselineStdMm?: number; // Deviazione standard della baseline in mm
  
  // Note di processamento
  processingNotes?: string; // Note aggiuntive sull'analisi
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
  // Dimensioni reali fornite dall'utente (in mm)
  realWidthMm: real("real_width_mm"), // Larghezza reale in millimetri
  realHeightMm: real("real_height_mm"), // Altezza reale in millimetri
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
  realWidthMm: true,
  realHeightMm: true,
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

// Gamification System - Achievements
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // unique identifier like 'first_ocr', 'ocr_master'
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'ocr', 'signature', 'document', 'analysis'
  type: text("type").notNull(), // 'milestone', 'streak', 'accuracy', 'volume'
  tier: text("tier").notNull(), // 'bronze', 'silver', 'gold', 'platinum'
  points: integer("points").notNull(),
  criteria: jsonb("criteria").notNull(), // achievement unlock criteria
  icon: text("icon").notNull(), // icon name from lucide-react
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

// User Achievement Progress
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  achievementId: integer("achievement_id").notNull().references(() => achievements.id),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  progress: jsonb("progress").default({}), // progress data for partial achievements
  notificationSent: boolean("notification_sent").default(false).notNull(),
});

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

// User Skill Levels and Progress
export const userSkills = pgTable("user_skills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  skillType: text("skill_type").notNull(), // 'ocr', 'signature_analysis', 'document_analysis'
  level: integer("level").default(1).notNull(),
  experience: integer("experience").default(0).notNull(),
  experienceToNext: integer("experience_to_next").default(100).notNull(),
  accuracy: real("accuracy").default(0.0).notNull(), // average accuracy percentage
  totalTasks: integer("total_tasks").default(0).notNull(),
  successfulTasks: integer("successful_tasks").default(0).notNull(),
  streak: integer("streak").default(0).notNull(), // current streak
  bestStreak: integer("best_streak").default(0).notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(users, {
    fields: [userSkills.userId],
    references: [users.id],
  }),
}));

// Learning Challenges
export const learningChallenges = pgTable("learning_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'ocr', 'signature', 'analysis'
  difficulty: text("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  type: text("type").notNull(), // 'tutorial', 'practice', 'quiz', 'challenge'
  content: jsonb("content").notNull(), // challenge content and instructions
  expectedResults: jsonb("expected_results"), // what the user should achieve
  hints: json("hints").$type<string[]>().default([]),
  points: integer("points").notNull(),
  timeLimit: integer("time_limit"), // time limit in minutes
  prerequisites: json("prerequisites").$type<string[]>().default([]), // required achievement codes
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learningChallengesRelations = relations(learningChallenges, ({ many }) => ({
  userChallenges: many(userChallenges),
}));

// User Challenge Progress
export const userChallenges = pgTable("user_challenges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  challengeId: integer("challenge_id").notNull().references(() => learningChallenges.id),
  status: text("status").default("not_started").notNull(), // 'not_started', 'in_progress', 'completed', 'failed'
  score: integer("score").default(0).notNull(),
  maxScore: integer("max_score").notNull(),
  accuracy: real("accuracy").default(0.0).notNull(),
  timeSpent: integer("time_spent").default(0).notNull(), // time in seconds
  attempts: integer("attempts").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  startedAt: timestamp("started_at"),
  lastAttemptAt: timestamp("last_attempt_at").defaultNow().notNull(),
  progressData: jsonb("progress_data").default({}), // detailed progress information
});

export const userChallengesRelations = relations(userChallenges, ({ one }) => ({
  user: one(users, {
    fields: [userChallenges.userId],
    references: [users.id],
  }),
  challenge: one(learningChallenges, {
    fields: [userChallenges.challengeId],
    references: [learningChallenges.id],
  }),
}));

// User Statistics and Leaderboards
export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  totalPoints: integer("total_points").default(0).notNull(),
  weeklyPoints: integer("weekly_points").default(0).notNull(),
  monthlyPoints: integer("monthly_points").default(0).notNull(),
  totalAchievements: integer("total_achievements").default(0).notNull(),
  completedChallenges: integer("completed_challenges").default(0).notNull(),
  ocrTasksCompleted: integer("ocr_tasks_completed").default(0).notNull(),
  signatureAnalysesCompleted: integer("signature_analyses_completed").default(0).notNull(),
  documentsProcessed: integer("documents_processed").default(0).notNull(),
  averageAccuracy: real("average_accuracy").default(0.0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  lastActiveDate: timestamp("last_active_date").defaultNow().notNull(),
  weeklyResetAt: timestamp("weekly_reset_at").defaultNow().notNull(),
  monthlyResetAt: timestamp("monthly_reset_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));

// Insert schemas for gamification
export const insertAchievementSchema = createInsertSchema(achievements).pick({
  code: true,
  name: true,
  description: true,
  category: true,
  type: true,
  tier: true,
  points: true,
  criteria: true,
  icon: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).pick({
  userId: true,
  achievementId: true,
  progress: true,
});

export const insertUserSkillSchema = createInsertSchema(userSkills).pick({
  userId: true,
  skillType: true,
  level: true,
  experience: true,
});

export const insertLearningChallengeSchema = createInsertSchema(learningChallenges).pick({
  title: true,
  description: true,
  category: true,
  difficulty: true,
  type: true,
  content: true,
  expectedResults: true,
  hints: true,
  points: true,
  timeLimit: true,
  prerequisites: true,
});

export const insertUserChallengeSchema = createInsertSchema(userChallenges).pick({
  userId: true,
  challengeId: true,
  status: true,
  score: true,
  maxScore: true,
  accuracy: true,
  timeSpent: true,
});

export const insertUserStatsSchema = createInsertSchema(userStats).pick({
  userId: true,
});

// Types for gamification system
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserSkill = typeof userSkills.$inferSelect;
export type InsertUserSkill = z.infer<typeof insertUserSkillSchema>;
export type LearningChallenge = typeof learningChallenges.$inferSelect;
export type InsertLearningChallenge = z.infer<typeof insertLearningChallengeSchema>;
export type UserChallenge = typeof userChallenges.$inferSelect;
export type InsertUserChallenge = z.infer<typeof insertUserChallengeSchema>;
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;

// Document Anonymization schema
export const anonymizations = pgTable("anonymizations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  originalDocumentId: integer("original_document_id").references(() => documents.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  anonymizedFilePath: text("anonymized_file_path").notNull(),
  entityTypes: json("entity_types").notNull().$type<string[]>(), // ['PERSON', 'LOCATION', 'EMAIL', etc.]
  entityReplacements: jsonb("entity_replacements").notNull().$type<Record<string, string>>(), // { 'PERSON': '[NOME]', 'LOCATION': '[CITTÀ]' }
  detectedEntities: jsonb("detected_entities").notNull().$type<Array<{
    text: string;
    type: string;
    position: { start: number; end: number };
    confidence: number;
  }>>(),
  processingStatus: text("processing_status").default("pending").notNull(), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const anonymizationsRelations = relations(anonymizations, ({ one }) => ({
  user: one(users, {
    fields: [anonymizations.userId],
    references: [users.id],
  }),
  originalDocument: one(documents, {
    fields: [anonymizations.originalDocumentId],
    references: [documents.id],
  }),
}));

export const insertAnonymizationSchema = createInsertSchema(anonymizations).pick({
  userId: true,
  originalDocumentId: true,
  filename: true,
  originalFilename: true,
  fileType: true,
  fileSize: true,
  anonymizedFilePath: true,
  entityTypes: true,
  entityReplacements: true,
  detectedEntities: true,
  processingStatus: true,
  errorMessage: true,
});

// Schema per la richiesta di anonimizzazione
export const anonymizationRequestSchema = z.object({
  documentId: z.number().optional(),
  entityReplacements: z.record(z.string(), z.string()).default({
    'PERSON': '[NOME]',
    'LOCATION': '[CITTÀ]',
    'EMAIL': '[EMAIL]',
    'PHONE': '[TELEFONO]',
    'ORGANIZATION': '[ORGANIZZAZIONE]',
    'DATE': '[DATA]',
    'ADDRESS': '[INDIRIZZO]',
    'POSTAL_CODE': '[CAP]',
    'FISCAL_CODE': '[CODICE_FISCALE]',
    'VAT_NUMBER': '[PARTITA_IVA]'
  }),
  entityTypes: z.array(z.string()).default([
    'PERSON', 'LOCATION', 'EMAIL', 'PHONE', 'ORGANIZATION', 
    'DATE', 'ADDRESS', 'POSTAL_CODE', 'FISCAL_CODE', 'VAT_NUMBER'
  ])
});

// Types per il sistema di anonimizzazione
export type Anonymization = typeof anonymizations.$inferSelect;
export type InsertAnonymization = z.infer<typeof insertAnonymizationSchema>;
export type AnonymizationRequest = z.infer<typeof anonymizationRequestSchema>;
