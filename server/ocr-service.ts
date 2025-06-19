import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createWorker } from 'tesseract.js';
import { log } from "./vite";

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

// Processamento OCR reale con Tesseract.js
export async function processOCR(
  fileBuffer: Buffer,
  filename: string,
  settings: OCRSettings
): Promise<OCRResult> {
  const startTime = Date.now();
  
  log("ocr", `Avvio processamento OCR reale per file: ${filename}`);
  log("ocr", `Impostazioni: ${JSON.stringify(settings)}`);

  try {
    // Mappa le lingue dal formato UI al formato Tesseract
    const tesseractLanguage = mapLanguageToTesseract(settings.language);
    
    log("ocr", `Inizializzazione Tesseract con lingua: ${tesseractLanguage}`);
    
    // Crea e configura worker Tesseract
    const worker = await createWorker(tesseractLanguage);
    
    log("ocr", `Esecuzione OCR su ${filename}...`);
    
    // Esegui OCR
    const { data } = await worker.recognize(fileBuffer);
    
    // Cleanup worker
    await worker.terminate();
    
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