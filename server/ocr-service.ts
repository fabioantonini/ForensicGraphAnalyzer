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

// Funzione migliorata per processare PDF con fallback OCR
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
        setTimeout(() => reject(new Error('PDF extraction timeout')), 15000)
      );
      
      extractedText = await Promise.race([extractionPromise, timeoutPromise]);
      
      // Se il testo estratto è molto breve, prova con OCR
      if (extractedText.trim().length < 50) {
        log("ocr", "Testo estratto troppo breve, tentativo OCR...");
        const ocrText = await processPdfWithOCR(pdfBuffer, filename, progressCallback);
        if (ocrText.length > extractedText.length) {
          extractedText = ocrText;
        }
      }
      
    } catch (extractionError: any) {
      log("ocr", `Errore estrazione PDF diretta: ${extractionError.message}`);
      
      // Prova con OCR come fallback
      log("ocr", "Tentativo OCR per PDF scansionato...");
      try {
        extractedText = await processPdfWithOCR(pdfBuffer, filename, progressCallback);
        if (extractedText.length > 0) {
          log("ocr", `OCR riuscito: ${extractedText.length} caratteri estratti`);
        }
      } catch (ocrError: any) {
        log("ocr", `OCR fallito: ${ocrError.message}`);
        
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

// Funzione per processare PDF scansionati con OCR
async function processPdfWithOCR(pdfBuffer: Buffer, filename: string, progressCallback?: (progress: number, stage: string) => void): Promise<string> {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const tempPdfPath = path.join('./temp', `temp_ocr_${uniqueId}_${sanitizedFilename}`);
  
  try {
    log("ocr", `[${uniqueId}] Avvio conversione PDF scansionato - File: ${filename}`);
    
    // Importa dinamicamente pdf2pic
    const pdf2pic = await import('pdf2pic');
    
    progressCallback?.(20, 'Conversione PDF in immagini...');
    
    // Salva temporaneamente il PDF
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(tempPdfPath, pdfBuffer);
    
    // Crea directory temporanea per le immagini
    const tempDir = path.join('./temp', `ocr_${uniqueId}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Configura pdf2pic
    const convert = pdf2pic.fromPath(tempPdfPath, {
      density: 200,           // DPI ridotto per performance
      saveFilename: `page_${uniqueId}`,
      savePath: tempDir,
      format: "png",
      width: 1800,            // Dimensioni ottimizzate
      height: 2500
    });
    
    progressCallback?.(40, 'Conversione pagine in corso...');
    
    // Converte fino a 5 pagine per non sovraccaricare il sistema
    const maxPages = 5;
    let allText = "";
    
    try {
      // Crea worker Tesseract
      const worker = await createWorker('eng');
      
      progressCallback?.(50, 'Inizializzazione OCR...');
      
      // Converti le prime pagine
      const pages = await convert.bulk([1, maxPages], { responseType: "buffer" });
      
      progressCallback?.(60, 'Analisi testo in corso...');
      
      let processedPages = 0;
      for (const page of pages) {
        if (page.buffer) {
          try {
            const { data } = await worker.recognize(page.buffer);
            const pageText = data.text.trim();
            
            if (pageText.length > 0) {
              allText += `\n=== Pagina ${processedPages + 1} ===\n${pageText}\n`;
            }
            
            processedPages++;
            progressCallback?.(60 + (processedPages / pages.length) * 25, `Elaborando pagina ${processedPages}/${pages.length}...`);
            
          } catch (pageError: any) {
            log("ocr", `Errore OCR pagina ${processedPages + 1}: ${pageError.message}`);
          }
        }
      }
      
      // Cleanup
      await worker.terminate();
      
      progressCallback?.(90, 'Finalizzazione...');
      
      const finalText = allText.trim();
      log("ocr", `OCR PDF completato: ${finalText.length} caratteri estratti da ${processedPages} pagine`);
      
      return finalText;
      
    } catch (processingError: any) {
      log("ocr", `Errore durante processamento OCR: ${processingError.message}`);
      throw processingError;
    }
    
  } catch (error: any) {
    log("ocr", `Errore OCR PDF: ${error.message}`);
    throw error;
    
  } finally {
    // Cleanup finale
    try {
      await fs.unlink(tempPdfPath);
      const tempDir = path.join('./temp', `ocr_${uniqueId}`);
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      log("ocr", `Errore cleanup: ${cleanupError}`);
    }
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