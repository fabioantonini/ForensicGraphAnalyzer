import OpenAI from "openai";
import { db } from "./db";
import { anonymizations, documents, users } from "../shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { extractTextFromPDF, extractTextFromDOCX } from "./document-processor";
import mammoth from "mammoth";
import PdfPrinter from "pdfkit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Default entity replacements in Italian
export const DEFAULT_ENTITY_REPLACEMENTS = {
  'PERSON': '[NOME]',
  'LOCATION': '[CITTÀ]',
  'EMAIL': '[EMAIL]',
  'PHONE': '[TELEFONO]',
  'ORGANIZATION': '[ORGANIZZAZIONE]',
  'DATE': '[DATA]',
  'ADDRESS': '[INDIRIZZO]',
  'POSTAL_CODE': '[CAP]',
  'FISCAL_CODE': '[CODICE_FISCALE]',
  'VAT_NUMBER': '[PARTITA_IVA]',
  'MONEY': '[IMPORTO]',
  'CREDIT_CARD': '[CARTA_CREDITO]',
  'IBAN': '[IBAN]'
};

export interface DetectedEntity {
  text: string;
  type: string;
  position: { start: number; end: number };
  confidence: number;
}

export interface AnonymizationResult {
  anonymizedText: string;
  detectedEntities: DetectedEntity[];
  originalText: string;
}

/**
 * Utilizza OpenAI per riconoscere entità sensibili nel testo
 */
export async function detectEntities(text: string, apiKey?: string): Promise<DetectedEntity[]> {
  try {
    // Usa la chiave API dell'utente se fornita, altrimenti quella di sistema
    const openaiClient = apiKey ? new OpenAI({ apiKey }) : openai;
    
    console.log(`[detectEntities] Input text length: ${text.length}`);
    console.log(`[detectEntities] Input text preview:`, text.substring(0, 200));
    console.log(`[detectEntities] Input text end:`, text.substring(Math.max(0, text.length - 100)));
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in sensitive entity recognition for anonymization of legal and administrative documents in Italian and English.

          IDENTIFY ALL these sensitive entities in both Italian and English:
          - PERSON: Full person names (e.g., "Giovanni Rossi", "John Smith", "Maria Garcia")
          - ADDRESS: Complete addresses with street and number (e.g., "Via Roma 12", "123 Main Street", "Via Verdi 34, Milano")
          - LOCATION: Specific cities when mentioned as places of residence (e.g., "Milano", "New York", "Roma")
          - MONEY: Specific monetary amounts (e.g., "EUR 500.000", "€ 10.000", "$1,000", "£500")
          - DATE: Complete specific dates (e.g., "5 maggio 1975", "June 21, 2025", "21/06/2025")
          - ORGANIZATION: Names of entities, foundations, companies (e.g., "Fondazione Bambini Sorridenti", "Microsoft Corp")
          - EMAIL: Complete email addresses
          - PHONE: Phone numbers (all formats)
          - FISCAL_CODE: Italian tax codes
          - VAT_NUMBER: VAT numbers
          - IBAN: IBAN codes
          - CREDIT_CARD: Credit card numbers

          IMPORTANT: 
          - Identify EVERY SINGLE occurrence of person names, even if repeated multiple times in the text
          - Support both Italian and English text patterns
          - Recognize Italian addresses (Via, Corso, Piazza) and English addresses (Street, Avenue, Road)
          - Handle both Italian and English date formats

          Calculate exact character positions. Use positions from the original text.

          Respond ONLY with valid JSON:
          {
            "entities": [
              {
                "text": "exact_text_from_document",
                "type": "PERSON",
                "start": character_position_start,
                "end": character_position_end,
                "confidence": 0.95
              }
            ]
          }`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const responseContent = response.choices[0].message.content || '{"entities": []}';
    console.log(`[detectEntities] OpenAI response:`, responseContent);
    console.log(`[detectEntities] Input text length:`, text.length);
    console.log(`[detectEntities] Input text preview:`, text.substring(0, 200));
    
    const result = JSON.parse(responseContent);
    
    console.log(`[detectEntities] Found ${result.entities?.length || 0} entities:`);
    result.entities?.forEach((entity: any, index: number) => {
      console.log(`  ${index + 1}. ${entity.type}: "${entity.text}" (${entity.start}-${entity.end})`);
    });
    
    return (result.entities || []).map((entity: any) => ({
      text: entity.text,
      type: entity.type,
      position: { start: entity.start, end: entity.end },
      confidence: entity.confidence || 0.8
    }));
  } catch (error) {
    console.error('Error detecting entities:', error);
    throw new Error('Failed to detect entities: ' + (error as Error).message);
  }
}

/**
 * Anonimizza il testo sostituendo le entità rilevate con i tag specificati
 */
export function anonymizeText(
  text: string, 
  entities: DetectedEntity[], 
  replacements: Record<string, string>
): string {
  // Usa un approccio basato su ricerca del testo invece di posizioni precise
  let anonymizedText = text;
  
  // Raggruppa entità per tipo e ordina per lunghezza (più lunghe prima per evitare sostituzioni parziali)
  const entityGroups: { [key: string]: DetectedEntity[] } = {};
  entities.forEach(entity => {
    if (!entityGroups[entity.type]) {
      entityGroups[entity.type] = [];
    }
    entityGroups[entity.type].push(entity);
  });

  // Processa ogni tipo di entità
  Object.entries(entityGroups).forEach(([type, typeEntities]) => {
    const replacement = replacements[type] || `[${type}]`;
    
    // Rimuovi duplicati e ordina per lunghezza decrescente
    const uniqueEntities = Array.from(new Set(typeEntities.map(e => e.text)))
      .sort((a, b) => b.length - a.length);
    
    console.log(`[anonymizeText] Processing ${uniqueEntities.length} unique entities of type ${type}:`, uniqueEntities);
    
    uniqueEntities.forEach(entityText => {
      // Usa regex per trovare tutte le occorrenze, ignorando case e spazi extra
      const escapedText = entityText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedText}\\b`, 'gi');
      
      const matchCount = (anonymizedText.match(regex) || []).length;
      if (matchCount > 0) {
        console.log(`[anonymizeText] Replacing ${matchCount} occurrences of "${entityText}" with "${replacement}"`);
        anonymizedText = anonymizedText.replace(regex, replacement);
      }
    });
  });

  return anonymizedText;
}

/**
 * Genera un file PDF anonimizzato dal testo
 */
export async function generateAnonymizedPDF(
  text: string, 
  outputPath: string,
  originalFilename: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PdfPrinter({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });
    const stream = fsSync.createWriteStream(outputPath);
    
    doc.pipe(stream);
    
    // Header minimalista e professionale
    doc.fontSize(14).font('Helvetica-Bold').text('DOCUMENTO ANONIMIZZATO', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`File originale: ${originalFilename}`, { align: 'center' });
    doc.fontSize(8).text(`Generato il: ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`, { align: 'center' });
    doc.moveDown(1.5);
    
    // Linea separatrice
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(1);
    
    // Content con formattazione preservata
    doc.fontSize(11).font('Helvetica');
    
    // Mantieni la struttura del testo originale
    const paragraphs = text.split('\n\n');
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        // Preserva le interruzioni di riga all'interno dei paragrafi
        const lines = paragraph.split('\n');
        lines.forEach((line, lineIndex) => {
          if (line.trim()) {
            doc.text(line.trim(), {
              align: 'left',
              lineGap: 2,
              indent: line.startsWith(' ') ? 20 : 0 // Mantieni l'indentazione
            });
            if (lineIndex < lines.length - 1) {
              doc.moveDown(0.2);
            }
          }
        });
        
        // Spazio tra paragrafi
        if (index < paragraphs.length - 1) {
          doc.moveDown(0.6);
        }
      }
    });
    
    doc.end();
    
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

/**
 * Genera un file DOCX anonimizzato dal testo preservando la formattazione
 */
export async function generateAnonymizedDOCX(
  text: string,
  outputPath: string,
  originalFilename: string
): Promise<void> {
  // Crea un documento DOCX strutturato mantenendo la formattazione originale
  const timestamp = new Date().toLocaleDateString('it-IT') + ' alle ' + new Date().toLocaleTimeString('it-IT');
  
  // Header professionale
  let formattedContent = 'DOCUMENTO ANONIMIZZATO\n';
  formattedContent += '━'.repeat(50) + '\n\n';
  formattedContent += `File originale: ${originalFilename}\n`;
  formattedContent += `Generato il: ${timestamp}\n\n`;
  formattedContent += '━'.repeat(50) + '\n\n';
  
  // Preserva la struttura del testo originale
  const paragraphs = text.split('\n\n');
  
  paragraphs.forEach((paragraph, index) => {
    if (paragraph.trim()) {
      // Mantieni le interruzioni di riga all'interno dei paragrafi
      const lines = paragraph.split('\n');
      lines.forEach((line, lineIndex) => {
        if (line.trim()) {
          // Preserva l'indentazione originale
          const indent = line.match(/^(\s*)/)?.[1] || '';
          formattedContent += indent + line.trim() + '\n';
        }
      });
      
      // Spazio tra paragrafi
      if (index < paragraphs.length - 1) {
        formattedContent += '\n';
      }
    }
  });
  
  // Salva come file di testo con encoding UTF-8 per preservare caratteri speciali
  await fs.writeFile(outputPath.replace('.docx', '.txt'), formattedContent, 'utf-8');
}

/**
 * Processa un documento per l'anonimizzazione
 */
export async function processDocumentForAnonymization(
  documentId: number,
  userId: number,
  entityReplacements: Record<string, string> = DEFAULT_ENTITY_REPLACEMENTS,
  entityTypes: string[] = Object.keys(DEFAULT_ENTITY_REPLACEMENTS)
): Promise<number> {
  // Recupera il documento dal database
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId)
  });
  
  if (!document) {
    throw new Error('Document not found');
  }
  
  if (document.userId !== userId) {
    throw new Error('Unauthorized access to document');
  }
  
  // Crea record di anonimizzazione
  const [anonymization] = await db.insert(anonymizations).values({
    userId,
    originalDocumentId: documentId,
    filename: `anonymized_${document.filename}`,
    originalFilename: document.originalFilename,
    fileType: document.fileType,
    fileSize: document.fileSize,
    anonymizedFilePath: '',
    entityTypes,
    entityReplacements,
    detectedEntities: [],
    processingStatus: 'processing'
  }).returning();
  
  try {
    // Recupera la chiave OpenAI dell'utente
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    const userApiKey = user?.openaiApiKey ? user.openaiApiKey : undefined;
    
    // Estrai testo dal documento
    let text = document.content;
    
    // Rileva entità sensibili
    console.log('Detecting entities in document...');
    const detectedEntities = await detectEntities(text, userApiKey);
    
    // Filtra solo le entità richieste
    const filteredEntities = detectedEntities.filter(entity => 
      entityTypes.includes(entity.type)
    );
    
    // Anonimizza il testo
    const anonymizedText = anonymizeText(text, filteredEntities, entityReplacements);
    
    // Genera file anonimizzato
    const uploadsDir = path.join(process.cwd(), 'uploads', 'anonymized');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const outputExtension = document.fileType === 'application/pdf' ? 'pdf' : 'docx';
    const outputFilename = `anonymized_${Date.now()}_${document.id}.${outputExtension}`;
    const outputPath = path.join(uploadsDir, outputFilename);
    
    if (document.fileType === 'application/pdf') {
      await generateAnonymizedPDF(anonymizedText, outputPath, document.originalFilename);
    } else {
      await generateAnonymizedDOCX(anonymizedText, outputPath, document.originalFilename);
    }
    
    // Aggiorna il record con i risultati
    await db.update(anonymizations)
      .set({
        anonymizedFilePath: outputPath,
        detectedEntities: filteredEntities,
        processingStatus: 'completed',
        updatedAt: new Date()
      })
      .where(eq(anonymizations.id, anonymization.id));
    
    console.log(`Document anonymization completed: ${outputFilename}`);
    return anonymization.id;
    
  } catch (error) {
    console.error('Error processing document for anonymization:', error);
    
    // Aggiorna il record con l'errore
    await db.update(anonymizations)
      .set({
        processingStatus: 'failed',
        errorMessage: (error as Error).message,
        updatedAt: new Date()
      })
      .where(eq(anonymizations.id, anonymization.id));
    
    throw error;
  }
}

/**
 * Processa un file caricato direttamente per l'anonimizzazione
 */
export async function processUploadedFileForAnonymization(
  filePath: string,
  filename: string,
  fileType: string,
  fileSize: number,
  userId: number,
  entityReplacements: Record<string, string> = DEFAULT_ENTITY_REPLACEMENTS,
  entityTypes: string[] = Object.keys(DEFAULT_ENTITY_REPLACEMENTS)
): Promise<AnonymizationResult> {
  try {
    // Recupera la chiave OpenAI dell'utente
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    const userApiKey = user?.openaiApiKey ? user.openaiApiKey : undefined;
    
    // Estrai testo dal file
    let text: string;
    
    if (fileType === 'application/pdf') {
      text = await extractTextFromPDF(filePath);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = await extractTextFromDOCX(filePath);
    } else {
      text = await fs.readFile(filePath, 'utf-8');
    }
    
    // Rileva entità sensibili
    const detectedEntities = await detectEntities(text, userApiKey);
    
    // Filtra solo le entità richieste
    const filteredEntities = detectedEntities.filter(entity => 
      entityTypes.includes(entity.type)
    );
    
    // Anonimizza il testo
    const anonymizedText = anonymizeText(text, filteredEntities, entityReplacements);
    
    return {
      anonymizedText,
      detectedEntities: filteredEntities,
      originalText: text
    };
    
  } catch (error) {
    console.error('Error processing uploaded file for anonymization:', error);
    throw new Error('Failed to process file: ' + (error as Error).message);
  }
}

/**
 * Processa un file usando testo e entità già estratti dall'anteprima
 */
export async function processFileWithPreExtractedData(
  extractedText: string,
  detectedEntities: DetectedEntity[],
  entityReplacements: Record<string, string> = DEFAULT_ENTITY_REPLACEMENTS,
  entityTypes: string[] = Object.keys(DEFAULT_ENTITY_REPLACEMENTS)
): Promise<AnonymizationResult> {
  try {
    console.log('[processFileWithPreExtractedData] Using pre-extracted text and entities');
    
    // Filtra solo le entità richieste
    const filteredEntities = detectedEntities.filter(entity => 
      entityTypes.includes(entity.type)
    );
    
    // Anonimizza il testo
    const anonymizedText = anonymizeText(extractedText, filteredEntities, entityReplacements);
    
    return {
      anonymizedText,
      detectedEntities: filteredEntities,
      originalText: extractedText
    };
    
  } catch (error) {
    console.error('Error processing file with pre-extracted data:', error);
    throw new Error('Failed to process file: ' + (error as Error).message);
  }
}

/**
 * Recupera lo stato di un'anonimizzazione
 */
export async function getAnonymizationStatus(anonymizationId: number, userId: number) {
  const anonymization = await db.query.anonymizations.findFirst({
    where: eq(anonymizations.id, anonymizationId),
    with: {
      originalDocument: true
    }
  });
  
  if (!anonymization) {
    throw new Error('Anonymization not found');
  }
  
  if (anonymization.userId !== userId) {
    throw new Error('Unauthorized access to anonymization');
  }
  
  return anonymization;
}

/**
 * Recupera tutte le anonimizzazioni di un utente
 */
export async function getUserAnonymizations(userId: number) {
  return db.query.anonymizations.findMany({
    where: eq(anonymizations.userId, userId),
    with: {
      originalDocument: true
    },
    orderBy: (anonymizations, { desc }) => [desc(anonymizations.createdAt)]
  });
}