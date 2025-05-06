import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fsExtra from 'fs-extra';
import { ensureReportDirectory } from "./pdf-utils";
import { initializeChromaDB } from './chromadb';
import { execSync } from 'child_process';
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
  
  // Inizializza ChromaDB all'avvio
  try {
    log("Inizializzazione ChromaDB persistente...", "chromadb");
    
    // Verifica se è necessario eseguire lo script start-chroma.sh
    const chromaPidExists = fs.existsSync(path.join(process.cwd(), 'chroma.pid'));
    
    if (!chromaPidExists) {
      log("Esecuzione script di inizializzazione ChromaDB...", "chromadb");
      try {
        // Esegui lo script di inizializzazione
        execSync('./start-chroma.sh', { stdio: 'inherit' });
        log("ChromaDB persistente inizializzato con successo", "chromadb");
      } catch (error) {
        log(`Errore durante l'inizializzazione di ChromaDB: ${error}`, "chromadb");
        log("L'applicazione continuerà usando il fallback in-memory", "chromadb");
      }
    } else {
      log("ChromaDB già inizializzato, flag chroma.pid trovato", "chromadb");
    }
    
    // Inizializza il client ChromaDB (sia che il server sia disponibile o meno)
    await initializeChromaDB();
  } catch (error) {
    log(`Errore durante l'inizializzazione di ChromaDB: ${error}`, "chromadb");
    log("L'applicazione continuerà usando il fallback in-memory", "chromadb");
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
