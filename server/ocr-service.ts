import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import crypto from 'crypto';
import { log } from "./vite";
import { extractTextFromPDF } from "./document-processor";

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
    log("ocr", `Inizio processamento OCR per processId: ${processId}`);
    
    const result = await processOCR(fileBuffer, filename, settings, (progress: number, stage: string) => {
      log("ocr", `Progresso ${processId}: ${progress}% - ${stage}`);
      updateOCRProcessStatus(processId, { progress, stage });
    });

    log("ocr", `OCR completato per processId: ${processId}, risultato: ${result.extractedText.length} caratteri`);

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
    log("ocr", `Errore OCR per processId: ${processId}: ${error.message}`);
    
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

// Processamento OCR principale
export async function processOCR(
  fileBuffer: Buffer,
  filename: string,
  settings: OCRSettings,
  progressCallback?: (progress: number, stage: string) => void
): Promise<OCRResult> {
  const startTime = Date.now();
  
  log("ocr", `Avvio processamento OCR per file: ${filename}`);

  try {
    // Inizializzazione
    progressCallback?.(5, 'Inizializzazione sistema OCR...');
    
    const isPdf = filename.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      // Per i PDF, usa solo estrazione diretta del testo
      progressCallback?.(15, 'Estrazione testo da PDF...');
      
      const extractedText = await processPdfText(fileBuffer, filename, progressCallback);
      
      progressCallback?.(90, 'Finalizzazione risultati PDF...');
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      const result: OCRResult = {
        extractedText: extractedText.trim(),
        confidence: extractedText.trim().length > 0 ? 85 : 50,
        language: 'ita',
        processingTime,
        pageCount: 1
      };
      
      progressCallback?.(100, 'Completato!');
      return result;
      
    } else {
      // Per le immagini, usa OCR Tesseract
      progressCallback?.(15, 'Preprocessing dell\'immagine...');
      const processedBuffer = await preprocessImage(fileBuffer, settings);
      
      progressCallback?.(30, 'Caricamento modelli linguistici...');
      
      // Crea worker Tesseract con solo inglese per stabilità
      const worker = await createWorker('eng');
      
      progressCallback?.(50, 'Analisi immagine in corso...');
      
      // Esegui OCR sull'immagine
      const { data } = await worker.recognize(processedBuffer);
      
      progressCallback?.(90, 'Finalizzazione risultati...');
      
      // Cleanup worker
      await worker.terminate();
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      const avgConfidence = Math.round(data.confidence || 0);
      
      const result: OCRResult = {
        extractedText: data.text,
        confidence: avgConfidence,
        language: 'eng',
        processingTime,
        pageCount: 1
      };
      
      progressCallback?.(100, 'Completato!');
      return result;
    }

  } catch (error: any) {
    log("ocr", `Errore durante processamento OCR: ${error.message}`);
    throw new Error(`Errore OCR: ${error.message}`);
  }
}

// Funzione semplificata per processare PDF
async function processPdfText(pdfBuffer: Buffer, filename: string, progressCallback?: (progress: number, stage: string) => void): Promise<string> {
  try {
    log("ocr", "Estrazione testo diretto da PDF...");
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Buffer PDF vuoto o non valido');
    }

    // Salva temporaneamente il PDF
    const tempPath = path.join('./temp', `temp_${Date.now()}_${filename}`);
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(tempPath, pdfBuffer);
    
    let extractedText = '';
    
    try {
      // Estrai il testo con timeout
      const extractionPromise = extractTextFromPDF(tempPath);
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('PDF extraction timeout')), 30000)
      );
      
      extractedText = await Promise.race([extractionPromise, timeoutPromise]);
      
    } catch (extractionError: any) {
      log("ocr", `Errore estrazione PDF: ${extractionError.message}`);
      
      extractedText = `Impossibile estrarre il testo da questo PDF.

Il file potrebbe essere:
- Un PDF scansionato (immagini)
- Un PDF protetto o corrotto
- Un PDF con formato non standard

Suggerimenti:
- Prova a copiare e incollare il testo manualmente
- Converti il PDF in formato testo (.txt)
- Usa un altro software per riparare il PDF`;
    }
    
    // Cleanup
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      // Ignora errori di cleanup
    }
    
    return extractedText;
    
  } catch (error: any) {
    log("ocr", `Errore generale estrazione PDF: ${error.message}`);
    
    return `Errore durante l'elaborazione del PDF: ${error.message}

Per risolvere il problema:
- Verifica che il file sia un PDF valido
- Prova con un file più piccolo
- Converti il PDF in formato testo (.txt)`;
  }
}

// Preprocessing semplificato dell'immagine
async function preprocessImage(buffer: Buffer, settings: OCRSettings): Promise<Buffer> {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer immagine vuoto o non valido');
    }

    let image = sharp(buffer);
    
    // Verifica validità immagine
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Immagine corrotta o formato non supportato');
    }

    log("ocr", `Immagine valida: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);
    
    // Preprocessing basilare
    switch (settings.preprocessingMode) {
      case 'enhance':
        image = image.normalize().sharpen({ sigma: 1.0 });
        break;
      case 'denoise':
        image = image.normalize().median(3);
        break;
      case 'sharpen':
        image = image.normalize().sharpen({ sigma: 2.0 });
        break;
      default:
        image = image.normalize().sharpen();
        break;
    }
    
    // Converte in PNG per OCR
    const processedBuffer = await image.png({ quality: 100 }).toBuffer();
    
    return processedBuffer;
    
  } catch (error: any) {
    log("ocr", `Errore durante preprocessing: ${error.message}, uso immagine originale`);
    return buffer;
  }
}

// Funzione per salvare documento OCR
export async function saveOCRDocument(
  title: string,
  content: string,
  originalFilename: string,
  metadata: any,
  userId: number
): Promise<number> {
  try {
    const timestamp = Date.now();
    const filename = `ocr_${timestamp}_${originalFilename.replace(/\.[^/.]+$/, '')}.txt`;
    
    const fileContent = `DOCUMENTO ESTRATTO TRAMITE OCR
Titolo: ${title}
File originale: ${originalFilename}
Data estrazione: ${new Date().toLocaleString()}
Utente: ${userId}
Metadati: ${JSON.stringify(metadata, null, 2)}

--- CONTENUTO ESTRATTO ---

${content}`;

    // Salva il file
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, fileContent, 'utf8');
    
    log("ocr", `Documento OCR salvato: ${filepath}`);
    
    return timestamp; // Ritorna un ID univoco
    
  } catch (error: any) {
    log("ocr", `Errore salvataggio documento OCR: ${error.message}`);
    throw new Error(`Impossibile salvare il documento: ${error.message}`);
  }
}