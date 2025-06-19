import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { promisify } from "util";
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

// Simula processamento OCR con Tesseract (da implementare con libreria reale)
export async function processOCR(
  fileBuffer: Buffer,
  filename: string,
  settings: OCRSettings
): Promise<OCRResult> {
  const startTime = Date.now();
  
  log("ocr", `Avvio processamento OCR per file: ${filename}`);
  log("ocr", `Impostazioni: ${JSON.stringify(settings)}`);

  try {
    // Salva temporaneamente il file
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `ocr_${Date.now()}_${filename}`);
    await fs.writeFile(tempFilePath, fileBuffer);

    // Simula processamento OCR (da sostituire con Tesseract reale)
    const mockResult = await simulateOCRProcessing(tempFilePath, settings);

    // Pulisci file temporaneo
    await fs.unlink(tempFilePath);

    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    log("ocr", `OCR completato in ${processingTime}s con confidenza ${mockResult.confidence}%`);

    return {
      ...mockResult,
      processingTime
    };

  } catch (error) {
    log("ocr", `Errore durante processamento OCR: ${error.message}`);
    throw new Error(`Errore OCR: ${error.message}`);
  }
}

// Simulazione processamento OCR (da sostituire con implementazione reale)
async function simulateOCRProcessing(
  filePath: string,
  settings: OCRSettings
): Promise<Omit<OCRResult, 'processingTime'>> {
  
  // Simula ritardo di processamento
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  // Testo simulato basato sul tipo di documento
  const filename = path.basename(filePath).toLowerCase();
  let extractedText = "";
  let confidence = 85;

  if (filename.includes('handwriting') || filename.includes('manuscript')) {
    extractedText = `Documento manoscritto estratto tramite OCR.

Questo è un esempio di testo estratto da un documento manoscritto.
Il riconoscimento di testi scritti a mano presenta maggiori sfide
rispetto al testo stampato, ma tecnologie avanzate permettono
risultati sempre più accurati.

Caratteristiche del testo rilevate:
- Calligrafia: stile corsivo
- Pressione: media-alta
- Inclinazione: 15° verso destra
- Consistenza: buona

Note tecniche:
Il documento presenta alcune parti sbiadite che potrebbero
richiedere un'elaborazione manuale per completare l'estrazione.`;
    confidence = 72;
  } else if (filename.includes('typed') || filename.includes('print')) {
    extractedText = `DOCUMENTO STAMPATO - ESTRAZIONE OCR

TITOLO: Analisi Grafologica Forense
AUTORE: Dr. Marco Rossi
DATA: 15 Marzo 2024

CONTENUTO:
La grafologia forense è una disciplina scientifica che studia
la scrittura manuale per identificare caratteristiche uniche
dell'autore e verificare l'autenticità dei documenti.

METODOLOGIE PRINCIPALI:
1. Analisi della pressione del tratto
2. Studio dell'inclinazione e spaziatura
3. Esame delle legature tra lettere
4. Valutazione della velocità di scrittura

CONCLUSIONI:
L'analisi computerizzata, combinata con l'expertise umana,
fornisce risultati affidabili per applicazioni forensi.`;
    confidence = 96;
  } else {
    extractedText = `Testo estratto tramite OCR avanzato.

Questo documento contiene informazioni che sono state
automaticamente estratte dall'immagine fornita utilizzando
tecnologie di riconoscimento ottico dei caratteri.

Il processo ha analizzato:
- Layout del documento
- Caratteri e simboli
- Struttura del testo
- Formattazione originale

Per documenti di alta qualità, l'accuratezza dell'estrazione
può raggiungere il 99%. Documenti degradati o con calligrafia
complessa possono richiedere revisione manuale.

Timestamp: ${new Date().toISOString()}
Processo: OCR Engine v2.1`;
    confidence = 88;
  }

  // Aggiungi variabilità alla confidenza basata sulle impostazioni
  if (settings.dpi >= 600) confidence += 5;
  if (settings.preprocessingMode === 'enhance') confidence += 3;
  if (settings.language.includes('+')) confidence -= 2; // Multi-lingua è più complesso

  // Assicurati che la confidenza sia nel range valido
  confidence = Math.max(60, Math.min(99, confidence));

  return {
    extractedText,
    confidence,
    language: settings.language.split('+')[0], // Prima lingua
    pageCount: 1
  };
}

// Per implementazione futura con Tesseract reale:
/*
async function runTesseractOCR(
  filePath: string, 
  settings: OCRSettings
): Promise<Omit<OCRResult, 'processingTime'>> {
  return new Promise((resolve, reject) => {
    const tesseractArgs = [
      filePath,
      'stdout',
      '--psm', '3', // Page segmentation mode
      '--oem', '1', // OCR Engine mode
      '-l', settings.language,
      '--dpi', settings.dpi.toString()
    ];

    const tesseract = spawn('tesseract', tesseractArgs);
    let output = '';
    let errorOutput = '';

    tesseract.stdout.on('data', (data) => {
      output += data.toString();
    });

    tesseract.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    tesseract.on('close', (code) => {
      if (code === 0) {
        // Estrai confidenza dal stderr di Tesseract se disponibile
        const confidenceMatch = errorOutput.match(/Mean confidence: (\d+)/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 85;

        resolve({
          extractedText: output.trim(),
          confidence,
          language: settings.language,
          pageCount: 1
        });
      } else {
        reject(new Error(`Tesseract ha fallito con codice ${code}: ${errorOutput}`));
      }
    });
  });
}
*/

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

  } catch (error) {
    log("ocr", `Errore nel salvataggio documento OCR: ${error.message}`);
    throw new Error(`Errore nel salvataggio: ${error.message}`);
  }
}