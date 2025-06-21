import { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { 
  processDocumentForAnonymization,
  processUploadedFileForAnonymization,
  processFileWithPreExtractedData,
  getAnonymizationStatus,
  getUserAnonymizations,
  generateAnonymizedPDF,
  generateAnonymizedDOCX,
  DEFAULT_ENTITY_REPLACEMENTS
} from "./anonymization-service";
import { anonymizationRequestSchema } from "../shared/schema";
import { isValidFileType } from "./document-processor";

// Configurazione multer per upload file
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'temp');
    await fs.mkdir(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Sono accettati solo PDF, DOCX e TXT.'));
    }
  }
});

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function setupAnonymizationRoutes(app: Express) {
  
  // GET /api/anonymizations - Recupera tutte le anonimizzazioni dell'utente
  app.get('/api/anonymizations', requireAuth, async (req: Request, res: Response) => {
    try {
      const anonymizations = await getUserAnonymizations(req.user!.id);
      res.json(anonymizations);
    } catch (error) {
      console.error('Error fetching anonymizations:', error);
      res.status(500).json({ error: 'Failed to fetch anonymizations' });
    }
  });

  // GET /api/anonymizations/:id - Recupera lo stato di un'anonimizzazione specifica
  app.get('/api/anonymizations/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const anonymizationId = parseInt(req.params.id);
      if (isNaN(anonymizationId)) {
        return res.status(400).json({ error: 'Invalid anonymization ID' });
      }

      const anonymization = await getAnonymizationStatus(anonymizationId, req.user!.id);
      res.json(anonymization);
    } catch (error) {
      console.error('Error fetching anonymization status:', error);
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({ error: 'Anonymization not found' });
      } else if ((error as Error).message.includes('Unauthorized')) {
        res.status(403).json({ error: 'Unauthorized access' });
      } else {
        res.status(500).json({ error: 'Failed to fetch anonymization status' });
      }
    }
  });

  // POST /api/anonymize/document - Anonimizza un documento esistente
  app.post('/api/anonymize/document', requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = anonymizationRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validation.error.errors 
        });
      }

      const { documentId, entityReplacements, entityTypes } = validation.data;
      
      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required' });
      }

      const anonymizationId = await processDocumentForAnonymization(
        documentId,
        req.user!.id,
        entityReplacements,
        entityTypes
      );

      res.json({ 
        success: true,
        anonymizationId,
        message: 'Document anonymization started' 
      });
    } catch (error) {
      console.error('Error starting document anonymization:', error);
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({ error: 'Document not found' });
      } else if ((error as Error).message.includes('Unauthorized')) {
        res.status(403).json({ error: 'Unauthorized access to document' });
      } else {
        res.status(500).json({ error: 'Failed to start anonymization: ' + (error as Error).message });
      }
    }
  });

  // POST /api/anonymize/upload - Upload e anonimizza un file direttamente
  app.post('/api/anonymize/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
    let tempFilePath: string | null = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      tempFilePath = req.file.path;
      
      // Parse parametri di anonimizzazione
      let entityReplacements = DEFAULT_ENTITY_REPLACEMENTS;
      let entityTypes = Object.keys(DEFAULT_ENTITY_REPLACEMENTS);
      
      if (req.body.entityReplacements) {
        try {
          entityReplacements = JSON.parse(req.body.entityReplacements);
        } catch (e) {
          console.warn('Invalid entityReplacements JSON, using defaults');
        }
      }
      
      if (req.body.entityTypes) {
        try {
          entityTypes = JSON.parse(req.body.entityTypes);
        } catch (e) {
          console.warn('Invalid entityTypes JSON, using defaults');
        }
      }

      // Usa il testo già estratto dall'anteprima se disponibile
      const extractedText = req.body.extractedText;
      const detectedEntities = req.body.detectedEntities ? JSON.parse(req.body.detectedEntities) : null;
      
      let result: any;
      
      if (extractedText && detectedEntities) {
        // Usa dati pre-estratti dall'anteprima
        result = await processFileWithPreExtractedData(
          extractedText,
          detectedEntities,
          entityReplacements,
          entityTypes
        );
      } else {
        // Processa il file normalmente
        result = await processUploadedFileForAnonymization(
          req.file.path,
          req.file.originalname || 'document',
          req.file.mimetype,
          req.file.size,
          req.user!.id,
          entityReplacements,
          entityTypes
        );
      }

      // Genera file anonimizzato
      const uploadsDir = path.join(process.cwd(), 'uploads', 'anonymized');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      let outputFilename: string;
      let outputPath: string;
      
      if (req.file.mimetype === 'application/pdf') {
        outputFilename = `anonymized_${Date.now()}.pdf`;
        outputPath = path.join(uploadsDir, outputFilename);
        await generateAnonymizedPDF(result.anonymizedText, outputPath, req.file.originalname || 'document');
      } else {
        // Per tutti i file non-PDF, generiamo un file di testo formattato
        outputFilename = `anonymized_${Date.now()}.txt`;
        outputPath = path.join(uploadsDir, outputFilename);
        await generateAnonymizedDOCX(result.anonymizedText, outputPath, req.file.originalname || 'document');
      }

      res.json({
        success: true,
        anonymizedText: result.anonymizedText,
        detectedEntities: result.detectedEntities,
        downloadUrl: `/api/anonymize/download/${outputFilename}?token=${req.user!.id}`,
        filename: outputFilename,
        originalFilename: req.file.originalname
      });

    } catch (error) {
      console.error('Error processing uploaded file:', error);
      
      // Gestione specifica per errori PDF
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('PDF parsing failed') || errorMessage.includes('bad XRef entry')) {
        res.status(400).json({ 
          error: 'Il file PDF è corrotto o non può essere elaborato. Prova a utilizzare un PDF diverso o converti il documento in formato testo (.txt).',
          details: errorMessage
        });
      } else {
        res.status(500).json({ error: 'Errore durante l\'elaborazione: ' + errorMessage });
      }
    } finally {
      // Cleanup temp file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (e) {
          console.warn('Failed to cleanup temp file:', tempFilePath);
        }
      }
    }
  });

  // GET /api/anonymize/download/:filename - Download file anonimizzato
  app.get('/api/anonymize/download/:filename', async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const userToken = req.query.token;
      
      // Validazione nome file per sicurezza
      if (!/^anonymized_\d+\.(pdf|txt)$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      // Verifica token utente (semplificata per il download)
      if (!userToken) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const filePath = path.join(process.cwd(), 'uploads', 'anonymized', filename);
      
      // Verifica che il file esista
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Determina il content type
      const extension = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (extension === '.pdf') {
        contentType = 'application/pdf';
      } else if (extension === '.txt') {
        contentType = 'text/plain; charset=utf-8';
      } else if (extension === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileBuffer = await fs.readFile(filePath);
      res.send(fileBuffer);
      
    } catch (error) {
      console.error('Error downloading anonymized file:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });

  // POST /api/anonymize/preview - Anteprima anonimizzazione senza generare file
  app.post('/api/anonymize/preview', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
    let tempFilePath: string | null = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      tempFilePath = req.file.path;
      
      // Parse parametri di anonimizzazione
      let entityReplacements = DEFAULT_ENTITY_REPLACEMENTS;
      let entityTypes = Object.keys(DEFAULT_ENTITY_REPLACEMENTS);
      
      if (req.body.entityReplacements) {
        try {
          entityReplacements = JSON.parse(req.body.entityReplacements);
        } catch (e) {
          console.warn('Invalid entityReplacements JSON, using defaults');
        }
      }
      
      if (req.body.entityTypes) {
        try {
          entityTypes = JSON.parse(req.body.entityTypes);
        } catch (e) {
          console.warn('Invalid entityTypes JSON, using defaults');
        }
      }

      // Solo anteprima - non generare file
      const result = await processUploadedFileForAnonymization(
        req.file.path,
        req.file.originalname || 'document',
        req.file.mimetype,
        req.file.size,
        req.user!.id,
        entityReplacements,
        entityTypes
      );

      res.json({
        success: true,
        preview: true,
        originalText: result.originalText.substring(0, 1000) + (result.originalText.length > 1000 ? '...' : ''),
        anonymizedText: result.anonymizedText.substring(0, 1000) + (result.anonymizedText.length > 1000 ? '...' : ''),
        detectedEntities: result.detectedEntities,
        totalEntities: result.detectedEntities.length,
        originalFilename: req.file.originalname
      });

    } catch (error) {
      console.error('Error previewing anonymization:', error);
      
      // Gestione specifica per errori PDF
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('PDF parsing failed') || errorMessage.includes('bad XRef entry')) {
        res.status(400).json({ 
          error: 'Il file PDF è corrotto o non può essere elaborato. Prova a utilizzare un PDF diverso o converti il documento in formato testo (.txt).',
          details: errorMessage
        });
      } else {
        res.status(500).json({ error: 'Errore durante l\'anteprima: ' + errorMessage });
      }
    } finally {
      // Cleanup temp file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (e) {
          console.warn('Failed to cleanup temp file:', tempFilePath);
        }
      }
    }
  });

  // GET /api/anonymize/entity-types - Recupera i tipi di entità disponibili
  app.get('/api/anonymize/entity-types', requireAuth, (req: Request, res: Response) => {
    const entityTypes = [
      { key: 'PERSON', label: 'Nomi e cognomi', description: 'Nomi e cognomi di persone fisiche', defaultTag: '[NOME]' },
      { key: 'LOCATION', label: 'Luoghi', description: 'Città, province, regioni, paesi', defaultTag: '[CITTÀ]' },
      { key: 'EMAIL', label: 'Email', description: 'Indirizzi di posta elettronica', defaultTag: '[EMAIL]' },
      { key: 'PHONE', label: 'Telefoni', description: 'Numeri di telefono fissi e cellulari', defaultTag: '[TELEFONO]' },
      { key: 'ORGANIZATION', label: 'Organizzazioni', description: 'Nomi di aziende, enti, organizzazioni', defaultTag: '[ORGANIZZAZIONE]' },
      { key: 'DATE', label: 'Date', description: 'Date specifiche (non anni generici)', defaultTag: '[DATA]' },
      { key: 'ADDRESS', label: 'Indirizzi', description: 'Indirizzi completi con via e numero civico', defaultTag: '[INDIRIZZO]' },
      { key: 'POSTAL_CODE', label: 'CAP', description: 'Codici postali italiani', defaultTag: '[CAP]' },
      { key: 'FISCAL_CODE', label: 'Codici Fiscali', description: 'Codici fiscali italiani', defaultTag: '[CODICE_FISCALE]' },
      { key: 'VAT_NUMBER', label: 'Partite IVA', description: 'Partite IVA italiane', defaultTag: '[PARTITA_IVA]' },
      { key: 'MONEY', label: 'Importi', description: 'Importi in denaro e valute', defaultTag: '[IMPORTO]' },
      { key: 'CREDIT_CARD', label: 'Carte di Credito', description: 'Numeri di carte di credito', defaultTag: '[CARTA_CREDITO]' },
      { key: 'IBAN', label: 'IBAN', description: 'Codici IBAN bancari', defaultTag: '[IBAN]' }
    ];
    
    res.json({ entityTypes, defaultReplacements: DEFAULT_ENTITY_REPLACEMENTS });
  });
}