/**
 * Adapter che implementa un'interfaccia simile a ChromaDB ma utilizza pgvector
 * per consentire un'integrazione trasparente con il resto dell'applicazione
 */
import { addDocumentToVectorStore, removeDocumentFromVectorStore, queryVectorStore } from './pgvector';
import { Document } from '@shared/schema';

/**
 * Adapter per pgvector che fornisce un'interfaccia simile a ChromaDB
 */
export class PgVectorAdapter {
  private readonly userId: number;
  private readonly apiKey?: string;

  /**
   * Crea un nuovo adapter per pgvector
   * @param userId ID dell'utente
   * @param apiKey Chiave API OpenAI opzionale
   */
  constructor(userId: number, apiKey?: string) {
    this.userId = userId;
    this.apiKey = apiKey;
  }

  /**
   * Aggiunge un documento alla collezione vettoriale
   * @param document Documento da aggiungere
   */
  async addDocument(document: Document): Promise<void> {
    await addDocumentToVectorStore(document, this.apiKey);
  }

  /**
   * Rimuove un documento dalla collezione vettoriale
   * @param documentId ID del documento da rimuovere
   */
  async removeDocument(documentId: number): Promise<void> {
    await removeDocumentFromVectorStore(documentId, this.userId);
  }

  /**
   * Esegue una query semantica nella collezione vettoriale
   * @param query Testo della query
   * @param documentIds Array di ID di documenti da considerare (opzionale)
   * @param limit Numero massimo di risultati da restituire
   * @returns Array di risultati con documentId, content e similarity
   */
  async query(query: string, documentIds?: number[], limit: number = 5): Promise<{
    documentId: number;
    content: string;
    similarity: number;
  }[]> {
    return await queryVectorStore(query, this.userId, documentIds, this.apiKey, limit);
  }
}

/**
 * Factory function per creare un adapter pgvector per un determinato utente
 * @param userId ID dell'utente
 * @param apiKey Chiave API OpenAI opzionale
 * @returns Istanza di PgVectorAdapter
 */
export function createPgVectorAdapter(userId: number, apiKey?: string): PgVectorAdapter {
  return new PgVectorAdapter(userId, apiKey);
}