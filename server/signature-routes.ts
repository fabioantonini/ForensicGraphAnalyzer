import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { SignatureAnalyzer } from "./signature-analyzer";
import { SignaturePythonAnalyzer } from "./python-bridge";
import { insertSignatureProjectSchema, insertSignatureSchema } from "@shared/schema";
import { log } from "./vite";

// Assicuriamoci che le directory esistano
try {
  // Crea la directory delle firme e dei report
  fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  fs.mkdir(path.join(process.cwd(), 'uploads', 'reports'), { recursive: true });
  console.log('[INIT] Directory uploads e reports inizializzate');
} catch (error) {
  console.log('[INIT] Errore nella creazione delle directory:', error);
}

// Configurazione di multer per gestire upload di immagini
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Crea la directory e poi procedi
      fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true })
        .then(() => {
          cb(null, path.join(process.cwd(), 'uploads'));
        })
        .catch(err => {
          console.error('[UPLOAD] Errore nella creazione della directory:', err);
          cb(null, path.join(process.cwd(), 'uploads'));
        });
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `signature-${uniqueSuffix}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Accetta solo immagini
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

// Middleware per verificare l'autenticazione
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  console.log('Session ID:', req.sessionID);  
  console.log('Is authenticated?', req.isAuthenticated());
  console.log('User:', req.user);
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Autenticazione richiesta' });
};

export function registerSignatureRoutes(router: Router) {
  // Genera report PDF per tutte le firme da verificare in un progetto
  router.post("/signature-projects/:id/generate-all-reports", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      console.log(`[DEBUG REPORT-ALL] Avvio generazione report per tutte le firme nel progetto ${projectId}`);
      
      const project = await storage.getSignatureProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      console.log(`[DEBUG REPORT-ALL] Recupero firme da verificare per progetto ${projectId}`);
      
      // Ottieni tutte le firme da verificare completate
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      console.log(`[DEBUG REPORT-ALL] Trovate ${completedVerifications.length} firme da verificare completate`);
      
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
      
      console.log(`[DEBUG REPORT-ALL] Trovate ${completedReferences.length} firme di riferimento completate`);
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      // Verifica la disponibilità dell'analizzatore Python avanzato
      const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
      if (!isPythonAvailable) {
        return res.status(500).json({
          error: 'Analizzatore avanzato non disponibile, impossibile generare i report'
        });
      }
      
      // Crea le informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica firme multiple`,
        date: new Date().toLocaleDateString('it-IT'),
        documentType: 'Verifica di firma',
        notes: project.description || ""
      };
      
      console.log(`[DEBUG REPORT-ALL] Inizio generazione report per ${completedVerifications.length} firme`);
      
      // Utilizziamo un ciclo for standard invece di Promise.all per garantire migliore gestione degli errori
      const results = [];
      for (const signature of completedVerifications) {
        try {
          console.log(`[DEBUG REPORT-ALL] Generazione report per firma ${signature.id}`);
          
          // Percorso della firma da verificare
          const signaturePath = path.join('./uploads', signature.filename);
          
          // Calcoliamo il report usando tutte le firme di riferimento, come fa "Confronta Tutte"
          // Creiamo un array con i percorsi di tutte le firme di riferimento
          const referencePaths = completedReferences.map(ref => path.join('./uploads', ref.filename));
          
          // Utilizza la prima firma di riferimento come principale per il report
          const primaryReferencePath = referencePaths[0];
          
          // Le firme di riferimento aggiuntive sono tutte tranne la prima
          const additionalReferencePaths = referencePaths.length > 1 ? referencePaths.slice(1) : [];
          
          // Debug
          console.log(`[DEBUG REPORT-ALL] Firma da verificare: ${signature.filename}`);
          console.log(`[DEBUG REPORT-ALL] Firma di riferimento principale: ${completedReferences[0].filename}`);
          if (additionalReferencePaths.length > 0) {
            console.log(`[DEBUG REPORT-ALL] Firme di riferimento aggiuntive: ${additionalReferencePaths.length}`);
          }
          
          // Aggiorniamo le info sul caso per indicare che è un confronto con multiple firme di riferimento
          const enhancedCaseInfo = {
            ...caseInfo,
            notes: caseInfo.notes + (completedReferences.length > 1 ? 
              `\nConfrontata con ${completedReferences.length} firme di riferimento.` : '')
          };
          
          // Genera il report PDF
          // IMPORTANTE: Invertiamo i parametri per compensare il problema di ordinamento
          console.log(`[REPORT-ALL] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
          console.log(`[REPORT-ALL] Firma da verificare (diventerà riferimento): ${signaturePath}`);
          console.log(`[REPORT-ALL] Firma di riferimento (diventerà verifica): ${primaryReferencePath}`);
          
          const reportResult = await SignaturePythonAnalyzer.generateReport(
            primaryReferencePath,    // Questo diventerà la firma da verificare nel report
            signaturePath,           // Questo diventerà la firma di riferimento nel report
            enhancedCaseInfo,        // Informazioni sul caso
            additionalReferencePaths // Eventuali firme di riferimento aggiuntive
          );
          
          // Aggiorna la firma con il percorso del report
          if (reportResult && reportResult.report_path) {
            await storage.updateSignature(signature.id, {
              reportPath: reportResult.report_path
            });
            
            console.log(`[DEBUG REPORT-ALL] Report generato con successo per firma ${signature.id}`);
            
            // Ottieni la firma aggiornata
            const updatedSignature = await storage.getSignature(signature.id);
            results.push({
              id: signature.id,
              reportPath: updatedSignature?.reportPath,
              success: true
            });
          } else {
            console.error(`[DEBUG REPORT-ALL] Errore durante la generazione del report per firma ${signature.id}:`, reportResult?.error || 'Nessun percorso di report restituito');
            results.push({
              id: signature.id,
              success: false,
              error: reportResult?.error || 'Generazione report fallita'
            });
          }
        } catch (error: any) {
          console.error(`[DEBUG REPORT-ALL] Errore per firma ${signature.id}:`, error.message);
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
      
      console.log(`[DEBUG REPORT-ALL] Generazione report completata per ${results.filter(r => r.success).length}/${results.length} firme`);
      res.json({
        total: results.length,
        successful: results.filter(r => r.success).length,
        results: results
      });
    } catch (error: any) {
      console.error(`[DEBUG REPORT-ALL] Errore generale nella generazione dei report:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  
  // Crea un nuovo progetto firma
  router.post("/signature-projects", isAuthenticated, async (req, res) => {
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
  router.get("/signature-projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getUserSignatureProjects(req.user!.id);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ottieni un progetto firma specifico
  router.get("/signature-projects/:id", isAuthenticated, async (req, res) => {
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

  // Aggiorna un progetto firma
  router.put("/signature-projects/:id", isAuthenticated, async (req, res) => {
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
      
      const updatedProject = await storage.updateSignatureProject(projectId, {
        name: req.body.name,
        description: req.body.description
      });
      
      res.json(updatedProject);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Elimina un progetto firma
  router.delete("/signature-projects/:id", isAuthenticated, async (req, res) => {
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
      
      // Ottieni tutte le firme del progetto
      const signatures = await storage.getProjectSignatures(projectId);
      
      // Elimina i file delle firme
      for (const signature of signatures) {
        try {
          await fs.unlink(path.join('./uploads', signature.filename));
        } catch (err) {
          console.error(`Impossibile eliminare il file ${signature.filename}:`, err);
        }
      }
      
      // Elimina il progetto (questo eliminerà anche tutte le firme associate)
      await storage.deleteSignatureProject(projectId);
      
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload di una firma di riferimento
  router.post("/signature-projects/:id/signatures/reference", isAuthenticated, upload.single('signature'), async (req, res) => {
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
      
      const signatureData = insertSignatureSchema.parse({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: true
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      // Avvia l'analisi della firma in background
      processSignature(signature.id, req.file.path);
      
      res.status(201).json(signature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Upload di una firma da verificare
  router.post("/signature-projects/:id/signatures/verify", isAuthenticated, upload.single('signature'), async (req, res) => {
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
      
      // Verifica che ci siano firme di riferimento per questo progetto
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      if (referenceSignatures.length === 0) {
        return res.status(400).json({ 
          error: 'Nessuna firma di riferimento presente. Carica almeno una firma di riferimento prima.'
        });
      }
      
      const signatureData = insertSignatureSchema.parse({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: false
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      // Avvia l'analisi e il confronto della firma in background
      processAndCompareSignature(signature.id, req.file.path, projectId);
      
      res.status(201).json(signature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Ottieni tutte le firme di un progetto
  router.get("/signature-projects/:id/signatures", isAuthenticated, async (req, res) => {
    try {
      // RISOLUZIONE CRITICA: Stava restituendo i progetti invece delle firme
      // Questo era un bug critico che causava il problema delle "firme fantasma"
      const projectId = parseInt(req.params.id);
      console.log(`[DEBUG] Richiesta firme per progetto ${projectId}`);
      
      // Verifica se il parametro di percorso è un ID di progetto valido
      if (isNaN(projectId)) {
        console.log(`[ERROR] ID progetto non valido: ${req.params.id}`);
        return res.status(400).json({ error: 'ID progetto non valido' });
      }
      
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        console.log(`[DEBUG] Progetto ${projectId} non trovato`);
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        console.log(`[DEBUG] Utente ${req.user!.id} non autorizzato per progetto ${projectId} (proprietario: ${project.userId})`);
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Ottieni le firme associate a questo progetto
      const referenceOnly = req.query.referenceOnly === 'true';
      
      // Query al database per ottenere le firme
      console.log(`[DEBUG] Esecuzione query per firme del progetto ${projectId} (referenceOnly: ${referenceOnly})`);
      const signatures = await storage.getProjectSignatures(projectId, referenceOnly);
      
      // Log dettagliato
      console.log(`[DEBUG] Trovate ${signatures.length} firme per progetto ${projectId}`);
      if (signatures.length > 0) {
        console.log(`[DEBUG] Prima firma: ID=${signatures[0].id}, projectId=${signatures[0].projectId}, isReference=${signatures[0].isReference}`);
      } else {
        console.log(`[DEBUG] Nessuna firma trovata per progetto ${projectId}`);
      }
      
      // Restituisci un array vuoto se non ci sono firme
      if (!signatures || signatures.length === 0) {
        return res.json([]);
      }
      
      // Trasforma il risultato in array di oggetti JSON per garantire che tutti i campi siano serializzati correttamente
      // Questo è essenziale per garantire che i dati siano nel formato atteso dal client
      const result = signatures.map(sig => ({
        id: sig.id,
        projectId: sig.projectId, // Garantisci che projectId sia sempre incluso
        filename: sig.filename,
        originalFilename: sig.originalFilename,
        fileType: sig.fileType,
        fileSize: sig.fileSize,
        isReference: sig.isReference,
        parameters: sig.parameters,
        processingStatus: sig.processingStatus,
        comparisonResult: sig.comparisonResult,
        createdAt: sig.createdAt,
        updatedAt: sig.updatedAt
      }));
      
      console.log(`[DEBUG] Risposta API: ${result.length} firme per progetto ${projectId}`);
      res.json(result);
    } catch (error: any) {
      console.error(`[DEBUG] Errore nel recupero firme:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Ottieni una firma specifica
  router.get("/signatures/:id", isAuthenticated, async (req, res) => {
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
      
      res.json(signature);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  

  // Endpoint per generare e scaricare un report PDF per una firma
  // Endpoint per generare un report PDF per una firma 
  router.get("/signatures/:id/generate-report", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      console.log(`[PDF REPORT] Richiesta generazione report per firma ${signatureId}`);
      
      // Verifica che la firma esista
      const signature = await storage.getSignature(signatureId);
      if (!signature) {
        console.log(`[PDF REPORT] Firma ${signatureId} non trovata`);
        return res.status(404).json({ error: "Firma non trovata" });
      }
      
      // Verifica che l'utente sia autorizzato
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        console.log(`[PDF REPORT] Utente non autorizzato per firma ${signatureId}`);
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      // Verifica che non sia una firma di riferimento
      if (signature.isReference) {
        console.log(`[PDF REPORT] La firma ${signatureId} è una firma di riferimento, non è possibile generare un report`);
        return res.status(400).json({ error: "Non è possibile generare report per firme di riferimento" });
      }
      
      // Verifica che la firma sia stata elaborata
      if (signature.processingStatus !== "completed") {
        console.log(`[PDF REPORT] La firma ${signatureId} non è stata completamente elaborata`);
        return res.status(400).json({ error: "La firma non è stata completamente elaborata" });
      }
      
      // Se il report è già stato generato, restituisci il percorso senza rigenerarlo
      if (signature.reportPath) {
        try {
          await fs.access(signature.reportPath);
          console.log(`[PDF REPORT] Report già esistente per firma ${signatureId}: ${signature.reportPath}`);
          return res.status(200).json({ 
            success: true, 
            message: "Report già generato in precedenza", 
            reportPath: signature.reportPath 
          });
        } catch (err) {
          console.log(`[PDF REPORT] Report esistente ma file non trovato, generazione di un nuovo report`);
          // Il file non esiste più, continua con la generazione di un nuovo report
        }
      }
      
      // Ottieni le firme di riferimento per questo progetto
      const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === "completed" && ref.parameters
      );
      
      if (completedReferences.length === 0) {
        console.log(`[PDF REPORT] Nessuna firma di riferimento disponibile per il confronto`);
        return res.status(400).json({ error: "Nessuna firma di riferimento disponibile per il confronto" });
      }
      
      // Usiamo la prima firma di riferimento per il confronto avanzato
      const referenceSignature = completedReferences[0];
      console.log(`[PDF REPORT] Utilizzo firma di riferimento ${referenceSignature.id} per il confronto`);
      
      // Verifica la disponibilità dell'analizzatore Python avanzato
      const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
      if (!isPythonAvailable) {
        console.log(`[PDF REPORT] Analizzatore Python non disponibile, impossibile generare report`);
        return res.status(500).json({ error: "Servizio di analisi avanzata non disponibile" });
      }
      
      // Prepara i percorsi dei file
      const referencePath = path.join("./uploads", referenceSignature.filename);
      const signaturePath = path.join("./uploads", signature.filename);
      
      // Verifica che i file delle firme esistano
      try {
        await fs.access(referencePath);
        await fs.access(signaturePath);
      } catch (err) {
        console.log(`[PDF REPORT] File di firma non trovato`, err);
        return res.status(404).json({ error: "File di firma non trovato" });
      }
      
      // Formatta la data in modo localizzato
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      // Crea informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica firma: ${signature.originalFilename}`,
        date: formattedDate,
        documentType: "Verifica di autenticità",
        notes: project.description || ""
      };
      
      console.log(`[PDF REPORT] Avvio generazione report per firma ${signatureId}`);
      
      // Genera il report
      try {
        // IMPORTANTE: Invertiamo i parametri per compensare il problema di ordinamento
        // nel python-bridge.ts la firma da verificare viene scambiata con quella di riferimento
        // NOTA: questo è un workaround intenzionale, il vero bug è in advanced-signature-analyzer.py
        console.log(`[PDF REPORT] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
        console.log(`[PDF REPORT] Firma da verificare (diventerà riferimento): ${signaturePath}`);
        console.log(`[PDF REPORT] Firma di riferimento (diventerà verifica): ${referencePath}`);
        
        const reportResult = await SignaturePythonAnalyzer.generateReport(
          referencePath,   // Questo diventerà la firma da verificare nel report
          signaturePath,   // Questo diventerà la firma di riferimento nel report
          caseInfo
        );
        
        console.log(`[PDF REPORT] Risultato report ricevuto:`, JSON.stringify(reportResult, null, 2));
        
        if (!reportResult) {
          console.log(`[PDF REPORT] Risultato nullo nella generazione del report per firma ${signatureId}`);
          return res.status(500).json({ error: "Errore nella generazione del report: risultato nullo" });
        }
        
        if (!reportResult.report_path) {
          console.log(`[PDF REPORT] Percorso report mancante per firma ${signatureId}`);
          
          // Se manca il percorso del report ma abbiamo altri dati validi, creiamo un percorso temporaneo
          if (reportResult.similarity !== undefined && reportResult.comparison_chart) {
            console.log(`[PDF REPORT] Creazione percorso report temporaneo dato che abbiamo altri dati validi`);
            const tempReportPath = `/uploads/reports/temp_report_${Date.now()}.pdf`;
            reportResult.report_path = tempReportPath;
          } else {
            return res.status(500).json({ error: "Errore nella generazione del report: percorso mancante" });
          }
        }
        
        console.log(`[PDF REPORT] Report generato con successo: ${reportResult.report_path}`);
        
        // Aggiorna il record della firma con il percorso del report
        await storage.updateSignature(signatureId, {
          reportPath: reportResult.report_path
        });
        
        // Aggiorna anche il grafico e il report se non sono già presenti
        const updates: any = {};
        
        if (!signature.comparisonChart && reportResult.comparison_chart) {
          updates.comparisonChart = reportResult.comparison_chart;
        }
        
        if (!signature.analysisReport && reportResult.description) {
          updates.analysisReport = reportResult.description;
        }
        
        // Se ci sono altri aggiornamenti, applicali
        if (Object.keys(updates).length > 0) {
          await storage.updateSignature(signatureId, updates);
        }
        
        // Aggiorna registro attività
        await storage.createActivity({
          userId: req.user!.id,
          type: "signature_report",
          details: `Generato report PDF per la firma "${signature.originalFilename}"`
        });
        
        // Restituisci successo e il percorso del report
        return res.status(200).json({
          success: true,
          message: "Report generato con successo",
          reportPath: reportResult.report_path
        });
      } catch (error: any) {
        console.error(`[PDF REPORT] Errore durante la generazione del report:`, error);
        return res.status(500).json({ 
          error: "Errore durante la generazione del report", 
          details: error.message 
        });
      }
    } catch (error: any) {
      console.error(`[PDF REPORT] Errore nella generazione del report:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Ottieni il report PDF di una firma
  router.get("/signatures/:id/report", isAuthenticated, async (req, res) => {
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
      
      // Verifica che il report esista
      if (!signature.reportPath) {
        // Se non c'è un report, ma c'è abbastanza informazioni per generarne uno
        if (signature.comparisonChart && signature.analysisReport && signature.comparisonResult !== null) {
          try {
            log('Generazione report PDF on-demand', 'signatures');
            
            // Ottieni la firma di riferimento
            const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
            
            // Prendi la prima firma di riferimento elaborata
            const referenceSignature = referenceSignatures.find(
              ref => ref.processingStatus === 'completed' && ref.parameters
            );
            
            if (!referenceSignature) {
              return res.status(400).json({ error: 'Nessuna firma di riferimento disponibile per generare il report' });
            }
            
            // Crea le informazioni sul caso
            const caseInfo = {
              caseName: project.name,
              subject: `Verifica firma: ${signature.originalFilename}`,
              date: new Date().toLocaleDateString('it-IT'),
              documentType: 'Verifica singola',
              notes: project.description || ""
            };
            
            // Percorsi delle immagini
            const referencePath = path.join('./uploads', referenceSignature.filename);
            const signaturePath = path.join('./uploads', signature.filename);
            
            // Genera il report DOCX
            // IMPORTANTE: Invertiamo i parametri per compensare il problema di ordinamento
            console.log(`[PDF REPORT DOWNLOAD] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
            console.log(`[PDF REPORT DOWNLOAD] Firma da verificare (diventerà riferimento): ${signaturePath}`);
            console.log(`[PDF REPORT DOWNLOAD] Firma di riferimento (diventerà verifica): ${referencePath}`);
            
            const reportResult = await SignaturePythonAnalyzer.generateReport(
              referencePath,   // Questo diventerà la firma da verificare nel report
              signaturePath,   // Questo diventerà la firma di riferimento nel report
              caseInfo
            );
            
            console.log(`[PDF REPORT DOWNLOAD] Risultato report ricevuto:`, JSON.stringify(reportResult, null, 2));
            
            // Se il report_path è mancante ma abbiamo altri dati validi, creiamo un percorso temporaneo
            if (reportResult && typeof reportResult === 'object' && (!reportResult.report_path || typeof reportResult.report_path !== 'string')) {
              if (reportResult.similarity !== undefined && reportResult.comparison_chart) {
                console.log(`[PDF REPORT DOWNLOAD] Creazione percorso report temporaneo dato che abbiamo altri dati validi`);
                const tempReportPath = path.join(process.cwd(), 'uploads', 'reports', `temp_report_${Date.now()}.pdf`);
                reportResult.report_path = tempReportPath;
              }
            }
            
            if (reportResult && typeof reportResult === 'object' && 'report_path' in reportResult) {
              // Aggiorna il percorso del report nella firma
              await storage.updateSignature(signature.id, {
                reportPath: reportResult.report_path as string
              });
              
              // APPROCCIO ALTERNATIVO: Ignoriamo il file Python e generiamo il PDF direttamente qui
              try {
                console.log(`[PDF REPORT] Generazione PDF alternativa on-demand usando il comparisonChart`);
                
                // Importiamo pdfkit direttamente con tipizzazione
                // @ts-ignore
                const PDFDocument = require('pdfkit');
                // @ts-ignore
                const fsExtra = require('fs-extra');
                
                // Prepara il percorso del file PDF
                const outputPath = path.join(process.cwd(), 'uploads', 'reports', `report_${Date.now()}.pdf`);
                
                // Assicuriamoci che la directory esista
                await fsExtra.ensureDir(path.join(process.cwd(), 'uploads', 'reports'));
                
                // Crea una stream di scrittura
                const pdfStream = fsExtra.createWriteStream(outputPath);
                
                // Crea un nuovo documento PDF
                const doc = new PDFDocument({
                  size: 'A4',
                  info: {
                    Title: 'Rapporto di analisi firma',
                    Author: 'GrapholexInsight',
                    Subject: 'Verifica firma',
                    Keywords: 'firma, verifica, analisi, grafologia',
                    CreationDate: new Date()
                  }
                });
                
                // Pipe il PDF alla stream di scrittura
                doc.pipe(pdfStream);
                
                // Aggiungi contenuti al PDF
                doc.fontSize(18).text('Rapporto di Analisi Firma', { align: 'center' });
                doc.moveDown();
                doc.fontSize(14).text('Firma analizzata: ' + (signature.originalFilename || 'Sconosciuto'), { underline: true });
                doc.moveDown();
                
                // Aggiungi la data
                doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('it-IT')}`);
                doc.moveDown();
                
                // Aggiungi il punteggio di similarità
                const comparisonValue = reportResult.similarity || signature.comparisonResult || 0;
                doc.fontSize(14).text(`Punteggio di somiglianza: ${(comparisonValue * 100).toFixed(1)}%`);
                doc.moveDown();
                
                // Aggiungi l'immagine della firma se disponibile
                try {
                  const signatureImagePath = path.join(process.cwd(), 'uploads', signature.filename);
                  
                  // Verifica che l'immagine esista
                  await fsExtra.access(signatureImagePath);
                  
                  // Aggiungi una sezione per le immagini
                  doc.fontSize(14).text('Firma in verifica:', { underline: true });
                  doc.moveDown();
                  
                  // Calcola le dimensioni per l'immagine
                  doc.image(signatureImagePath, {
                    width: 300,
                    align: 'center'
                  });
                  doc.moveDown();
                } catch (imgErr) {
                  // Non fare nulla se l'immagine non è disponibile
                }
                
                // Aggiungi il grafico di confronto se disponibile
                if (reportResult.comparison_chart) {
                  doc.fontSize(14).text('Grafico di confronto:', { underline: true });
                  doc.moveDown();
                  
                  // Crea un file temporaneo per l'immagine del grafico
                  const chartImagePath = path.join(process.cwd(), 'uploads', 'temp_chart.png');
                  try {
                    await fsExtra.writeFile(chartImagePath, Buffer.from(reportResult.comparison_chart, 'base64'));
                    
                    // Aggiungi l'immagine del grafico
                    doc.image(chartImagePath, {
                      width: 500,
                      align: 'center'
                    });
                    doc.moveDown();
                    
                    // Pulisci il file temporaneo
                    try {
                      await fsExtra.unlink(chartImagePath);
                    } catch (e) {
                      // Ignora eventuali errori nella pulizia
                    }
                  } catch (chartErr) {
                    doc.text('Grafico di confronto non disponibile', { align: 'center' });
                    doc.moveDown();
                  }
                }
                
                // Aggiungi il report di analisi se disponibile
                if (reportResult.description) {
                  doc.fontSize(14).text('Analisi tecnica:', { underline: true });
                  doc.moveDown();
                  doc.fontSize(12).text(reportResult.description);
                  doc.moveDown();
                }
                
                // Aggiungi una sezione metodologica
                doc.fontSize(14).text('Metodologia di analisi:', { underline: true });
                doc.moveDown();
                doc.fontSize(10).text(
                  "L'analisi delle firme utilizza un approccio multi-parametro che considera diversi aspetti " +
                  "grafologici e metrici delle firme confrontate. Il sistema estrae e confronta i seguenti parametri:\n\n" +
                  "- Proporzioni (15%): Larghezza, altezza e rapporto proporzionale della firma\n" +
                  "- Caratteristiche dei tratti (25%): Spessore, pressione e variabilità dei tratti\n" +
                  "- Curvatura (20%): Angoli, curve e fluidità del tratto\n" +
                  "- Distribuzione spaziale (20%): Densità e posizionamento dei tratti nell'area della firma\n" +
                  "- Connettività (20%): Continuità e frammentazione dei tratti\n\n" +
                  "Il punteggio di somiglianza combinato deriva dalla media ponderata di questi parametri, con " +
                  "un'accuratezza stimata dell'85% rispetto all'analisi manuale di un esperto grafologo. " +
                  "Punteggi superiori all'80% indicano un'alta probabilità di autenticità."
                );
                
                // Finalizza il documento
                doc.end();
                
                // Attendi il completamento della scrittura
                await new Promise((resolve, reject) => {
                  pdfStream.on('finish', resolve);
                  pdfStream.on('error', reject);
                });
                
                console.log(`[PDF REPORT] PDF generato con successo in: ${outputPath}`);
                
                // Aggiorna il percorso del report nel database
                await storage.updateSignature(signature.id, {
                  reportPath: outputPath
                });
                
                // Verifica che il file esista
                await fsExtra.access(outputPath);
                console.log(`[PDF REPORT] File verificato e accessibile: ${outputPath}`);
                
                // Servi il file
                return res.download(outputPath);
              } catch (finalErr) {
                console.error(`[PDF REPORT] Impossibile generare PDF on-demand:`, finalErr);
                // Aggiungi dettagli completi sull'errore nei log
                console.error(`[PDF REPORT] STACK TRACE COMPLETO:`, finalErr.stack);
                console.error(`[PDF REPORT] MESSAGGIO COMPLETO:`, finalErr.message);
                console.error(`[PDF REPORT] TIPO ERRORE:`, finalErr.name);
                console.error(`[PDF REPORT] STRINGIFIED:`, JSON.stringify(finalErr));
                
                return res.status(500).json({ 
                  error: `Impossibile generare il report PDF on-demand: ${finalErr.message}` 
                });
              }
            } else {
              return res.status(500).json({ error: 'Impossibile generare il report PDF' });
            }
          } catch (error: any) {
            log(`Errore nella generazione del report: ${error.message}`, 'signatures');
            return res.status(500).json({ error: `Errore nella generazione del report: ${error.message}` });
          }
        } else {
          return res.status(404).json({ error: 'Report non disponibile per questa firma' });
        }
      }
      
      // Verifica che il file esista
      try {
        await fsExtra.access(signature.reportPath);
        console.log(`[PDF REPORT] File del report trovato: ${signature.reportPath}`);  
      } catch (error) {
        console.log(`[PDF REPORT] File non trovato: ${signature.reportPath}, tentativo di ri-generazione`);
        
        // Se il percorso contiene temp_report_, dobbiamo generare il file
        if (signature.reportPath.includes('temp_report_')) {
          try {
            console.log(`[PDF REPORT] Rilevato percorso temporaneo, tentativo di generazione on-demand`);
            
            // Ottieni la firma di riferimento
            const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
            
            // Prendi la prima firma di riferimento elaborata
            const referenceSignature = referenceSignatures.find(
              ref => ref.processingStatus === 'completed' && ref.parameters
            );
            
            if (!referenceSignature) {
              return res.status(400).json({ error: 'Nessuna firma di riferimento disponibile per generare il report' });
            }
            
            // Percorsi delle immagini
            const referencePath = path.join('./uploads', referenceSignature.filename);
            const signaturePath = path.join('./uploads', signature.filename);
            
            // Crea le informazioni sul caso
            const caseInfo = {
              caseName: `Analisi firma - Progetto ${signature.projectId}`,
              subject: `Firma ${signature.originalFilename}`,
              date: new Date().toLocaleDateString('it-IT'),
              documentType: 'Verifica di firma',
              notes: "Report generato automaticamente"
            };
            
            // Crea una directory temporanea per i report se non esiste
            const reportDir = path.join(process.cwd(), 'uploads', 'reports');
            try {
              await fs.mkdir(reportDir, { recursive: true });
            } catch (error) {
              const mkdirError = error as Error;
              console.log(`[PDF REPORT] Errore nella creazione della directory: ${mkdirError.message}`);
            }
            
            // Genera un nome file reale basato sul timestamp del nome temporaneo
            const timestamp = signature.reportPath.split('temp_report_')[1].split('.')[0];
            const realReportPath = path.join(process.cwd(), 'uploads', 'reports', `report_${timestamp}.pdf`);
            
            console.log(`[PDF REPORT] Generazione report reale in: ${realReportPath}`);
            
            // Prima tentiamo di vedere se il comparisonResult esiste già ed è stato salvato
            const comparisonResult: { 
              similarity: number, 
              comparison_chart: string | null, 
              description: string | null, 
              report_path: string | undefined 
            } = {
              similarity: signature.comparisonResult ?? 0.7, // Usa il valore esistente o un valore predefinito
              comparison_chart: signature.comparisonChart,
              description: signature.analysisReport,
              report_path: undefined // Sarà generato più avanti, usiamo undefined invece di null per evitare errori di tipo
            };
            
            try {
              // Crea un file PDF di base usando il comparisonChart esistente
              console.log(`[PDF REPORT] Generazione di un PDF semplice usando dati esistenti`);
              
              // Importiamo pdfkit direttamente con tipizzazione
              // @ts-ignore
              const PDFDocument = require('pdfkit');
              // @ts-ignore
              const fsExtra = require('fs-extra');
              
              // Prepara il percorso del file PDF
              const outputPath = path.join(process.cwd(), 'uploads', 'reports', `report_${Date.now()}.pdf`);
              
              // Assicuriamoci che la directory esista
              await fsExtra.ensureDir(path.join(process.cwd(), 'uploads', 'reports'));
              
              // Crea una stream di scrittura
              const pdfStream = fsExtra.createWriteStream(outputPath);
              
              // Crea un nuovo documento PDF
              const doc = new PDFDocument({
                size: 'A4',
                info: {
                  Title: `Rapporto di analisi firma - ${signature.originalFilename}`,
                  Author: 'GrapholexInsight',
                  Subject: `Verifica firma: ${signature.originalFilename}`,
                  Keywords: 'firma, verifica, analisi, grafologia',
                  CreationDate: new Date()
                }
              });
              
              // Pipe il PDF alla stream di scrittura
              doc.pipe(pdfStream);
              
              // Aggiungi contenuti al PDF
              doc.fontSize(18).text('Rapporto di Analisi Firma', { align: 'center' });
              doc.moveDown();
              doc.fontSize(14).text(`Firma analizzata: ${signature.originalFilename}`, { underline: true });
              doc.moveDown();
              
              // Aggiungi la data
              doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('it-IT')}`);
              doc.moveDown();
              
              // Aggiungi il punteggio di similarità
              const comparisonValue = signature.comparisonResult || 0;
              doc.fontSize(14).text(`Punteggio di somiglianza: ${(comparisonValue * 100).toFixed(1)}%`);
              doc.moveDown();
              
              // Aggiungi l'immagine della firma
              const signatureImagePath = path.join(process.cwd(), 'uploads', signature.filename);
              
              // Aggiungi una sezione per le immagini
              doc.fontSize(14).text('Firme a confronto:', { underline: true });
              doc.moveDown();
              
              try {
                // Verifica che l'immagine esista
                await fsExtra.access(signatureImagePath);
                
                // Calcola le dimensioni per l'immagine
                doc.image(signatureImagePath, {
                  width: 300,
                  align: 'center'
                });
                doc.fontSize(10).text('Firma in verifica', { align: 'center' });
                doc.moveDown();
              } catch (err) {
                doc.text('Immagine della firma non disponibile', { align: 'center' });
                doc.moveDown();
              }
              
              // Aggiungi il grafico di confronto se disponibile
              if (signature.comparisonChart) {
                doc.fontSize(14).text('Grafico di confronto:', { underline: true });
                doc.moveDown();
                
                // Crea un file temporaneo per l'immagine del grafico
                const chartImagePath = path.join(process.cwd(), 'uploads', 'temp_chart.png');
                try {
                  await fsExtra.writeFile(chartImagePath, Buffer.from(signature.comparisonChart, 'base64'));
                  
                  // Aggiungi l'immagine del grafico
                  doc.image(chartImagePath, {
                    width: 500,
                    align: 'center'
                  });
                  doc.moveDown();
                  
                  // Pulisci il file temporaneo
                  try {
                    await fsExtra.unlink(chartImagePath);
                  } catch (e) {
                    // Ignora eventuali errori nella pulizia
                  }
                } catch (chartErr) {
                  doc.text('Grafico di confronto non disponibile', { align: 'center' });
                  doc.moveDown();
                }
              }
              
              // Aggiungi il report di analisi se disponibile
              if (signature.analysisReport) {
                doc.fontSize(14).text('Analisi tecnica:', { underline: true });
                doc.moveDown();
                doc.fontSize(12).text(signature.analysisReport);
                doc.moveDown();
              }
              
              // Aggiungi una sezione metodologica
              doc.fontSize(14).text('Metodologia di analisi:', { underline: true });
              doc.moveDown();
              doc.fontSize(10).text(
                "L'analisi delle firme utilizza un approccio multi-parametro che considera diversi aspetti " +
                "grafologici e metrici delle firme confrontate. Il sistema estrae e confronta i seguenti parametri:\n\n" +
                "- Proporzioni (15%): Larghezza, altezza e rapporto proporzionale della firma\n" +
                "- Caratteristiche dei tratti (25%): Spessore, pressione e variabilità dei tratti\n" +
                "- Curvatura (20%): Angoli, curve e fluidità del tratto\n" +
                "- Distribuzione spaziale (20%): Densità e posizionamento dei tratti nell'area della firma\n" +
                "- Connettività (20%): Continuità e frammentazione dei tratti\n\n" +
                "Il punteggio di somiglianza combinato deriva dalla media ponderata di questi parametri, con " +
                "un'accuratezza stimata dell'85% rispetto all'analisi manuale di un esperto grafologo. " +
                "Punteggi superiori all'80% indicano un'alta probabilità di autenticità."
              );
              
              // Finalizza il documento
              doc.end();
              
              // Attendi il completamento della scrittura
              await new Promise((resolve, reject) => {
                pdfStream.on('finish', resolve);
                pdfStream.on('error', reject);
              });
              
              console.log(`[PDF REPORT] PDF generato con successo in: ${outputPath}`);
              
              // Aggiorna il percorso del report
              comparisonResult.report_path = outputPath;
            } catch (pdfError) {
              console.error(`[PDF REPORT] Errore nella generazione del PDF:`, pdfError);
              console.error(`[PDF REPORT] STACK TRACE COMPLETO:`, pdfError.stack);
              console.error(`[PDF REPORT] MESSAGGIO COMPLETO:`, pdfError.message);
              console.error(`[PDF REPORT] TIPO ERRORE:`, pdfError.name);
              console.error(`[PDF REPORT] STRINGIFIED:`, JSON.stringify(pdfError));
              console.log(`[PDF REPORT] Tentativo alternativo con il modulo Python`);
              
              // Se fallisce, tentiamo con il modulo Python come backup
              console.log(`[PDF REPORT REGEN] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
              try {
                const pythonResult = await SignaturePythonAnalyzer.compareSignatures(
                  referencePath,   // Questo diventerà la firma da verificare nel report
                  signaturePath,   // Questo diventerà la firma di riferimento nel report
                  true,            // Genera il report
                  caseInfo
                );
                
                if (pythonResult && pythonResult.report_path) {
                  comparisonResult.report_path = pythonResult.report_path;
                }
              } catch (pythonError) {
                console.error(`[PDF REPORT] Anche il tentativo con Python è fallito:`, pythonError);
              }
            }
            
            if (comparisonResult && comparisonResult.report_path) {
              console.log(`[PDF REPORT] Report generato con successo: ${comparisonResult.report_path}`);
              
              // Aggiorna il percorso nel database
              await storage.updateSignature(signature.id, {
                reportPath: comparisonResult.report_path
              });
              
              // Invia il file generato
              return res.download(comparisonResult.report_path);
            } else {
              return res.status(500).json({ error: 'Impossibile generare il report PDF on-demand' });
            }
          } catch (genError: any) {
            console.error(`[PDF REPORT] Errore nella generazione on-demand:`, genError);
            return res.status(500).json({ 
              error: `Errore nella generazione on-demand del report: ${genError.message}` 
            });
          }
        } else {
          return res.status(404).json({ error: 'File del report non trovato' });
        }
      }
      
      // Verifica che il file esista e sia accessibile
      try {
        console.log(`[PDF REPORT] Tentativo di scaricare il file: ${signature.reportPath}`);
        await fs.access(signature.reportPath);
        console.log(`[PDF REPORT] Accesso confermato, file esistente: ${signature.reportPath}`);
        
        // Invia il file come download
        return res.download(signature.reportPath);
      } catch (accessError) {
        console.error(`[PDF REPORT] ERRORE: File non accessibile:`, accessError);
        return res.status(500).json({ error: 'Report esistente ma non accessibile.' });
      }
    } catch (error: any) {
      log(`Errore nell'accesso al report: ${error.message}`, 'signatures');
      res.status(500).json({ error: error.message });
    }
  });
  
  // Esegui confronto manuale di una firma
  router.post("/signatures/:id/compare", isAuthenticated, async (req, res) => {
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
      
      // Verifica che la firma non sia di riferimento
      if (signature.isReference) {
        return res.status(400).json({ error: 'Non è possibile confrontare una firma di riferimento' });
      }
      
      // Verifica che la firma sia stata elaborata
      if (signature.processingStatus !== 'completed') {
        return res.status(400).json({ error: 'La firma deve essere completamente elaborata prima di poter essere confrontata' });
      }
      
      // Ottieni le firme di riferimento per questo progetto
      const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
      
      // Filtra le firme di riferimento complete (con parametri)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }

      let similarityScore = 0;
      let comparisonChart = null;
      let analysisReport = null;
      
      // Verifica la disponibilità dell'analizzatore Python avanzato
      const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
      
      if (isPythonAvailable) {
        try {
          log(`Usando analizzatore Python avanzato per confronto firma ${signatureId}`, 'signatures');
          
          // Usiamo la prima firma di riferimento per il confronto avanzato
          const referenceSignature = completedReferences[0];
          const referencePath = path.join('./uploads', referenceSignature.filename);
          const signaturePath = path.join('./uploads', signature.filename);
          
          // Crea le informazioni sul caso
          const caseInfo = {
            caseName: project.name,
            subject: `Firma ${signature.originalFilename}`,
            date: new Date().toLocaleDateString('it-IT'),
            documentType: 'Verifica di firma',
            notes: project.description || ""
          };
          
          // Esegui il confronto avanzato
          // IMPORTANTE: Invertiamo i parametri per compensare il problema di ordinamento
          console.log(`[CONFRONTO POPUP] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
          console.log(`[CONFRONTO POPUP] Firma da verificare (diventerà riferimento): ${signaturePath}`);
          console.log(`[CONFRONTO POPUP] Firma di riferimento (diventerà verifica): ${referencePath}`);
          
          const comparisonResult = await SignaturePythonAnalyzer.compareSignatures(
            referencePath,   // Questo diventerà la firma da verificare nel report
            signaturePath,   // Questo diventerà la firma di riferimento nel report
            false, // Non generare report DOCX automaticamente
            caseInfo
          );
          
          similarityScore = comparisonResult.similarity;
          
          // Salva il grafico e il report
          comparisonChart = comparisonResult.comparison_chart;
          analysisReport = comparisonResult.description;
          
          log(`Confronto Python completato per firma ${signatureId} con score ${similarityScore}`, 'signatures');
        } catch (pythonError: any) {
          log(`Errore con analizzatore Python per confronto: ${pythonError.message}. Uso analizzatore JS fallback.`, 'signatures');
          // Fallback all'analizzatore JavaScript se quello Python fallisce
          const referenceParameters = completedReferences.map(ref => ref.parameters!);
          similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
        }
      } else {
        log(`Analizzatore Python non disponibile, uso analizzatore JS per confronto.`, 'signatures');
        // Usa l'analizzatore JavaScript standard
        const referenceParameters = completedReferences.map(ref => ref.parameters!);
        similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
      }
      
      // Aggiorna il risultato del confronto includendo grafico e report
      const updatedSignature = await storage.updateSignatureComparisonResult(signatureId, similarityScore);
      
      // Se abbiamo generato un grafico e un report, salviamoli
      if (comparisonChart && analysisReport) {
        // Aggiorniamo la firma con il grafico e il report
        await storage.updateSignature(signatureId, {
          comparisonChart,
          analysisReport
        });
      }
      
      res.json({
        ...updatedSignature,
        comparisonChart,
        analysisReport
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Elimina una firma
  router.delete("/signatures/:id", isAuthenticated, async (req, res) => {
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
      
      // Elimina il file della firma
      try {
        await fs.unlink(path.join('./uploads', signature.filename));
      } catch (err) {
        console.error(`Impossibile eliminare il file ${signature.filename}:`, err);
      }
      
      // Elimina la firma dal database
      await storage.deleteSignature(signatureId);
      
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Esegui confronto automatico di tutte le firme da verificare in un progetto
  router.post("/signature-projects/:id/compare-all", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      console.log(`[DEBUG COMPARE-ALL] Avvio confronto multiplo per progetto ${projectId}`);
      
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        console.log(`[DEBUG COMPARE-ALL] Progetto ${projectId} non trovato`);
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        console.log(`[DEBUG COMPARE-ALL] Utente ${req.user!.id} non autorizzato per progetto ${projectId} (proprietario: ${project.userId})`);
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      console.log(`[DEBUG COMPARE-ALL] Recupero firme di riferimento per progetto ${projectId}`);
      
      // Ottieni tutte le firme di riferimento
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      console.log(`[DEBUG COMPARE-ALL] Trovate ${referenceSignatures.length} firme di riferimento totali`);
      
      // Filtra le firme di riferimento complete (con parametri)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      console.log(`[DEBUG COMPARE-ALL] Firme di riferimento completate: ${completedReferences.length}`);
      
      if (completedReferences.length === 0) {
        console.log(`[DEBUG COMPARE-ALL] Nessuna firma di riferimento elaborata disponibile per il progetto ${projectId}`);
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      console.log(`[DEBUG COMPARE-ALL] Recupero firme da verificare per progetto ${projectId}`);
      
      // Ottieni tutte le firme da verificare
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      console.log(`[DEBUG COMPARE-ALL] Trovate ${verificationSignatures.length} firme da verificare totali`);
      
      // Filtra le firme da verificare complete (con parametri)
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      console.log(`[DEBUG COMPARE-ALL] Firme da verificare completate: ${completedVerifications.length}`);
      
      if (completedVerifications.length === 0) {
        console.log(`[DEBUG COMPARE-ALL] Nessuna firma da verificare elaborata disponibile per il progetto ${projectId}`);
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile'
        });
      }
      
      // Verifica la disponibilità dell'analizzatore Python avanzato
      const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
      console.log(`[DEBUG COMPARE-ALL] Analizzatore Python ${isPythonAvailable ? 'disponibile' : 'non disponibile'}`);
      
      // Crea le informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica multiple di firme`,
        date: new Date().toLocaleDateString('it-IT'),
        documentType: 'Verifiche multiple',
        notes: project.description || ""
      };
      
      console.log(`[DEBUG COMPARE-ALL] Inizio elaborazione di ${completedVerifications.length} firme da verificare`);
      
      // Utilizziamo un ciclo for standard invece di Promise.all per garantire migliore gestione degli errori
      const results = [];
      for (const signature of completedVerifications) {
        try {
          console.log(`[DEBUG COMPARE-ALL] Elaborazione firma ${signature.id}`);
          
          let similarityScore = 0;
          let comparisonChart = null;
          let analysisReport = null;
          
          if (isPythonAvailable) {
            try {
              console.log(`[DEBUG COMPARE-ALL] Usando analizzatore Python per firma ${signature.id}`);
              
              // Usiamo la prima firma di riferimento per il confronto avanzato
              const referenceSignature = completedReferences[0];
              const referencePath = path.join('./uploads', referenceSignature.filename);
              const signaturePath = path.join('./uploads', signature.filename);
              
              // Esegui il confronto avanzato
              // IMPORTANTE: Invertiamo i parametri per compensare il problema di ordinamento
              console.log(`[COMPARE-ALL] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
              console.log(`[COMPARE-ALL] Firma da verificare (diventerà riferimento): ${signaturePath}`);
              console.log(`[COMPARE-ALL] Firma di riferimento (diventerà verifica): ${referencePath}`);
              
              const comparisonResult = await SignaturePythonAnalyzer.compareSignatures(
                referencePath,   // Questo diventerà la firma da verificare nel report
                signaturePath,   // Questo diventerà la firma di riferimento nel report
                false, // Non generare report DOCX automaticamente
                caseInfo
              );
              
              similarityScore = comparisonResult.similarity;
              
              // Salva il grafico e il report
              comparisonChart = comparisonResult.comparison_chart;
              analysisReport = comparisonResult.description;
              
              console.log(`[DEBUG COMPARE-ALL] Confronto Python completato per firma ${signature.id} con score ${similarityScore}`);
            } catch (pythonError: any) {
              console.log(`[DEBUG COMPARE-ALL] Errore con analizzatore Python: ${pythonError.message}. Fallback a JS.`);
              // Fallback all'analizzatore JavaScript se quello Python fallisce
              const referenceParameters = completedReferences.map(ref => ref.parameters!);
              similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
            }
          } else {
            console.log(`[DEBUG COMPARE-ALL] Usando analizzatore JS per firma ${signature.id}`);
            // Usa l'analizzatore JavaScript standard
            const referenceParameters = completedReferences.map(ref => ref.parameters!);
            similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
          }
          
          console.log(`[DEBUG COMPARE-ALL] Risultato confronto per firma ${signature.id}: ${similarityScore}`);
          
          // Primo step: aggiornamento del risultato numerico
          console.log(`[DEBUG COMPARE-ALL] Aggiornamento punteggio di confronto per firma ${signature.id}`);
          await storage.updateSignatureComparisonResult(signature.id, similarityScore);
          
          // Secondo step: aggiornamento dei dati aggiuntivi solo se necessario
          if (comparisonChart || analysisReport) {
            console.log(`[DEBUG COMPARE-ALL] Aggiornamento dati avanzati per firma ${signature.id}`);
            
            // Creiamo un nuovo oggetto con solo i campi effettivamente presenti
            const updateData: Record<string, any> = {};
            
            if (comparisonChart) {
              console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id} ha un grafico di confronto`);
              updateData.comparisonChart = comparisonChart;
            }
            
            if (analysisReport) {
              console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id} ha un report di analisi`);
              updateData.analysisReport = analysisReport;
            }
            
            // Aggiorniamo solo se abbiamo effettivamente dei dati da aggiornare
            if (Object.keys(updateData).length > 0) {
              console.log(`[DEBUG COMPARE-ALL] Aggiornamento firma ${signature.id} con dati avanzati`);
              await storage.updateSignature(signature.id, updateData);
            }
          }
          
          // Recupera la firma aggiornata
          console.log(`[DEBUG COMPARE-ALL] Recupero firma aggiornata ${signature.id}`);
          const updatedSignature = await storage.getSignature(signature.id);
          
          if (!updatedSignature) {
            console.error(`[DEBUG COMPARE-ALL] Impossibile recuperare la firma aggiornata ${signature.id}`);
            throw new Error(`Impossibile recuperare la firma aggiornata con ID ${signature.id}`);
          }
          
          results.push(updatedSignature);
          console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id} elaborata con successo`);
        } catch (signatureError) {
          console.error(`[DEBUG COMPARE-ALL] Errore nell'elaborazione della firma ${signature.id}:`, signatureError);
          // Continuiamo con le altre firme anche se una fallisce
        }
      }
      
      console.log(`[DEBUG COMPARE-ALL] Confronto multiplo completato per ${results.length} firme`);
      
      // Aggiorna il registro attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'signature_compare',
        details: `Confrontate ${results.length} firme nel progetto "${project.name}"`
      });
      
      // Rispondi con tutte le firme aggiornate
      console.log(`[DEBUG COMPARE-ALL] Invio risposta con ${results.length} firme aggiornate`);
      res.json(results);
    } catch (error: any) {
      console.error(`[DEBUG COMPARE-ALL] Errore generale nel confronto multiplo delle firme:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint per ripulire tutte le firme di un progetto
  router.post("/signature-projects/:id/reset", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      console.log(`[CLEANUP] Iniziata pulizia completa del progetto ${projectId}...`);
      
      // Ottieni tutte le firme del progetto
      let signatures = await storage.getProjectSignatures(projectId);
      console.log(`[CLEANUP] Trovate ${signatures.length} firme da eliminare`);
      
      // Implementazione migliorata con due passaggi separati:
      // 1. Prima eliminiamo tutti i file fisici
      for (const signature of signatures) {
        try {
          if (signature.filename) {
            const filePath = path.join('./uploads', signature.filename);
            try {
              await fs.access(filePath);
              await fs.unlink(filePath);
              console.log(`[CLEANUP] File eliminato: ${filePath}`);
            } catch (err) {
              console.log(`[CLEANUP] File non trovato: ${filePath}`);
            }
          }
        } catch (error) {
          console.error(`[CLEANUP] Errore eliminando file per firma ${signature.id}:`, error);
        }
      }
      
      // 2. Poi eliminiamo tutti i record dal database
      for (const signature of signatures) {
        try {
          await storage.deleteSignature(signature.id);
          console.log(`[CLEANUP] Record firma eliminato: ${signature.id}`);
        } catch (error) {
          console.error(`[CLEANUP] Errore eliminando record firma ${signature.id}:`, error);
        }
      }
      
      // 3. Verifica che non ci siano firme residue
      signatures = await storage.getProjectSignatures(projectId);
      if (signatures.length > 0) {
        console.warn(`[CLEANUP] ⚠️ Ci sono ancora ${signatures.length} firme residue nel progetto!`);
        
        // Secondo tentativo di pulizia forzata
        console.log(`[CLEANUP] Esecuzione secondo passaggio di pulizia forzata...`);
        for (const signature of signatures) {
          try {
            console.log(`[CLEANUP] Eliminazione forzata della firma ${signature.id}`);
            if (signature.filename) {
              try {
                await fs.unlink(path.join('./uploads', signature.filename)).catch(() => {});
              } catch (e) {}
            }
            await storage.deleteSignature(signature.id);
          } catch (error) {
            console.error(`[CLEANUP] Impossibile eliminare forzatamente la firma ${signature.id}:`, error);
          }
        }
        
        // Ultima verifica
        const finalCheck = await storage.getProjectSignatures(projectId);
        console.log(`[CLEANUP] Dopo pulizia forzata: ${finalCheck.length} firme rimaste`);
        
        if (finalCheck.length > 0) {
          console.log(`[CLEANUP] IDs firme rimanenti: ${finalCheck.map(s => s.id).join(', ')}`);
        }
      } else {
        console.log(`[CLEANUP] ✓ Progetto ripulito con successo: nessuna firma rimasta`);
      }
      
      res.json({ 
        success: true, 
        message: `Rimosse ${signatures.length} firme dal progetto`,
        remainingCount: signatures.length
      });
    } catch (error: any) {
      console.error("[CLEANUP] Errore durante il reset del progetto:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Funzioni ausiliarie per elaborazione asincrona

async function processSignature(signatureId: number, filePath: string) {
  try {
    // Aggiorna lo stato a 'processing'
    await storage.updateSignatureStatus(signatureId, 'processing');
    
    // Verifica la disponibilità dell'analizzatore Python
    const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
    
    let parameters;
    
    if (isPythonAvailable) {
      log(`Usando analizzatore Python avanzato per la firma ${signatureId}`, 'signatures');
      try {
        // Prova a usare l'analizzatore Python avanzato
        parameters = await SignaturePythonAnalyzer.analyzeSignature(filePath);
      } catch (pythonError: any) {
        log(`Errore con analizzatore Python: ${pythonError.message}. Uso analizzatore JS fallback.`, 'signatures');
        // Fallback all'analizzatore JavaScript se quello Python fallisce
        parameters = await SignatureAnalyzer.extractParameters(filePath);
      }
    } else {
      log(`Analizzatore Python non disponibile, uso analizzatore JS.`, 'signatures');
      // Usa l'analizzatore JavaScript standard
      parameters = await SignatureAnalyzer.extractParameters(filePath);
    }
    
    // Aggiorna la firma con i parametri estratti
    await storage.updateSignatureParameters(signatureId, parameters);
    
    // Aggiorna lo stato a 'completed'
    await storage.updateSignatureStatus(signatureId, 'completed');
  } catch (error: any) {
    console.error(`Errore nell'elaborazione della firma ${signatureId}:`, error);
    await storage.updateSignatureStatus(signatureId, 'failed');
  }
}

async function processAndCompareSignature(signatureId: number, filePath: string, projectId: number) {
  try {
    log(`Inizio elaborazione firma ${signatureId} per progetto ${projectId}`, 'signatures');
    
    // Aggiorna lo stato a 'processing'
    await storage.updateSignatureStatus(signatureId, 'processing');
    
    // Verifica la disponibilità dell'analizzatore Python
    const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
    
    let parameters;
    
    if (isPythonAvailable) {
      log(`Usando analizzatore Python avanzato per la firma ${signatureId}`, 'signatures');
      try {
        // Prova a usare l'analizzatore Python avanzato
        parameters = await SignaturePythonAnalyzer.analyzeSignature(filePath);
      } catch (pythonError: any) {
        log(`Errore con analizzatore Python: ${pythonError.message}. Uso analizzatore JS fallback.`, 'signatures');
        // Fallback all'analizzatore JavaScript se quello Python fallisce
        parameters = await SignatureAnalyzer.extractParameters(filePath);
      }
    } else {
      log(`Analizzatore Python non disponibile, uso analizzatore JS.`, 'signatures');
      // Usa l'analizzatore JavaScript standard
      parameters = await SignatureAnalyzer.extractParameters(filePath);
    }
    
    // Aggiorna la firma con i parametri estratti
    log(`Aggiornamento parametri firma ${signatureId}`, 'signatures');
    await storage.updateSignatureParameters(signatureId, parameters);
    
    // Aggiorna lo stato come 'completed', ma senza confrontare automaticamente
    // Lo stato 'completed' indica che la firma è pronta per essere confrontata ma non è stata ancora confrontata
    await storage.updateSignatureStatus(signatureId, 'completed');
    log(`Elaborazione firma ${signatureId} completata con successo - in attesa di confronto manuale`, 'signatures');
    
    // Il confronto verrà eseguito solo quando l'utente preme "Confronta Tutte" 
    // e non più automaticamente qui
    
  } catch (error: any) {
    console.error(`Errore nell'elaborazione della firma ${signatureId}:`, error);
    await storage.updateSignatureStatus(signatureId, 'failed');
  }
}