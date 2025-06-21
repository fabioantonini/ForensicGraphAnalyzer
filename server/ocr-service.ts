import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { log } from "./vite";

// Store per tracciare lo stato dei processi OCR
interface OCRProcessStatus {
  processId: string;
  progress: number;
  stage: string;
  completed: boolean;
  error?: string;
  result?: OCRResult;
}

const ocrProcesses = new Map<string, OCRProcessStatus>();

// Funzione per ottenere lo stato di un processo OCR
export function getOCRProcessStatus(processId: string): OCRProcessStatus | undefined {
  return ocrProcesses.get(processId);
}

// Funzione per aggiornare lo stato di un processo OCR
function updateOCRProcessStatus(processId: string, update: Partial<OCRProcessStatus>) {
  const current = ocrProcesses.get(processId);
  if (current) {
    ocrProcesses.set(processId, { ...current, ...update });
  }
}

// Funzione per processare OCR con progresso trackabile
export async function processOCRWithProgress(
  fileBuffer: Buffer,
  filename: string,
  settings: OCRSettings,
  processId: string
): Promise<void> {
  // Inizializza lo stato del processo
  ocrProcesses.set(processId, {
    processId,
    progress: 0,
    stage: 'Inizializzazione...',
    completed: false
  });

  try {
    const result = await processOCR(fileBuffer, filename, settings, (progress, stage) => {
      updateOCRProcessStatus(processId, { progress, stage });
    });

    // Segna come completato con risultato
    updateOCRProcessStatus(processId, {
      progress: 100,
      stage: 'Completato!',
      completed: true,
      result
    });

    // Cleanup dopo 5 minuti
    setTimeout(() => {
      ocrProcesses.delete(processId);
    }, 5 * 60 * 1000);

  } catch (error: any) {
    updateOCRProcessStatus(processId, {
      progress: 0,
      stage: 'Errore',
      completed: true,
      error: error.message
    });

    // Cleanup dopo 1 minuto in caso di errore
    setTimeout(() => {
      ocrProcesses.delete(processId);
    }, 60 * 1000);
  }
}

// Configurazione multer per upload OCR
export const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/tiff',
      'image/bmp',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato per OCR'));
    }
  }
});

interface OCRSettings {
  language: string;
  dpi: number;
  preprocessingMode: string;
  outputFormat: string;
}

interface OCRResult {
  extractedText: string;
  confidence: number;
  language: string;
  processingTime: number;
  pageCount?: number;
}

// Processamento OCR reale con Tesseract.js e callback per progresso
export async function processOCR(
  fileBuffer: Buffer,
  filename: string,
  settings: OCRSettings,
  progressCallback?: (progress: number, stage: string) => void
): Promise<OCRResult> {
  const startTime = Date.now();
  
  log("ocr", `Avvio processamento OCR reale per file: ${filename}`);
  log("ocr", `Impostazioni: ${JSON.stringify(settings)}`);

  try {
    // Fase 1: Inizializzazione (0-20%)
    progressCallback?.(5, 'Inizializzazione sistema OCR...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simula tempo reale
    
    // Mappa le lingue dal formato UI al formato Tesseract
    const tesseractLanguage = mapLanguageToTesseract(settings.language);
    
    log("ocr", `Inizializzazione Tesseract con lingua: ${tesseractLanguage}`);
    progressCallback?.(15, 'Caricamento modelli linguistici...');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Fase 2: Preprocessing (20-40%)
    progressCallback?.(25, 'Preprocessing dell\'immagine...');
    const processedBuffer = await preprocessImage(fileBuffer, settings);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    progressCallback?.(40, 'Caricamento modello di riconoscimento...');
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Crea e configura worker Tesseract con callback di progresso
    const worker = await createWorker(tesseractLanguage, undefined, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(40 + (m.progress * 45)); // 40-85%
          progressCallback?.(progress, `Riconoscimento testo: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    // Fase 3: Riconoscimento (40-90%)
    progressCallback?.(50, 'Analisi del documento in corso...');
    
    log("ocr", `Esecuzione OCR su ${filename} con preprocessing: ${settings.preprocessingMode}`);
    
    // Esegui OCR con callback di progresso integrato
    const { data } = await worker.recognize(processedBuffer);
    
    // Fase 4: Finalizzazione (90-100%)
    progressCallback?.(90, 'Finalizzazione risultati...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Cleanup worker
    await worker.terminate();
    
    progressCallback?.(100, 'Completato!');
    
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // Calcola confidence media
    const avgConfidence = Math.round(data.confidence || 0);
    
    // Determina la lingua rilevata
    const detectedLanguage = data.text.length > 0 ? 
      detectLanguageFromText(data.text) : settings.language;
    
    const result: OCRResult = {
      extractedText: data.text.trim(),
      confidence: avgConfidence,
      language: detectedLanguage,
      processingTime,
      pageCount: 1
    };
    
    progressCallback?.(100, 'Processamento completato!');
    
    log("ocr", `OCR completato: ${result.extractedText.length} caratteri estratti con confidenza ${avgConfidence}%`);
    
    return result;

  } catch (error: any) {
    log("ocr", `Errore durante processamento OCR: ${error.message}`);
    throw new Error(`Errore OCR: ${error.message}`);
  }
}

// Mappa le lingue dal formato UI al formato Tesseract
function mapLanguageToTesseract(language: string): string {
  const languageMap: { [key: string]: string } = {
    'auto': 'eng', // Default per auto-detection
    'ita': 'ita',
    'eng': 'eng',
    'ita+eng': 'ita+eng',
    'fra': 'fra',
    'deu': 'deu', 
    'spa': 'spa'
  };
  
  return languageMap[language] || 'eng';
}

// Rileva la lingua dal testo estratto (semplice euristica)
function detectLanguageFromText(text: string): string {
  const italianWords = ['il', 'la', 'di', 'che', 'e', 'per', 'con', 'del', 'della', 'sul', 'sulla'];
  const englishWords = ['the', 'and', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by'];
  
  const words = text.toLowerCase().split(/\s+/);
  let italianCount = 0;
  let englishCount = 0;
  
  words.forEach(word => {
    if (italianWords.includes(word)) italianCount++;
    if (englishWords.includes(word)) englishCount++;
  });
  
  if (italianCount > englishCount) return 'ita';
  if (englishCount > italianCount) return 'eng';
  return 'ita+eng'; // Mixed o incerto
}

// Preprocessing dell'immagine con Sharp per migliorare l'OCR
async function preprocessImage(buffer: Buffer, settings: OCRSettings): Promise<Buffer> {
  try {
    let image = sharp(buffer);
    
    // Applica DPI se specificato (per immagini che lo supportano)
    if (settings.dpi && settings.dpi !== 300) {
      image = image.withMetadata({ density: settings.dpi });
    }
    
    // Applica preprocessing in base alle impostazioni
    switch (settings.preprocessingMode) {
      case 'enhance':
        // Migliora contrasto e nitidezza
        image = image
          .normalize() // Normalizza i livelli
          .sharpen(1.0, 1.0, 2.0) // Aumenta nitidezza
          .gamma(1.2); // Regola gamma per migliorare contrasto
        log("ocr", "Applicato preprocessing: enhance (contrasto e nitidezza)");
        break;
        
      case 'denoise':
        // Riduce il rumore
        image = image
          .blur(0.3) // Leggera sfocatura per ridurre rumore
          .normalize() // Normalizza i livelli
          .threshold(128); // Converte in bianco e nero con soglia
        log("ocr", "Applicato preprocessing: denoise (riduzione rumore)");
        break;
        
      case 'sharpen':
        // Aumenta la nitidezza
        image = image
          .sharpen(2.0, 1.0, 3.0) // Nitidezza più aggressiva
          .modulate({ brightness: 1.1, saturation: 0.8 }); // Regola luminosità
        log("ocr", "Applicato preprocessing: sharpen (nitidezza)");
        break;
        
      case 'auto':
      default:
        // Preprocessing automatico standard
        image = image
          .normalize() // Normalizza automaticamente
          .sharpen(); // Nitidezza leggera
        log("ocr", "Applicato preprocessing: auto (standard)");
        break;
    }
    
    // Converte sempre in formato ottimale per OCR
    const processedBuffer = await image
      .png({ quality: 100 }) // PNG senza perdita per OCR migliore
      .toBuffer();
    
    return processedBuffer;
    
  } catch (error: any) {
    log("ocr", `Errore durante preprocessing: ${error.message}, uso immagine originale`);
    return buffer; // Fallback all'immagine originale
  }
}




export async function saveOCRDocument(
  title: string,
  content: string,
  originalFilename: string,
  metadata: any,
  userId: number
): Promise<number> {
  try {
    // Genera un filename unico per il documento OCR
    const timestamp = Date.now();
    const filename = `ocr_${timestamp}_${originalFilename.replace(/\.[^/.]+$/, '')}.txt`;
    
    // Crea il contenuto del file
    const fileContent = `DOCUMENTO ESTRATTO TRAMITE OCR
Titolo: ${title}
File originale: ${originalFilename}
Data estrazione: ${new Date().toISOString()}
Metadati: ${JSON.stringify(metadata, null, 2)}

CONTENUTO ESTRATTO:
${content}`;

    // Salva il file nella directory uploads
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, fileContent, 'utf8');

    // Calcola dimensione file
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // Inserisci nel database (implementazione semplificata)
    // Questo dovrebbe usare il sistema storage esistente
    const document = {
      userId,
      filename,
      originalFilename: `${title}.txt`,
      filePath,
      fileSize,
      fileType: 'text/plain',
      indexed: false, // Sarà indicizzato in seguito
      source: 'ocr',
      metadata: JSON.stringify(metadata)
    };

    log("ocr", `Documento OCR salvato: ${filename}`);
    
    // Restituisci un ID mock (da implementare con storage reale)
    return timestamp;

  } catch (error: any) {
    log("ocr", `Errore nel salvataggio documento OCR: ${error.message}`);
    throw new Error(`Errore nel salvataggio: ${error.message}`);
  }
}