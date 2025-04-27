import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { SignatureAnalyzer } from "./signature-analyzer";
import { insertSignatureProjectSchema, insertSignatureSchema } from "@shared/schema";

// Configurazione di multer per gestire upload di immagini
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads');
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
      
      // Estrai i parametri delle firme di riferimento
      const referenceParameters = completedReferences.map(ref => ref.parameters!);
      
      // Esegui il confronto
      const similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
      
      // Aggiorna il risultato del confronto
      const updatedSignature = await storage.updateSignatureComparisonResult(signatureId, similarityScore);
      
      res.json(updatedSignature);
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
    
    // Estrai i parametri dalla firma
    const parameters = await SignatureAnalyzer.extractParameters(filePath);
    
    // Aggiorna la firma con i parametri estratti
    await storage.updateSignatureParameters(signatureId, parameters);
    
    // Aggiorna lo stato a 'completed'
    await storage.updateSignatureStatus(signatureId, 'completed');
  } catch (error) {
    console.error(`Errore nell'elaborazione della firma ${signatureId}:`, error);
    await storage.updateSignatureStatus(signatureId, 'failed');
  }
}

async function processAndCompareSignature(signatureId: number, filePath: string, projectId: number) {
  try {
    // Aggiorna lo stato a 'processing'
    await storage.updateSignatureStatus(signatureId, 'processing');
    
    // Estrai i parametri dalla firma
    const parameters = await SignatureAnalyzer.extractParameters(filePath);
    
    // Aggiorna la firma con i parametri estratti
    await storage.updateSignatureParameters(signatureId, parameters);
    
    // Ottieni tutte le firme di riferimento per questo progetto
    const referenceSignatures = await storage.getProjectSignatures(projectId, true);
    
    // Filtra le firme di riferimento complete (con parametri)
    const completedReferences = referenceSignatures.filter(
      ref => ref.processingStatus === 'completed' && ref.parameters
    );
    
    if (completedReferences.length === 0) {
      throw new Error('Nessuna firma di riferimento elaborata disponibile');
    }
    
    // Estrai i parametri delle firme di riferimento
    const referenceParameters = completedReferences.map(ref => ref.parameters!);
    
    // Confronta con le firme di riferimento
    const similarityScore = SignatureAnalyzer.compareSignatures(parameters, referenceParameters);
    
    // Aggiorna il risultato del confronto
    await storage.updateSignatureComparisonResult(signatureId, similarityScore);
    
  } catch (error) {
    console.error(`Errore nell'elaborazione e confronto della firma ${signatureId}:`, error);
    await storage.updateSignatureStatus(signatureId, 'failed');
  }
}