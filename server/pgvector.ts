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

interface QueryResult {
  documentId: number;
  content: string;
  similarity: number;
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
    
    // Genera l'embedding della query
    const queryEmbedding = await generateEmbedding(query, apiKey);
    
    // Prepara la where condition in base ai parametri
    let whereCondition = `WHERE user_id = ${userId}`;
    if (documentIds && documentIds.length > 0) {
      whereCondition += ` AND document_id IN (${documentIds.join(',')})`;
    }
    
    // Esegui la query di similarità
    const results = await db.execute<QueryResult>(
      sql`
        SELECT 
          document_id as "documentId", 
          chunk_content as "content", 
          1 - (embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}) as "similarity"
        FROM document_embeddings
        ${sql.raw(whereCondition)}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `
    );
    
    console.log(`Query completata, trovati ${results.length} risultati`);
    return results;
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
    const result = await db.execute<{
      documentCount: number;
      embeddingCount: number;
      totalChunks: number;
    }>(sql`
      SELECT 
        COUNT(DISTINCT document_id) as "documentCount",
        COUNT(*) as "embeddingCount",
        SUM(chunk_index) as "totalChunks"
      FROM document_embeddings
      WHERE user_id = ${userId}
    `);
    
    return result[0] || { documentCount: 0, embeddingCount: 0, totalChunks: 0 };
  } catch (error: any) {
    console.error(`Errore nel recupero delle statistiche del vector store:`, error);
    return { documentCount: 0, embeddingCount: 0, totalChunks: 0 };
  }
}