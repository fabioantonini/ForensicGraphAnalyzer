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
            
            similarityScore = pythonResult.similarity; // Mantieni come percentuale diretta
            comparisonChart = pythonResult.comparison_chart; // CORRETTO: field name è comparison_chart
            analysisReport = pythonResult.description; // CORRETTO: field name è description
            
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
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      if (completedVerifications.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile'
        });
      }
      
      // Ottieni le firme di riferimento completate
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      const completedReferences = referenceSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      console.log(`[GENERATE ALL REPORTS] Utilizzo generazione PDF integrata per ${completedVerifications.length} firme`);
      
      const results = [];
      for (const signature of completedVerifications) {
        try {
          console.log(`[GENERATE ALL REPORTS] Generazione report per firma ${signature.id}`);
          
          // Verifica che la firma abbia un risultato di confronto
          if (!signature.comparisonResult || signature.comparisonResult === 0) {
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
      
      // Pipe il PDF direttamente alla risposta
      doc.pipe(res);
      
      // Contenuto del PDF
      doc.fontSize(20).text('RAPPORTO DI ANALISI FIRMA', { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(14).text('INFORMAZIONI DELLA FIRMA', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Nome file: ${signature.originalFilename}`);
      doc.text(`Data analisi: ${new Date().toLocaleDateString('it-IT')}`);
      doc.text(`Progetto: ${project.name}`);
      doc.moveDown(1.5);
      
      doc.fontSize(16).text('RISULTATO DELL\'ANALISI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(14);
      
      const percentageScore = (signature.comparisonResult * 100).toFixed(1);
      let verdict = '';
      
      if (signature.comparisonResult >= 0.85) {
        verdict = 'AUTENTICA';
      } else if (signature.comparisonResult >= 0.65) {
        verdict = 'PROBABILMENTE AUTENTICA';  
      } else {
        verdict = 'SOSPETTA';
      }
      
      doc.text(`Punteggio di similarità: ${percentageScore}%`);
      doc.text(`Valutazione: ${verdict}`, { fontSize: 16 });
      doc.moveDown(1.5);
      
      // Aggiungi i parametri completi se disponibili
      if (signature.parameters) {
        doc.fontSize(14).text('PARAMETRI ANALIZZATI', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        
        // Parametri dimensionali
        if (signature.parameters.realDimensions) {
          doc.text(`Dimensioni reali: ${signature.parameters.realDimensions.widthMm?.toFixed(1)}mm × ${signature.parameters.realDimensions.heightMm?.toFixed(1)}mm`);
        }
        
        // Parametri del tratto
        if (signature.parameters.strokeWidth) {
          if (signature.parameters.strokeWidth.meanMm) {
            doc.text(`Spessore medio tratto: ${signature.parameters.strokeWidth.meanMm.toFixed(2)}mm`);
          }
          if (signature.parameters.strokeWidth.varianceMm) {
            doc.text(`Varianza spessore: ${signature.parameters.strokeWidth.varianceMm.toFixed(2)}mm`);
          }
          if (signature.parameters.strokeWidth.minMm && signature.parameters.strokeWidth.maxMm) {
            doc.text(`Range spessore: ${signature.parameters.strokeWidth.minMm.toFixed(2)}mm - ${signature.parameters.strokeWidth.maxMm.toFixed(2)}mm`);
          }
        }
        
        // Parametri di movimento
        if (signature.parameters.inclination !== undefined) {
          doc.text(`Inclinazione media: ${signature.parameters.inclination.toFixed(1)}°`);
        }
        if (signature.parameters.velocity !== undefined) {
          doc.text(`Velocità di scrittura: ${signature.parameters.velocity.toFixed(1)}/5`);
        }
        if (signature.parameters.pressure !== undefined) {
          doc.text(`Pressione media: ${signature.parameters.pressure.toFixed(1)}/5`);
        }
        
        // Parametri di forma
        if (signature.parameters.curvature !== undefined) {
          doc.text(`Curvatura: ${signature.parameters.curvature.toFixed(2)}`);
        }
        if (signature.parameters.angularity !== undefined) {
          doc.text(`Angolosità: ${signature.parameters.angularity.toFixed(2)}`);
        }
        if (signature.parameters.connectivity !== undefined) {
          doc.text(`Connettività: ${signature.parameters.connectivity.toFixed(2)}`);
        }
        
        // Parametri di distribuzione
        if (signature.parameters.spacingVariance !== undefined) {
          doc.text(`Varianza spaziatura: ${signature.parameters.spacingVariance.toFixed(2)}`);
        }
        if (signature.parameters.densityUniformity !== undefined) {
          doc.text(`Uniformità densità: ${signature.parameters.densityUniformity.toFixed(2)}`);
        }
        
        // Parametri avanzati
        if (signature.parameters.proportionRatio !== undefined) {
          doc.text(`Rapporto proporzioni: ${signature.parameters.proportionRatio.toFixed(2)}`);
        }
        if (signature.parameters.styleClassification) {
          doc.text(`Classificazione stile: ${signature.parameters.styleClassification}`);
        }
        if (signature.parameters.loopAnalysis !== undefined) {
          doc.text(`Analisi asole: ${signature.parameters.loopAnalysis.toFixed(2)}`);
        }
        if (signature.parameters.dynamicInclination !== undefined) {
          doc.text(`Inclinazione dinamica: ${signature.parameters.dynamicInclination.toFixed(1)}°`);
        }
        if (signature.parameters.multilevelPressure !== undefined) {
          doc.text(`Pressione multi-livello: ${signature.parameters.multilevelPressure.toFixed(2)}`);
        }
        if (signature.parameters.microscaleCurvature !== undefined) {
          doc.text(`Curvatura microscala: ${signature.parameters.microscaleCurvature.toFixed(2)}`);
        }
        if (signature.parameters.executionSpeed !== undefined) {
          doc.text(`Velocità esecuzione: ${signature.parameters.executionSpeed.toFixed(2)}`);
        }
        if (signature.parameters.morphologicalConnections !== undefined) {
          doc.text(`Connessioni morfologiche: ${signature.parameters.morphologicalConnections.toFixed(2)}`);
        }
        if (signature.parameters.calibratedSpacing !== undefined) {
          doc.text(`Spaziatura calibrata: ${signature.parameters.calibratedSpacing.toFixed(2)}`);
        }
      }
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text(
        `Report generato da GrapholexInsight il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
        { align: 'center' }
      );
      
      doc.end();
      
    } catch (error: any) {
      console.error('[REPORT DOWNLOAD] Errore:', error);
      res.status(500).json({ error: error.message });
    }
  });
}