import { 
  User, InsertUser, Document, InsertDocument, Activity,
  InsertActivity, Query, InsertQuery, users, documents, activities, queries,
  SignatureProject, InsertSignatureProject, Signature, InsertSignature,
  signatureProjects, signatures, SignatureParameters
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserApiKey(userId: number, apiKey: string): Promise<User>;
  updateUserProfile(userId: number, profileData: {
    fullName?: string;
    organization?: string;
    profession?: string;
  }): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;

  // Document methods
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getUserDocuments(userId: number, filters?: {
    fileType?: string;
    searchTerm?: string;
    dateRange?: string;
  }): Promise<Document[]>;
  updateDocumentIndexStatus(id: number, indexed: boolean): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  getMultipleDocuments(ids: number[]): Promise<Document[]>;
  getDocumentCount(userId: number): Promise<number>;
  getLastUploadTime(userId: number): Promise<Date | null>;
  getStorageUsed(userId: number): Promise<number>;

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
  }): Promise<Signature>;
  deleteSignature(id: number): Promise<void>;

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
  public sessionStore: any;
  private nextUserId: number;
  private nextDocumentId: number;
  private nextActivityId: number;
  private nextQueryId: number;
  private nextSignatureProjectId: number;
  private nextSignatureId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.activities = new Map();
    this.queries = new Map();
    this.signatureProjects = new Map();
    this.signatures = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.nextUserId = 1;
    this.nextDocumentId = 1;
    this.nextActivityId = 1;
    this.nextQueryId = 1;
    this.nextSignatureProjectId = 1;
    this.nextSignatureId = 1;
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
      openaiApiKey: "",
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
  }): Promise<SignatureProject> {
    const project = await this.getSignatureProject(id);
    if (!project) {
      throw new Error(`Signature project with ID ${id} not found`);
    }
    
    const updatedProject: SignatureProject = {
      ...project,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
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
      updatedAt: new Date(),
    };
    
    this.signatures.set(id, updatedSignature);
    return updatedSignature;
  }

  async deleteSignature(id: number): Promise<void> {
    this.signatures.delete(id);
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
  }): Promise<SignatureProject> {
    const [project] = await db
      .update(signatureProjects)
      .set(data)
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
    
    let query = db
      .select()
      .from(signatures)
      .where(eq(signatures.projectId, projectId));
    
    if (referenceOnly) {
      query = query.where(eq(signatures.isReference, true));
    }
    
    const results = await query.orderBy(desc(signatures.createdAt));
    
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
  }): Promise<Signature> {
    const [signature] = await db
      .update(signatures)
      .set({
        ...(data.comparisonChart !== undefined && { comparisonChart: data.comparisonChart }),
        ...(data.analysisReport !== undefined && { analysisReport: data.analysisReport }),
        ...(data.reportPath !== undefined && { reportPath: data.reportPath }),
        updatedAt: new Date()
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

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getMultipleDocuments(ids: number[]): Promise<Document[]> {
    if (ids.length === 0) return [];
    return db
      .select()
      .from(documents)
      .where(sql`${documents.id} IN (${ids.join(',')})`);
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
}

// Change from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
