import { 
  User, InsertUser, Document, InsertDocument, Activity,
  InsertActivity, Query, InsertQuery, users, documents, activities, queries,
  SignatureProject, InsertSignatureProject, Signature, InsertSignature,
  signatureProjects, signatures, SignatureParameters, ReportTemplate, InsertReportTemplate,
  reportTemplates, settings, QuizSession, InsertQuizSession, QuizQuestion, InsertQuizQuestion,
  QuizAnswer, InsertQuizAnswer, quizSessions, quizQuestions, quizAnswers
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { and, desc, eq, gt, lt, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import path from "path";
import fs from "fs/promises";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createDemoAccount(demoData: Omit<InsertUser, 'confirmPassword'>, durationDays: number): Promise<User>;
  extendDemoAccount(userId: number, additionalDays: number): Promise<User>;
  deactivateExpiredDemoAccounts(): Promise<number>; // Restituisce il numero di account disattivati
  getDemoAccountsExpiringIn(days: number): Promise<User[]>;
  getDataForPurge(daysAfterExpiration: number): Promise<User[]>;
  isUserActive(userId: number): Promise<boolean>;
  updateUserApiKey(userId: number, apiKey: string): Promise<User>;
  updateUserProfile(userId: number, profileData: {
    fullName?: string;
    organization?: string;
    profession?: string;
  }): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  
  // Demo account methods
  createDemoAccount(demoUser: InsertUser, durationDays: number): Promise<User>;
  extendDemoAccount(userId: number, additionalDays: number): Promise<User>;
  getDemoAccountsExpiringIn(days: number): Promise<User[]>;
  deactivateExpiredDemoAccounts(): Promise<number>; // Ritorna il numero di account disattivati
  getDataForPurge(daysBeforePurge: number): Promise<{ userId: number, documents: number[] }[]>;
  getUserCount(): Promise<number>;
  updateUserRole(userId: number, role: string): Promise<User>;
  
  // Settings methods
  saveSettings(key: string, value: string): Promise<void>;
  getSettings(key: string): Promise<string | null>;
  deleteUser(userId: number): Promise<void>;

  // Document methods
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getUserDocuments(userId: number, filters?: {
    fileType?: string;
    searchTerm?: string;
    dateRange?: string;
  }): Promise<Document[]>;
  updateDocumentIndexStatus(id: number, indexed: boolean): Promise<Document>;
  updateDocumentContent(id: number, content: string): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  getMultipleDocuments(ids: number[]): Promise<Document[]>;
  getDocumentCount(userId: number): Promise<number>;
  getLastUploadTime(userId: number): Promise<Date | null>;
  getStorageUsed(userId: number): Promise<number>;
  checkDuplicateDocument(userId: number, originalFilename: string, fileSize: number): Promise<Document | null>;

  // Activity methods
  createActivity(activity: InsertActivity): Promise<Activity>;
  getRecentActivity(userId: number, limit: number): Promise<Activity[]>;

  // Query methods
  createQuery(query: InsertQuery): Promise<Query>;
  getQuery(id: number): Promise<Query | undefined>;
  getUserQueries(userId: number): Promise<Query[]>;
  getQueryCount(userId: number): Promise<number>;
  getLastQueryTime(userId: number): Promise<Date | null>;

  // Signature Projects methods
  createSignatureProject(project: InsertSignatureProject): Promise<SignatureProject>;
  getSignatureProject(id: number): Promise<SignatureProject | undefined>;
  getUserSignatureProjects(userId: number): Promise<SignatureProject[]>;
  updateSignatureProject(id: number, data: {
    name?: string;
    description?: string;
    dpi?: number;
  }): Promise<SignatureProject>;
  deleteSignatureProject(id: number): Promise<void>;

  // Signatures methods
  createSignature(signature: InsertSignature): Promise<Signature>;
  getSignature(id: number): Promise<Signature | undefined>;
  getProjectSignatures(projectId: number, referenceOnly?: boolean): Promise<Signature[]>;
  updateSignatureParameters(id: number, parameters: SignatureParameters): Promise<Signature>;
  updateSignatureStatus(id: number, status: string): Promise<Signature>;
  updateSignatureComparisonResult(id: number, result: number): Promise<Signature>;
  updateSignature(id: number, data: {
    comparisonChart?: string;
    analysisReport?: string;
    reportPath?: string;
    dpi?: number;
  }): Promise<Signature>;
  deleteSignature(id: number): Promise<void>;

  // Report Template methods
  createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate>;
  getReportTemplate(id: number): Promise<ReportTemplate | undefined>;
  getUserReportTemplates(userId: number): Promise<ReportTemplate[]>;
  getPublicReportTemplates(): Promise<ReportTemplate[]>;
  updateReportTemplate(id: number, data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    template?: any;
    thumbnailUrl?: string;
  }): Promise<ReportTemplate>;
  deleteReportTemplate(id: number): Promise<void>;

  // Wake Up Quiz methods
  createQuizSession(session: InsertQuizSession): Promise<QuizSession>;
  getQuizSession(id: number): Promise<QuizSession | undefined>;
  getUserActiveQuizSessions(userId: number): Promise<QuizSession[]>;
  updateQuizSession(id: number, data: {
    currentQuestion?: number;
    score?: number;
    status?: string;
    completedAt?: Date;
  }): Promise<QuizSession>;
  
  createQuizQuestion(question: InsertQuizQuestion): Promise<QuizQuestion>;
  getSessionQuestions(sessionId: number): Promise<QuizQuestion[]>;
  getQuizQuestion(id: number): Promise<QuizQuestion | undefined>;
  
  createQuizAnswer(answer: InsertQuizAnswer): Promise<QuizAnswer>;
  getQuestionAnswer(questionId: number): Promise<QuizAnswer | undefined>;
  updateQuizAnswer(id: number, data: {
    userAnswer?: number;
    isCorrect?: boolean;
    answerTimeMs?: number;
    points?: number;
    answeredAt?: Date;
    revealedAt?: Date;
  }): Promise<QuizAnswer>;
  
  getUserQuizStats(userId: number): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalScore: number;
    averageScore: number;
    bestScore: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  }>;

  // Session store
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private activities: Map<number, Activity>;
  private queries: Map<number, Query>;
  private signatureProjects: Map<number, SignatureProject>;
  private signatures: Map<number, Signature>;
  private reportTemplates: Map<number, ReportTemplate>;
  public sessionStore: any;
  private nextUserId: number;
  private nextDocumentId: number;
  private nextActivityId: number;
  private nextQueryId: number;
  private nextSignatureProjectId: number;
  private nextSignatureId: number;
  private nextReportTemplateId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.activities = new Map();
    this.queries = new Map();
    this.signatureProjects = new Map();
    this.signatures = new Map();
    this.reportTemplates = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.nextUserId = 1;
    this.nextDocumentId = 1;
    this.nextActivityId = 1;
    this.nextQueryId = 1;
    this.nextSignatureProjectId = 1;
    this.nextSignatureId = 1;
    this.nextReportTemplateId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const now = new Date();
    const user: User = {
      ...userData,
      id,
      role: "user", // Default role
      openaiApiKey: null,
      fullName: userData.fullName || null,
      organization: userData.organization || null,
      profession: userData.profession || null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserApiKey(userId: number, apiKey: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const updatedUser: User = {
      ...user,
      openaiApiKey: apiKey,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserProfile(userId: number, profileData: {
    fullName?: string;
    organization?: string;
    profession?: string;
  }): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const updatedUser: User = {
      ...user,
      ...(profileData.fullName !== undefined && { fullName: profileData.fullName }),
      ...(profileData.organization !== undefined && { organization: profileData.organization }),
      ...(profileData.profession !== undefined && { profession: profileData.profession }),
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const updatedUser: User = {
      ...user,
      password: hashedPassword,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async updateUserRole(userId: number, role: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const updatedUser: User = {
      ...user,
      role,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async deleteUser(userId: number): Promise<void> {
    if (!this.users.has(userId)) {
      throw new Error("User not found");
    }

    // Delete all user data
    // First, get all documents to delete
    const userDocuments = Array.from(this.documents.values())
      .filter(doc => doc.userId === userId);
    
    // Delete each document
    for (const doc of userDocuments) {
      this.documents.delete(doc.id);
    }

    // Delete all activities
    for (const activity of Array.from(this.activities.values())
      .filter(a => a.userId === userId)) {
      this.activities.delete(activity.id);
    }

    // Delete all queries
    for (const query of Array.from(this.queries.values())
      .filter(q => q.userId === userId)) {
      this.queries.delete(query.id);
    }

    // Delete all signature projects and signatures
    for (const project of Array.from(this.signatureProjects.values())
      .filter(p => p.userId === userId)) {
      
      // Delete all signatures in this project
      for (const signature of Array.from(this.signatures.values())
        .filter(s => s.projectId === project.id)) {
        this.signatures.delete(signature.id);
      }
      
      this.signatureProjects.delete(project.id);
    }

    // Delete all report templates
    for (const template of Array.from(this.reportTemplates.values())
      .filter(t => t.userId === userId)) {
      this.reportTemplates.delete(template.id);
    }

    // Finally delete the user
    this.users.delete(userId);
  }
  
  // Demo account methods
  async createDemoAccount(demoUser: InsertUser, durationDays: number): Promise<User> {
    const id = this.nextUserId++;
    const now = new Date();
    
    // Calcola le date di scadenza
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + durationDays);
    
    // Calcola la data di conservazione dati (2 settimane dopo la scadenza)
    const retentionDate = new Date(expiryDate);
    retentionDate.setDate(retentionDate.getDate() + 14);
    
    const user: User = {
      ...demoUser,
      id,
      role: 'demo',
      accountType: 'demo',
      demoExpiresAt: expiryDate,
      dataRetentionUntil: retentionDate,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(id, user);
    
    // Registra attività
    this.createActivity({
      userId: id,
      type: 'account',
      details: `Account demo creato. Scade il: ${expiryDate.toLocaleDateString()}`
    });
    
    return user;
  }
  
  async extendDemoAccount(userId: number, additionalDays: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`Utente con ID ${userId} non trovato`);
    }
    
    if (user.accountType !== 'demo') {
      throw new Error(`L'utente non è un account demo`);
    }
    
    // Calcola la nuova data di scadenza
    let newExpiryDate: Date;
    
    if (user.demoExpiresAt && user.demoExpiresAt > new Date()) {
      // Se l'account è ancora attivo, aggiungi giorni alla data di scadenza attuale
      newExpiryDate = new Date(user.demoExpiresAt);
    } else {
      // Se l'account è già scaduto, aggiungi giorni alla data corrente
      newExpiryDate = new Date();
    }
    
    newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);
    
    // Calcola la nuova data di conservazione dati
    const newRetentionDate = new Date(newExpiryDate);
    newRetentionDate.setDate(newRetentionDate.getDate() + 14);
    
    // Aggiorna l'utente
    const updatedUser: User = {
      ...user,
      demoExpiresAt: newExpiryDate,
      dataRetentionUntil: newRetentionDate,
      isActive: true,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    
    // Registra attività
    this.createActivity({
      userId,
      type: 'account',
      details: `Account demo esteso di ${additionalDays} giorni. Nuova scadenza: ${newExpiryDate.toLocaleDateString()}`
    });
    
    return updatedUser;
  }
  
  async getDemoAccountsExpiringIn(days: number): Promise<User[]> {
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    return Array.from(this.users.values()).filter(user => 
      user.accountType === 'demo' && 
      user.isActive === true && 
      user.demoExpiresAt !== undefined && 
      user.demoExpiresAt < cutoffDate && 
      user.demoExpiresAt > now
    );
  }
  
  async deactivateExpiredDemoAccounts(): Promise<number> {
    const now = new Date();
    let count = 0;
    
    for (const user of this.users.values()) {
      if (
        user.accountType === 'demo' && 
        user.isActive === true && 
        user.demoExpiresAt !== undefined && 
        user.demoExpiresAt < now
      ) {
        // Disattiva l'account
        user.isActive = false;
        user.updatedAt = now;
        this.users.set(user.id, user);
        count++;
      }
    }
    
    return count;
  }
  
  async getDataForPurge(daysBeforePurge: number): Promise<{ userId: number, documents: number[] }[]> {
    const now = new Date();
    const result = [];
    
    for (const user of this.users.values()) {
      if (
        user.accountType === 'demo' && 
        user.isActive === false && 
        user.dataRetentionUntil !== undefined && 
        user.dataRetentionUntil < now
      ) {
        // Trova tutti i documenti dell'utente
        const userDocuments = Array.from(this.documents.values())
          .filter(doc => doc.userId === user.id)
          .map(doc => doc.id);
        
        result.push({
          userId: user.id,
          documents: userDocuments
        });
      }
    }
    
    return result;
  }

  // Document methods
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const id = this.nextDocumentId++;
    const now = new Date();
    const document: Document = {
      ...documentData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, document);
    return document;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getUserDocuments(userId: number, filters?: {
    fileType?: string;
    searchTerm?: string;
    dateRange?: string;
  }): Promise<Document[]> {
    let documents = Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
    
    // Apply filters if provided
    if (filters) {
      // Filter by file type
      if (filters.fileType) {
        documents = documents.filter(doc => doc.fileType.includes(filters.fileType!));
      }
      
      // Filter by search term in original filename
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        documents = documents.filter(doc => 
          doc.originalFilename.toLowerCase().includes(searchTerm)
        );
      }
      
      // Filter by date range
      if (filters.dateRange) {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.dateRange) {
          case 'today':
            // Start of today
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            // Start of this week (Sunday)
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'month':
            // Start of this month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'year':
            // Start of this year
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(0); // Beginning of time
        }
        
        documents = documents.filter(doc => doc.createdAt >= startDate);
      }
    }
    
    // Sort by creation date (newest first)
    return documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateDocumentIndexStatus(id: number, indexed: boolean): Promise<Document> {
    const document = await this.getDocument(id);
    if (!document) {
      throw new Error(`Document with ID ${id} not found`);
    }
    
    const updatedDocument: Document = {
      ...document,
      indexed,
      updatedAt: new Date(),
    };
    
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async updateDocumentContent(id: number, content: string): Promise<Document> {
    const document = await this.getDocument(id);
    if (!document) {
      throw new Error(`Document with ID ${id} not found`);
    }
    
    const updatedDocument: Document = {
      ...document,
      content,
      updatedAt: new Date(),
    };
    
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<void> {
    this.documents.delete(id);
  }

  async getMultipleDocuments(ids: number[]): Promise<Document[]> {
    return ids
      .map(id => this.documents.get(id))
      .filter((doc): doc is Document => doc !== undefined);
  }

  async getDocumentCount(userId: number): Promise<number> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    ).length;
  }

  async getLastUploadTime(userId: number): Promise<Date | null> {
    const userDocuments = Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
    
    if (userDocuments.length === 0) {
      return null;
    }
    
    // Sort by creation date and get the most recent
    return userDocuments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0].createdAt;
  }

  async getStorageUsed(userId: number): Promise<number> {
    const userDocuments = Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
    
    return userDocuments.reduce((total, doc) => total + doc.fileSize, 0);
  }

  // Check for duplicate documents based on original filename and size
  async checkDuplicateDocument(userId: number, originalFilename: string, fileSize: number): Promise<Document | null> {
    const userDocuments = Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
    
    // Find document with same original filename and size
    const duplicate = userDocuments.find(doc => 
      doc.originalFilename === originalFilename && 
      doc.fileSize === fileSize
    );
    
    return duplicate || null;
  }

  // Activity methods
  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const id = this.nextActivityId++;
    const now = new Date();
    const activity: Activity = {
      ...activityData,
      id,
      createdAt: now,
    };
    this.activities.set(id, activity);
    return activity;
  }

  async getRecentActivity(userId: number, limit: number): Promise<Activity[]> {
    const userActivities = Array.from(this.activities.values()).filter(
      (activity) => activity.userId === userId,
    );
    
    // Sort by creation date (newest first) and limit
    return userActivities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Query methods
  async createQuery(queryData: InsertQuery): Promise<Query> {
    const id = this.nextQueryId++;
    const now = new Date();
    const query: Query = {
      ...queryData,
      id,
      createdAt: now,
    };
    this.queries.set(id, query);
    return query;
  }

  async getQuery(id: number): Promise<Query | undefined> {
    return this.queries.get(id);
  }

  async getUserQueries(userId: number): Promise<Query[]> {
    const userQueries = Array.from(this.queries.values()).filter(
      (query) => query.userId === userId,
    );
    
    // Sort by creation date (newest first)
    return userQueries.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getQueryCount(userId: number): Promise<number> {
    return Array.from(this.queries.values()).filter(
      (query) => query.userId === userId,
    ).length;
  }

  async getLastQueryTime(userId: number): Promise<Date | null> {
    const userQueries = Array.from(this.queries.values()).filter(
      (query) => query.userId === userId,
    );
    
    if (userQueries.length === 0) {
      return null;
    }
    
    // Sort by creation date and get the most recent
    return userQueries.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0].createdAt;
  }

  // Signature Projects methods
  async createSignatureProject(projectData: InsertSignatureProject): Promise<SignatureProject> {
    const id = this.nextSignatureProjectId++;
    const now = new Date();
    
    // Trova e rimuove firme residue che potrebbero avere lo stesso ID del progetto
    const existingSignatures = Array.from(this.signatures.values())
      .filter(s => s.projectId === id);
    
    if (existingSignatures.length > 0) {
      console.log(`ATTENZIONE: Rilevate ${existingSignatures.length} firme residue per progetto ID ${id}, elimino...`);
      for (const signature of existingSignatures) {
        this.signatures.delete(signature.id);
      }
    }
    
    const project: SignatureProject = {
      ...projectData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.signatureProjects.set(id, project);
    return project;
  }

  async getSignatureProject(id: number): Promise<SignatureProject | undefined> {
    return this.signatureProjects.get(id);
  }

  async getUserSignatureProjects(userId: number): Promise<SignatureProject[]> {
    const userProjects = Array.from(this.signatureProjects.values()).filter(
      (project) => project.userId === userId,
    );
    
    // Sort by creation date (newest first)
    return userProjects.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateSignatureProject(id: number, data: {
    name?: string;
    description?: string;
    dpi?: number;
  }): Promise<SignatureProject> {
    const project = await this.getSignatureProject(id);
    if (!project) {
      throw new Error(`Signature project with ID ${id} not found`);
    }
    
    const updatedProject: SignatureProject = {
      ...project,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.dpi !== undefined && { dpi: data.dpi }),
      updatedAt: new Date(),
    };
    
    this.signatureProjects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteSignatureProject(id: number): Promise<void> {
    // Delete all signatures associated with this project
    const projectSignatures = Array.from(this.signatures.values())
      .filter(signature => signature.projectId === id);
    
    for (const signature of projectSignatures) {
      this.signatures.delete(signature.id);
    }
    
    // Delete the project
    this.signatureProjects.delete(id);
  }

  // Signatures methods
  async createSignature(signatureData: InsertSignature): Promise<Signature> {
    const id = this.nextSignatureId++;
    const now = new Date();
    const signature: Signature = {
      ...signatureData,
      id,
      parameters: null,
      processingStatus: 'pending',
      comparisonResult: null,
      createdAt: now,
      updatedAt: now,
    };
    this.signatures.set(id, signature);
    return signature;
  }

  async getSignature(id: number): Promise<Signature | undefined> {
    return this.signatures.get(id);
  }

  async getProjectSignatures(projectId: number, referenceOnly?: boolean): Promise<Signature[]> {
    let projectSignatures = Array.from(this.signatures.values()).filter(
      (signature) => signature.projectId === projectId,
    );
    
    if (referenceOnly) {
      projectSignatures = projectSignatures.filter(
        (signature) => signature.isReference
      );
    }
    
    // Sort by creation date (newest first)
    return projectSignatures.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateSignatureParameters(id: number, parameters: SignatureParameters): Promise<Signature> {
    const signature = await this.getSignature(id);
    if (!signature) {
      throw new Error(`Signature with ID ${id} not found`);
    }
    
    const updatedSignature: Signature = {
      ...signature,
      parameters,
      updatedAt: new Date(),
    };
    
    this.signatures.set(id, updatedSignature);
    return updatedSignature;
  }

  async updateSignatureStatus(id: number, status: string): Promise<Signature> {
    const signature = await this.getSignature(id);
    if (!signature) {
      throw new Error(`Signature with ID ${id} not found`);
    }
    
    const updatedSignature: Signature = {
      ...signature,
      processingStatus: status,
      updatedAt: new Date(),
    };
    
    this.signatures.set(id, updatedSignature);
    return updatedSignature;
  }

  async updateSignatureComparisonResult(id: number, result: number): Promise<Signature> {
    const signature = await this.getSignature(id);
    if (!signature) {
      throw new Error(`Signature with ID ${id} not found`);
    }
    
    const updatedSignature: Signature = {
      ...signature,
      comparisonResult: result,
      processingStatus: 'completed',
      updatedAt: new Date(),
    };
    
    this.signatures.set(id, updatedSignature);
    return updatedSignature;
  }
  
  async updateSignature(id: number, data: {
    comparisonChart?: string;
    analysisReport?: string;
    reportPath?: string;
    dpi?: number;
    comparisonResult?: number;
    referenceSignatureFilename?: string;
    referenceSignatureOriginalFilename?: string;
    referenceDpi?: number;
    updatedAt?: Date;
  }): Promise<Signature> {
    const signature = await this.getSignature(id);
    if (!signature) {
      throw new Error(`Signature with ID ${id} not found`);
    }
    
    const updatedSignature: Signature = {
      ...signature,
      ...(data.comparisonChart !== undefined && { comparisonChart: data.comparisonChart }),
      ...(data.analysisReport !== undefined && { analysisReport: data.analysisReport }),
      ...(data.reportPath !== undefined && { reportPath: data.reportPath }),
      ...(data.dpi !== undefined && { dpi: data.dpi }),
      ...(data.comparisonResult !== undefined && { comparisonResult: data.comparisonResult }),
      ...(data.referenceSignatureFilename !== undefined && { referenceSignatureFilename: data.referenceSignatureFilename }),
      ...(data.referenceSignatureOriginalFilename !== undefined && { referenceSignatureOriginalFilename: data.referenceSignatureOriginalFilename }),
      ...(data.referenceDpi !== undefined && { referenceDpi: data.referenceDpi }),
      updatedAt: data.updatedAt || new Date(),
    };
    
    this.signatures.set(id, updatedSignature);
    return updatedSignature;
  }

  async deleteSignature(id: number): Promise<void> {
    this.signatures.delete(id);
  }

  // Report Template methods
  async createReportTemplate(templateData: InsertReportTemplate): Promise<ReportTemplate> {
    const id = this.nextReportTemplateId++;
    const now = new Date();
    const template: ReportTemplate = {
      ...templateData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.reportTemplates.set(id, template);
    return template;
  }

  async getReportTemplate(id: number): Promise<ReportTemplate | undefined> {
    return this.reportTemplates.get(id);
  }

  async getUserReportTemplates(userId: number): Promise<ReportTemplate[]> {
    const userTemplates = Array.from(this.reportTemplates.values()).filter(
      (template) => template.userId === userId
    );
    
    // Sort by creation date (newest first)
    return userTemplates.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getPublicReportTemplates(): Promise<ReportTemplate[]> {
    const publicTemplates = Array.from(this.reportTemplates.values()).filter(
      (template) => template.isPublic === true
    );
    
    // Sort by creation date (newest first)
    return publicTemplates.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateReportTemplate(id: number, data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    template?: any;
    thumbnailUrl?: string;
  }): Promise<ReportTemplate> {
    const template = await this.getReportTemplate(id);
    if (!template) {
      throw new Error(`Report template with ID ${id} not found`);
    }
    
    const updatedTemplate: ReportTemplate = {
      ...template,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      ...(data.template !== undefined && { template: data.template }),
      ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
      updatedAt: new Date(),
    };
    
    this.reportTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteReportTemplate(id: number): Promise<void> {
    this.reportTemplates.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conObject: { connectionString: process.env.DATABASE_URL },
      createTableIfMissing: true,
    });
  }
  
  // Demo account methods
  async createDemoAccount(demoUser: InsertUser, durationDays: number): Promise<User> {
    try {
      // Calcola le date di scadenza
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + durationDays);
      
      // Calcola la data di conservazione dati (2 settimane dopo la scadenza)
      const retentionDate = new Date(expiryDate);
      retentionDate.setDate(retentionDate.getDate() + 14);
      
      // Crea l'utente con tipo account demo
      const [user] = await db
        .insert(users)
        .values({
          ...demoUser,
          role: 'demo',
          accountType: 'demo',
          demoExpiresAt: expiryDate,
          dataRetentionUntil: retentionDate,
          isActive: true
        })
        .returning();
      
      // Registra attività
      await this.createActivity({
        userId: user.id,
        type: 'account',
        details: `Account demo creato. Scade il: ${expiryDate.toLocaleDateString()}`
      });
      
      return user;
    } catch (error) {
      console.error("Errore durante la creazione dell'account demo:", error);
      throw error;
    }
  }
  
  async extendDemoAccount(userId: number, additionalDays: number): Promise<User> {
    try {
      // Ottieni l'utente corrente
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`Utente con ID ${userId} non trovato`);
      }
      
      if (user.accountType !== 'demo') {
        throw new Error(`L'utente non è un account demo`);
      }
      
      // Calcola la nuova data di scadenza
      let newExpiryDate: Date;
      
      if (user.demoExpiresAt && user.demoExpiresAt > new Date()) {
        // Se l'account è ancora attivo, aggiungi giorni alla data di scadenza attuale
        newExpiryDate = new Date(user.demoExpiresAt);
      } else {
        // Se l'account è già scaduto, aggiungi giorni alla data corrente
        newExpiryDate = new Date();
      }
      
      newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);
      
      // Calcola la nuova data di conservazione dati
      const newRetentionDate = new Date(newExpiryDate);
      newRetentionDate.setDate(newRetentionDate.getDate() + 14);
      
      // Aggiorna l'utente
      const [updatedUser] = await db
        .update(users)
        .set({
          demoExpiresAt: newExpiryDate,
          dataRetentionUntil: newRetentionDate,
          isActive: true, // Riattiva l'account se era stato disattivato
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      
      // Registra attività
      await this.createActivity({
        userId,
        type: 'account',
        details: `Account demo esteso di ${additionalDays} giorni. Nuova scadenza: ${newExpiryDate.toLocaleDateString()}`
      });
      
      return updatedUser;
    } catch (error) {
      console.error("Errore durante l'estensione dell'account demo:", error);
      throw error;
    }
  }
  
  async getDemoAccountsExpiringIn(days: number): Promise<User[]> {
    try {
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() + days);
      
      return await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.accountType, 'demo'),
            eq(users.isActive, true),
            lt(users.demoExpiresAt as any, cutoffDate),
            gt(users.demoExpiresAt as any, now)
          )
        );
    } catch (error) {
      console.error("Errore durante il recupero degli account demo in scadenza:", error);
      throw error;
    }
  }
  
  async deactivateExpiredDemoAccounts(): Promise<number> {
    try {
      const now = new Date();
      
      const result = await db
        .update(users)
        .set({
          isActive: false,
          updatedAt: now
        })
        .where(
          and(
            eq(users.accountType, 'demo'),
            eq(users.isActive, true),
            lt(users.demoExpiresAt as any, now)
          )
        );
      
      return result.length;
    } catch (error) {
      console.error("Errore durante la disattivazione degli account demo scaduti:", error);
      throw error;
    }
  }
  
  async getDataForPurge(daysBeforePurge: number): Promise<{ userId: number, documents: number[] }[]> {
    try {
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - daysBeforePurge);
      
      // Trova gli account demo da eliminare
      const accountsToPurge = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.accountType, 'demo'),
            eq(users.isActive, false),
            lt(users.dataRetentionUntil as any, now)
          )
        );
      
      // Raccogli i documenti per ogni account
      const result = [];
      
      for (const user of accountsToPurge) {
        // Trova tutti i documenti dell'utente
        const userDocuments = await db
          .select()
          .from(documents)
          .where(eq(documents.userId, user.id));
        
        result.push({
          userId: user.id,
          documents: userDocuments.map(doc => doc.id)
        });
      }
      
      return result;
    } catch (error) {
      console.error("Errore durante il recupero dei dati per la purga:", error);
      throw error;
    }
  }
  
  // Signature Project methods
  async createSignatureProject(projectData: InsertSignatureProject): Promise<SignatureProject> {
    // Prima di creare un nuovo progetto, verifica se esistono già firme con lo stesso ID
    // che potrebbero essere create prima del progetto (bug nella sincronizzazione del DB)
    try {
      // Crea il progetto
      const [project] = await db
        .insert(signatureProjects)
        .values(projectData)
        .returning();
      
      // Cerca e elimina eventuali firme residue
      await db
        .delete(signatures)
        .where(
          and(
            eq(signatures.projectId, project.id),
            sql`${signatures.id} < ${project.id * 1000}` // Assume che le firme abbiano ID maggiori
          )
        );
        
      return project;
    } catch (error) {
      console.error("Errore durante la creazione del progetto di firma:", error);
      throw error;
    }
  }

  async getSignatureProject(id: number): Promise<SignatureProject | undefined> {
    const [project] = await db
      .select()
      .from(signatureProjects)
      .where(eq(signatureProjects.id, id));
    return project;
  }

  async getUserSignatureProjects(userId: number): Promise<SignatureProject[]> {
    return await db
      .select()
      .from(signatureProjects)
      .where(eq(signatureProjects.userId, userId))
      .orderBy(desc(signatureProjects.createdAt));
  }

  async updateSignatureProject(id: number, data: {
    name?: string;
    description?: string;
    dpi?: number;
  }): Promise<SignatureProject> {
    const [project] = await db
      .update(signatureProjects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(signatureProjects.id, id))
      .returning();
    return project;
  }

  async deleteSignatureProject(id: number): Promise<void> {
    await db
      .delete(signatures)
      .where(eq(signatures.projectId, id));
    
    await db
      .delete(signatureProjects)
      .where(eq(signatureProjects.id, id));
  }

  // Signature methods
  async createSignature(signatureData: InsertSignature): Promise<Signature> {
    const [signature] = await db
      .insert(signatures)
      .values({
        ...signatureData,
        parameters: null,
        processingStatus: 'pending',
        comparisonResult: null
      })
      .returning();
    return signature;
  }

  async getSignature(id: number): Promise<Signature | undefined> {
    const [signature] = await db
      .select()
      .from(signatures)
      .where(eq(signatures.id, id));
    return signature;
  }

  async getProjectSignatures(projectId: number, referenceOnly?: boolean): Promise<Signature[]> {
    // Log completo per debug problemi di segregazione progetti
    console.log(`[STORAGE] Richiesta firme per progetto ${projectId} (referenceOnly: ${referenceOnly})`);
    
    // Query diretta per evitare bug di cross-contaminazione
    let whereConditions: any[] = [eq(signatures.projectId, projectId)];
    
    // Solo se referenceOnly è specificato esplicitamente applichiamo il filtro
    if (referenceOnly === true) {
      whereConditions.push(eq(signatures.isReference, true));
    } else if (referenceOnly === false) {
      whereConditions.push(eq(signatures.isReference, false));
    }
    // Se referenceOnly è undefined, restituiamo tutte le firme
    
    const results = await db
      .select()
      .from(signatures)
      .where(and(...whereConditions))
      .orderBy(desc(signatures.createdAt));
    
    // Verifica che tutte le firme appartengano effettivamente al progetto richiesto
    const differentProjectSignatures = results.filter(sig => sig.projectId !== projectId);
    if (differentProjectSignatures.length > 0) {
      console.error(`[CRITICAL ERROR] Trovate ${differentProjectSignatures.length} firme di progetti diversi!`);
      console.error(`[CRITICAL ERROR] ID progetti erroneamente inclusi: ${[...new Set(differentProjectSignatures.map(s => s.projectId))].join(', ')}`);
      console.error(`[CRITICAL ERROR] Dettagli firme errate: ${JSON.stringify(differentProjectSignatures.map(s => ({ id: s.id, projectId: s.projectId })), null, 2)}`);
      
      // Filtra manualmente i risultati
      const filteredResults = results.filter(sig => sig.projectId === projectId);
      console.log(`[STORAGE] Firme filtrate dopo la verifica: ${filteredResults.length} (rimosse ${results.length - filteredResults.length})`);
      return filteredResults;
    }
    
    console.log(`[STORAGE] Restituite ${results.length} firme per il progetto ${projectId}`);
    return results;
  }

  async updateSignatureParameters(id: number, parameters: SignatureParameters): Promise<Signature> {
    const [signature] = await db
      .update(signatures)
      .set({ parameters })
      .where(eq(signatures.id, id))
      .returning();
    return signature;
  }

  async updateSignatureStatus(id: number, status: string): Promise<Signature> {
    const [signature] = await db
      .update(signatures)
      .set({ processingStatus: status })
      .where(eq(signatures.id, id))
      .returning();
    return signature;
  }

  async updateSignatureComparisonResult(id: number, result: number): Promise<Signature> {
    console.log(`[STORAGE DEBUG] updateSignatureComparisonResult per firma ${id}: result=${result}, isNaN=${isNaN(result)}, type=${typeof result}`);
    
    if (isNaN(result) || typeof result !== 'number') {
      console.error(`[STORAGE ERROR] Tentativo di salvare valore non valido per comparisonResult: ${result}`);
      throw new Error(`Valore comparison result non valido: ${result}`);
    }
    
    const [signature] = await db
      .update(signatures)
      .set({ comparisonResult: result })
      .where(eq(signatures.id, id))
      .returning();
    return signature;
  }
  
  async updateSignature(id: number, data: {
    comparisonChart?: string;
    analysisReport?: string;
    reportPath?: string;
    dpi?: number;
    comparisonResult?: number;
    referenceSignatureFilename?: string;
    referenceSignatureOriginalFilename?: string;
    referenceDpi?: number;
    updatedAt?: Date;
  }): Promise<Signature> {
    const [signature] = await db
      .update(signatures)
      .set({
        ...(data.comparisonChart !== undefined && { comparisonChart: data.comparisonChart }),
        ...(data.analysisReport !== undefined && { analysisReport: data.analysisReport }),
        ...(data.reportPath !== undefined && { reportPath: data.reportPath }),
        ...(data.dpi !== undefined && { dpi: data.dpi }),
        ...(data.comparisonResult !== undefined && { comparisonResult: data.comparisonResult }),
        ...(data.referenceSignatureFilename !== undefined && { referenceSignatureFilename: data.referenceSignatureFilename }),
        ...(data.referenceSignatureOriginalFilename !== undefined && { referenceSignatureOriginalFilename: data.referenceSignatureOriginalFilename }),
        ...(data.referenceDpi !== undefined && { referenceDpi: data.referenceDpi }),
        updatedAt: data.updatedAt || new Date()
      })
      .where(eq(signatures.id, id))
      .returning();
      
    if (!signature) {
      throw new Error(`Signature with ID ${id} not found`);
    }
    
    return signature;
  }

  async deleteSignature(id: number): Promise<void> {
    console.log(`[STORAGE] Eliminazione firma con ID ${id} in corso...`);
    try {
      const result = await db
        .delete(signatures)
        .where(eq(signatures.id, id))
        .returning({ deletedId: signatures.id });
      
      console.log(`[STORAGE] Eliminazione firma ${id} completata:`, result);
      
      if (!result || result.length === 0) {
        console.warn(`[STORAGE] Firma ${id} non trovata o già eliminata`);
      }
    } catch (error) {
      console.error(`[STORAGE] Errore durante l'eliminazione della firma ${id}:`, error);
      throw error;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        username: userData.username.toLowerCase(),
        email: userData.email.toLowerCase(),
        openaiApiKey: ""
      })
      .returning();
    return user;
  }

  async updateUserApiKey(userId: number, apiKey: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        openaiApiKey: apiKey,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }

  async updateUserProfile(userId: number, profileData: {
    fullName?: string;
    organization?: string;
    profession?: string;
  }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...(profileData.fullName !== undefined && { fullName: profileData.fullName }),
        ...(profileData.organization !== undefined && { organization: profileData.organization }),
        ...(profileData.profession !== undefined && { profession: profileData.profession }),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.createdAt);
    
    return allUsers;
  }

  async getUserCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    
    return result[0].count;
  }

  async updateUserRole(userId: number, role: string): Promise<User> {
    if (role !== 'user' && role !== 'admin') {
      throw new Error('Role must be either "user" or "admin"');
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }

  async deleteUser(userId: number): Promise<void> {
    // Verifica che l'utente esista
    const user = await this.getUser(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Elimina manualmente gli embedding dei documenti dell'utente
    // usando SQL diretto perché Drizzle ORM non gestisce bene il tipo vector
    try {
      await db.execute(sql`DELETE FROM document_embeddings WHERE user_id = ${userId}`);
      console.log(`Embedding dell'utente ${userId} eliminati con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione degli embedding dell'utente ${userId}:`, error);
      // Continua con il processo anche se questa operazione fallisce
    }
    
    // Elimina i dati dell'utente in blocchi di try/catch separati
    // per assicurarsi che il processo continui anche se alcune operazioni falliscono
    
    // Elimina i documenti dell'utente
    try {
      await db.delete(documents).where(eq(documents.userId, userId));
      console.log(`Documenti dell'utente ${userId} eliminati con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione dei documenti dell'utente ${userId}:`, error);
    }
    
    // Elimina le attività dell'utente
    try {
      await db.delete(activities).where(eq(activities.userId, userId));
      console.log(`Attività dell'utente ${userId} eliminate con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione delle attività dell'utente ${userId}:`, error);
    }
    
    // Elimina le query dell'utente
    try {
      await db.delete(queries).where(eq(queries.userId, userId));
      console.log(`Query dell'utente ${userId} eliminate con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione delle query dell'utente ${userId}:`, error);
    }
    
    // Ottieni tutte le firme dell'utente per eliminarle dal filesystem
    try {
      // Ottieni progetti di firma dell'utente
      const projects = await db
        .select()
        .from(signatureProjects)
        .where(eq(signatureProjects.userId, userId));
      
      // Per ogni progetto, ottieni le firme associate
      for (const project of projects) {
        // Ottieni tutte le firme associate al progetto
        const projectSignatures = await db
          .select()
          .from(signatures)
          .where(eq(signatures.projectId, project.id));
        
        // Elimina ogni file di firma dal filesystem
        for (const signature of projectSignatures) {
          try {
            // Percorso del file della firma
            const signaturePath = path.join(process.cwd(), 'uploads', signature.filename);
            await fs.unlink(signaturePath).catch(err => {
              console.error(`Impossibile eliminare il file della firma ${signature.filename}:`, err);
            });
            
            // Elimina anche eventuali report PDF associati
            if (signature.reportPath) {
              const reportPath = path.join(process.cwd(), signature.reportPath);
              await fs.unlink(reportPath).catch(err => {
                console.error(`Impossibile eliminare il file di report ${signature.reportPath}:`, err);
              });
            }
          } catch (fileError) {
            console.error(`Errore nell'eliminazione dei file della firma ID ${signature.id}:`, fileError);
          }
        }
        
        // Elimina le firme del progetto dal database
        await db.delete(signatures).where(eq(signatures.projectId, project.id));
      }
      
      // Elimina i progetti di firma dal database
      await db.delete(signatureProjects).where(eq(signatureProjects.userId, userId));
      console.log(`Progetti e firme dell'utente ${userId} eliminati con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione dei progetti e firme dell'utente ${userId}:`, error);
    }
    
    // Elimina i template di report dell'utente
    try {
      await db.delete(reportTemplates).where(eq(reportTemplates.userId, userId));
      console.log(`Template di report dell'utente ${userId} eliminati con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione dei template di report dell'utente ${userId}:`, error);
    }
    
    // Infine, elimina l'utente
    try {
      await db.delete(users).where(eq(users.id, userId));
      console.log(`Utente ${userId} eliminato con successo`);
    } catch (error) {
      console.error(`Errore nell'eliminazione dell'utente ${userId}:`, error);
      throw error; // Questo errore deve essere propagato
    }
  }

  // Document methods
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(documentData)
      .returning();
    return document;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async getUserDocuments(userId: number, filters?: {
    fileType?: string;
    searchTerm?: string;
    dateRange?: string;
  }): Promise<Document[]> {
    let query = db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId));

    if (filters) {
      // Filter by file type
      if (filters.fileType) {
        query = query.where(sql`${documents.fileType} LIKE ${`%${filters.fileType}%`}`);
      }
      
      // Filter by search term
      if (filters.searchTerm) {
        query = query.where(sql`${documents.originalFilename} ILIKE ${`%${filters.searchTerm}%`}`);
      }
      
      // Filter by date range
      if (filters.dateRange) {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.dateRange) {
          case 'today':
            // Start of today
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            // Start of this week (Sunday)
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'month':
            // Start of this month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'year':
            // Start of this year
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(0); // Beginning of time
        }
        
        query = query.where(sql`${documents.createdAt} >= ${startDate}`);
      }
    }
    
    // Sort by creation date (newest first)
    const userDocuments = await query.orderBy(desc(documents.createdAt));
    return userDocuments;
  }

  async updateDocumentIndexStatus(id: number, indexed: boolean): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({
        indexed,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning();
    
    if (!updatedDocument) {
      throw new Error(`Document with ID ${id} not found`);
    }
    
    return updatedDocument;
  }

  async updateDocumentContent(id: number, content: string): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({
        content,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning();
    
    if (!updatedDocument) {
      throw new Error(`Document with ID ${id} not found`);
    }
    
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }
  
  // Report Template methods
  async createReportTemplate(templateData: InsertReportTemplate): Promise<ReportTemplate> {
    const [template] = await db
      .insert(reportTemplates)
      .values(templateData)
      .returning();
    return template;
  }

  async getReportTemplate(id: number): Promise<ReportTemplate | undefined> {
    const [template] = await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.id, id));
    return template;
  }

  async getUserReportTemplates(userId: number): Promise<ReportTemplate[]> {
    return await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.userId, userId))
      .orderBy(desc(reportTemplates.createdAt));
  }

  async getPublicReportTemplates(): Promise<ReportTemplate[]> {
    return await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.isPublic, true))
      .orderBy(desc(reportTemplates.createdAt));
  }

  async updateReportTemplate(id: number, data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    template?: any;
    thumbnailUrl?: string;
  }): Promise<ReportTemplate> {
    const [template] = await db
      .update(reportTemplates)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.template !== undefined && { template: data.template }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        updatedAt: new Date()
      })
      .where(eq(reportTemplates.id, id))
      .returning();
    
    if (!template) {
      throw new Error(`Report template with ID ${id} not found`);
    }
    
    return template;
  }

  async deleteReportTemplate(id: number): Promise<void> {
    await db
      .delete(reportTemplates)
      .where(eq(reportTemplates.id, id));
  }

  async getMultipleDocuments(ids: number[]): Promise<Document[]> {
    if (ids.length === 0) return [];
    return db
      .select()
      .from(documents)
      .where(inArray(documents.id, ids));
  }

  async getDocumentCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documents)
      .where(eq(documents.userId, userId));
    return result?.count || 0;
  }

  async getLastUploadTime(userId: number): Promise<Date | null> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))
      .limit(1);
    
    return document?.createdAt || null;
  }

  async getStorageUsed(userId: number): Promise<number> {
    const [result] = await db
      .select({ sum: sql<number>`SUM(${documents.fileSize})` })
      .from(documents)
      .where(eq(documents.userId, userId));
    
    return result?.sum || 0;
  }

  // Check for duplicate documents based on original filename and size
  async checkDuplicateDocument(userId: number, originalFilename: string, fileSize: number): Promise<Document | null> {
    const [duplicate] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.originalFilename, originalFilename),
          eq(documents.fileSize, fileSize)
        )
      )
      .limit(1);
    
    return duplicate || null;
  }

  // Activity methods
  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(activityData)
      .returning();
    return activity;
  }

  async getRecentActivity(userId: number, limit: number): Promise<Activity[]> {
    return db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  // Query methods
  async createQuery(queryData: InsertQuery): Promise<Query> {
    const [query] = await db
      .insert(queries)
      .values(queryData)
      .returning();
    return query;
  }

  async getQuery(id: number): Promise<Query | undefined> {
    const [query] = await db
      .select()
      .from(queries)
      .where(eq(queries.id, id));
    return query;
  }

  async getUserQueries(userId: number): Promise<Query[]> {
    return db
      .select()
      .from(queries)
      .where(eq(queries.userId, userId))
      .orderBy(desc(queries.createdAt));
  }

  async getQueryCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queries)
      .where(eq(queries.userId, userId));
    return result?.count || 0;
  }

  async getLastQueryTime(userId: number): Promise<Date | null> {
    const [query] = await db
      .select()
      .from(queries)
      .where(eq(queries.userId, userId))
      .orderBy(desc(queries.createdAt))
      .limit(1);
    
    return query?.createdAt || null;
  }
  
  /**
   * Salva un'impostazione di sistema
   * @param key Chiave dell'impostazione
   * @param value Valore dell'impostazione
   */
  async saveSettings(key: string, value: string): Promise<void> {
    // Controlla se l'impostazione esiste già
    const [existing] = await db.select().from(settings).where(eq(settings.key, key));
    
    if (existing) {
      // Aggiorna l'impostazione esistente
      await db.update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key));
    } else {
      // Crea una nuova impostazione
      await db.insert(settings).values({ key, value });
    }
  }
  
  /**
   * Recupera un'impostazione di sistema
   * @param key Chiave dell'impostazione
   * @returns Valore dell'impostazione o null se non esiste
   */
  async getSettings(key: string): Promise<string | null> {
    const [result] = await db.select().from(settings).where(eq(settings.key, key));
    return result ? result.value : null;
  }

  // Wake Up Quiz methods
  async createQuizSession(sessionData: InsertQuizSession): Promise<QuizSession> {
    const [session] = await db
      .insert(quizSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async getQuizSession(id: number): Promise<QuizSession | undefined> {
    const [session] = await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, id));
    return session;
  }

  async getUserActiveQuizSessions(userId: number): Promise<QuizSession[]> {
    return await db
      .select()
      .from(quizSessions)
      .where(and(
        eq(quizSessions.userId, userId),
        eq(quizSessions.status, 'active')
      ))
      .orderBy(desc(quizSessions.startedAt));
  }

  async updateQuizSession(id: number, data: {
    currentQuestion?: number;
    score?: number;
    status?: string;
    completedAt?: Date;
  }): Promise<QuizSession> {
    const [session] = await db
      .update(quizSessions)
      .set({
        ...(data.currentQuestion !== undefined && { currentQuestion: data.currentQuestion }),
        ...(data.score !== undefined && { score: data.score }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt })
      })
      .where(eq(quizSessions.id, id))
      .returning();
    
    if (!session) {
      throw new Error(`Quiz session with ID ${id} not found`);
    }
    
    return session;
  }

  async createQuizQuestion(questionData: InsertQuizQuestion): Promise<QuizQuestion> {
    const [question] = await db
      .insert(quizQuestions)
      .values(questionData)
      .returning();
    return question;
  }

  async getSessionQuestions(sessionId: number): Promise<QuizQuestion[]> {
    return await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.sessionId, sessionId))
      .orderBy(quizQuestions.questionNumber);
  }

  async getQuizQuestion(id: number): Promise<QuizQuestion | undefined> {
    const [question] = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.id, id));
    return question;
  }

  async getQuizQuestionBySessionAndNumber(sessionId: number, questionNumber: number): Promise<QuizQuestion | undefined> {
    const [question] = await db
      .select()
      .from(quizQuestions)
      .where(and(
        eq(quizQuestions.sessionId, sessionId),
        eq(quizQuestions.questionNumber, questionNumber)
      ));
    return question;
  }

  async createQuizAnswer(answerData: InsertQuizAnswer): Promise<QuizAnswer> {
    const [answer] = await db
      .insert(quizAnswers)
      .values(answerData)
      .returning();
    return answer;
  }

  async getQuestionAnswer(questionId: number): Promise<QuizAnswer | undefined> {
    const [answer] = await db
      .select()
      .from(quizAnswers)
      .where(eq(quizAnswers.questionId, questionId));
    return answer;
  }

  async updateQuizAnswer(id: number, data: {
    userAnswer?: number;
    isCorrect?: boolean;
    answerTimeMs?: number;
    points?: number;
    answeredAt?: Date;
    revealedAt?: Date;
  }): Promise<QuizAnswer> {
    const [answer] = await db
      .update(quizAnswers)
      .set({
        ...(data.userAnswer !== undefined && { userAnswer: data.userAnswer }),
        ...(data.isCorrect !== undefined && { isCorrect: data.isCorrect }),
        ...(data.answerTimeMs !== undefined && { answerTimeMs: data.answerTimeMs }),
        ...(data.points !== undefined && { points: data.points }),
        ...(data.answeredAt !== undefined && { answeredAt: data.answeredAt }),
        ...(data.revealedAt !== undefined && { revealedAt: data.revealedAt })
      })
      .where(eq(quizAnswers.id, id))
      .returning();
    
    if (!answer) {
      throw new Error(`Quiz answer with ID ${id} not found`);
    }
    
    return answer;
  }

  async deleteQuizSession(sessionId: number): Promise<void> {
    // Prima elimina tutte le risposte
    const questions = await this.getSessionQuestions(sessionId);
    for (const question of questions) {
      await db.delete(quizAnswers).where(eq(quizAnswers.questionId, question.id));
    }
    
    // Poi elimina tutte le domande
    await db.delete(quizQuestions).where(eq(quizQuestions.sessionId, sessionId));
    
    // Infine elimina la sessione
    await db.delete(quizSessions).where(eq(quizSessions.id, sessionId));
  }

  async getUserQuizSessions(userId: number): Promise<QuizSession[]> {
    const sessions = await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.userId, userId));
    return sessions;
  }

  async deleteQuizAnswer(questionId: number): Promise<void> {
    await db.delete(quizAnswers).where(eq(quizAnswers.questionId, questionId));
  }

  async deleteSessionQuestions(sessionId: number): Promise<void> {
    await db.delete(quizQuestions).where(eq(quizQuestions.sessionId, sessionId));
  }

  async deleteQuizSessionById(sessionId: number): Promise<void> {
    await db.delete(quizSessions).where(eq(quizSessions.id, sessionId));
  }

  async getUserQuizStats(userId: number): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalScore: number;
    averageScore: number;
    bestScore: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  }> {
    // Total sessions
    const [totalSessionsResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(quizSessions)
      .where(eq(quizSessions.userId, userId));
    
    // Completed sessions
    const [completedSessionsResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(quizSessions)
      .where(and(
        eq(quizSessions.userId, userId),
        eq(quizSessions.status, 'completed')
      ));
    
    // Score stats
    const [scoreStatsResult] = await db
      .select({ 
        totalScore: sql<number>`SUM(score)`,
        bestScore: sql<number>`MAX(score)`
      })
      .from(quizSessions)
      .where(and(
        eq(quizSessions.userId, userId),
        eq(quizSessions.status, 'completed')
      ));
    
    // Question stats - join sessions with questions and answers
    const [questionStatsResult] = await db
      .select({ 
        totalQuestions: sql<number>`COUNT(${quizAnswers.id})`,
        correctAnswers: sql<number>`SUM(CASE WHEN ${quizAnswers.isCorrect} = true THEN 1 ELSE 0 END)`
      })
      .from(quizSessions)
      .innerJoin(quizQuestions, eq(quizSessions.id, quizQuestions.sessionId))
      .innerJoin(quizAnswers, eq(quizQuestions.id, quizAnswers.questionId))
      .where(and(
        eq(quizSessions.userId, userId),
        eq(quizSessions.status, 'completed')
      ));
    
    const totalSessions = totalSessionsResult?.count || 0;
    const completedSessions = completedSessionsResult?.count || 0;
    const totalScore = scoreStatsResult?.totalScore || 0;
    const bestScore = scoreStatsResult?.bestScore || 0;
    const totalQuestions = questionStatsResult?.totalQuestions || 0;
    const correctAnswers = questionStatsResult?.correctAnswers || 0;
    
    const averageScore = completedSessions > 0 ? totalScore / completedSessions : 0;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    
    return {
      totalSessions,
      completedSessions,
      totalScore,
      averageScore,
      bestScore,
      totalQuestions,
      correctAnswers,
      accuracy
    };
  }
}

// Change from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
