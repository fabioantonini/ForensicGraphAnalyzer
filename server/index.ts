import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fsExtra from 'fs-extra';
import { ensureReportDirectory } from "./pdf-utils";
import { initializeVectorDB } from './vectordb'; // Nuovo modulo di persistenza vettoriale
import { testDatabaseConnection, isPgVectorAvailable } from './db';
import fs from 'fs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Assicurati che le directory per i report esistano
  try {
    await ensureReportDirectory();
    log("Directory per i report inizializzata", "pdf-utils");
  } catch (error) {
    console.error("Errore nell'inizializzazione della directory per i report:", error);
  }
  
  // Inizializzazione del database vettoriale
  try {
    log("Inizializzazione sistema di persistenza vettoriale...", "database");
    
    // Verifica connessione al database PostgreSQL
    const pgConnected = await testDatabaseConnection();
    
    if (pgConnected) {
      log("Connessione al database PostgreSQL riuscita", "database");
      
      // Verifica disponibilità estensione pgvector
      const vectorAvailable = await isPgVectorAvailable();
      
      if (vectorAvailable) {
        log("Estensione pgvector installata e disponibile", "database");
        log("Sistema di persistenza vettoriale pgvector abilitato", "database");
      } else {
        log("Estensione pgvector non disponibile", "database");
        log("ATTENZIONE: Sarà utilizzato storage in-memory non persistente", "database");
      }
    } else {
      log("Connessione al database PostgreSQL fallita", "database");
      log("ATTENZIONE: Sarà utilizzato storage in-memory non persistente", "database");
    }
    
    // Inizializza il sistema vettoriale
    await initializeVectorDB();
  } catch (error) {
    log(`Errore durante l'inizializzazione del sistema vettoriale: ${error}`, "database");
    log("L'applicazione continuerà ma potrebbero esserci problemi di persistenza", "database");
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
