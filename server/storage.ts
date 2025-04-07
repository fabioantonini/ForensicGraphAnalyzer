import { 
  User, InsertUser, Document, InsertDocument, Activity,
  InsertActivity, Query, InsertQuery 
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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

  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private activities: Map<number, Activity>;
  private queries: Map<number, Query>;
  public sessionStore: session.SessionStore;
  private nextUserId: number;
  private nextDocumentId: number;
  private nextActivityId: number;
  private nextQueryId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.activities = new Map();
    this.queries = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.nextUserId = 1;
    this.nextDocumentId = 1;
    this.nextActivityId = 1;
    this.nextQueryId = 1;
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
}

export const storage = new MemStorage();
