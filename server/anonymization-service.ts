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
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Sei un esperto in riconoscimento di entità sensibili per l'anonimizzazione di documenti legali e amministrativi italiani. 
          
          Analizza il testo e identifica TUTTE le entità sensibili che devono essere anonimizzate, incluse:
          - PERSON: Nomi e cognomi di persone
          - LOCATION: Città, province, regioni, paesi
          - EMAIL: Indirizzi email
          - PHONE: Numeri di telefono (fissi e cellulari)
          - ORGANIZATION: Nomi di aziende, enti, organizzazioni
          - DATE: Date specifiche (non anni generici)
          - ADDRESS: Indirizzi completi (via, numero civico)
          - POSTAL_CODE: Codici postali (CAP)
          - FISCAL_CODE: Codici fiscali italiani
          - VAT_NUMBER: Partite IVA
          - MONEY: Importi in denaro
          - CREDIT_CARD: Numeri di carte di credito
          - IBAN: Codici IBAN
          
          Rispondi SOLO con un JSON valido nel formato:
          {
            "entities": [
              {
                "text": "testo_trovato",
                "type": "TIPO_ENTITA",
                "start": posizione_inizio,
                "end": posizione_fine,
                "confidence": 0.95
              }
            ]
          }
          
          Sii molto accurato nelle posizioni start/end che devono corrispondere esattamente al testo originale.`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || '{"entities": []}');
    
    return result.entities.map((entity: any) => ({
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
  // Ordina le entità per posizione (dalla fine all'inizio per evitare problemi di offset)
  const sortedEntities = [...entities].sort((a, b) => b.position.start - a.position.start);
  
  let anonymizedText = text;
  
  for (const entity of sortedEntities) {
    const replacement = replacements[entity.type] || `[${entity.type}]`;
    const before = anonymizedText.substring(0, entity.position.start);
    const after = anonymizedText.substring(entity.position.end);
    anonymizedText = before + replacement + after;
  }
  
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
    const doc = new PdfPrinter({ size: 'A4', margin: 50 });
    const stream = fsSync.createWriteStream(outputPath);
    
    doc.pipe(stream);
    
    // Header
    doc.fontSize(16).text('DOCUMENTO ANONIMIZZATO', { align: 'center' });
    doc.fontSize(12).text(`Documento originale: ${originalFilename}`, { align: 'center' });
    doc.fontSize(10).text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Content
    doc.fontSize(11).text(text, { align: 'justify' });
    
    doc.end();
    
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

/**
 * Genera un file DOCX anonimizzato dal testo
 */
export async function generateAnonymizedDOCX(
  text: string,
  outputPath: string,
  originalFilename: string
): Promise<void> {
  const docxContent = `
    <html>
      <body>
        <h2 style="text-align: center;">DOCUMENTO ANONIMIZZATO</h2>
        <p style="text-align: center; font-size: 12px;">Documento originale: ${originalFilename}</p>
        <p style="text-align: center; font-size: 10px;">Generato il: ${new Date().toLocaleDateString('it-IT')}</p>
        <hr/>
        <div style="text-align: justify; font-size: 11px; line-height: 1.5;">
          ${text.replace(/\n/g, '<br/>')}
        </div>
      </body>
    </html>
  `;
  
  // Converti HTML in DOCX usando mammoth (reverse)
  // Per ora salviamo come file di testo formattato
  const formattedText = `DOCUMENTO ANONIMIZZATO\n\nDocumento originale: ${originalFilename}\nGenerato il: ${new Date().toLocaleDateString('it-IT')}\n\n${'-'.repeat(50)}\n\n${text}`;
  
  await fs.writeFile(outputPath, formattedText, 'utf-8');
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
    
    const userApiKey = user?.openaiApiKey;
    
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