import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
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

// Funzione per processare PDF usando estrazione di testo diretta con fallback OCR
async function processPdfText(pdfBuffer: Buffer, filename: string, progressCallback?: (progress: number, stage: string) => void): Promise<string> {
  try {
    log("ocr", "Estrazione testo diretto da PDF...");
    
    // Salva temporaneamente il PDF per l'estrazione
    const tempPath = path.join('./temp', `temp_${Date.now()}_${filename}`);
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(tempPath, pdfBuffer);
    
    // Estrai il testo usando pdf-parse
    const extractedText = await extractTextFromPDF(tempPath);
    
    // Cleanup file temporaneo
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      // Ignora errori di cleanup
    }
    
    log("ocr", `Testo estratto da PDF: ${extractedText.length} caratteri`);
    
    // Se il testo estratto è troppo breve per la dimensione del file, 
    // potrebbe essere un PDF scansionato (immagini)
    const fileSize = pdfBuffer.length;
    const textDensity = extractedText.length / (fileSize / 1024); // caratteri per KB
    
    log("ocr", `Densità testo PDF: ${textDensity.toFixed(2)} caratteri/KB`);
    
    // Se la densità è molto bassa (< 0.5 caratteri per KB), probabilmente è un PDF scansionato
    if (textDensity < 0.5 && extractedText.trim().length < 1000) {
      log("ocr", "PDF sembra essere scansionato, tentativo OCR con Tesseract...");
      
      try {
        // Usa OCR come fallback per PDF scansionati
        const ocrText = await processPdfWithOCR(pdfBuffer, filename, progressCallback);
        if (ocrText.length > extractedText.length) {
          log("ocr", `OCR ha prodotto più testo: ${ocrText.length} vs ${extractedText.length} caratteri`);
          return ocrText;
        }
      } catch (ocrError: any) {
        log("ocr", `Fallback OCR fallito: ${ocrError.message}`);
      }
    }
    
    return extractedText;
    
  } catch (error: any) {
    log("ocr", `Errore estrazione PDF: ${error.message}`);
    throw new Error(`Impossibile estrarre testo da PDF: ${error.message}`);
  }
}

// Funzione per processare PDF scansionati con OCR usando pdf2pic
async function processPdfWithOCR(pdfBuffer: Buffer, filename: string, progressCallback?: (progress: number, stage: string) => void): Promise<string> {
  try {
    log("ocr", "Avvio conversione PDF scansionato in immagini per OCR...");
    
    const pdf2pic = await import('pdf2pic');
    const { createWorker } = await import('tesseract.js');
    
    // Salva temporaneamente il PDF
    const tempPdfPath = path.join('./temp', `temp_ocr_${Date.now()}_${filename}`);
    await fs.mkdir('./temp', { recursive: true });
    await fs.writeFile(tempPdfPath, pdfBuffer);
    
    log("ocr", "PDF salvato temporaneamente, avvio conversione...");
    
    // Configura pdf2pic per convertire PDF in immagini
    const convert = pdf2pic.fromPath(tempPdfPath, {
      density: 300,           // DPI per qualità OCR
      saveFilename: "page",
      savePath: "./temp",
      format: "png",
      width: 2480,            // Larghezza per qualità OCR
      height: 3508            // Altezza per qualità OCR
    });
    
    log("ocr", "Conversione PDF in immagini...");
    
    // Converte tutte le pagine del PDF
    const pages = await convert.bulk(-1, { responseType: "buffer" });
    
    if (!pages || pages.length === 0) {
      log("ocr", "Nessuna pagina convertita dal PDF");
      await fs.unlink(tempPdfPath).catch(() => {}); // Cleanup
      return "";
    }
    
    log("ocr", `Convertite ${pages.length} pagine, avvio OCR...`);
    
    // Crea worker Tesseract per OCR
    const worker = await createWorker(['ita', 'eng']);
    
    let allText = "";
    
    // Processa tutte le pagine con OCR
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.buffer) {
        // Calcola progresso basato sulle pagine processate
        const pageProgress = 40 + Math.round((i / pages.length) * 50); // Da 40% a 90%
        progressCallback?.(pageProgress, `OCR pagina ${i + 1}/${pages.length}...`);
        
        log("ocr", `Processamento OCR pagina ${i + 1}/${pages.length}...`);
        
        const { data } = await worker.recognize(page.buffer);
        const pageText = data.text.trim();
        
        if (pageText.length > 0) {
          allText += `\n=== Pagina ${i + 1} ===\n${pageText}\n`;
        }
        
        log("ocr", `Pagina ${i + 1}: ${pageText.length} caratteri estratti`);
      }
    }
    
    // Cleanup
    await worker.terminate();
    await fs.unlink(tempPdfPath).catch(() => {});
    
    // Cleanup automatico - pdf2pic con responseType: "buffer" non crea file temporanei
    
    const finalText = allText.trim();
    log("ocr", `OCR PDF completato: ${finalText.length} caratteri totali estratti`);
    
    return finalText;
    
  } catch (error: any) {
    log("ocr", `Errore OCR PDF: ${error.message}`);
    return "";
  }
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
      
      // Crea worker Tesseract
      const worker = await createWorker(tesseractLanguage);
      
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