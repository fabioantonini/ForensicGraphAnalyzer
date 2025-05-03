import { Express, Request, Response, NextFunction, Router } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
import { Document, User, insertQuerySchema, signatures, InsertReportTemplate } from "@shared/schema";
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
  initializeChromaDB
} from "./chromadb";
import { chatWithRAG, validateAPIKey } from "./openai";
import { log } from "./vite";
import { registerSignatureRoutes } from "./signature-routes";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";

// Initialize multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize ChromaDB - but don't block the app if it fails
  // This allows the auth system to work even if ChromaDB is unavailable
  try {
    await initializeChromaDB();
  } catch (error) {
    log(`ChromaDB initialization error (non-blocking): ${error}`, "express");
  }

  // Sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Register signature routes
  const router = Router();
  registerSignatureRoutes(router);
  
  // Risposta API per indicare quale versione di codice sta eseguendo
  router.get("/api/version", (req, res) => {
    res.json({
      version: "1.0.0",
      updated: "2025-05-02",
      features: ["Project isolation", "Full PDF report generation", "Reference signatures validation"]
    });
  });
  
  app.use("/api", router);

  // Get user stats
  app.get("/api/stats", isAuthenticated, async (req, res, next) => {
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

  // Document endpoints
  // Upload a document
  app.post("/api/documents", isAuthenticated, upload.single("file"), async (req, res, next) => {
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
      
      // Generate a unique filename
      const filename = generateFilename(req.file.originalname);
      
      // Save the file temporarily
      const filepath = await saveFile(req.file.buffer, filename);
      
      try {
        // Process the file to extract text
        const content = await processFile(filepath, req.file.mimetype);
        
        // Save document to database
        const document = await storage.createDocument({
          userId,
          filename,
          originalFilename: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          content,
          indexed: false
        });
        
        // Add document to ChromaDB collection - use user key or fallback to system key
        const apiKeyToUse = user.openaiApiKey || undefined; // undefined will trigger system key use
        const indexed = await addDocumentToCollection(userId, document, apiKeyToUse);
        
        // Update document indexed status
        if (indexed) {
          await storage.updateDocumentIndexStatus(document.id, true);
          document.indexed = true;
        }
        
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
      const { content, filename } = await fetchHtmlFromUrl(url);
      
      // Process the HTML content
      const processedContent = await extractTextFromHTML('', content);
      
      // Save document to database
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
      
      // Add document to ChromaDB collection - use user key or fallback to system key
      const apiKeyToUse = user.openaiApiKey || undefined; // undefined will trigger system key use
      const indexed = await addDocumentToCollection(userId, document, apiKeyToUse);
      
      // Update document indexed status
      if (indexed) {
        await storage.updateDocumentIndexStatus(document.id, true);
        document.indexed = true;
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
  app.get("/api/documents", isAuthenticated, async (req, res, next) => {
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
  app.get("/api/documents/:id", isAuthenticated, async (req, res, next) => {
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
      
      // Remove document from ChromaDB if it was indexed - use user key or fallback to system key
      if (document.indexed) {
        const apiKeyForDelete = user.openaiApiKey || undefined; // undefined will trigger system key use
        await removeDocumentFromCollection(userId, documentId, apiKeyForDelete);
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

  // Query endpoints
  // Perform a RAG query
  app.post("/api/query", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId) as User;
      
      // Validate request body
      const { query, documentIds, model = "gpt-4o", temperature = 0.7 } = req.body;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }
      
      if (!Array.isArray(documentIds)) {
        return res.status(400).json({ message: "documentIds must be an array" });
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
      const isValidKey = await validateAPIKey(apiKeyToUse);
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
        temperature
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

  const httpServer = createServer(app);
  return httpServer;
}
