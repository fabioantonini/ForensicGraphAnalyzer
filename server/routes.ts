import { Express, Request, Response, NextFunction, Router } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupAdminRoutes } from "./admin-routes";
import multer from "multer";
import { Document, User, insertQuerySchema, signatures, InsertReportTemplate, createDemoAccountSchema, extendDemoSchema } from "@shared/schema";
import path from "path";
import fs from "fs/promises";
import { 
  isValidFileType, 
  generateFilename, 
  saveFile, 
  processFile, 
  cleanupFile,
  fetchHtmlFromUrl,
  extractTextFromHTML
} from "./document-processor";
import { 
  addDocumentToCollection, 
  removeDocumentFromCollection,
  queryCollection,
  initializeVectorDB
} from "./vectordb";
import { chatWithRAG, validateAPIKey } from "./openai";
import { log } from "./vite";
import { registerSignatureRoutes } from "./signature-routes";
import { setupAnonymizationRoutes } from "./anonymization-routes";
import wakeUpRoutes from "./wake-up-routes";
import { processOCR, saveOCRDocument, ocrUpload, processOCRWithProgress, getOCRProcessStatus } from "./ocr-service";
import { eq, desc, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { users, documents } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { 
  getProgress, 
  getProgressPercentage, 
  getEstimatedTimeRemaining,
  initProgress,
  updateProgress,
  completeProgress,
  failProgress,
  transferProgress
} from "./progress-tracker";
import {
  generateRecommendations,
  getUserRecommendations,
  updateRecommendationStatus
} from "./recommendation-service";
import { analyzeImageQuality } from "./image-quality-analyzer";

// Initialize multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

// Multer configuration for image quality analysis (needs disk storage)
const imageQualityUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/temp/');
    },
    filename: (req, file, cb) => {
      const uniqueName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Ensure temp directory exists for image quality analysis
  try {
    await fs.mkdir('uploads/temp/', { recursive: true });
  } catch (error) {
    log(`Directory temp already exists or creation failed: ${error}`, "express");
  }

  // Inizializzazione del sistema di persistenza vettoriale
  // Non blocchiamo l'app se fallisce per consentire al sistema di autenticazione di funzionare comunque
  try {
    await initializeVectorDB();
  } catch (error) {
    log(`Errore inizializzazione sistema di persistenza vettoriale (non bloccante): ${error}`, "express");
  }

  // Sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);
  
  // Setup admin routes
  setupAdminRoutes(app);
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  
  // Middleware to check if user is an admin
  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && req.user?.role === 'admin') {
      return next();
    }
    res.status(403).json({ message: "Forbidden - Admin access required" });
  };
  
  // Middleware per verificare se l'utente è attivo (non scaduto per gli account demo)
  const isActiveUser = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && req.user?.isActive !== false) {
      return next();
    }
    
    // Se l'utente non è attivo (probabilmente un account demo scaduto)
    req.logout((err) => {
      if (err) {
        console.error("Errore durante il logout dell'utente disattivato:", err);
      }
      
      res.status(403).json({ 
        message: "Account disattivato o scaduto", 
        code: "ACCOUNT_EXPIRED" 
      });
    });
  };
  
  // Ottieni gli account demo in scadenza nei prossimi giorni
  app.get("/api/admin/demo-accounts/expiring", isAdmin, async (req, res, next) => {
    try {
      // Trova gli account demo che scadranno nei prossimi 7 giorni
      const expiringAccounts = await storage.getDemoAccountsExpiringIn(7);
      
      // Rimuovi la password e altri dati sensibili
      const safeExpiringAccounts = expiringAccounts.map(account => {
        const { password, ...safeAccount } = account;
        return safeAccount;
      });
      
      res.json(safeExpiringAccounts);
    } catch (err) {
      next(err);
    }
  });

  // Register signature routes
  const router = Router();
  registerSignatureRoutes(router);
  
  // CRITICAL: Mount router on app with /api prefix
  app.use('/api', router);

  // Register anonymization routes
  setupAnonymizationRoutes(app);
  
  // Risposta API per indicare quale versione di codice sta eseguendo
  router.get("/version", (req, res) => {
    res.json({
      version: "1.1.0",
      updated: "2025-05-11",
      features: ["Project isolation", "Full PDF report generation", "Reference signatures validation", "Demo mode"]
    });
  });

  // Get user stats
  app.get("/api/stats", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      // Get document count
      const documentCount = await storage.getDocumentCount(userId);
      
      // Get query count
      const queryCount = await storage.getQueryCount(userId);
      
      // Get storage used (in bytes)
      const storageUsed = await storage.getStorageUsed(userId);
      
      // Get recent activity
      const recentActivity = await storage.getRecentActivity(userId, 5);
      
      // Get last uploaded document
      const lastUpload = await storage.getLastUploadTime(userId);
      
      // Get last query time
      const lastQuery = await storage.getLastQueryTime(userId);
      
      res.json({
        documentCount,
        queryCount,
        storageUsed,
        recentActivity,
        lastUpload,
        lastQuery
      });
    } catch (err) {
      next(err);
    }
  });

  // Document progress endpoint
  app.get("/api/documents/:id/progress", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      // Verifica che il documento appartenga all'utente
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Ottieni il progresso dal tracker
      const progress = getProgress(documentId);
      
      if (!progress) {
        // Se non ci sono informazioni di progresso, il documento potrebbe essere già stato elaborato
        if (document.indexed) {
          return res.json({ status: 'completed', progress: 100 });
        } else {
          return res.json({ status: 'pending', progress: 0 });
        }
      }
      
      // Calcola percentuale e tempo rimanente
      const percentage = getProgressPercentage(documentId);
      const timeRemaining = getEstimatedTimeRemaining(documentId);
      
      res.json({
        status: progress.status,
        progress: percentage,
        processedChunks: progress.processedChunks,
        totalChunks: progress.totalChunks,
        timeRemaining,
        error: progress.error
      });
    } catch (err) {
      next(err);
    }
  });
  
  // Document endpoints
  // Upload a document
  app.post("/api/documents", isAuthenticated, isActiveUser, upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const userId = req.user!.id;
      const user = await storage.getUser(userId) as User;
      
      // Check if the user has an API key configured or if we have a system key
      const hasUserKey = !!user.openaiApiKey;
      const hasSystemKey = !!process.env.OPENAI_API_KEY;
      
      if (!hasUserKey && !hasSystemKey) {
        return res.status(400).json({ 
          message: "OpenAI API key not configured. Please add your API key in settings." 
        });
      }
      
      // Check if file type is supported
      if (!isValidFileType(req.file.mimetype)) {
        return res.status(400).json({ message: "Unsupported file type" });
      }
      
      // Inizializza la barra di progresso con un ID temporaneo
      const tempDocId = Date.now(); // Usiamo il timestamp come ID temporaneo
      initProgress(tempDocId, 100); // Inizializziamo con 100 parti totali
      updateProgress(tempDocId, 5); // 5% - Avvio caricamento
      
      // Generate a unique filename
      const filename = generateFilename(req.file.originalname);
      updateProgress(tempDocId, 10); // 10% - Filename generato
      
      // Save the file temporarily
      const filepath = await saveFile(req.file.buffer, filename);
      updateProgress(tempDocId, 20); // 20% - File salvato
      
      try {
        // Process the file to extract text
        updateProgress(tempDocId, 25); // 25% - Inizio estrazione testo
        const content = await processFile(filepath, req.file.mimetype);
        updateProgress(tempDocId, 40); // 40% - Testo estratto
        
        // Save document to database
        updateProgress(tempDocId, 45); // 45% - Salvataggio database
        const document = await storage.createDocument({
          userId,
          filename,
          originalFilename: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          content,
          indexed: false
        });
        
        // Trasferisci il progresso dal tempDocId al documentId reale usando la nuova funzione
        const isTransferred = transferProgress(tempDocId, document.id);
        if (!isTransferred) {
          // Fallback: inizializza un nuovo tracker se il trasferimento fallisce
          initProgress(document.id, 100);
          updateProgress(document.id, 45);
        }
        
        // Add document to vector database - use user key or fallback to system key
        const apiKeyToUse = user.openaiApiKey || undefined; // undefined will trigger system key use
        
        // Aggiorniamo il progresso prima dell'indicizzazione vettoriale
        updateProgress(document.id, 50); // 50% - Pre-indicizzazione vettoriale
        
        try {
          // Nota: l'addDocumentToCollection chiamerà updateProgress() internamente
          // attraverso pgvector.ts per ogni chunk elaborato
          await addDocumentToCollection(document, apiKeyToUse);
          document.indexed = true;
          await storage.updateDocumentIndexStatus(document.id, true);
          
          // Segnala il completamento dell'elaborazione nel tracker di progresso
          completeProgress(document.id);
        } catch (indexError) {
          log(`Error indexing document: ${indexError}`, "express");
          // Non blocchiamo il flusso di lavoro se l'indicizzazione fallisce
          
          // Segnala il fallimento dell'elaborazione nel tracker di progresso
          const errorMessage = indexError instanceof Error ? indexError.message : String(indexError);
          failProgress(document.id, errorMessage || "Errore durante l'indicizzazione del documento");
        }
        
        // Il documento è già stato aggiornato nel blocco try/catch precedente
        
        // Log activity
        await storage.createActivity({
          userId,
          type: "upload",
          details: `Uploaded document: ${req.file.originalname}`
        });
        
        // Cleanup temporary file
        await cleanupFile(filepath);
        
        res.status(201).json(document);
      } catch (error) {
        // Cleanup temporary file on error
        await cleanupFile(filepath);
        throw error;
      }
    } catch (err) {
      next(err);
    }
  });

  // Import document from URL
  app.post("/api/documents/url", isAuthenticated, async (req, res, next) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required" });
      }
      
      // Inizializza subito il progresso con un ID temporaneo per mostrare feedback immediato
      const tempId = Date.now(); // ID temporaneo per il tracker
      initProgress(tempId, 100); // Impostiamo un totale di 100 steps
      updateProgress(tempId, 5); // 5% - Iniziamo il processo
      
      const userId = req.user!.id;
      const user = await storage.getUser(userId) as User;
      
      // Check if the user has an API key configured or if we have a system key
      const hasUserKey = !!user.openaiApiKey;
      const hasSystemKey = !!process.env.OPENAI_API_KEY;
      
      if (!hasUserKey && !hasSystemKey) {
        return res.status(400).json({ 
          message: "OpenAI API key not configured. Please add your API key in settings." 
        });
      }
      
      // Fetch HTML content from URL
      updateProgress(tempId, 15); // 15% - Inizio download del contenuto HTML
      const { content, filename } = await fetchHtmlFromUrl(url);
      updateProgress(tempId, 30); // 30% - Download completato
      
      // Process the HTML content
      updateProgress(tempId, 35); // 35% - Inizio elaborazione del contenuto HTML
      const processedContent = await extractTextFromHTML('', content);
      updateProgress(tempId, 40); // 40% - Elaborazione completata
      
      // Save document to database
      updateProgress(tempId, 45); // 45% - Preparazione per il salvataggio nel database
      const estimatedSize = Buffer.byteLength(content, 'utf8');
      
      const document = await storage.createDocument({
        userId,
        filename,
        originalFilename: url,
        fileType: 'text/html',
        fileSize: estimatedSize,
        content: processedContent,
        indexed: false
      });
      
      // Trasferisci il progresso dal tempId al documentId reale usando la nuova funzione
      const isTransferred = transferProgress(tempId, document.id);
      if (!isTransferred) {
        // Fallback: inizializza un nuovo tracker se il trasferimento fallisce
        initProgress(document.id, 100);
        updateProgress(document.id, 50); // 50% - Pre-indicizzazione vettoriale
      }
      
      // Add document to vector database - use user key or fallback to system key
      const apiKeyToUse = user.openaiApiKey || undefined; // undefined will trigger system key use
      
      try {
        await addDocumentToCollection(document, apiKeyToUse);
        document.indexed = true;
        await storage.updateDocumentIndexStatus(document.id, true);
        
        // Segnala il completamento dell'elaborazione nel tracker di progresso
        completeProgress(document.id);
      } catch (indexError) {
        log(`Error indexing document: ${indexError}`, "express");
        // Non blocchiamo il flusso di lavoro se l'indicizzazione fallisce
        
        // Segnala il fallimento dell'elaborazione nel tracker di progresso
        const errorMessage = indexError instanceof Error ? indexError.message : String(indexError);
        failProgress(document.id, errorMessage || "Errore durante l'indicizzazione del documento");
      }
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "import",
        details: `Imported web page: ${url}`
      });
      
      res.status(201).json(document);
    } catch (err) {
      next(err);
    }
  });

  // Get all documents for a user
  app.get("/api/documents", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      // Get query parameters for filtering
      const fileType = req.query.fileType as string | undefined;
      const searchTerm = req.query.search as string | undefined;
      const dateRange = req.query.dateRange as string | undefined;
      
      const documents = await storage.getUserDocuments(userId, { fileType, searchTerm, dateRange });
      res.json(documents);
    } catch (err) {
      next(err);
    }
  });

  // Get a specific document
  app.get("/api/documents/:id", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if document belongs to user
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(document);
    } catch (err) {
      next(err);
    }
  });

  // Delete a document
  app.delete("/api/documents/:id", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const documentId = parseInt(req.params.id);
      const user = await storage.getUser(userId) as User;
      
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if document belongs to user
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Remove document from vector database if it was indexed - use user key or fallback to system key
      if (document.indexed) {
        try {
          await removeDocumentFromCollection(documentId, userId);
        } catch (error) {
          log(`Error removing document from vector database: ${error}`, "express");
          // Non blocchiamo il flusso di lavoro se la rimozione fallisce
        }
      }
      
      // Delete document from storage
      await storage.deleteDocument(documentId);
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "delete",
        details: `Deleted document: ${document.originalFilename}`
      });
      
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Reprocess document (extract text and update the index)
  app.post("/api/documents/:id/reprocess", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const documentId = parseInt(req.params.id);
      const user = await storage.getUser(userId) as User;
      
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if document belongs to user
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Check if file exists
      const filepath = path.join(process.cwd(), 'uploads', document.filename);
      let fileExists = true;
      try {
        await fs.access(filepath);
      } catch (error) {
        fileExists = false;
        log(`Document file not found on server: ${filepath}`, "express");
        return res.status(404).json({ message: "Document file not found on server" });
      }
      
      // Remove from vector database first (if possible) to prevent duplicates
      if (document.indexed) {
        try {
          await removeDocumentFromCollection(documentId, userId);
        } catch (error) {
          log(`Error removing document from vector database: ${error}`, "express");
          // Non blocchiamo il flusso di lavoro se la rimozione fallisce
        }
      }
      
      // Process the file to extract text
      let content = '';
      try {
        log(`Processing file: ${filepath}`, "express");
        content = await processFile(filepath, document.fileType);
      } catch (error) {
        log(`Error reprocessing document content: ${error}`, "express");
        return res.status(500).json({ message: "Failed to process document content" });
      }
      
      // Update document with extracted content
      await storage.updateDocumentIndexStatus(documentId, false); // First update indexed status
      await storage.updateDocumentContent(documentId, content); // Then update content
      
      // Add document back to vector database with updated content
      const apiKeyToUse = user.openaiApiKey || undefined; // undefined will trigger system key use
      log(`Adding document back to vector database with updated content`, "express");
      
      try {
        // Ottieni il documento aggiornato
        const updatedDocument = await storage.getDocument(documentId);
        if (updatedDocument) {
          await addDocumentToCollection(updatedDocument, apiKeyToUse);
          await storage.updateDocumentIndexStatus(documentId, true);
        } else {
          log(`Document not found after update`, "express");
        }
      } catch (indexError) {
        log(`Error re-indexing document: ${indexError}`, "express");
        // Non blocchiamo il flusso di lavoro se l'indicizzazione fallisce
      }
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "reprocess",
        details: `Reprocessed document: ${document.originalFilename}`
      });
      
      const updatedDocument = await storage.getDocument(documentId);
      res.json({
        id: updatedDocument?.id,
        filename: updatedDocument?.originalFilename,
        fileType: updatedDocument?.fileType,
        createdAt: updatedDocument?.createdAt,
        updatedAt: updatedDocument?.updatedAt,
        indexed: updatedDocument?.indexed
      });
    } catch (err) {
      next(err);
    }
  });

  // Query endpoints
  // Perform a RAG query
  app.post("/api/query", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId) as User;
      
      // Validate request body
      const { query, documentIds, model = "gpt-4o", temperature = 0.7, conversationContext = [] } = req.body;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }
      
      if (!Array.isArray(documentIds)) {
        return res.status(400).json({ message: "documentIds must be an array" });
      }
      
      // Verifica che il contesto della conversazione sia un array
      if (!Array.isArray(conversationContext)) {
        return res.status(400).json({ message: "conversationContext must be an array" });
      }
      
      // Check if the user has an API key configured or if we have a system key
      const hasUserKey = !!user.openaiApiKey;
      const hasSystemKey = !!process.env.OPENAI_API_KEY;
      
      if (!hasUserKey && !hasSystemKey) {
        return res.status(400).json({ 
          message: "OpenAI API key not configured. Please add your API key in settings or ask administrator to configure system key." 
        });
      }
      
      // Validate API key - prioritize user key, fall back to system key
      const apiKeyToUse = user.openaiApiKey || undefined; // undefined will trigger system key use
      const isValidKey = await validateAPIKey(apiKeyToUse, userId);
      if (!isValidKey) {
        return res.status(400).json({ message: "Invalid OpenAI API key" });
      }
      
      // Check if selected documents exist and belong to the user
      const selectedDocuments = await storage.getMultipleDocuments(documentIds);
      
      // Filter out documents that don't belong to the user
      const validDocuments = selectedDocuments.filter(doc => doc.userId === userId);
      
      if (validDocuments.length === 0) {
        return res.status(400).json({ message: "No valid documents selected" });
      }
      
      // Get document IDs that are actually valid
      const validDocumentIds = validDocuments.map(doc => doc.id);
      
      // Query ChromaDB for relevant context with the API key
      const queryResults = await queryCollection(
        userId,
        query,
        validDocumentIds,
        apiKeyToUse
      );
      
      // Build context from retrieved documents
      const context = queryResults.documents;
      
      // Get ChatGPT response - use user key or fallback to system key
      const response = await chatWithRAG(
        query,
        context,
        apiKeyToUse,
        model,
        temperature,
        conversationContext, // Passa il contesto della conversazione
        userId // Aggiungo userId per attivare fallback
      );
      
      // Save query and response to database
      const savedQuery = await storage.createQuery({
        userId,
        query,
        response,
        documentIds: validDocumentIds,
      });
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "query",
        details: `Performed query: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`
      });
      
      res.json({
        id: savedQuery.id,
        query,
        response,
        documents: validDocuments.map(doc => ({
          id: doc.id,
          filename: doc.originalFilename
        })),
        createdAt: savedQuery.createdAt
      });
    } catch (err) {
      next(err);
    }
  });

  // Get query history
  app.get("/api/queries", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const queries = await storage.getUserQueries(userId);
      res.json(queries);
    } catch (err) {
      next(err);
    }
  });

  // Get a specific query
  app.get("/api/queries/:id", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const queryId = parseInt(req.params.id);
      
      if (isNaN(queryId)) {
        return res.status(400).json({ message: "Invalid query ID" });
      }
      
      const query = await storage.getQuery(queryId);
      
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }
      
      // Check if query belongs to user
      if (query.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get document information for the query
      const documents = await storage.getMultipleDocuments(query.documentIds);
      
      res.json({
        ...query,
        documents: documents.map(doc => ({
          id: doc.id,
          filename: doc.originalFilename
        }))
      });
    } catch (err) {
      next(err);
    }
  });

  // Activity endpoints
  // Get recent activity
  app.get("/api/activities", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string || "10");
      
      const activities = await storage.getRecentActivity(userId, limit);
      res.json(activities);
    } catch (err) {
      next(err);
    }
  });
  
  // OCR endpoints
  // Get OCR process status
  app.get("/api/ocr/status/:processId", isAuthenticated, async (req, res, next) => {
    try {
      const { processId } = req.params;
      const status = getOCRProcessStatus(processId);
      
      if (!status) {
        return res.status(404).json({ message: "Processo non trovato" });
      }
      
      res.json(status);
    } catch (error: any) {
      log("ocr", `Errore status OCR: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Process OCR for uploaded file
  app.post("/api/ocr/process", isAuthenticated, isActiveUser, ocrUpload.single('file'), async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const file = req.file;
      
      // Debug logging dettagliato
      log("ocr", `=== DEBUG OCR UPLOAD ===`);
      log("ocr", `User ID: ${userId}`);
      log("ocr", `Request headers: ${JSON.stringify(req.headers)}`);
      log("ocr", `Request body keys: ${Object.keys(req.body)}`);
      log("ocr", `File object: ${file ? 'PRESENTE' : 'NULL'}`);
      if (file) {
        log("ocr", `File details: ${JSON.stringify({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        })}`);
      }
      
      if (!file) {
        log("ocr", `ERRORE: Nessun file ricevuto dal middleware multer`);
        return res.status(400).json({ message: "Nessun file caricato" });
      }

      // Parse settings from request
      let settings;
      try {
        settings = JSON.parse(req.body.settings || '{}');
      } catch {
        settings = {
          language: "ita+eng",
          dpi: 300,
          preprocessingMode: "auto",
          outputFormat: "text"
        };
      }

      log("ocr", `Processamento OCR avviato per utente ${userId}, file: ${file.originalname}`);

      // Genera un ID univoco per il processo
      const processId = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Avvia processamento asincrono
      processOCRWithProgress(file.buffer, file.originalname, settings, processId);
      
      // Restituisci immediatamente l'ID del processo per il polling
      res.json({ processId, message: "Processamento avviato" });
    } catch (error: any) {
      log("ocr", `Errore processamento OCR: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Save OCR result as document
  app.post("/api/documents/from-ocr", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { title, content, originalFilename, metadata } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "Titolo e contenuto sono obbligatori" });
      }

      log("ocr", `Salvataggio documento OCR per utente ${userId}: ${title}`);

      // Save as new document using existing storage system
      const timestamp = Date.now();
      const filename = `ocr_${timestamp}_${title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      
      // Create document data
      const documentData = {
        userId,
        filename,
        originalFilename: `${title}.txt`,
        fileSize: Buffer.byteLength(content, 'utf8'),
        fileType: 'text/plain',
        content,
        indexed: false,
        source: 'ocr',
        metadata: JSON.stringify(metadata || {})
      };

      // Save using storage interface
      const document = await storage.createDocument(documentData);
      
      // Add to vector store for RAG
      try {
        const user = await storage.getUser(userId);
        await addDocumentToCollection(document, user?.openaiApiKey);
        // Mark as indexed - using direct database update since storage interface doesn't have updateDocument  
        await db.update(documents).set({ indexed: true }).where(eq(documents.id, document.id));
        log("ocr", `Documento OCR indicizzato nel vector store: ${document.id}`);
      } catch (indexError: any) {
        log("ocr", `Errore indicizzazione documento OCR: ${indexError.message}`);
        // Continue even if indexing fails
      }

      res.json({
        id: document.id,
        message: "Documento OCR salvato e aggiunto alla base di conoscenza"
      });
    } catch (error: any) {
      log("ocr", `Errore salvataggio documento OCR: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Recommendation endpoints
  // Get recommendations for current user
  app.get("/api/recommendations", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      const includeViewed = req.query.includeViewed === 'true';
      const includeDismissed = req.query.includeDismissed === 'true';
      const limit = parseInt(req.query.limit as string || "5");
      
      const recommendations = await getUserRecommendations(userId, limit, includeViewed, includeDismissed);
      res.json(recommendations);
    } catch (error) {
      next(error);
    }
  });
  
  // Generate new recommendations
  app.post("/api/recommendations/generate", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      const count = req.body.count || 3;
      // Usa la lingua inviata dal client o fallback su 'it'
      const locale = req.body.locale || 'it';
      console.log(`Generazione raccomandazioni in lingua: ${locale}`);
      const recommendations = await generateRecommendations(userId, count, locale);
      res.json(recommendations);
    } catch (error) {
      next(error);
    }
  });
  
  // Update recommendation status (viewed/dismissed)
  app.patch("/api/recommendations/:id", isAuthenticated, isActiveUser, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      const recommendationId = parseInt(req.params.id);
      const { viewed, dismissed } = req.body;
      
      const success = await updateRecommendationStatus(
        recommendationId, 
        userId, 
        viewed !== undefined ? viewed : undefined, 
        dismissed !== undefined ? dismissed : undefined
      );
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Raccomandazione non trovata o non aggiornata" });
      }
    } catch (error) {
      next(error);
    }
  });

  // Report Template API Routes
  // Get all report templates for current user
  app.get("/api/report-templates", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const templates = await storage.getUserReportTemplates(userId);
      res.json(templates);
    } catch (err) {
      next(err);
    }
  });

  // Get public report templates
  app.get("/api/report-templates/public", isAuthenticated, async (req, res, next) => {
    try {
      const templates = await storage.getPublicReportTemplates();
      res.json(templates);
    } catch (err) {
      next(err);
    }
  });

  // Get a specific report template
  app.get("/api/report-templates/:id", isAuthenticated, async (req, res, next) => {
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getReportTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Report template not found" });
      }
      
      const userId = req.user!.id;
      // Only allow access if the template belongs to the user or is public
      if (template.userId !== userId && !template.isPublic) {
        return res.status(403).json({ error: "You don't have permission to access this template" });
      }
      
      res.json(template);
    } catch (err) {
      next(err);
    }
  });

  // Create a new report template
  app.post("/api/report-templates", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { name, description, template, isPublic, thumbnailUrl } = req.body;
      
      const newTemplate = await storage.createReportTemplate({
        userId,
        name,
        description: description || null,
        template,
        isPublic: isPublic || false,
        thumbnailUrl: thumbnailUrl || null,
      });
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "template_created",
        details: `Created report template: ${name}`
      });
      
      res.status(201).json(newTemplate);
    } catch (err) {
      next(err);
    }
  });

  // Update a report template
  app.put("/api/report-templates/:id", isAuthenticated, async (req, res, next) => {
    try {
      const templateId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if template exists and belongs to the user
      const existingTemplate = await storage.getReportTemplate(templateId);
      if (!existingTemplate) {
        return res.status(404).json({ error: "Report template not found" });
      }
      
      if (existingTemplate.userId !== userId) {
        return res.status(403).json({ error: "You don't have permission to update this template" });
      }
      
      const { name, description, template, isPublic, thumbnailUrl } = req.body;
      
      const updatedTemplate = await storage.updateReportTemplate(templateId, {
        name,
        description,
        template, 
        isPublic,
        thumbnailUrl
      });
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "template_updated",
        details: `Updated report template: ${updatedTemplate.name}`
      });
      
      res.json(updatedTemplate);
    } catch (err) {
      next(err);
    }
  });

  // Delete a report template
  app.delete("/api/report-templates/:id", isAuthenticated, async (req, res, next) => {
    try {
      const templateId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if template exists and belongs to the user
      const existingTemplate = await storage.getReportTemplate(templateId);
      if (!existingTemplate) {
        return res.status(404).json({ error: "Report template not found" });
      }
      
      if (existingTemplate.userId !== userId) {
        return res.status(403).json({ error: "You don't have permission to delete this template" });
      }
      
      await storage.deleteReportTemplate(templateId);
      
      // Log activity
      await storage.createActivity({
        userId,
        type: "template_deleted",
        details: `Deleted report template: ${existingTemplate.name}`
      });
      
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ===== ROUTE DI AMMINISTRAZIONE =====
  
  // Lista di tutti gli utenti (solo admin)
  app.get("/api/admin/users", isAdmin, async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      // Rimuovi password dall'output
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      res.json(safeUsers);
    } catch (err) {
      next(err);
    }
  });
  
  // Conteggio utenti (solo admin)
  app.get("/api/admin/users/count", isAdmin, async (req, res, next) => {
    try {
      const count = await storage.getUserCount();
      res.json({ count });
    } catch (err) {
      next(err);
    }
  });
  
  // Cambia ruolo utente (solo admin)
  app.put("/api/admin/users/:id/role", isAdmin, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role } = req.body;
      
      if (!role || (role !== 'user' && role !== 'admin')) {
        return res.status(400).json({ error: "Invalid role. Must be 'user' or 'admin'" });
      }
      
      // Impedisci di rimuovere i diritti di admin all'ultimo amministratore
      if (role === 'user' && userId === req.user!.id) {
        const users = await storage.getAllUsers();
        const adminCount = users.filter(u => u.role === 'admin').length;
        
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot remove admin role from the last administrator" });
        }
      }
      
      const updatedUser = await storage.updateUserRole(userId, role);
      const { password, ...safeUser } = updatedUser;
      
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });
  
  // Elimina utente (solo admin)
  app.delete("/api/admin/user/:id", isAdmin, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // Impedisci di eliminare se stessi
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      // Verifica che l'utente esista
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.deleteUser(userId);
      
      // Log activity
      await storage.createActivity({
        userId: req.user!.id,
        type: "user_deleted",
        details: `Amministratore ha eliminato l'utente: ${user.username}`
      });
      
      res.json({ message: "User successfully deleted" });
    } catch (err) {
      next(err);
    }
  });
  
  // Statistiche del sistema (solo admin)
  app.get("/api/admin/stats", isAdmin, async (req, res, next) => {
    try {
      // Conteggio totale utenti
      const userCount = await storage.getUserCount();
      
      // Conteggio totale documenti
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM documents`);
      const resultArray = result as unknown as Record<string, any>[];
      const documentCount = resultArray[0]?.count || 0;
      
      // Spazio totale utilizzato
      const sizeResult = await db.execute(sql`SELECT SUM(file_size) as total FROM documents`);
      const sizeResultArray = sizeResult as unknown as Record<string, any>[];
      const totalSize = sizeResultArray[0]?.total || 0;
      const totalSizeMB = Math.round(totalSize / (1024 * 1024) * 100) / 100;
      
      // Conteggio totale query
      const queryResult = await db.execute(sql`SELECT COUNT(*) as count FROM queries`);
      const queryResultArray = queryResult as unknown as Record<string, any>[];
      const queryCount = queryResultArray[0]?.count || 0;
      
      // Ultimi utenti registrati
      const newUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(5);
      
      // Account demo in scadenza
      const expiringDemoAccounts = await storage.getDemoAccountsExpiringIn(7); // Account che scadono entro 7 giorni
      const safeExpiringAccounts = expiringDemoAccounts.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      // Rimuovi le password dall'output
      const safeNewUsers = newUsers.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({
        userCount,
        documentCount,
        totalSize: `${totalSizeMB} MB`,
        queryCount,
        newUsers: safeNewUsers,
        expiringDemoAccounts: safeExpiringAccounts
      });
    } catch (err) {
      next(err);
    }
  });
  
  // Crea un account demo (solo admin)
  app.post("/api/admin/demo-account", isAdmin, async (req, res, next) => {
    try {
      // Validazione dei dati
      const validationResult = createDemoAccountSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Dati account demo non validi", details: validationResult.error.format() });
      }
      
      const demoData = validationResult.data;
      
      // Verifica se l'username è già in uso
      const existingUser = await storage.getUserByUsername(demoData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username già in uso" });
      }
      
      // Verifica se l'email è già in uso
      const existingEmail = await storage.getUserByEmail(demoData.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email già in uso" });
      }
      
      // Hash della password
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const passwordBuf = (await scryptAsync(demoData.password, salt, 64)) as Buffer;
      const hashedPassword = `${passwordBuf.toString("hex")}.${salt}`;
      
      // Crea l'account demo
      const demoAccount = await storage.createDemoAccount(
        {
          ...demoData,
          password: hashedPassword
        }, 
        demoData.durationDays
      );
      
      // Registra attività
      await storage.createActivity({
        userId: req.user!.id,
        type: "admin",
        details: `Creato account demo '${demoAccount.username}' con scadenza ${demoAccount.demoExpiresAt!.toLocaleDateString()}`
      });
      
      // Rimuovi la password dall'output
      const { password, ...safeDemoAccount } = demoAccount;
      
      res.status(201).json(safeDemoAccount);
    } catch (err) {
      next(err);
    }
  });
  
  // Estendi un account demo (solo admin)
  app.post("/api/admin/extend-demo", isAdmin, async (req, res, next) => {
    try {
      // Validazione dei dati
      const validationResult = extendDemoSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Dati non validi", details: validationResult.error.format() });
      }
      
      const { userId, additionalDays } = validationResult.data;
      
      // Verifica che l'utente esista
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Utente non trovato" });
      }
      
      // Verifica che sia un account demo
      if (user.accountType !== 'demo') {
        return res.status(400).json({ error: "L'utente specificato non è un account demo" });
      }
      
      // Estendi l'account demo
      const updatedUser = await storage.extendDemoAccount(userId, additionalDays);
      
      // Registra attività
      await storage.createActivity({
        userId: req.user!.id,
        type: "admin",
        details: `Esteso account demo '${updatedUser.username}' di ${additionalDays} giorni. Nuova scadenza: ${updatedUser.demoExpiresAt!.toLocaleDateString()}`
      });
      
      // Rimuovi la password dall'output
      const { password, ...safeUser } = updatedUser;
      
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });
  
  // Manutenzione account demo scaduti
  app.post("/api/admin/maintenance/demo-accounts", isAdmin, async (req, res, next) => {
    try {
      // Disattiva gli account demo scaduti
      const deactivatedCount = await storage.deactivateExpiredDemoAccounts();
      
      // Ottieni i dati per la purga (account che hanno superato il periodo di ritenzione dati)
      const accountsToPurge = await storage.getDataForPurge(14); // 14 giorni oltre la scadenza
      
      let purgedCount = 0;
      
      if (accountsToPurge.length > 0) {
        // Implementa qui la logica per eliminare file e dati
        // Questa operazione richiede ulteriore sviluppo per gestire correttamente la pulizia dei dati
        
        // TODO: eliminazione dei dati
        purgedCount = accountsToPurge.length;
      }
      
      // Registra attività
      await storage.createActivity({
        userId: req.user!.id,
        type: "admin",
        details: `Manutenzione account demo: ${deactivatedCount} disattivati, ${purgedCount} purge-ready`
      });
      
      res.json({
        deactivatedAccounts: deactivatedCount,
        purgeReadyAccounts: accountsToPurge.length
      });
    } catch (err) {
      next(err);
    }
  });

  // Image Quality Analysis endpoint for drag & drop confidence meter
  app.post("/api/analyze-image-quality", isAuthenticated, isActiveUser, imageQualityUpload.single('image'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        // Clean up uploaded file
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up invalid file:', cleanupError);
        }
        return res.status(400).json({ message: "Invalid file type. Please upload JPEG, PNG, TIFF, or BMP images." });
      }

      // Log file details for debugging
      console.log(`[IMAGE_QUALITY] Analyzing file: ${req.file.filename}, path: ${req.file.path}, size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);
      
      // Analyze image quality
      const qualityResult = await analyzeImageQuality(req.file.path);

      // Clean up the temporary file after analysis
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up analyzed file:', cleanupError);
      }

      res.json(qualityResult);
    } catch (err) {
      console.error('Error analyzing image quality:', err);
      
      // Clean up file on error
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file after error:', cleanupError);
        }
      }
      
      res.status(500).json({ 
        message: "Failed to analyze image quality",
        error: err.message || "Unknown error"
      });
    }
  });

  // SendGrid configuration endpoint (admin only)
  app.post("/api/admin/sendgrid-config", isAdmin, async (req, res, next) => {
    try {
      const { apiKey, senderEmail } = req.body;
      
      if (!apiKey || !senderEmail) {
        return res.status(400).json({ 
          message: "API key and sender email are required" 
        });
      }

      const { saveSendGridConfig } = await import('./sendgrid-service');
      await saveSendGridConfig({
        apiKey,
        senderEmail,
        isConfigured: true
      });

      res.json({ message: "SendGrid configuration updated successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Test SendGrid configuration endpoint (admin only)
  app.post("/api/admin/sendgrid-test", isAdmin, async (req, res, next) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ 
          message: "Test email address is required" 
        });
      }

      const { testSendGridConfiguration } = await import('./sendgrid-service');
      const success = await testSendGridConfiguration(testEmail);

      if (success) {
        res.json({ message: "Test email sent successfully!" });
      } else {
        res.status(500).json({ message: "Failed to send test email" });
      }
    } catch (err) {
      next(err);
    }
  });

  // Register Wake Up quiz routes
  app.use("/api/wake-up", wakeUpRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
