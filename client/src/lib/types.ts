export interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  organization?: string;
  profession?: string;
  openaiApiKey?: string;
  model?: string;
  queryCount?: number;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: number;
  userId: number;
  filename: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  indexed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: number;
  userId: number;
  type: string;
  details: string;
  createdAt: Date;
}

export interface Query {
  id: number;
  userId: number;
  query: string;
  response: string;
  documentIds: number[];
  createdAt: Date;
}

export interface Stats {
  documentCount: number;
  queryCount: number;
  storageUsed: number;
  recentActivity: Activity[];
  lastUpload: Date | null;
  lastQuery: Date | null;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  sources?: {
    documentId: number;
    filename: string;
  }[];
}

export interface FormattedStorage {
  bytes: number;
  formatted: string;
  percentage: number;
}

export interface FilterOptions {
  fileType?: 'all' | 'pdf' | 'docx' | 'pptx' | string;
  searchTerm?: string;
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'year' | string;
}

export interface QueryResult {
  id: number;
  query: string;
  response: string;
  documents: {
    id: number;
    filename: string;
  }[];
  createdAt: Date;
}

export interface ApiSettings {
  openaiApiKey: string;
  model: string;
  temperature: number;
}
