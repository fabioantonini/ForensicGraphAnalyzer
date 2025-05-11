/**
 * Module per la gestione degli embedding utilizzando pgvector
 */
import { db } from "./db";
import { sql } from "drizzle-orm";
import { Document, documents, documentEmbeddings } from "@shared/schema";
import { generateEmbedding } from "./openai";
import { eq, and } from "drizzle-orm";

// Dimensione standard del chunk per il testo (caratteri)
const CHUNK_SIZE = 1000;

/**
 * Divide il testo del documento in chunk di dimensioni appropriate
 * @param text Testo completo del documento
 * @returns Array di chunk testuali
 */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  // Creiamo chunk che si sovrappongono leggermente per garantire continuità semantica
  for (let i = 0; i < text.length; i += CHUNK_SIZE - 200) {
    const chunk = text.substring(i, i + CHUNK_SIZE);
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

/**
 * Aggiunge un documento alla collezione vettoriale
 * @param document Documento da aggiungere
 * @param apiKey Chiave API di OpenAI (opzionale)
 */
export async function addDocumentToVectorStore(document: Document, apiKey?: string): Promise<void> {
  try {
    console.log(`Aggiunta documento ID ${document.id} al vector store...`);
    // Dividi il testo in chunk
    const chunks = chunkText(document.content);
    
    // Per ogni chunk, genera l'embedding e salvalo nel database
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Genera l'embedding utilizzando OpenAI
      const embedding = await generateEmbedding(chunk, apiKey);
      
      // Salva l'embedding nel database utilizzando una query SQL diretta
      // poiché Drizzle ORM non supporta nativamente il tipo vector
      await db.execute(
        sql`INSERT INTO document_embeddings 
            (document_id, user_id, chunk_index, chunk_content, embedding, created_at, updated_at)
            VALUES 
            (${document.id}, ${document.userId}, ${i}, ${chunk}, ${sql.raw(`'[${embedding.join(',')}]'`)}, NOW(), NOW())`
      );
    }
    
    // Aggiorna lo stato del documento come indicizzato
    await db.update(documents)
      .set({ indexed: true })
      .where(eq(documents.id, document.id));
      
    console.log(`Documento ID ${document.id} aggiunto con successo al vector store (${chunks.length} chunks)`);
  } catch (error: any) {
    console.error(`Errore nell'aggiunta del documento al vector store:`, error);
    throw new Error(`Impossibile aggiungere il documento al vector store: ${error.message}`);
  }
}

/**
 * Rimuove un documento dalla collezione vettoriale
 * @param documentId ID del documento da rimuovere
 * @param userId ID dell'utente proprietario
 */
export async function removeDocumentFromVectorStore(documentId: number, userId: number): Promise<void> {
  try {
    console.log(`Rimozione documento ID ${documentId} dal vector store...`);
    
    // Elimina tutti gli embedding associati al documento
    await db.execute(
      sql`DELETE FROM document_embeddings 
          WHERE document_id = ${documentId} AND user_id = ${userId}`
    );
    
    console.log(`Documento ID ${documentId} rimosso con successo dal vector store`);
  } catch (error: any) {
    console.error(`Errore nella rimozione del documento dal vector store:`, error);
    throw new Error(`Impossibile rimuovere il documento dal vector store: ${error.message}`);
  }
}

// Definizione corretta dell'interfaccia per i risultati delle query
export interface QueryResult {
  documentId: number;
  content: string;
  similarity: number;
  [key: string]: unknown; // Permette proprietà aggiuntive per compatibilità con Record<string, unknown>
}

/**
 * Esegue una query semantica nella collezione vettoriale
 * @param query Testo della query
 * @param userId ID dell'utente
 * @param documentIds Array di ID di documenti da considerare (opzionale)
 * @param apiKey Chiave API di OpenAI (opzionale)
 * @param limit Numero massimo di risultati da restituire
 * @returns Array di risultati ordinati per similarità
 */
export async function queryVectorStore(
  query: string,
  userId: number,
  documentIds?: number[],
  apiKey?: string,
  limit: number = 5
): Promise<QueryResult[]> {
  try {
    console.log(`Esecuzione query "${query}" nel vector store...`);
    
    // Conta quanti documenti e chunks ha l'utente
    try {
      const countResults = await db.execute(
        sql`
          SELECT COUNT(*) as total_chunks, COUNT(DISTINCT document_id) as total_docs
          FROM document_embeddings
          WHERE user_id = ${userId}
        `
      );
      
      // Evitiamo di usare JSON.stringify per oggetti complessi
      try {
        console.log("Tipo countResults:", typeof countResults);
        console.log("countResults è un array?", Array.isArray(countResults));
        
        if (typeof countResults === 'object' && countResults !== null) {
          console.log("Proprietà di countResults:", Object.keys(countResults));
        }
        
        if (Array.isArray(countResults) && countResults.length > 0) {
          console.log("Proprietà del primo elemento:", Object.keys(countResults[0]));
        }
      } catch (logError) {
        console.log("Errore durante il logging dei risultati di conteggio:", logError);
      }
      
      // Verifica il formato esatto della risposta
      if (Array.isArray(countResults) && countResults.length > 0) {
        const totalItems = countResults[0];
        console.log(`L'utente ${userId} ha ${totalItems.total_docs || 'unknown'} documenti e ${totalItems.total_chunks || 'unknown'} chunk nel vector store`);
      } else {
        console.log(`Formato di risposta imprevisto per la count query:`, typeof countResults);
      }
    } catch (countError) {
      console.log(`Errore durante il conteggio dei documenti: ${countError}`);
    }
    
    // Genera l'embedding della query
    const queryEmbedding = await generateEmbedding(query, apiKey);
    console.log(`Embedding generato, dimensione: ${queryEmbedding.length}`);
    
    // Prepara la where condition in base ai parametri
    let whereCondition = `WHERE user_id = ${userId}`;
    if (documentIds && documentIds.length > 0) {
      whereCondition += ` AND document_id IN (${documentIds.join(',')})`;
      console.log(`Query filtrata per i documenti: ${documentIds.join(', ')}`);
    }
    
    // Esegui la query di similarità con tipizzazione corretta
    const sqlQuery = sql`
      SELECT 
        document_id as "documentId", 
        chunk_content as "content", 
        1 - (embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}) as "similarity"
      FROM document_embeddings
      ${sql.raw(whereCondition)}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
    
    console.log(`Esecuzione query SQL nel vector store...`);
    
    try {
      const rawResults = await db.execute(sqlQuery);
      console.log("Formato risultati SQL:", typeof rawResults);
      console.log("È un array?", Array.isArray(rawResults));
      
      // Evitiamo di usare JSON.stringify per oggetti complessi
      try {
        const firstResult = Array.isArray(rawResults) && rawResults.length > 0 ? rawResults[0] : null;
        console.log("Primo risultato:", firstResult);
        
        if (typeof rawResults === 'object' && rawResults !== null) {
          console.log("Proprietà dell'oggetto risultati:", Object.keys(rawResults));
        }
      } catch (logError) {
        console.log("Errore durante il logging dei risultati:", logError);
      }
      
      // Vediamo se c'è la proprietà rows, che è comune nei client PostgreSQL
      if (rawResults && typeof rawResults === 'object' && 'rows' in rawResults && Array.isArray(rawResults.rows)) {
        console.log(`Query completata, trovati ${rawResults.rows.length} risultati nella proprietà 'rows'`);
        return rawResults.rows as Array<QueryResult>;
      }
      
      // In alternativa, controlliamo se è già un array
      if (rawResults && Array.isArray(rawResults)) {
        console.log(`Query completata, trovati ${rawResults.length} risultati nell'array`);
        return rawResults as Array<QueryResult>;
      }
      
      console.log(`Query completata, ma risultati non validi:`, rawResults);
      return [];
    } catch (sqlError) {
      console.error("Errore nell'esecuzione della query SQL:", sqlError);
      return [];
    }
  } catch (error: any) {
    console.error(`Errore nell'esecuzione della query nel vector store:`, error);
    throw new Error(`Impossibile eseguire la query nel vector store: ${error.message}`);
  }
}

/**
 * Ottiene le statistiche degli embedding per un utente
 * @param userId ID dell'utente
 * @returns Statistiche sugli embedding
 */
export async function getVectorStoreStats(userId: number): Promise<{
  documentCount: number;
  embeddingCount: number;
  totalChunks: number;
}> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT document_id) as "documentCount",
        COUNT(*) as "embeddingCount",
        SUM(chunk_index) as "totalChunks"
      FROM document_embeddings
      WHERE user_id = ${userId}
    `);
    
    // Accesso sicuro ai risultati con tipizzazione corretta
    const stats = result as unknown as Array<{
      documentCount: number;
      embeddingCount: number;
      totalChunks: number;
    }>;
    
    return (stats.length > 0 && stats[0]) 
      ? stats[0] 
      : { documentCount: 0, embeddingCount: 0, totalChunks: 0 };
  } catch (error: any) {
    console.error(`Errore nel recupero delle statistiche del vector store:`, error);
    return { documentCount: 0, embeddingCount: 0, totalChunks: 0 };
  }
}