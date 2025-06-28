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
    
    // Verifica validità del buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer vuoto o non valido');
    }
    
    const result = await processOCR(fileBuffer, filename, settings, (progress: number, stage: string) => {
      try {
        log("ocr", `Progresso ${processId}: ${progress}% - ${stage}`);
        updateOCRProcessStatus(processId, { progress, stage });
      } catch (updateError) {
        log("ocr", `Errore aggiornamento progresso: ${updateError}`);
      }
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
      try {
        ocrProcesses.delete(processId);
      } catch (cleanupError) {
        log("ocr", `Errore cleanup processId ${processId}: ${cleanupError}`);
      }
    }, 5 * 60 * 1000);

  } catch (error: any) {
    log("ocr", `Errore OCR per processId: ${processId}: ${error.message}`);
    
    // Crea un risultato di errore invece di fallire completamente
    const errorResult: OCRResult = {
      extractedText: `Errore durante l'elaborazione: ${error.message}

Dettagli tecnici:
- File: ${filename}
- Errore: ${error.message}

Possibili soluzioni:
- Verifica che il file non sia corrotto
- Prova con un file più piccolo
- Assicurati che il formato sia supportato`,
      confidence: 0,
      language: 'err',
      processingTime: 0,
      pageCount: 0
    };
    
    updateOCRProcessStatus(processId, {
      progress: 100,
      stage: 'Completato con errori',
      completed: true,
      result: errorResult,
      error: error.message
    });

    // Cleanup dopo 1 minuto in caso di errore
    setTimeout(() => {
      try {
        ocrProcesses.delete(processId);
      } catch (cleanupError) {
        log("ocr", `Errore cleanup processId ${processId}: ${cleanupError}`);
      }
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
  let worker: any = null;
  
  log("ocr", `Avvio processamento OCR per file: ${filename}`);

  try {
    // Inizializzazione
    progressCallback?.(5, 'Inizializzazione sistema OCR...');
    
    // Verifica validità del buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Buffer file vuoto o non valido');
    }
    
    const isPdf = filename.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      // Per i PDF, usa estrazione diretta del testo con fallback OCR
      progressCallback?.(15, 'Estrazione testo da PDF...');
      
      const extractedText = await processPdfText(fileBuffer, filename, progressCallback);
      
      progressCallback?.(90, 'Finalizzazione risultati PDF...');
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      // Determina confidence basato sulla lunghezza del testo estratto
      let confidence = 50;
      if (extractedText.trim().length > 100) {
        confidence = 85;
      } else if (extractedText.trim().length > 20) {
        confidence = 70;
      }
      
      const result: OCRResult = {
        extractedText: extractedText.trim(),
        confidence,
        language: 'ita',
        processingTime,
        pageCount: 1
      };
      
      progressCallback?.(100, 'Completato!');
      return result;
      
    } else {
      // Per le immagini, usa OCR Tesseract
      try {
        progressCallback?.(15, 'Preprocessing dell\'immagine...');
        const processedBuffer = await preprocessImage(fileBuffer, settings);
        
        progressCallback?.(30, 'Caricamento modelli linguistici...');
        
        // Crea worker Tesseract con timeout
        const workerPromise = createWorker('eng');
        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout inizializzazione OCR')), 30000)
        );
        
        worker = await Promise.race([workerPromise, timeoutPromise]);
        
        progressCallback?.(50, 'Analisi immagine in corso...');
        
        // Esegui OCR sull'immagine con timeout
        const recognitionPromise = worker.recognize(processedBuffer);
        const recognitionTimeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout riconoscimento testo')), 60000)
        );
        
        const { data } = await Promise.race([recognitionPromise, recognitionTimeoutPromise]);
        
        progressCallback?.(90, 'Finalizzazione risultati...');
        
        const processingTime = Math.round((Date.now() - startTime) / 1000);
        const avgConfidence = Math.round(data.confidence || 0);
        
        const result: OCRResult = {
          extractedText: data.text || '',
          confidence: avgConfidence,
          language: 'eng',
          processingTime,
          pageCount: 1
        };
        
        progressCallback?.(100, 'Completato!');
        return result;
        
      } catch (imageError: any) {
        log("ocr", `Errore processamento immagine: ${imageError.message}`);
        
        // Ritorna un risultato di errore invece di fallire
        const processingTime = Math.round((Date.now() - startTime) / 1000);
        
        return {
          extractedText: `Impossibile processare l'immagine: ${imageError.message}

Possibili cause:
- Formato immagine non supportato o corrotto
- Immagine troppo grande o di qualità troppo bassa
- Timeout durante il processamento

Suggerimenti:
- Verifica che l'immagine sia in formato JPEG, PNG, TIFF o BMP
- Riduci le dimensioni dell'immagine se è molto grande
- Migliora la qualità di scansione se il testo è poco leggibile`,
          confidence: 0,
          language: 'err',
          processingTime,
          pageCount: 1
        };
      }
    }

  } catch (error: any) {
    log("ocr", `Errore durante processamento OCR: ${error.message}`);
    
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // Ritorna un risultato di errore invece di propagare l'eccezione
    return {
      extractedText: `Errore durante l'elaborazione: ${error.message}

Dettagli:
- File: ${filename}
- Tipo: ${filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Immagine'}
- Errore: ${error.message}

Soluzioni possibili:
- Verifica che il file non sia corrotto
- Prova con un formato diverso
- Riduci le dimensioni del file`,
      confidence: 0,
      language: 'err',
      processingTime,
      pageCount: 0
    };
    
  } finally {
    // Cleanup worker se è stato creato
    if (worker) {
      try {
        await worker.terminate();
      } catch (workerError) {
        log("ocr", `Errore terminazione worker: ${workerError}`);
      }
    }
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
  
  let worker: any = null;
  
  try {
    log("ocr", `[${uniqueId}] Avvio conversione PDF scansionato - File: ${filename}`);
    
    progressCallback?.(20, 'Conversione PDF in immagini...');
    
    // Verifica che il buffer PDF sia valido
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Buffer PDF vuoto o non valido');
    }
    
    // Salva temporaneamente il PDF
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(tempPdfPath, pdfBuffer);
    
    // Verifica che il file sia stato scritto correttamente
    const stats = await fs.stat(tempPdfPath);
    if (stats.size === 0) {
      throw new Error('File PDF temporaneo vuoto');
    }
    
    log("ocr", `File PDF temporaneo salvato: ${stats.size} bytes`);
    
    // Crea directory temporanea per le immagini
    const tempDir = path.join('./temp', `ocr_${uniqueId}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Prima crea il worker Tesseract per verificare che funzioni
    progressCallback?.(30, 'Inizializzazione OCR...');
    worker = await createWorker('eng');
    
    // Importa dinamicamente pdf2pic
    const pdf2pic = await import('pdf2pic');
    
    progressCallback?.(40, 'Conversione pagine in corso...');

    // Configura pdf2pic con impostazioni più conservative
    const convert = pdf2pic.fromPath(tempPdfPath, {
      density: 150,           // DPI ridotto ulteriormente
      saveFilename: `page_${uniqueId}`,
      savePath: tempDir,
      format: "png",
      width: 1200,            // Dimensioni ridotte per stabilità
      height: 1600
    });
    
    // Converte solo le prime 3 pagine per evitare sovraccarico
    const maxPages = 3;
    let allText = "";
    
    try {
      progressCallback?.(50, 'Conversione immagini...');
      
      // Converti una pagina alla volta per gestire meglio gli errori
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          log("ocr", `Conversione pagina ${pageNum}...`);
          
          // Converti singola pagina con timeout
          const convertPromise = convert(pageNum, { responseType: "buffer" });
          const timeoutPromise = new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout conversione pagina ${pageNum}`)), 30000)
          );
          
          const pageResult = await Promise.race([convertPromise, timeoutPromise]);
          
          if (pageResult && pageResult.buffer && pageResult.buffer.length > 0) {
            log("ocr", `Pagina ${pageNum} convertita: ${pageResult.buffer.length} bytes`);
            
            // Verifica che il buffer dell'immagine sia valido
            try {
              const imageMetadata = await sharp(pageResult.buffer).metadata();
              if (!imageMetadata.width || !imageMetadata.height) {
                throw new Error(`Immagine pagina ${pageNum} non valida`);
              }
              
              log("ocr", `Immagine pagina ${pageNum} valida: ${imageMetadata.width}x${imageMetadata.height}`);
              
              // Processa con OCR
              const { data } = await worker.recognize(pageResult.buffer);
              const pageText = data.text.trim();
              
              if (pageText.length > 0) {
                allText += `\n=== Pagina ${pageNum} ===\n${pageText}\n`;
                log("ocr", `Pagina ${pageNum} processata: ${pageText.length} caratteri`);
              }
              
            } catch (ocrError: any) {
              log("ocr", `Errore OCR pagina ${pageNum}: ${ocrError.message}`);
              // Continua con la prossima pagina
            }
          } else {
            log("ocr", `Pagina ${pageNum} non convertita o buffer vuoto`);
          }
          
          progressCallback?.(50 + (pageNum / maxPages) * 35, `Elaborando pagina ${pageNum}/${maxPages}...`);
          
        } catch (pageError: any) {
          log("ocr", `Errore conversione pagina ${pageNum}: ${pageError.message}`);
          // Continua con la prossima pagina
        }
      }
      
      progressCallback?.(90, 'Finalizzazione...');
      
      const finalText = allText.trim();
      log("ocr", `OCR PDF completato: ${finalText.length} caratteri estratti`);
      
      if (finalText.length === 0) {
        return `Impossibile estrarre testo leggibile da questo PDF.

Il documento potrebbe essere:
- Un PDF con qualità di scansione molto bassa
- Un PDF con testo in lingue non supportate
- Un PDF con formato particolare o protetto

Suggerimenti:
- Verifica la qualità di scansione del documento originale
- Prova a convertire il PDF in formato immagine con qualità più alta
- Usa software specializzato per il riconoscimento ottico`;
      }
      
      return finalText;
      
    } catch (processingError: any) {
      log("ocr", `Errore durante processamento OCR: ${processingError.message}`);
      throw processingError;
    }
    
  } catch (error: any) {
    log("ocr", `Errore OCR PDF: ${error.message}`);
    
    // Ritorna un messaggio di errore utile invece di propagare l'eccezione
    return `Errore durante l'elaborazione OCR del PDF: ${error.message}

Possibili cause:
- Documento PDF corrotto o non standard
- Memoria insufficiente per il processamento
- Formato PDF non supportato

Soluzioni alternative:
- Prova con un documento più piccolo
- Converti il PDF in formato immagine (PNG/JPEG)
- Copia manualmente il testo se è selezionabile`;
    
  } finally {
    // Cleanup finale
    try {
      if (worker) {
        await worker.terminate();
      }
    } catch (workerError) {
      log("ocr", `Errore terminazione worker: ${workerError}`);
    }
    
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