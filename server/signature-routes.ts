import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { SignatureAnalyzer } from "./signature-analyzer";
import { SignaturePythonAnalyzer } from "./python-bridge";
import { insertSignatureProjectSchema, insertSignatureSchema, signatures } from "@shared/schema";
import { eq } from 'drizzle-orm';
import { db } from './db';
import { log } from "./vite";
import PDFDocument from "pdfkit";
import OpenAI from "openai";
import { SignatureCropper } from "./signature-cropper";
// Import determineBestDPI rimosso - ora utilizziamo solo dimensioni reali inserite dall'utente

// Per compatibilità retroattiva, inizialmente usiamo solo fs standard
import { createWriteStream, constants } from "fs";
import sharp from "sharp";

// Inizializza OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for signature uploads
const signatureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'signatures');
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const ext = path.extname(file.originalname);
      cb(null, `signature_${timestamp}_${randomString}${ext}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Usa JPG, PNG, BMP o TIFF.'));
    }
  }
});

// Export function to register all signature routes
export function registerSignatureRoutes(appRouter: Router) {
  console.log("🔥🔥🔥 REGISTERING SIGNATURE ROUTES 🔥🔥🔥");
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  
  // Middleware to check if user is active
  const isActiveUser = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.isActive !== false) {
      return next();
    }
    res.status(403).json({ message: "Account disattivato o scaduto" });
  };

  // Crea un nuovo progetto firma
  appRouter.post("/signature-projects", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const projectData = insertSignatureProjectSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      const project = await storage.createSignatureProject(projectData);
      
      // Crea una attività per il nuovo progetto
      await storage.createActivity({
        userId: req.user!.id,
        type: 'project_create',
        details: `Creato progetto di verifica firma: ${project.name}`
      });
      
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Ottieni tutti i progetti firma dell'utente
  appRouter.get("/signature-projects", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const projects = await storage.getUserSignatureProjects(req.user!.id);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ottieni un progetto firma specifico
  appRouter.get("/signature-projects/:id", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Elimina un progetto firma
  appRouter.delete("/signature-projects/:id", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      await storage.deleteSignatureProject(projectId);
      
      // Crea una attività per l'eliminazione del progetto
      await storage.createActivity({
        userId: req.user!.id,
        type: 'project_delete',
        details: `Eliminato progetto di verifica firma: ${project.name}`
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Esegui confronto automatico di tutte le firme da verificare in un progetto
  appRouter.post("/signature-projects/:id/compare-all", isAuthenticated, isActiveUser, async (req, res) => {
    console.error(`\n🔥🔥🔥 COMPARE-ALL ENTRY REACHED WITH MIDDLEWARE! 🔥🔥🔥`);
    console.error(`TIMESTAMP: ${new Date().toISOString()}`);
    console.error(`PROJECT ID: ${req.params.id}`);
    console.error(`USER: ${req.user?.username || 'NO USER'}`);
    console.error(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n`);
    
    try {
      const projectId = parseInt(req.params.id);
      
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Ottieni tutte le firme di riferimento
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      
      // Filtra le firme di riferimento complete (con parametri)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      // Ottieni tutte le firme da verificare
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      
      // Filtra le firme da verificare complete (con parametri)
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      if (completedVerifications.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile'
        });
      }
      
      // Risultati del confronto
      const results = [];
      
      for (const signature of completedVerifications) {
        try {
          console.log(`[COMPARE-ALL] Elaborazione firma ${signature.id}`);
          
          // Cancella grafico cached per forzare rigenerazione
          await storage.updateSignature(signature.id, { comparisonChart: null });
          
          let similarityScore = 0;
          let comparisonChart = null;
          let analysisReport = null;
          
          // Usa la prima firma di riferimento disponibile per il confronto
          const referenceSignature = completedReferences[0];
          console.log(`[COMPARE-ALL] Using reference signature:`, {
            id: referenceSignature.id,
            filename: referenceSignature.filename,
            originalFilename: referenceSignature.originalFilename,
            dpi: referenceSignature.dpi
          });
          
          // Confronta con Python analyzer
          try {
            const verificaPath = path.join('uploads', signature.filename);
            const referencePath = path.join('uploads', referenceSignature.filename);
            
            const pythonResult = await SignaturePythonAnalyzer.compareSignatures(
              verificaPath,
              referencePath,
              signature.parameters?.realDimensions || { widthMm: signature.realWidthMm, heightMm: signature.realHeightMm },
              referenceSignature.parameters?.realDimensions || { widthMm: referenceSignature.realWidthMm, heightMm: referenceSignature.realHeightMm }
            );
            
            similarityScore = pythonResult.similarity / 100; // Converti in decimale
            comparisonChart = pythonResult.comparison_chart; // CORRETTO: field name è comparison_chart
            analysisReport = pythonResult.description; // CORRETTO: field name è description
            
            console.log(`[COMPARE-ALL] Python result per firma ${signature.id}:`, {
              similarity: pythonResult.similarity,
              hasChart: !!pythonResult.comparison_chart,
              chartLength: pythonResult.comparison_chart?.length,
              hasReport: !!pythonResult.description
            });
            
          } catch (pythonError) {
            console.error(`[COMPARE-ALL] Errore Python analyzer per firma ${signature.id}:`, pythonError);
            
            // Fallback al JavaScript analyzer
            try {
              const jsResult = await SignatureAnalyzer.compareSignatures(signature, referenceSignature);
              similarityScore = jsResult.similarity;
              comparisonChart = jsResult.chart;
              analysisReport = jsResult.report;
            } catch (jsError) {
              console.error(`[COMPARE-ALL] Errore anche con JavaScript analyzer:`, jsError);
              similarityScore = 0;
              analysisReport = "Errore durante l'analisi di confronto";
            }
          }
          
          // Aggiorna la firma con i risultati del confronto
          const updateData: any = {
            comparisonResult: similarityScore,
            analysisReport,
            referenceSignatureFilename: referenceSignature.filename,
            referenceSignatureOriginalFilename: referenceSignature.originalFilename,
            referenceDpi: referenceSignature.dpi || 300,
            updatedAt: new Date()
          };
          
          if (comparisonChart) {
            updateData.comparisonChart = comparisonChart;
          }
          
          console.log(`[COMPARE-ALL] Dati da aggiornare per firma ${signature.id}:`, {
            hasChart: !!updateData.comparisonChart,
            chartLength: updateData.comparisonChart?.length,
            hasReport: !!updateData.analysisReport,
            comparisonResult: updateData.comparisonResult,
            referenceFilename: updateData.referenceSignatureFilename,
            referenceOriginalFilename: updateData.referenceSignatureOriginalFilename,
            referenceDpi: updateData.referenceDpi
          });
          
          console.log(`[COMPARE-ALL] Chiamata updateSignature per firma ${signature.id} con:`, updateData);
          
          // Aggiornamento diretto nel database PostgreSQL per i campi di riferimento
          try {
            await db.update(signatures)
              .set({
                comparisonChart: updateData.comparisonChart,
                analysisReport: updateData.analysisReport,
                reportPath: updateData.reportPath,
                comparisonResult: updateData.comparisonResult,
                referenceSignatureFilename: updateData.referenceSignatureFilename,
                referenceSignatureOriginalFilename: updateData.referenceSignatureOriginalFilename,
                referenceDpi: updateData.referenceDpi,
                updatedAt: new Date()
              })
              .where(eq(signatures.id, signature.id));
            
            console.log(`[COMPARE-ALL] Aggiornamento DATABASE completato per firma ${signature.id}`);
          } catch (dbError) {
            console.error(`[COMPARE-ALL] Errore aggiornamento database per firma ${signature.id}:`, dbError);
          }
          
          await storage.updateSignature(signature.id, updateData);
          
          // Ottieni la firma aggiornata per includerla nei risultati
          const updatedSignature = await storage.getSignature(signature.id);
          console.log(`[COMPARE-ALL] Firma ${signature.id} dopo aggiornamento:`, {
            id: updatedSignature?.id,
            hasChart: !!updatedSignature?.comparisonChart,
            hasReport: !!updatedSignature?.analysisReport,
            referenceFilename: updatedSignature?.referenceSignatureFilename,
            referenceOriginalFilename: updatedSignature?.referenceSignatureOriginalFilename,
            referenceDpi: updatedSignature?.referenceDpi
          });
          if (updatedSignature) {
            results.push(updatedSignature);
          }
          
        } catch (signatureError) {
          console.error(`[COMPARE-ALL] Errore nell'elaborazione della firma ${signature.id}:`, signatureError);
          // Continuiamo con le altre firme anche se una fallisce
        }
      }
      
      // Aggiorna il registro attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'signature_compare',
        details: `Confrontate ${results.length} firme nel progetto "${project.name}"`
      });
      
      // Filtra e restituisci solo le firme da verificare (non di riferimento)
      const verificationResults = results.filter(signature => !signature.isReference);
      console.log(`[COMPARE-ALL] RISPOSTA FINALE: ${verificationResults.length} firme`);
      res.json(verificationResults);
      
    } catch (error: any) {
      console.error(`[COMPARE-ALL] Errore generale nel confronto multiplo delle firme:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload di una firma di riferimento
  appRouter.post("/signature-projects/:id/signatures/reference", isAuthenticated, isActiveUser, signatureUpload.single('signature'), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
      }
      
      // Estrai le dimensioni reali dai dati del form
      const realWidthMm = parseFloat(req.body.realWidthMm);
      const realHeightMm = parseFloat(req.body.realHeightMm);
      
      if (!realWidthMm || !realHeightMm || realWidthMm <= 0 || realHeightMm <= 0) {
        return res.status(400).json({ 
          error: 'Le dimensioni reali della firma sono obbligatorie e devono essere positive'
        });
      }
      
      const signatureData = insertSignatureSchema.parse({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: true,
        dpi: 300, // DPI standard per compatibilità
        realWidthMm: realWidthMm,
        realHeightMm: realHeightMm
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      res.status(201).json(signature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Upload di una firma da verificare
  appRouter.post("/signature-projects/:id/signatures/verify", isAuthenticated, isActiveUser, signatureUpload.single('signature'), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
      }
      
      // Estrai le dimensioni reali dai dati del form
      const realWidthMm = parseFloat(req.body.realWidthMm);
      const realHeightMm = parseFloat(req.body.realHeightMm);
      
      if (!realWidthMm || !realHeightMm || realWidthMm <= 0 || realHeightMm <= 0) {
        return res.status(400).json({ 
          error: 'Le dimensioni reali della firma sono obbligatorie e devono essere positive'
        });
      }
      
      const signatureData = insertSignatureSchema.parse({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: false,
        dpi: 300, // DPI standard per compatibilità
        realWidthMm: realWidthMm,
        realHeightMm: realHeightMm
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      res.status(201).json(signature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Ottieni tutte le firme di un progetto
  appRouter.get("/signature-projects/:id/signatures", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      const signatures = await storage.getProjectSignatures(projectId);
      res.json(signatures);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}