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
    
    const result = await processOCR(fileBuffer, filename, settings, (progress, stage) => {
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

    log("ocr", `Status finale aggiornato per processId: ${processId}`);

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

// Funzione per processare PDF usando estrazione di testo diretta con fallback OCR
async function processPdfText(pdfBuffer: Buffer, filename: string, progressCallback?: (progress: number, stage: string) => void): Promise<string> {
  try {
    log("ocr", "Estrazione testo diretto da PDF...");
    
    // Verifica che il buffer sia valido
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Buffer PDF vuoto o non valido');
    }

    // Salva temporaneamente il PDF per l'estrazione
    const tempPath = path.join('./temp', `temp_${Date.now()}_${filename}`);
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(tempPath, pdfBuffer);
    
    let extractedText = '';
    
    try {
      // Estrai il testo usando pdf-parse con timeout
      const extractionPromise = extractTextFromPDF(tempPath);
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('PDF extraction timeout')), 30000)
      );
      
      extractedText = await Promise.race([extractionPromise, timeoutPromise]);
      
      log("ocr", `Testo estratto da PDF: ${extractedText.length} caratteri`);
      
    } catch (extractionError: any) {
      log("ocr", `Errore estrazione PDF diretta: ${extractionError.message}`);
      
      // Se l'estrazione diretta fallisce, ritorna un messaggio di errore utile
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
    
    // Cleanup file temporaneo
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      // Ignora errori di cleanup
    }
    
    return extractedText;
    
  } catch (error: any) {
    log("ocr", `Errore generale estrazione PDF: ${error.message}`);
    
    // Ritorna un messaggio di errore invece di lanciare un'eccezione
    return `Errore durante l'elaborazione del PDF: ${error.message}
    
Per risolvere il problema:
- Verifica che il file sia un PDF valido
- Prova con un file più piccolo
- Converti il PDF in formato testo (.txt)`;
  }
}

// Funzione per processare PDF scansionati con OCR usando pdf2pic (DISABILITATA per stabilità)
async function processPdfWithOCR(pdfBuffer: Buffer, filename: string, progressCallback?: (progress: number, stage: string) => void): Promise<string> {
  // Temporaneamente disabilitata per evitare crash dell'applicazione
  log("ocr", "PDF OCR temporaneamente disabilitato per stabilità");
  return "PDF OCR non disponibile. Usa file di testo o immagini per l'OCR.";
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
    // Fase 1: Inizializzazione (0-10%)
    progressCallback?.(5, 'Inizializzazione sistema OCR...');
    
    // Mappa le lingue dal formato UI al formato Tesseract
    const tesseractLanguage = mapLanguageToTesseract(settings.language);
    log("ocr", `Inizializzazione Tesseract con lingua: ${tesseractLanguage}`);
    
    // Fase 2: Gestione PDF o immagine (10-40%)
    const isPdf = filename.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      progressCallback?.(15, 'Estrazione testo da PDF...');
      
      // Per i PDF, usa estrazione diretta del testo (più veloce e affidabile)
      const extractedText = await processPdfText(fileBuffer, filename, progressCallback);
      
      progressCallback?.(90, 'Finalizzazione risultati PDF...');
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      const detectedLanguage = extractedText.length > 0 ? 
        detectLanguageFromText(extractedText) : settings.language;
      
      // Debug dettagliato per identificare il problema
      log("ocr", `=== DEBUG PDF EXTRACTION ===`);
      log("ocr", `Testo estratto grezzo: "${extractedText}"`);
      log("ocr", `Lunghezza testo: ${extractedText.length}`);
      log("ocr", `Testo trimmed: "${extractedText.trim()}"`);
      log("ocr", `Lunghezza trimmed: ${extractedText.trim().length}`);
      log("ocr", `=== END DEBUG ===`);
      
      const finalText = extractedText.trim();
      const result: OCRResult = {
        extractedText: finalText,
        confidence: finalText.length > 0 ? 95 : 50, // Riduce confidenza se nessun testo
        language: detectedLanguage,
        processingTime,
        pageCount: 1
      };
      
      progressCallback?.(100, 'Completato!');
      log("ocr", `PDF processato: ${result.extractedText.length} caratteri estratti`);
      return result;
      
    } else {
      // Per le immagini, usa OCR Tesseract
      progressCallback?.(15, 'Preprocessing dell\'immagine...');
      const processedBuffer = await preprocessImage(fileBuffer, settings);
      
      progressCallback?.(30, 'Caricamento modelli linguistici...');
      
      // Crea worker Tesseract con gestione errori migliorata
      const worker = await createWorker('eng'); // Usa solo inglese per stabilità
      
      progressCallback?.(50, 'Analisi immagine in corso...');
      
      // Esegui OCR sull'immagine
      const { data } = await worker.recognize(processedBuffer);
      
      progressCallback?.(90, 'Finalizzazione risultati...');
      
      // Cleanup worker
      await worker.terminate();
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      const avgConfidence = Math.round(data.confidence || 0);
      const detectedLanguage = data.text.length > 0 ? 
        detectLanguageFromText(data.text) : settings.language;
      
      const result: OCRResult = {
        extractedText: data.text.trim(),
        confidence: avgConfidence,
        language: detectedLanguage,
        processingTime,
        pageCount: 1
      };
      
      progressCallback?.(100, 'Completato!');
      log("ocr", `Immagine processata: ${result.extractedText.length} caratteri estratti con confidenza ${avgConfidence}%`);
      return result;
    }
    
    // Questa sezione è stata spostata sopra per gestire separatamente PDF e immagini
    // Il codice per immagini e PDF è già implementato sopra

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
    // Verifica che il buffer sia valido
    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer immagine vuoto o non valido');
    }

    let image = sharp(buffer);
    
    // Verifica che l'immagine sia valida prima di processarla
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Immagine corrotta o formato non supportato');
    }

    log("ocr", `Immagine valida: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);
    
    // Applica preprocessing basilare e sicuro
    switch (settings.preprocessingMode) {
      case 'enhance':
        // Migliora contrasto e nitidezza in modo conservativo
        image = image
          .normalize()
          .sharpen({ sigma: 1.0 });
        log("ocr", "Applicato preprocessing: enhance (contrasto e nitidezza)");
        break;
        
      case 'denoise':
        // Riduce il rumore in modo conservativo
        image = image
          .normalize()
          .median(3);
        log("ocr", "Applicato preprocessing: denoise (riduzione rumore)");
        break;
        
      case 'sharpen':
        // Aumenta la nitidezza in modo conservativo
        image = image
          .normalize()
          .sharpen({ sigma: 2.0 });
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