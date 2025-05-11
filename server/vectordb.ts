/**
 * Modulo per la gestione della persistenza vettoriale usando pgvector
 * Sostituisce ChromaDB con una soluzione basata su PostgreSQL per maggiore affidabilità
 */

import { Document } from '@shared/schema';
import { log } from './vite';
import { createPgVectorAdapter } from './pgvector-adapter';
import { testDatabaseConnection, isPgVectorAvailable, db } from './db';
import { sql } from 'drizzle-orm';

// Stato del sistema di persistenza vettoriale
let isPgVectorEnabled = false;

// Fallback in-memory store
interface InMemoryDocument {
  id: string;
  content: string;
  metadata: any;
  userId: number;
}
const inMemoryDocuments = new Map<string, InMemoryDocument>();

/**
 * Inizializza il sistema di persistenza vettoriale (pgvector)
 * @returns Promise che si risolve a true se pgvector è disponibile, false altrimenti
 */
export async function initializeVectorDB() {
  log(`Inizializzazione sistema di persistenza vettoriale...`, "database");
  
  try {
    // Verifica connessione al database PostgreSQL
    const pgConnected = await testDatabaseConnection();
    
    if (pgConnected) {
      log(`Connessione al database PostgreSQL verificata con successo`, "database");
      
      // Verifica che l'estensione pgvector sia disponibile
      const vectorAvailable = await isPgVectorAvailable();
      
      if (vectorAvailable) {
        // Verifica che la tabella document_embeddings esista
        try {
          await db.execute(sql`SELECT COUNT(*) FROM document_embeddings LIMIT 1`);
          log(`Tabella document_embeddings verificata con successo`, "database");
          isPgVectorEnabled = true;
          log(`Sistema di persistenza vettoriale pgvector abilitato e funzionante`, "database");
          return true;
        } catch (tableError) {
          log(`Errore nella verifica della tabella document_embeddings: ${tableError}`, "database");
          log(`Sarà utilizzato lo storage di fallback in-memory`, "database");
        }
      } else {
        log(`Estensione pgvector non disponibile`, "database");
        log(`Sarà utilizzato lo storage di fallback in-memory`, "database");
      }
    } else {
      log(`Connessione al database PostgreSQL fallita`, "database");
      log(`Sarà utilizzato lo storage di fallback in-memory`, "database");
    }
    
    return false;
  } catch (error) {
    log(`Errore durante l'inizializzazione del sistema vettoriale: ${error}`, "database");
    log(`Sarà utilizzato lo storage di fallback in-memory`, "database");
    return false;
  }
}

/**
 * Ottiene la collection per un utente specifico
 * @param userId ID dell'utente
 * @param apiKey Chiave API OpenAI opzionale
 * @returns Adapter per la collection dell'utente
 */
export async function getUserCollection(userId: number, apiKey?: string) {
  // Utilizza sempre pgvector quando disponibile
  if (isPgVectorEnabled) {
    try {
      return createPgVectorAdapter(userId, apiKey);
    } catch (error) {
      log(`Errore nella creazione dell'adapter pgvector: ${error}`, "database");
      // Continua con il fallback
    }
  }
  
  // Fallback all'in-memory store
  log(`Utilizzo storage in-memory per l'utente ${userId}`, "database");
  return null;
}

/**
 * Aggiunge un documento al sistema di persistenza vettoriale
 * @param document Documento da aggiungere
 * @param apiKey Chiave API OpenAI opzionale
 * @returns Promise che si risolve quando il documento è stato aggiunto
 */
export async function addDocumentToCollection(
  document: Document,
  apiKey?: string
): Promise<void> {
  const userId = document.userId;
  
  // Tentativo con pgvector se disponibile
  if (isPgVectorEnabled) {
    try {
      log(`Aggiunta documento al vector store pgvector per utente ${userId}`, "database");
      const pgAdapter = createPgVectorAdapter(userId, apiKey);
      await pgAdapter.addDocument(document);
      return;
    } catch (error) {
      log(`Errore nell'aggiunta al vector store pgvector: ${error}`, "database");
      // Continua con il fallback
    }
  }
  
  // Fallback all'in-memory store
  log(`Aggiunta documento all'in-memory store per utente ${userId}`, "database");
  
  // Estrai paragrafi dal documento
  const paragraphs = document.content
    .split('\n\n')
    .filter(p => p.trim().length > 0)
    .map(p => p.trim());
  
  // Inizializza il tracciamento del progresso se non è già stato fatto
  const progress = getProgress(document.id);
  if (!progress) {
    initProgress(document.id, paragraphs.length);
  }
  
  for (let i = 0; i < paragraphs.length; i++) {
    const docId = `${document.id}-${i}`;
    inMemoryDocuments.set(docId, {
      id: docId,
      content: paragraphs[i],
      metadata: {
        documentId: document.id,
        filename: document.originalFilename,
        index: i
      },
      userId
    });
    
    // Aggiorna il progresso per ogni chunk elaborato
    updateProgress(document.id, i + 1);
  }
  
  // Segna il completamento dell'elaborazione
  completeProgress(document.id);
  
  log(`Documento aggiunto all'in-memory store con ${paragraphs.length} chunk`, "database");
}

/**
 * Rimuove un documento dal sistema di persistenza vettoriale
 * @param documentId ID del documento da rimuovere
 * @param userId ID dell'utente proprietario
 * @returns Promise che si risolve quando il documento è stato rimosso
 */
export async function removeDocumentFromCollection(
  documentId: number,
  userId: number
): Promise<void> {
  // Tentativo con pgvector se disponibile
  if (isPgVectorEnabled) {
    try {
      log(`Rimozione documento dal vector store pgvector per utente ${userId}`, "database");
      const pgAdapter = createPgVectorAdapter(userId);
      await pgAdapter.removeDocument(documentId);
      return;
    } catch (error) {
      log(`Errore nella rimozione dal vector store pgvector: ${error}`, "database");
      // Continua con il fallback
    }
  }
  
  // Fallback all'in-memory store
  log(`Rimozione documento dall'in-memory store per utente ${userId}`, "database");
  
  // Rimuovi tutti i chunk associati al documento
  // Utilizziamo Array.from per maggiore compatibilità
  Array.from(inMemoryDocuments.entries()).forEach(([key, doc]) => {
    if (doc.userId === userId && doc.metadata.documentId === documentId) {
      inMemoryDocuments.delete(key);
    }
  });
  
  log(`Documento rimosso dall'in-memory store`, "database");
}

/**
 * Esegue una query sul sistema di persistenza vettoriale
 * @param userId ID dell'utente
 * @param query Testo della query
 * @param documentIds Array di ID di documenti da considerare (opzionale)
 * @param apiKey Chiave API OpenAI opzionale
 * @param k Numero massimo di risultati da restituire
 * @returns Promise con i risultati della query
 */
export async function queryCollection(
  userId: number,
  query: string,
  documentIds?: number[],
  apiKey?: string,
  k: number = 5
): Promise<{
  documents: string[];
  metadatas: Record<string, any>[];
  ids: string[];
  distances: number[];
}> {
  // Try pgvector search when enabled
  if (isPgVectorEnabled) {
    try {
      log(`Trying pgvector search for user ${userId}`, "database");
      
      try {
        // Create pgvector adapter
        const pgAdapter = createPgVectorAdapter(userId, apiKey);
        
        // Query pgvector
        const pgResults = await pgAdapter.query(query, documentIds, k);
        
        // Log detailed results for debugging
        log(`Esecuzione query "${query}" nel vector store...`, "database");
        log(`Query pgvector ha restituito ${pgResults ? pgResults.length : 'nessun'} risultato/i`, "database");
        
        if (pgResults && pgResults.length > 0) {
          log(`Found ${pgResults.length} results using pgvector for query: "${query}"`, "database");
          
          // Map pgvector results to expected format
          return {
            documents: pgResults.map(r => r.content),
            metadatas: pgResults.map(r => ({ 
              documentId: r.documentId,
              filename: 'unknown' // Non possiamo accedere a r.metadata direttamente
            })),
            ids: pgResults.map(r => r.documentId.toString()),
            distances: pgResults.map(r => 1 - r.similarity) // Convert similarity to distance
          };
        } else {
          log(`Nessun risultato trovato in pgvector per la query: "${query}"`, "database");
        }
      } catch (pgQueryError) {
        log(`Errore durante la query pgvector: ${pgQueryError}`, "database");
      }
      
      log(`No results from pgvector, falling back to in-memory search`, "database");
    } catch (error) {
      log(`Error using pgvector search: ${error}`, "database");
      // Continue with fallback
    }
  }
  
  // Fallback to in-memory search
  log(`Using in-memory documents for query from user ${userId}`, "database");
  
  // Filter documents by user ID and document IDs
  const userDocs = Array.from(inMemoryDocuments.values()).filter(doc => {
    if (doc.userId !== userId) return false;
    if (documentIds && documentIds.length > 0) {
      return documentIds.includes(doc.metadata.documentId);
    }
    return true;
  });
  
  if (userDocs.length === 0) {
    log(`No documents found for user ${userId} with requested document IDs`, "database");
    return {
      documents: [],
      metadatas: [],
      ids: [],
      distances: []
    };
  }
  
  // Simple keyword matching as fallback
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 3);
  
  // Score documents based on keyword matches
  const scoredDocs = userDocs.map(doc => {
    const content = doc.content.toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        score += 1;
      }
    }
    
    return {
      doc,
      score
    };
  });
  
  // Sort by score descending
  scoredDocs.sort((a, b) => b.score - a.score);
  
  // Take top k results
  const topResults = scoredDocs.slice(0, k).filter(r => r.score > 0);
  
  log(`Found ${topResults.length} results using in-memory search for query: "${query}"`, "database");
  
  return {
    documents: topResults.map(r => r.doc.content),
    metadatas: topResults.map(r => r.doc.metadata),
    ids: topResults.map(r => r.doc.id),
    distances: topResults.map(r => 1 - r.score / keywords.length) // Normalized distance
  };
}