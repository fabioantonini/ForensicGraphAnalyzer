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
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'signatures');
      // Crea la directory se non esiste
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error('Error creating uploads directory:', error);
      }
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
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  
  // Middleware to check if user is active
  const isActiveUser = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && req.user?.isActive !== false) {
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
      
      // Filtra le firme di riferimento complete (con parameters)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      console.log(`[COMPARE-ALL] Reference signatures found: ${referenceSignatures.length}`);
      console.log(`[COMPARE-ALL] Completed references: ${completedReferences.length}`);
      referenceSignatures.forEach(ref => {
        console.log(`[COMPARE-ALL] Ref ${ref.id}: status=${ref.processingStatus}, hasParameters=${!!ref.parameters}, parametersCount=${ref.parameters ? Object.keys(ref.parameters).length : 0}`);
      });
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile. Carica una firma di riferimento.'
        });
      }
      
      // Ottieni tutte le firme da verificare
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      
      // Filtra le firme da verificare complete (con parameters)
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      console.log(`[COMPARE-ALL] Verification signatures found: ${verificationSignatures.length}`);
      console.log(`[COMPARE-ALL] Completed verifications: ${completedVerifications.length}`);
      verificationSignatures.forEach(ver => {
        console.log(`[COMPARE-ALL] Ver ${ver.id}: status=${ver.processingStatus}, hasParameters=${!!ver.parameters}, parametersCount=${ver.parameters ? Object.keys(ver.parameters).length : 0}`);
      });
      
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
          await storage.updateSignature(signature.id, { 
            comparisonChart: '', 
            naturalnessChart: ''  // === NUOVO: CANCELLA ANCHE GRAFICO NATURALEZZA ===
          });
          
          let similarityScore = 0;
          let comparisonChart = null;
          let analysisReport = null;
          
          // === DICHIARAZIONE VARIABILI DI NATURALEZZA ===
          let naturalnessScore = null;
          let verdict = null;
          let confidenceLevel = null;
          let verdictExplanation = null;
          let naturalnessChart = null;  // === NUOVO: GRAFICO NATURALEZZA ===
          
          // Usa la prima firma di riferimento disponibile per il confronto
          const referenceSignature = completedReferences[0];
          
          // Confronta con Python analyzer
          try {
            const verificaPath = path.join('uploads', signature.filename);
            const referencePath = path.join('uploads', referenceSignature.filename);
            
            // Verifica che entrambe le firme abbiano dimensioni reali - OBBLIGATORIE, no fallback ai DPI
            if (!signature.realWidthMm || !signature.realHeightMm) {
              throw new Error(`Firma ${signature.id} non ha dimensioni reali definite`);
            }
            if (!referenceSignature.realWidthMm || !referenceSignature.realHeightMm) {
              throw new Error(`Firma di riferimento ${referenceSignature.id} non ha dimensioni reali definite`);
            }
            
            const pythonResult = await SignaturePythonAnalyzer.compareSignatures(
              verificaPath,
              referencePath,
              { widthMm: signature.realWidthMm, heightMm: signature.realHeightMm },
              { widthMm: referenceSignature.realWidthMm, heightMm: referenceSignature.realHeightMm }
            );
            
            similarityScore = pythonResult.similarity; // Mantieni come percentuale diretta
            comparisonChart = pythonResult.comparison_chart; // CORRETTO: field name è comparison_chart
            naturalnessChart = pythonResult.naturalness_chart || null;  // === NUOVO: GRAFICO NATURALEZZA ===
            
            // === ESTRAZIONE NUOVI PARAMETRI DI NATURALEZZA ===
            verdict = pythonResult.verdict || null;
            
            // Estrai parametri di naturalezza se disponibili
            if (pythonResult.naturalness !== undefined) {
              naturalnessScore = pythonResult.naturalness;
              console.log(`[COMPARE-ALL] ✅ NATURALEZZA: ${(naturalnessScore * 100).toFixed(1)}% per firma ${signature.id}`);
            }
            
            if (pythonResult.confidence !== undefined) {
              confidenceLevel = pythonResult.confidence;
              console.log(`[COMPARE-ALL] ✅ CONFIDENZA: ${(confidenceLevel * 100).toFixed(1)}% per firma ${signature.id}`);
            }
            
            if (pythonResult.explanation) {
              verdictExplanation = pythonResult.explanation;
              console.log(`[COMPARE-ALL] ✅ SPIEGAZIONE: ${verdictExplanation.substring(0, 100)}... per firma ${signature.id}`);
            }
            
            // === NUOVO: GENERA INTERPRETAZIONE AI DELL'ANALISI ===
            try {
              const { generateSignatureInterpretation } = await import("./openai");
              const interpretation = await generateSignatureInterpretation(
                verdict || 'Non determinato',
                similarityScore || 0,
                naturalnessScore,
                pythonResult,
                confidenceLevel,
                req.user?.openaiApiKey,
                req.user?.id
              );
              
              // Salva l'interpretazione nella spiegazione se non già presente
              if (!verdictExplanation && interpretation) {
                verdictExplanation = interpretation;
                console.log(`[COMPARE-ALL] 🤖 INTERPRETAZIONE AI generata per firma ${signature.id}`);
              }
            } catch (aiError) {
              console.error(`[COMPARE-ALL] ⚠️ Errore generazione interpretazione AI:`, aiError);
              // Non blocca l'esecuzione, continua senza interpretazione AI
            }
            
            console.log(`[COMPARE-ALL] 🎯 NUOVA CLASSIFICAZIONE: "${verdict}" (Similarità: ${(similarityScore * 100).toFixed(1)}%, Naturalezza: ${naturalnessScore ? (naturalnessScore * 100).toFixed(1) + '%' : 'N/A'})`);
            
            // CORREZIONE: Salva i parametri strutturati JSON invece della sola descrizione testuale
            // Questo permette al sistema PDF di estrarre tutti i 21+ parametri per l'analisi dettagliata
            if (pythonResult.verifica_parameters) {
              analysisReport = JSON.stringify(pythonResult.verifica_parameters);
              console.log(`[COMPARE-ALL] Salvati parametri JSON strutturati per firma ${signature.id} con ${Object.keys(pythonResult.verifica_parameters).length} parametri`);
            } else {
              // Fallback alla descrizione testuale se i parametri non sono disponibili
              analysisReport = pythonResult.description;
              console.log(`[COMPARE-ALL] Fallback a descrizione testuale per firma ${signature.id}`);
            }
            
          } catch (pythonError) {
            console.error(`[COMPARE-ALL] Errore Python analyzer per firma ${signature.id}:`, pythonError);
            
            // Fallback al JavaScript analyzer (disabilitato per incompatibilità di tipo)
            try {
              // const jsResult = await SignatureAnalyzer.compareSignatures(signature, referenceSignature);
              // similarityScore = jsResult.similarity;
              // comparisonChart = jsResult.chart;
              // analysisReport = jsResult.report;
              console.log(`[COMPARE-ALL] JavaScript analyzer disabilitato per incompatibilità di tipo`);
              similarityScore = 0;
              analysisReport = "Analisi non disponibile: errore durante il confronto";
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
            
            // === NUOVI CAMPI PER INDICE DI NATURALEZZA ===
            naturalnessScore: naturalnessScore,
            verdict: verdict,
            confidenceLevel: confidenceLevel,
            verdictExplanation: verdictExplanation,
            
            referenceSignatureFilename: referenceSignature.filename,
            referenceSignatureOriginalFilename: referenceSignature.originalFilename,
            referenceDpi: referenceSignature.dpi || 300,
            updatedAt: new Date()
          };
          
          if (comparisonChart) {
            updateData.comparisonChart = comparisonChart;
          }
          
          // === NUOVO: SUPPORTA GRAFICO NATURALEZZA ===
          if (naturalnessChart) {
            updateData.naturalnessChart = naturalnessChart;
          }
          
          // Aggiornamento diretto nel database PostgreSQL per i campi di riferimento
          try {
            await db.update(signatures)
              .set({
                comparisonChart: updateData.comparisonChart,
                naturalnessChart: updateData.naturalnessChart,  // === NUOVO: GRAFICO NATURALEZZA ===
                analysisReport: updateData.analysisReport,
                reportPath: updateData.reportPath,
                comparisonResult: updateData.comparisonResult,
                
                // === NUOVI CAMPI PER INDICE DI NATURALEZZA ===
                naturalnessScore: updateData.naturalnessScore,
                verdict: updateData.verdict,
                confidenceLevel: updateData.confidenceLevel,
                verdictExplanation: updateData.verdictExplanation,
                
                referenceSignatureFilename: updateData.referenceSignatureFilename,
                referenceSignatureOriginalFilename: updateData.referenceSignatureOriginalFilename,
                referenceDpi: updateData.referenceDpi,
                updatedAt: new Date()
              })
              .where(eq(signatures.id, signature.id));
            
          } catch (dbError) {
            console.error(`[COMPARE-ALL] Errore aggiornamento database per firma ${signature.id}:`, dbError);
          }
          
          await storage.updateSignature(signature.id, updateData);
          
          // Ottieni la firma aggiornata per includerla nei risultati
          const updatedSignature = await storage.getSignature(signature.id);
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
        filename: `signatures/${req.file.filename}`,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: true,
        // DPI rimosso - usiamo solo dimensioni reali
        realWidthMm: realWidthMm,
        realHeightMm: realHeightMm
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      // Avvia elaborazione automatica dei parametri per RIFERIMENTO
      try {
        console.log(`[SIGNATURE PROCESSING] Avvio elaborazione automatica per firma di riferimento ${signature.id}`);
        
        // Elabora parametri in background senza attendere
        processSignatureParameters(signature.id).catch(error => {
          console.error(`[SIGNATURE PROCESSING] Errore elaborazione firma ${signature.id}:`, error);
        });
        
      } catch (error) {
        console.error(`[SIGNATURE PROCESSING] Errore avvio elaborazione:`, error);
      }
      
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
        filename: `signatures/${req.file.filename}`,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: false,
        // DPI rimosso - usiamo solo dimensioni reali
        realWidthMm: realWidthMm,
        realHeightMm: realHeightMm
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      // Avvia elaborazione automatica dei parametri per VERIFICA
      try {
        console.log(`[SIGNATURE PROCESSING] Avvio elaborazione automatica per firma da verificare ${signature.id}`);
        
        // Elabora parametri in background senza attendere
        processSignatureParameters(signature.id).catch(error => {
          console.error(`[SIGNATURE PROCESSING] Errore elaborazione firma ${signature.id}:`, error);
        });
        
      } catch (error) {
        console.error(`[SIGNATURE PROCESSING] Errore avvio elaborazione:`, error);
      }
      
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
      
      // Disabilita cache per garantire dati sempre aggiornati
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const signatures = await storage.getProjectSignatures(projectId);
      res.json(signatures);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Genera report PDF per tutte le firme da verificare in un progetto
  appRouter.post("/signature-projects/:id/generate-all-reports", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      const project = await storage.getSignatureProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Ottieni tutte le firme da verificare completate
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters && sig.comparisonResult !== null && sig.comparisonResult !== undefined
      );
      
      if (completedVerifications.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile. Esegui prima "Confronta tutte".'
        });
      }
      
      // Ottieni le firme di riferimento completate
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      const completedReferences = referenceSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile. Carica una firma di riferimento.'
        });
      }
      
      console.log(`[GENERATE ALL REPORTS] Utilizzo generazione PDF integrata per ${completedVerifications.length} firme`);
      
      const results = [];
      for (const signature of completedVerifications) {
        try {
          console.log(`[GENERATE ALL REPORTS] Generazione report per firma ${signature.id}`);
          
          // Verifica che la firma abbia un risultato di confronto
          if (signature.comparisonResult === null || signature.comparisonResult === undefined) {
            results.push({
              id: signature.id,
              success: false,
              error: 'Prima di generare il report, esegui il confronto usando "Confronta tutte"'
            });
            continue;
          }
          
          // Aggiorna la firma con il percorso del report fittizio per ora
          await storage.updateSignature(signature.id, {
            reportPath: `report_${signature.id}_${Date.now()}.pdf`
          });
          
          results.push({
            id: signature.id,
            success: true
          });
          
        } catch (error: any) {
          console.error(`[GENERATE ALL REPORTS] Errore per firma ${signature.id}:`, error);
          results.push({
            id: signature.id,
            success: false,
            error: error.message
          });
        }
      }
      
      // Aggiorna il registro attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'report_generation',
        details: `Generati ${results.filter(r => r.success).length} report PDF nel progetto "${project.name}"`
      });
      
      res.json({
        total: results.length,
        successful: results.filter(r => r.success).length,
        results: results
      });
    } catch (error: any) {
      console.error('[GENERATE ALL REPORTS] Errore:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint per scaricare un report PDF
  appRouter.get("/signatures/:id/report", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Per ora, restituiamo un PDF semplice generato al volo
      if (!signature.comparisonResult) {
        return res.status(400).json({ error: 'Report non disponibile. Esegui prima il confronto.' });
      }
      
      // Genera un PDF semplice al volo
      const doc = new PDFDocument({
        size: 'A4',
        info: {
          Title: 'Rapporto di Analisi Firma',
          Author: 'GrapholexInsight',
          Subject: 'Verifica Firma',
          CreationDate: new Date()
        }
      });
      
      // Imposta headers per il download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report_${signature.originalFilename}_${Date.now()}.pdf"`);
      
      // Helper function per formattare numeri
      const formatNumber = (value: any, decimals: number = 2): string => {
        if (typeof value === 'number' && !isNaN(value)) {
          return value.toFixed(decimals);
        }
        return '0.00';
      };
      
      // Pipe il PDF direttamente alla risposta
      doc.pipe(res);
      
      // Contenuto del PDF - Header
      doc.fontSize(20).text('RAPPORTO DI ANALISI FIRMA', { align: 'center' });
      doc.moveDown(2);
      
      // INFORMAZIONI DEL CASO
      doc.fontSize(14).text('INFORMAZIONI DEL CASO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Progetto: ${project.name}`);
      doc.text(`Oggetto: Verifica firma: ${signature.originalFilename}`);
      doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`);
      doc.text(`Tipo: Verifica di firma`);
      if (project.description) {
        doc.text(`Note: ${project.description}`);
      }
      doc.moveDown(1.5);
      
      // RISULTATO DELL'ANALISI
      doc.fontSize(14).text('RISULTATO DELL\'ANALISI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      
      const percentageScore = formatNumber(signature.comparisonResult * 100, 1);
      let verdict = '';
      
      if (signature.comparisonResult >= 0.85) {
        verdict = 'AUTENTICA';
      } else if (signature.comparisonResult >= 0.65) {
        verdict = 'PROBABILMENTE AUTENTICA';  
      } else {
        verdict = 'SOSPETTA';
      }
      
      doc.text(`Punteggio di similarità: ${percentageScore}%`);
      
      // Aggiungi naturalezza se disponibile nella sezione principale
      if (signature.naturalnessScore !== null && signature.naturalnessScore !== undefined) {
        doc.text(`Indice di naturalezza: ${(signature.naturalnessScore * 100).toFixed(1)}%`);
      }
      
      doc.text(`Valutazione: ${verdict}`, { fontSize: 14 });
      doc.moveDown(1.5);
      
      // Ottieni la firma di riferimento per l'analisi AI
      const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
      const referenceSignature = referenceSignatures.find(ref => ref.processingStatus === 'completed' && ref.parameters);
      
      // Parse dei parametri dalle analysisReport
      let signatureParams = null;
      let referenceParams = null;
      
      try {
        if (signature.analysisReport) {
          console.log('[PDF REPORT] Tentativo parsing firma in verifica. Contenuto:', signature.analysisReport.substring(0, 100));
          signatureParams = JSON.parse(signature.analysisReport);
          console.log('[PDF REPORT] Parametri firma in verifica:', Object.keys(signatureParams));
        }
        if (referenceSignature?.analysisReport) {
          console.log('[PDF REPORT] Tentativo parsing firma di riferimento. Contenuto:', referenceSignature.analysisReport.substring(0, 100));
          referenceParams = JSON.parse(referenceSignature.analysisReport);
          console.log('[PDF REPORT] Parametri firma di riferimento:', Object.keys(referenceParams));
        }
      } catch (e) {
        console.error('[PDF REPORT] ERRORE parsing parametri:', e);
        console.error('[PDF REPORT] analysisReport non è JSON valido, probabilmente è descrizione testuale');
        signatureParams = null;
        referenceParams = null;
      }
      
      // Estrai dimensioni prima di usarle (GLOBALI per entrambe le sezioni)
      let sigWidth = 0, sigHeight = 0, refWidth = 0, refHeight = 0;
      
      // Estrai dimensioni firma in verifica - USA SEMPRE QUELLE REALI DAL DATABASE
      if (signature.realWidthMm && signature.realHeightMm) {
        sigWidth = signature.realWidthMm;
        sigHeight = signature.realHeightMm;
      } else if (signatureParams?.Dimensions) {
        if (Array.isArray(signatureParams.Dimensions)) {
          sigWidth = signatureParams.Dimensions[0] || 0;
          sigHeight = signatureParams.Dimensions[1] || 0;
        } else if (typeof signatureParams.Dimensions === 'object') {
          sigWidth = signatureParams.Dimensions.width || 0;
          sigHeight = signatureParams.Dimensions.height || 0;
        }
      }
      
      // Estrai dimensioni firma di riferimento - USA SEMPRE QUELLE REALI DAL DATABASE
      if (referenceSignature?.realWidthMm && referenceSignature?.realHeightMm) {
        refWidth = referenceSignature.realWidthMm;
        refHeight = referenceSignature.realHeightMm;
      } else if (referenceParams?.Dimensions) {
        if (Array.isArray(referenceParams.Dimensions)) {
          refWidth = referenceParams.Dimensions[0] || 0;
          refHeight = referenceParams.Dimensions[1] || 0;
        } else if (typeof referenceParams.Dimensions === 'object') {
          refWidth = referenceParams.Dimensions.width || 0;
          refHeight = referenceParams.Dimensions.height || 0;
        }
      }
      
      // PARAMETRI ANALIZZATI - Sezione con elenchi puntati dettagliati
      if (referenceParams && signatureParams) {
        doc.fontSize(14).text('PARAMETRI ANALIZZATI', { underline: true });
        doc.moveDown(0.5);
        
        // FIRMA IN VERIFICA
        doc.fontSize(12).text('FIRMA IN VERIFICA:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        // Usa le dimensioni originali dell'immagine invece di ricostruirle matematicamente
        const sigPixelsPerMm = signatureParams.pixels_per_mm || 1;
        const sigWidthPx = signatureParams.original_width || Math.round(sigWidth * sigPixelsPerMm);
        const sigHeightPx = signatureParams.original_height || Math.round(sigHeight * sigPixelsPerMm);
        
        doc.text(`• Dimensioni: ${signatureParams.display?.dimensions_px || `${sigWidthPx}x${sigHeightPx} px`}`);
        doc.text(`• Dimensioni reali: ${signatureParams.display?.dimensions_mm || `${formatNumber(sigWidth, 1)}x${formatNumber(sigHeight, 1)} mm`}`);
        
        // Parametri disponibili dal JSON
        if (signatureParams.PressureMean !== undefined) {
          doc.text(`• Intensità pixel media: ${signatureParams.display?.pressure_mean || formatNumber(signatureParams.PressureMean, 1)} (0=nero/alta pressione, 255=bianco/bassa pressione)`);
        }
        if (signatureParams.PressureStd !== undefined) {
          doc.text(`• Varianza spessore: ${signatureParams.display?.pressure_std || formatNumber(signatureParams.PressureStd, 2)}`);
        }
        if (signatureParams.Proportion !== undefined) {
          doc.text(`• Proporzione: ${signatureParams.display?.proportion || formatNumber(signatureParams.Proportion, 3)}`);
        }
        if (signatureParams.Inclination !== undefined) {
          doc.text(`• Inclinazione: ${signatureParams.display?.inclination || formatNumber(signatureParams.Inclination, 1) + '°'}`);
        }
        if (signatureParams.PressureStd !== undefined) {
          doc.text(`• Deviazione intensità: ${formatNumber(signatureParams.PressureStd, 1)}`);
        }
        if (signatureParams.AvgCurvature !== undefined) {
          doc.text(`• Curvatura media: ${signatureParams.display?.curvature || formatNumber(signatureParams.AvgCurvature, 3)}`);
        }
        if (signatureParams.Velocity !== undefined) {
          doc.text(`• Velocità scrittura: ${signatureParams.display?.velocity || formatNumber(signatureParams.Velocity, 2) + '/5'}`);
        }
        if (signatureParams.WritingStyle !== undefined) {
          doc.text(`• Stile scrittura: ${signatureParams.WritingStyle}`);
        }
        if (signatureParams.Readability !== undefined) {
          doc.text(`• Leggibilità: ${signatureParams.Readability}`);
        }
        if (signatureParams.AvgAsolaSize !== undefined) {
          doc.text(`• Dimensione asole medie: ${signatureParams.display?.asola_size || formatNumber(signatureParams.AvgAsolaSize, 2) + ' mm²'}`);
        }
        if (signatureParams.AvgSpacing !== undefined) {
          doc.text(`• Spaziatura media: ${signatureParams.display?.spacing || formatNumber(signatureParams.AvgSpacing, 2) + ' mm'}`);
        }
        if (signatureParams.OverlapRatio !== undefined) {
          doc.text(`• Rapporto sovrapposizione: ${signatureParams.display?.overlap_ratio || formatNumber(signatureParams.OverlapRatio * 100, 1) + '%'}`);
        }
        if (signatureParams.LetterConnections !== undefined) {
          doc.text(`• Connessioni lettere: ${signatureParams.display?.letter_connections || formatNumber(signatureParams.LetterConnections, 2)}`);
        }
        if (signatureParams.BaselineStdMm !== undefined) {
          doc.text(`• Deviazione baseline: ${signatureParams.display?.baseline_std || formatNumber(signatureParams.BaselineStdMm, 2) + ' mm'}`);
        }
        
        doc.moveDown(1);
        
        // FIRMA DI RIFERIMENTO
        doc.fontSize(12).text('FIRMA DI RIFERIMENTO:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        // Usa le dimensioni originali dell'immagine invece di ricostruirle matematicamente
        const refPixelsPerMm = referenceParams.pixels_per_mm || 1;
        const refWidthPx = referenceParams.original_width || Math.round(refWidth * refPixelsPerMm);
        const refHeightPx = referenceParams.original_height || Math.round(refHeight * refPixelsPerMm);
        
        doc.text(`• Dimensioni: ${referenceParams.display?.dimensions_px || `${refWidthPx}x${refHeightPx} px`}`);
        doc.text(`• Dimensioni reali: ${referenceParams.display?.dimensions_mm || `${formatNumber(refWidth, 1)}x${formatNumber(refHeight, 1)} mm`}`);
        
        // Parametri disponibili dal JSON
        if (referenceParams.PressureMean !== undefined) {
          doc.text(`• Intensità pixel media: ${referenceParams.display?.pressure_mean || formatNumber(referenceParams.PressureMean, 1)} (0=nero/alta pressione, 255=bianco/bassa pressione)`);
        }
        if (referenceParams.PressureStd !== undefined) {
          doc.text(`• Varianza spessore: ${referenceParams.display?.pressure_std || formatNumber(referenceParams.PressureStd, 2)}`);
        }
        if (referenceParams.Proportion !== undefined) {
          doc.text(`• Proporzione: ${referenceParams.display?.proportion || formatNumber(referenceParams.Proportion, 3)}`);
        }
        if (referenceParams.Inclination !== undefined) {
          doc.text(`• Inclinazione: ${referenceParams.display?.inclination || formatNumber(referenceParams.Inclination, 1) + '°'}`);
        }
        if (referenceParams.PressureStd !== undefined) {
          doc.text(`• Deviazione intensità: ${formatNumber(referenceParams.PressureStd, 1)}`);
        }
        if (referenceParams.AvgCurvature !== undefined) {
          doc.text(`• Curvatura media: ${referenceParams.display?.curvature || formatNumber(referenceParams.AvgCurvature, 3)}`);
        }
        if (referenceParams.Velocity !== undefined) {
          doc.text(`• Velocità scrittura: ${referenceParams.display?.velocity || formatNumber(referenceParams.Velocity, 0) + '/5'}`);
        }
        if (referenceParams.WritingStyle !== undefined) {
          doc.text(`• Stile scrittura: ${referenceParams.WritingStyle}`);
        }
        if (referenceParams.Readability !== undefined) {
          doc.text(`• Leggibilità: ${referenceParams.Readability}`);
        }
        if (referenceParams.AvgAsolaSize !== undefined) {
          doc.text(`• Dimensione asole medie: ${referenceParams.display?.asola_size || formatNumber(referenceParams.AvgAsolaSize, 2) + ' mm²'}`);
        }
        if (referenceParams.AvgSpacing !== undefined) {
          doc.text(`• Spaziatura media: ${referenceParams.display?.spacing || formatNumber(referenceParams.AvgSpacing, 2) + ' mm'}`);
        }
        if (referenceParams.OverlapRatio !== undefined) {
          doc.text(`• Rapporto sovrapposizione: ${referenceParams.display?.overlap_ratio || formatNumber(referenceParams.OverlapRatio * 100, 1) + '%'}`);
        }
        if (referenceParams.LetterConnections !== undefined) {
          doc.text(`• Connessioni lettere: ${referenceParams.display?.letter_connections || formatNumber(referenceParams.LetterConnections, 2)}`);
        }
        if (referenceParams.BaselineStdMm !== undefined) {
          doc.text(`• Deviazione baseline: ${referenceParams.display?.baseline_std || formatNumber(referenceParams.BaselineStdMm, 2) + ' mm'}`);
        }
        
        doc.moveDown(1.5);
      }
      
      // ANALISI PERITALE AI DETTAGLIATA
      if (referenceParams && signatureParams) {
        doc.fontSize(14).text('ANALISI PERITALE AI', { underline: true });
        doc.fontSize(12).text('CONFRONTO PARAMETRO PER PARAMETRO', { underline: false });
        doc.moveDown(0.5);
        doc.fontSize(10);
        
        // CONFRONTO PARAMETRI PYTHON COMPLETO
        
        // 1. Confronto Dimensioni (già estratte sopra)
        
        // Solo se abbiamo dimensioni valide per entrambe
        if (sigWidth > 0 && sigHeight > 0 && refWidth > 0 && refHeight > 0) {
          console.log(`[PDF REPORT] Dimensioni estratte - Verifica: ${sigWidth}x${sigHeight}mm, Riferimento: ${refWidth}x${refHeight}mm`);
          doc.text(`Dimensioni: La firma in verifica ha dimensioni di ${formatNumber(sigWidth, 1)}x${formatNumber(sigHeight, 1)} mm rispetto alla firma di riferimento di ${formatNumber(refWidth, 1)}x${formatNumber(refHeight, 1)} mm. ${sigWidth < refWidth * 0.8 ? 'La firma in verifica è significativamente più piccola' : sigWidth > refWidth * 1.2 ? 'La firma in verifica è significativamente più grande' : 'Le dimensioni sono compatibili'}. Questa ${Math.abs(sigWidth - refWidth) > refWidth * 0.2 ? 'differenza potrebbe indicare una variazione nella modalità di esecuzione o una diversa impostazione mentale al momento della firma.' : 'compatibilità indica coerenza dimensionale.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        } else {
          console.log(`[PDF REPORT] Dimensioni non disponibili - Verifica: ${sigWidth}x${sigHeight}mm, Riferimento: ${refWidth}x${refHeight}mm`);
        }
        
        // 2. Confronto Proporzione
        if (signatureParams.Proportion !== undefined && referenceParams.Proportion !== undefined) {
          const sigProp = signatureParams.Proportion;
          const refProp = referenceParams.Proportion;
          
          doc.text(`Proporzione: La firma in verifica ha una proporzione altezza/larghezza di ${formatNumber(sigProp, 3)}, mentre la firma di riferimento ha una proporzione di ${formatNumber(refProp, 3)}. ${Math.abs(sigProp - refProp) > 0.2 ? 'Questa differenza significativa indica una diversa distribuzione delle dimensioni tra le componenti della firma, possibile indicatore di variazione stilistica.' : 'Questa compatibilità indica coerenza proporzionale tra le firme.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 3. Confronto Inclinazione
        if (signatureParams.Inclination !== undefined && referenceParams.Inclination !== undefined) {
          const sigIncl = signatureParams.Inclination;
          const refIncl = referenceParams.Inclination;
          const angleDiff = Math.abs(sigIncl - refIncl);
          
          doc.text(`Inclinazione: La firma in verifica ha un'inclinazione media di ${formatNumber(sigIncl, 1)}°, mentre quella di riferimento è di ${formatNumber(refIncl, 1)}°. Differenza angolare: ${formatNumber(angleDiff, 1)}°. ${angleDiff > 15 ? 'Questa differenza significativa può indicare un diverso orientamento della mano, del foglio o diversa postura durante la firma.' : 'Questa variazione è accettabile e indica coerenza stilistica nella direzione del tratto.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 4. Confronto Intensità Media dell'Inchiostro
        if (signatureParams.PressureMean !== undefined && referenceParams.PressureMean !== undefined) {
          const sigPress = signatureParams.PressureMean;
          const refPress = referenceParams.PressureMean;
          
          doc.text(`Intensità dell'Inchiostro: L'intensità media dei pixel della firma in verifica è ${formatNumber(sigPress, 1)}, ${sigPress < refPress * 0.8 ? 'significativamente più scura (maggiore pressione)' : sigPress > refPress * 1.2 ? 'significativamente più chiara (minore pressione)' : 'compatibile'} rispetto ai ${formatNumber(refPress, 1)} della firma di riferimento. ${Math.abs(sigPress - refPress) > refPress * 0.3 ? 'Questa differenza nell\'intensità dell\'inchiostro può indicare diversa pressione di scrittura, tipo di penna o qualità dell\'inchiostro utilizzato.' : 'Questa compatibilità nell\'intensità indica coerenza nella pressione di scrittura e nel tipo di strumento utilizzato.'} (scala 0-255: 0=nero/alta pressione, 255=bianco/bassa pressione)`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 5. Confronto Deviazione Standard Intensità
        if (signatureParams.PressureStd !== undefined && referenceParams.PressureStd !== undefined) {
          const sigPressStd = signatureParams.PressureStd;
          const refPressStd = referenceParams.PressureStd;
          
          doc.text(`Variabilità dell'Intensità: La deviazione standard dell'intensità dell'inchiostro nella firma in verifica è ${formatNumber(sigPressStd, 2)}, ${sigPressStd > refPressStd * 1.5 ? 'molto più elevata' : sigPressStd < refPressStd * 0.5 ? 'molto più ridotta' : 'compatibile'} rispetto ai ${formatNumber(refPressStd, 2)} della firma di riferimento. ${sigPressStd > refPressStd * 1.5 ? 'L\'alta variabilità nell\'intensità suggerisce irregolarità nel controllo della pressione o nell\'uniformità dell\'inchiostro, possibile indicatore di stress o diverso controllo motorio.' : 'La variabilità costante indica uniformità nella pressione di scrittura e nell\'applicazione dell\'inchiostro durante l\'esecuzione.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 6. Confronto Curvatura
        if (signatureParams.Curvature !== undefined && referenceParams.Curvature !== undefined) {
          const sigCurv = signatureParams.Curvature;
          const refCurv = referenceParams.Curvature;
          
          doc.text(`Curvatura Media: La curvatura media dei tratti nella firma in verifica è ${formatNumber(sigCurv, 1)}, ${sigCurv < refCurv * 0.7 ? 'significativamente più angolosa' : sigCurv > refCurv * 1.3 ? 'significativamente più curvilinea' : 'compatibile'} rispetto ai ${formatNumber(refCurv, 1)} della firma di riferimento. ${Math.abs(sigCurv - refCurv) > refCurv * 0.3 ? 'Questa differenza nella morfologia dei tratti può indicare diversa fluidità di esecuzione o controllo motorio variabile.' : 'La compatibilità indica coerenza nella modalità di formazione delle curve e degli angoli.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 7. Confronto Stile di Scrittura
        if (signatureParams.Style && referenceParams.Style) {
          const sigStyle = signatureParams.Style;
          const refStyle = referenceParams.Style;
          
          doc.text(`Stile di Scrittura: La firma in verifica presenta stile "${sigStyle}", ${sigStyle === refStyle ? 'identico' : 'diverso'} rispetto allo stile "${refStyle}" della firma di riferimento. ${sigStyle !== refStyle ? 'Questa differenza stilistica può indicare un approccio diverso alla formazione delle lettere o una variazione intenzionale nella modalità di scrittura.' : 'La coerenza stilistica supporta l\'ipotesi di autenticità nella modalità di formazione dei caratteri.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 8. Confronto Leggibilità
        if (signatureParams.Readability && referenceParams.Readability) {
          const sigRead = signatureParams.Readability;
          const refRead = referenceParams.Readability;
          
          doc.text(`Leggibilità: La firma in verifica presenta leggibilità "${sigRead}", ${sigRead === refRead ? 'coerente' : 'diversa'} rispetto alla "${refRead}" della firma di riferimento. ${sigRead !== refRead ? 'La variazione nella leggibilità può indicare diversa attenzione nella formazione dei caratteri o diverso livello di formalità nell\'esecuzione.' : 'La coerenza nella leggibilità indica stabilità nell\'approccio alla formazione dei caratteri.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 9. Confronto Dimensione Media Asole
        if (signatureParams.AvgAsolaSize !== undefined && referenceParams.AvgAsolaSize !== undefined) {
          const sigAsola = signatureParams.AvgAsolaSize;
          const refAsola = referenceParams.AvgAsolaSize;
          
          if (sigAsola > 0 || refAsola > 0) {
            doc.text(`Asole: La dimensione media delle asole nella firma in verifica è ${formatNumber(sigAsola, 2)} mm, ${sigAsola < refAsola * 0.7 ? 'significativamente inferiore' : sigAsola > refAsola * 1.3 ? 'significativamente superiore' : 'compatibile'} rispetto ai ${formatNumber(refAsola, 2)} mm della firma di riferimento. ${Math.abs(sigAsola - refAsola) > Math.max(sigAsola, refAsola) * 0.3 ? 'La differenza nelle dimensioni delle asole può indicare variazione nel controllo motorio fine o nella modalità di formazione delle lettere.' : 'La compatibilità nelle dimensioni delle asole indica coerenza nella formazione degli elementi circolari.'}`, { align: 'justify' });
            doc.moveDown(0.5);
          }
        }
        
        // 10. Confronto Spaziatura Media
        if (signatureParams.AvgSpacing !== undefined && referenceParams.AvgSpacing !== undefined) {
          const sigSpacing = signatureParams.AvgSpacing;
          const refSpacing = referenceParams.AvgSpacing;
          
          doc.text(`Spaziatura Media: La firma in verifica ha una spaziatura media tra elementi di ${formatNumber(sigSpacing, 2)} mm, ${sigSpacing < refSpacing * 0.7 ? 'molto più compatta' : sigSpacing > refSpacing * 1.3 ? 'molto più espansa' : 'compatibile'} rispetto ai ${formatNumber(refSpacing, 2)} mm della firma di riferimento. ${Math.abs(sigSpacing - refSpacing) > refSpacing * 0.3 ? 'La differenza nella spaziatura indica possibile variazione nella velocità di esecuzione o nel controllo ritmico della scrittura.' : 'La compatibilità nella spaziatura indica coerenza ritmica nell\'esecuzione.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 11. Confronto Velocità
        if (signatureParams.Velocity !== undefined && referenceParams.Velocity !== undefined) {
          const sigVel = signatureParams.Velocity;
          const refVel = referenceParams.Velocity;
          
          doc.text(`Velocità di Esecuzione: La velocità stimata della firma in verifica è ${formatNumber(sigVel, 3)}, ${sigVel < refVel * 0.8 ? 'significativamente più lenta' : sigVel > refVel * 1.2 ? 'significativamente più veloce' : 'compatibile'} rispetto ai ${formatNumber(refVel, 3)} della firma di riferimento. ${Math.abs(sigVel - refVel) > refVel * 0.2 ? 'La differenza nella velocità può indicare diversa confidenza, stato emotivo o controllo motorio durante l\'esecuzione.' : 'La compatibilità nella velocità indica coerenza temporale nell\'esecuzione della firma.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 12. Confronto Rapporto di Sovrapposizione
        if (signatureParams.OverlapRatio !== undefined && referenceParams.OverlapRatio !== undefined) {
          const sigOverlap = signatureParams.OverlapRatio;
          const refOverlap = referenceParams.OverlapRatio;
          
          doc.text(`Sovrapposizione Tratti: Il rapporto di sovrapposizione nella firma in verifica è ${formatNumber(sigOverlap, 6)}, ${sigOverlap > refOverlap * 2 ? 'significativamente superiore' : sigOverlap < refOverlap * 0.5 ? 'significativamente inferiore' : 'compatibile'} rispetto ai ${formatNumber(refOverlap, 6)} della firma di riferimento. ${Math.abs(sigOverlap - refOverlap) > Math.max(sigOverlap, refOverlap) * 0.5 ? 'La differenza nella sovrapposizione può indicare diversa densità di tratto o modalità di ripassatura.' : 'La compatibilità indica coerenza nella densità e sovrapposizione dei tratti.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 13. Confronto Connessioni tra Lettere
        if (signatureParams.LetterConnections !== undefined && referenceParams.LetterConnections !== undefined) {
          const sigConn = signatureParams.LetterConnections;
          const refConn = referenceParams.LetterConnections;
          
          doc.text(`Connessioni: Il numero di connessioni tra lettere nella firma in verifica è ${sigConn}, ${sigConn < refConn * 0.7 ? 'significativamente inferiore' : sigConn > refConn * 1.3 ? 'significativamente superiore' : 'compatibile'} rispetto ai ${refConn} della firma di riferimento. ${Math.abs(sigConn - refConn) > Math.max(sigConn, refConn) * 0.3 ? 'La differenza nel numero di connessioni può indicare diversa fluidità di esecuzione o approccio alla continuità della scrittura.' : 'La compatibilità nelle connessioni indica coerenza nella fluidità e continuità dell\'esecuzione.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // 14. Confronto Deviazione Baseline
        if (signatureParams.BaselineStd !== undefined && referenceParams.BaselineStd !== undefined) {
          const sigBaseline = signatureParams.BaselineStd;
          const refBaseline = referenceParams.BaselineStd;
          
          doc.text(`Stabilità Baseline: La deviazione standard della baseline nella firma in verifica è ${formatNumber(sigBaseline, 2)} mm, ${sigBaseline > refBaseline * 1.5 ? 'significativamente più instabile' : sigBaseline < refBaseline * 0.5 ? 'significativamente più stabile' : 'compatibile'} rispetto ai ${formatNumber(refBaseline, 2)} mm della firma di riferimento. ${Math.abs(sigBaseline - refBaseline) > refBaseline * 0.5 ? 'La differenza nella stabilità della baseline può indicare diverso controllo direzionale o stabilità motoria durante l\'esecuzione.' : 'La compatibilità nella baseline indica coerenza nel controllo direzionale della scrittura.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        doc.moveDown(1);
        
        // Confronto Spaziatura (mapping from available fields)
        if (signatureParams?.AvgSpacing !== undefined && referenceParams?.AvgSpacing !== undefined) {
          const sigSpacing = signatureParams.AvgSpacing;
          const refSpacing = referenceParams.AvgSpacing;
          
          doc.text(`Spaziatura Media: La firma in verifica ha una spaziatura media di ${formatNumber(sigSpacing, 2)} mm ${sigSpacing < refSpacing * 0.7 ? 'molto inferiore' : sigSpacing > refSpacing * 1.3 ? 'superiore' : 'compatibile'} rispetto ai ${formatNumber(refSpacing, 2)} mm della firma di riferimento, ${sigSpacing < refSpacing * 0.7 ? 'indicando maggiore compattezza e potenzialmente diversa velocità di esecuzione.' : 'indicando coerenza nella distribuzione spaziale.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // Confronto Velocità
        if (signatureParams?.Velocity !== undefined && referenceParams?.Velocity !== undefined) {
          const sigVel = signatureParams.Velocity;
          const refVel = referenceParams.Velocity;
          
          doc.text(`Velocità di Scrittura: La velocità di scrittura della firma in verifica è ${sigVel < refVel * 0.8 ? 'inferiore' : sigVel > refVel * 1.2 ? 'superiore' : 'compatibile'} (${formatNumber(sigVel, 2)}/5) rispetto a quella della firma di riferimento (${formatNumber(refVel, 2)}/5), ${sigVel < refVel * 0.8 ? 'suggerendo possibile maggiore attenzione o cautela durante la firma.' : 'indicando modalità di esecuzione coerenti.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // Confronto Proporzione
        if (signatureParams?.Proportion !== undefined && referenceParams?.Proportion !== undefined) {
          const sigProp = signatureParams.Proportion;
          const refProp = referenceParams.Proportion;
          
          doc.text(`Proporzione: La firma in verifica ha una proporzione di ${formatNumber(sigProp, 3)}, mentre la firma di riferimento ha una proporzione di ${formatNumber(refProp, 3)}. ${Math.abs(sigProp - refProp) > 0.2 ? 'Questa differenza indica una diversa distribuzione delle dimensioni tra le componenti della firma.' : 'Questa compatibilità indica coerenza proporzionale.'}`, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // VALUTAZIONE DELLA COERENZA DIMENSIONALE E PROPORZIONALE
        doc.fontSize(12).text('VALUTAZIONE DELLA COERENZA DIMENSIONALE E PROPORZIONALE', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        const percentageScore = signature.comparisonResult * 100;
        if (percentageScore >= 85) {
          doc.text('La firma in verifica presenta parametri dimensionali e proporzionali coerenti con la firma di riferimento. Le variazioni riscontrate rientrano nei margini di tolleranza accettabili per firme autentiche.', { align: 'justify' });
        } else if (percentageScore >= 65) {
          doc.text('La firma in verifica mostra alcune variazioni nei parametri dimensionali rispetto alla firma di riferimento. Queste differenze potrebbero indicare variazioni naturali legate al contesto di firma o necessitano di ulteriore valutazione.', { align: 'justify' });
        } else {
          doc.text('La firma in verifica presenta differenze significative nei parametri dimensionali e proporzionali rispetto alla firma di riferimento. La differenza nelle dimensioni e nella proporzione potrebbe indicare una variazione significativa nello stile di firma o una possibile alterazione intenzionale.', { align: 'justify' });
        }
        doc.moveDown(1);
        
        // ANALISI DELLE CARATTERISTICHE GRAFOLOGICHE
        doc.fontSize(12).text('ANALISI DELLE CARATTERISTICHE GRAFOLOGICHE', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        if (signatureParams?.PressureMean !== undefined && referenceParams?.PressureMean !== undefined) {
          const sigPress = signatureParams.PressureMean;
          const refPress = referenceParams.PressureMean;
          doc.text(`Intensità dell'Inchiostro: ${Math.abs(sigPress - refPress) < refPress * 0.3 ? 'L\'intensità uniforme dell\'inchiostro tra le due firme indica stabilità nel controllo della pressione di scrittura e coerenza nell\'uso dello strumento.' : 'L\'intensità dell\'inchiostro differente potrebbe indicare una variazione nella pressione applicata, nel tipo di penna utilizzata o nelle condizioni di scrittura.'}`, { align: 'justify' });
          doc.moveDown(0.3);
        }
        
        if (signatureParams?.Velocity !== undefined && referenceParams?.Velocity !== undefined) {
          const sigVel = signatureParams.Velocity;
          const refVel = referenceParams.Velocity;
          doc.text(`Fluidità e Controllo Motorio: ${Math.abs(sigVel - refVel) < refVel * 0.3 ? 'La velocità di scrittura coerente suggerisce un\'esecuzione naturale e fluida.' : 'La variazione nella velocità di scrittura suggerisce un\'esecuzione più controllata o meno fluida rispetto alla firma di riferimento.'}`, { align: 'justify' });
          doc.moveDown(0.3);
        }
        
        doc.moveDown(1);
        
        // IDENTIFICAZIONE DI EVENTUALI ANOMALIE O ELEMENTI SOSPETTI
        doc.fontSize(12).text('IDENTIFICAZIONE DI EVENTUALI ANOMALIE O ELEMENTI SOSPETTI', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        if (percentageScore < 65) {
          doc.text('Le differenze significative nei parametri di spessore, dimensioni, inclinazione e connettività potrebbero indicare una variazione intenzionale o non intenzionale nello stile di firma. Sono stati identificati elementi che richiedono particolare attenzione in un contesto forense.', { align: 'justify' });
        } else if (percentageScore < 85) {
          doc.text('Alcune variazioni nei parametri sono state riscontrate, ma restano entro margini di accettabilità. Si raccomanda valutazione contestuale per determinare se tali variazioni sono attribuibili a fattori naturali.', { align: 'justify' });
        } else {
          doc.text('Non sono state identificate anomalie significative nei parametri analizzati. La firma presenta caratteristiche coerenti con quelle di riferimento.', { align: 'justify' });
        }
        doc.moveDown(1);
        
        // CONCLUSIONE PROFESSIONALE SULL'AUTENTICITÀ
        doc.fontSize(12).text('CONCLUSIONE PROFESSIONALE SULL\'AUTENTICITÀ', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        if (percentageScore >= 85) {
          doc.text('Sulla base dell\'analisi comparativa dei parametri grafometrici, la firma in verifica presenta caratteristiche compatibili con la firma di riferimento. Il livello di similarità riscontrato supporta l\'ipotesi di autenticità.', { align: 'justify' });
        } else if (percentageScore >= 65) {
          doc.text('L\'analisi rivela alcune differenze tra la firma in verifica e quella di riferimento. Sebbene non sia possibile escludere l\'autenticità, si raccomanda un\'ulteriore valutazione da parte di un esperto grafologo forense e, se possibile, la raccolta di ulteriori campioni per un confronto più approfondito.', { align: 'justify' });
        } else {
          doc.text('Le differenze significative tra le due firme in termini di parametri grafometrici suggeriscono che la firma in verifica potrebbe non essere autentica o potrebbe essere stata eseguita in condizioni diverse rispetto alla firma di riferimento. Raccomando un\'ulteriore analisi da parte di un esperto grafologo forense e, se possibile, la raccolta di ulteriori campioni di firma per un confronto più approfondito.', { align: 'justify' });
        }
        doc.moveDown(1);
        
        // ANALISI TECNICA ALGORITMICA
        doc.fontSize(12).text('ANALISI TECNICA ALGORITMICA', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        // Analisi automatica basata sui parametri disponibili
        if (signatureParams && referenceParams) {
          // Velocità (se disponibile)
          if (signatureParams.Velocity !== undefined && referenceParams.Velocity !== undefined) {
            const sigVel = signatureParams.Velocity;
            const refVel = referenceParams.Velocity;
            doc.text(`La firma in verifica presenta una ${sigVel < refVel * 0.8 ? 'minore' : sigVel > refVel * 1.2 ? 'maggiore' : 'simile'} velocità di esecuzione rispetto alla comparativa.`);
          }
          
          // Proporzioni
          if (signatureParams.Proportion !== undefined && referenceParams.Proportion !== undefined) {
            const sigProp = signatureParams.Proportion;
            const refProp = referenceParams.Proportion;
            doc.text(`Le proporzioni tra altezza e larghezza mostrano ${Math.abs(sigProp - refProp) > 0.2 ? 'differenze significative' : 'compatibilità'}.`);
          }
          
          // Intensità
          if (signatureParams.PressureMean !== undefined && referenceParams.PressureMean !== undefined) {
            const sigPress = signatureParams.PressureMean;
            const refPress = referenceParams.PressureMean;
            doc.text(`L'intensità dell'inchiostro nelle firme è ${Math.abs(sigPress - refPress) < refPress * 0.3 ? 'compatibile' : 'differente'} tra i due esemplari.`);
          }
          
          // Inclinazione
          if (signatureParams.Inclination !== undefined && referenceParams.Inclination !== undefined) {
            const sigIncl = signatureParams.Inclination;
            const refIncl = referenceParams.Inclination;
            const angleDiff = Math.abs(sigIncl - refIncl);
            doc.text(`L'inclinazione dei tratti ${angleDiff > 15 ? 'evidenzia differenze stilistiche' : 'risulta simile'}.`);
          }
          
          // Curvatura
          if (signatureParams.AvgCurvature !== undefined && referenceParams.AvgCurvature !== undefined) {
            const sigCurv = signatureParams.AvgCurvature;
            const refCurv = referenceParams.AvgCurvature;
            doc.text(`La curvilineità/angolosità delle firme è ${Math.abs(sigCurv - refCurv) < 15 ? 'coerente' : 'variabile'}.`);
          }
          
          // Spaziatura
          if (signatureParams.AvgSpacing !== undefined && referenceParams.AvgSpacing !== undefined) {
            const sigSpacing = signatureParams.AvgSpacing;
            const refSpacing = referenceParams.AvgSpacing;
            doc.text(`La spaziatura tra le lettere appare ${Math.abs(sigSpacing - refSpacing) < refSpacing * 0.3 ? 'omogenea' : 'variabile'}.`);
          }
          
          doc.text(`Analisi completata sui parametri disponibili.`);
        } else {
          doc.text(`Parametri di analisi non disponibili per confronto tecnico automatico.`);
        }
        
        doc.moveDown(1);
        
      } else if (signature.analysisReport) {
        // Fallback al report esistente se non c'è firma di riferimento
        doc.fontSize(14).text('ANALISI PERITALE AI', { underline: true });
        doc.text('CONFRONTO PARAMETRO PER PARAMETRO', { fontSize: 12 });
        doc.moveDown(0.5);
        doc.fontSize(10);
        
        const analysisLines = signature.analysisReport.split('\n');
        for (const line of analysisLines) {
          if (line.trim()) {
            doc.text(line.trim(), { align: 'justify' });
            doc.moveDown(0.3);
          }
        }
        doc.moveDown(1);
      }
      
      
      // GRAFICO DI CONFRONTO
      if (signature.comparisonChart) {
        doc.moveDown(1.5);
        doc.fontSize(14).text('GRAFICO DI CONFRONTO', { underline: true });
        doc.moveDown(0.5);
        
        try {
          // Crea un'immagine temporanea dal base64
          const chartBuffer = Buffer.from(signature.comparisonChart, 'base64');
          doc.image(chartBuffer, {
            width: 500,
            align: 'center'
          });
          doc.moveDown(1);
        } catch (error) {
          doc.fontSize(10).text('Grafico di confronto non disponibile', { align: 'center' });
          doc.moveDown(1);
        }
      }
      
      // IMMAGINI ANALIZZATE
      doc.addPage();
      doc.fontSize(14).text('IMMAGINI ANALIZZATE', { underline: true });
      doc.moveDown(0.5);
      
      try {
        // Firma in verifica
        doc.fontSize(12).text('Firma in verifica:');
        doc.moveDown(0.3);
        const signatureImagePath = path.join(process.cwd(), 'uploads', signature.filename);
        
        // Verifica che l'immagine esista
        await fs.access(signatureImagePath);
        doc.image(signatureImagePath, {
          width: 400,
          align: 'center'
        });
        doc.moveDown(1);
        
        // Firma di riferimento se disponibile
        if (referenceSignature) {
          doc.fontSize(12).text('Firma di riferimento:');
          doc.moveDown(0.3);
          const referenceImagePath = path.join(process.cwd(), 'uploads', referenceSignature.filename);
          
          try {
            await fs.access(referenceImagePath);
            doc.image(referenceImagePath, {
              width: 400,
              align: 'center'
            });
          } catch {
            doc.fontSize(10).text('Immagine di riferimento non disponibile', { align: 'center' });
          }
        }
      } catch (error) {
        doc.fontSize(10).text('Immagini non disponibili', { align: 'center' });
      }
      
      // METODOLOGIA
      doc.moveDown(2);
      doc.fontSize(14).text('METODOLOGIA', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(
        `L'analisi è stata condotta utilizzando algoritmi di computer vision e analisi delle caratteristiche grafologiche. Il sistema estrae e confronta parametri quali intensità dell'inchiostro, curvatura, distribuzione spaziale e connettività. Il punteggio finale deriva dalla media ponderata di questi parametri con accuratezza stimata dell'85% rispetto all'analisi manuale.`,
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      doc.fontSize(10).text(
        'LEGENDA PUNTEGGI: 85-100% Autentica, 65-84% Probabile Autentica, 0-64% Sospetta',
        { align: 'center' }
      );
      
      // === NUOVE SEZIONI: NATURALEZZA E PROSPETTO FINALE ===
      
      // ANALISI DI NATURALEZZA (se disponibile)
      console.log('[PDF DEBUG] Checking naturalness data:', {
        naturalnessScore: signature.naturalnessScore,
        verdict: signature.verdict,
        verdictExplanation: signature.verdictExplanation?.substring(0, 50) + '...'
      });
      
      if (signature.naturalnessScore !== null && signature.naturalnessScore !== undefined) {
        console.log('[PDF DEBUG] Adding naturalness section');
        doc.addPage();
        doc.fontSize(16).text('ANALISI DI NATURALEZZA (ANTI-DISSIMULAZIONE)', { underline: true, align: 'center' });
        doc.moveDown(0.5);
        
        doc.fontSize(12).text(`Indice di Naturalezza: ${(signature.naturalnessScore * 100).toFixed(1)}%`, { underline: true });
        doc.moveDown(0.3);
        
        if (signature.verdict) {
          doc.fontSize(12).text(`Verdetto: ${signature.verdict}`, { underline: true });
          doc.moveDown(0.3);
        }
        
        if (signature.confidenceLevel) {
          const confidencePercent = signature.confidenceLevel < 1 ? signature.confidenceLevel * 100 : signature.confidenceLevel;
          doc.fontSize(12).text(`Livello di Confidenza: ${confidencePercent.toFixed(1)}%`, { underline: true });
          doc.moveDown(0.3);
        }
        
        if (signature.verdictExplanation) {
          doc.fontSize(12).text('Interpretazione Professionale:', { underline: true });
          doc.moveDown(0.3);
          doc.fontSize(10).text(signature.verdictExplanation, { align: 'justify' });
          doc.moveDown(0.5);
        }
        
        // === GRAFICO DI NATURALEZZA ===
        console.log('[PDF DEBUG] Checking if naturalness chart exists for signature', signature.id, 'Chart available:', !!signature.naturalnessChart);
        if (signature.naturalnessChart && signature.naturalnessChart.length > 0) {
          console.log('[PDF DEBUG] Adding naturalness chart to PDF');
          doc.fontSize(12).text('GRAFICO DI COMPARAZIONE NATURALEZZA', { underline: true, align: 'center' });
          doc.moveDown(0.3);
          
          try {
            // Debug: controlla formato del base64
            console.log('[PDF DEBUG] Chart data format:', signature.naturalnessChart.substring(0, 50) + '...');
            console.log('[PDF DEBUG] Chart data length:', signature.naturalnessChart.length);
            
            // Pulisci il base64 e convertilo in buffer
            const base64Data = signature.naturalnessChart.replace(/^data:image\/[a-z]+;base64,/, '');
            const chartBuffer = Buffer.from(base64Data, 'base64');
            
            console.log('[PDF DEBUG] Buffer created, size:', chartBuffer.length);
            
            doc.image(chartBuffer, {
              fit: [450, 300],
              align: 'center',
              valign: 'center'
            });
            doc.moveDown(0.5);
            console.log('[PDF DEBUG] Naturalness chart successfully added to PDF');
          } catch (chartError) {
            console.error('[PDF DEBUG] Error adding naturalness chart:', chartError);
            doc.fontSize(10).text('[Errore nel caricamento del grafico di naturalezza]', { align: 'center' });
            doc.moveDown(0.3);
          }
        } else {
          console.log('[PDF DEBUG] No naturalness chart available for signature', signature.id);
          doc.fontSize(10).text('[Grafico di naturalezza in fase di generazione - riprovare dopo il completamento dell\'analisi]', { align: 'center', style: 'italic' });
          doc.moveDown(0.3);
        }
        
        // Spiegazione tecnica
        doc.fontSize(10).text(
          "L'Indice di Naturalezza combina tre parametri avanzati: Fluidità dei tratti (coordinazione motoria), " +
          "Consistenza della Pressione (controllo dell'intensità), e Coordinazione Generale (regolarità delle curve). " +
          "Valori bassi possono indicare falsificazione, mentre valori intermedi possono suggerire dissimulazione autentica.",
          { align: 'justify' }
        );
        doc.moveDown(1);
      } else {
        console.log('[PDF DEBUG] Naturalness section SKIPPED - no data available');
      }
      
      // PROSPETTO FINALE DELL'ANALISI
      console.log('[PDF DEBUG] Adding final analysis section');
      doc.addPage();
      doc.fontSize(16).text('PROSPETTO FINALE DELL\'ANALISI', { underline: true, align: 'center' });
      doc.moveDown(1);
      
      // Riassunto dei risultati
      doc.fontSize(14).text('RIASSUNTO DEI RISULTATI', { underline: true });
      doc.moveDown(0.3);
      
      doc.fontSize(12);
      const numPercentageScore = typeof percentageScore === 'string' ? parseFloat(percentageScore) : percentageScore;
      doc.text(`Punteggio di Somiglianza: ${numPercentageScore.toFixed(1)}%`);
      
      if (signature.naturalnessScore !== null && signature.naturalnessScore !== undefined) {
        doc.text(`Indice di Naturalezza: ${(signature.naturalnessScore * 100).toFixed(1)}%`);
        if (signature.verdict) {
          doc.text(`Verdetto Finale: ${signature.verdict}`);
        }
        
        // === DETTAGLIO PARAMETRI DI NATURALEZZA ===
        doc.moveDown(0.5);
        doc.fontSize(12).text('DETTAGLIO PARAMETRI DI NATURALEZZA:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        
        // Estrai i parametri di naturalezza dai dati della firma
        if (signatureParams && referenceParams) {
          try {
            const sigFluidityScore = signatureParams.FluidityScore || 0;
            const sigPressureConsistency = signatureParams.PressureConsistency || 0;
            const sigCoordinationIndex = signatureParams.CoordinationIndex || 0;
            
            const refFluidityScore = referenceParams.FluidityScore || 0;
            const refPressureConsistency = referenceParams.PressureConsistency || 0;
            const refCoordinationIndex = referenceParams.CoordinationIndex || 0;
            
            doc.text(`• Fluidità dei Tratti: Firma in Verifica ${(sigFluidityScore * 100).toFixed(1)}% vs Riferimento ${(refFluidityScore * 100).toFixed(1)}%`);
            doc.text(`• Consistenza della Pressione: Firma in Verifica ${(sigPressureConsistency * 100).toFixed(1)}% vs Riferimento ${(refPressureConsistency * 100).toFixed(1)}%`);
            doc.text(`• Coordinazione Generale: Firma in Verifica ${(sigCoordinationIndex * 100).toFixed(1)}% vs Riferimento ${(refCoordinationIndex * 100).toFixed(1)}%`);
            
            console.log('[PDF DEBUG] Added naturalness parameter details to final section');
          } catch (paramError) {
            console.error('[PDF DEBUG] Error extracting naturalness parameters:', paramError);
            doc.text('• Parametri dettagliati non disponibili nella sessione corrente');
          }
        } else {
          doc.text('• Parametri dettagliati non disponibili - rigenerare l\'analisi per visualizzarli');
        }
      }
      doc.moveDown(1);
      
      // Raccomandazioni professionali
      doc.fontSize(14).text('RACCOMANDAZIONI PROFESSIONALI', { underline: true });
      doc.moveDown(0.3);
      
      doc.fontSize(11);
      const naturalnessPercent = signature.naturalnessScore ? signature.naturalnessScore * 100 : null;
      
      if (numPercentageScore >= 85) {
        doc.text('RACCOMANDAZIONE: La firma presenta caratteristiche fortemente compatibili con l\'autenticità. I parametri analizzati supportano l\'ipotesi di genuinità.', { align: 'justify' });
      } else if (numPercentageScore >= 65) {
        if (naturalnessPercent && naturalnessPercent >= 80) {
          doc.text('ATTENZIONE: Possibile dissimulazione autentica rilevata. La combinazione di somiglianza moderata con alta naturalezza suggerisce un tentativo volontario dell\'autore di modificare il proprio stile. Richiedere ulteriori verifiche documentali e campioni di confronto.', { align: 'justify' });
        } else {
          doc.text('ATTENZIONE: Somiglianza moderata rilevata. Necessaria analisi approfondita da parte di un esperto grafologo forense per valutare il contesto e le circostanze di scrittura.', { align: 'justify' });
        }
      } else {
        doc.text('ALLERTA: Bassa compatibilità parametrica rilevata. Forte sospetto di non autenticità. Si raccomanda perizia grafologica forense professionale e ulteriori indagini investigative.', { align: 'justify' });
      }
      
      doc.moveDown(1);
      
      // Note legali finali
      doc.fontSize(9).fillColor('gray').text(
        'IMPORTANTE: Queste raccomandazioni si basano su algoritmi di analisi computazionale avanzata. ' +
        'Per decisioni definitive in ambito legale, forense o investigativo, è sempre necessario consultare ' +
        'un esperto grafologo certificato che possa valutare elementi contestuali non rilevabili automaticamente.',
        { align: 'justify' }
      );
      doc.fillColor('black');
      doc.moveDown(1);
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text(
        `Report generato automaticamente da GrapholexInsight il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
        { align: 'center' }
      );
      
      doc.end();
      
    } catch (error: any) {
      console.error('[REPORT DOWNLOAD] Errore:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Elimina una singola firma
  appRouter.delete("/signatures/:id", isAuthenticated, isActiveUser, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Elimina il file fisico se esiste
      try {
        const filePath = path.join(process.cwd(), 'uploads', signature.filename);
        await fs.unlink(filePath);
        console.log(`[DELETE SIGNATURE] File fisico eliminato: ${filePath}`);
      } catch (fileError) {
        console.warn(`[DELETE SIGNATURE] Impossibile eliminare file fisico:`, fileError);
        // Non blocchiamo l'eliminazione se il file fisico non esiste
      }
      
      // Elimina dal database
      await storage.deleteSignature(signatureId);
      
      console.log(`[DELETE SIGNATURE] Firma ${signatureId} eliminata con successo`);
      res.json({ message: 'Firma eliminata con successo' });
    } catch (error: any) {
      console.error('[DELETE SIGNATURE] Errore:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Funzione per elaborare i parametri della firma in background
async function processSignatureParameters(signatureId: number): Promise<void> {
  try {
    console.log(`[PROCESS PARAMS] Inizio elaborazione parametri per firma ${signatureId}`);
    
    const signature = await storage.getSignature(signatureId);
    if (!signature) {
      throw new Error('Firma non trovata');
    }
    
    const originalFilePath = path.join(process.cwd(), 'uploads', signature.filename);
    
    // Verifica che il file esista
    try {
      await fs.access(originalFilePath);
    } catch {
      throw new Error('File immagine non trovato');
    }
    
    // RITAGLIO AUTOMATICO - rimuove spazio bianco attorno alla firma
    console.log(`[AUTO-CROP] Inizio ritaglio automatico per firma ${signatureId}`);
    const croppedFilePath = originalFilePath.replace(/(\.[^.]+)$/, '_cropped$1');
    
    let finalFilePath = originalFilePath;
    try {
      const cropResult = await SignatureCropper.cropSignature({
        inputPath: originalFilePath,
        outputPath: croppedFilePath,
        autoCrop: true
      });
      
      if (cropResult.success && cropResult.croppedPath) {
        console.log(`[AUTO-CROP] Ritaglio completato: ${cropResult.message} (confidenza: ${(cropResult.confidence*100).toFixed(1)}%)`);
        finalFilePath = cropResult.croppedPath;
        
        // Se il ritaglio ha una buona confidenza, sostituisci il file originale
        if (cropResult.confidence > 0.3) {
          await fs.copyFile(croppedFilePath, originalFilePath);
          console.log(`[AUTO-CROP] File originale sostituito con versione ritagliata`);
        }
        
        // Rimuovi il file temporaneo ritagliato
        try {
          await fs.unlink(croppedFilePath);
        } catch (e) {
          // Ignora errori di pulizia
        }
      } else {
        console.log(`[AUTO-CROP] Ritaglio non applicato: ${cropResult.message}`);
      }
    } catch (cropError) {
      console.warn(`[AUTO-CROP] Errore durante ritaglio automatico (continuo con originale):`, cropError);
    }
    
    // Elabora i parametri usando SignatureAnalyzer (supporta sia con che senza dimensioni reali)
    const parameters = await SignatureAnalyzer.extractParameters(
      originalFilePath, // Usa sempre il file originale (eventualmente sostituito)
      signature.realWidthMm || 120, // Default se mancanti
      signature.realHeightMm || 40   // Default se mancanti
    );
    
    // Salva i parametri nel campo corretto e imposta lo stato come completato
    console.log(`[PROCESS PARAMS] Aggiornamento firma ${signatureId} con parametri`);
    await storage.updateSignatureParameters(signatureId, parameters);
    await storage.updateSignature(signatureId, {
      processingStatus: 'completed'
    });
    console.log(`[PROCESS PARAMS] Status aggiornato con successo per firma ${signatureId}`);
    
    // Verifica che l'aggiornamento sia andato a buon fine
    const updatedSignature = await storage.getSignature(signatureId);
    console.log(`[PROCESS PARAMS] Status verificato nel database:`, {
      id: updatedSignature?.id,
      processingStatus: updatedSignature?.processingStatus,
      hasParameters: !!updatedSignature?.parameters,
      analysisReportLength: updatedSignature?.analysisReport?.length,
      parametersCount: updatedSignature?.parameters ? Object.keys(updatedSignature.parameters).length : 0,
      realWidth: updatedSignature?.realWidthMm,
      realHeight: updatedSignature?.realHeightMm
    });
    
    console.log(`[PROCESS PARAMS] Elaborazione completata per firma ${signatureId}`);
    
  } catch (error: any) {
    console.error(`[PROCESS PARAMS] Errore elaborazione firma ${signatureId}:`, error);
    
    // In caso di errore, imposta lo stato come fallito
    try {
      await storage.updateSignature(signatureId, {
        processingStatus: 'failed'
      });
    } catch (updateError) {
      console.error(`[PROCESS PARAMS] Errore aggiornamento stato fallimento:`, updateError);
    }
    
    throw error;
  }
}