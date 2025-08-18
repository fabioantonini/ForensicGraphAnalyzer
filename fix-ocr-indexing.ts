#!/usr/bin/env tsx

/**
 * Script per indicizzare manualmente documenti OCR nella base di conoscenza
 * Questi documenti sono stati salvati ma non sono stati inseriti nel vector store
 */

import { db } from './server/db';
import { documents } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import { generateEmbedding } from './server/openai';
import { sql } from 'drizzle-orm';

// Funzione per dividere il testo in chunk
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '.';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 20); // Filtra chunk troppo piccoli
}

async function indexOCRDocuments() {
  console.log("🔍 Ricerca documenti OCR non indicizzati...");
  
  try {
    // Trova documenti OCR non indicizzati per l'utente 3 (fabioantonini)
    const unindexedDocs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, 3),
          eq(documents.source, 'ocr'),
          eq(documents.indexed, false)
        )
      );
    
    console.log(`📋 Trovati ${unindexedDocs.length} documenti OCR da indicizzare`);
    
    for (const doc of unindexedDocs) {
      console.log(`\n📄 Indicizzando documento: ${doc.original_filename}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Dimensione testo: ${doc.content?.length || 0} caratteri`);
      
      if (!doc.content || doc.content.trim().length === 0) {
        console.log(`   ⚠️ SALTATO: Contenuto vuoto`);
        continue;
      }
      
      try {
        // Crea embedding e inseriscilo manualmente nel vector store
        const textChunks = chunkText(doc.content);
        console.log(`   - Creando ${textChunks.length} embedding chunks`);
        
        for (let i = 0; i < textChunks.length; i++) {
          const chunk = textChunks[i];
          const embedding = await generateEmbedding(chunk, 3); // Usa userId per fallback API key
          
          // Inserisci embedding nel database
          await db.execute(
            sql`INSERT INTO document_embeddings 
                (document_id, user_id, chunk_index, chunk_content, embedding, created_at, updated_at)
                VALUES 
                (${doc.id}, ${doc.userId}, ${i}, ${chunk}, ${'[' + embedding.join(',') + ']'}::vector, NOW(), NOW())`
          );
        }
        
        // Aggiorna il flag indexed
        await db
          .update(documents)
          .set({ 
            indexed: true,
            updatedAt: new Date()
          })
          .where(eq(documents.id, doc.id));
        
        console.log(`   ✅ SUCCESSO: ${textChunks.length} embedding creati nel vector store`);
        
      } catch (error: any) {
        console.log(`   ❌ ERRORE: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Processo completato!`);
    
    // Verifica finale
    const remainingUnindexed = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, 3),
          eq(documents.source, 'ocr'),
          eq(documents.indexed, false)
        )
      );
    
    console.log(`📊 Documenti OCR ancora non indicizzati: ${remainingUnindexed.length}`);
    
  } catch (error: any) {
    console.error("💥 Errore durante l'indicizzazione:", error.message);
    console.error(error);
  }
  
  process.exit(0);
}

// Esegui lo script
indexOCRDocuments();