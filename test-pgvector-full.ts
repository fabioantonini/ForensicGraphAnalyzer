/**
 * Script di test completo per verificare il funzionamento del sistema pgvector
 */
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { testDatabaseConnection, isPgVectorAvailable } from './server/db';
import { documents } from './shared/schema';

// Funzione mock per generare un vettore di embedding
function generateMockEmbedding(text: string): number[] {
  // Genera un vettore casuale di 1536 dimensioni (come OpenAI embedding)
  const embedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  
  // Normalizza il vettore (somma dei quadrati = 1)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function main() {
  try {
    console.log("=== TEST COMPLETO PGVECTOR INTEGRATION ===");
    
    // Test 1: Verifica connessione al database
    console.log("\n[TEST 1] Verifica connessione al database PostgreSQL");
    const isConnected = await testDatabaseConnection();
    console.log(`Connessione al database PostgreSQL: ${isConnected ? 'OK' : 'FALLITA'}`);
    
    if (!isConnected) {
      console.error("Impossibile connettersi al database PostgreSQL. Test interrotto.");
      return;
    }
    
    // Test 2: Verifica disponibilità pgvector
    console.log("\n[TEST 2] Verifica disponibilità pgvector");
    const vectorAvailable = await isPgVectorAvailable();
    console.log(`Estensione pgvector disponibile: ${vectorAvailable ? 'OK' : 'NON DISPONIBILE'}`);
    
    if (!vectorAvailable) {
      console.error("Estensione pgvector non disponibile. Test interrotto.");
      return;
    }
    
    // Test 3: Verifica struttura tabella document_embeddings
    console.log("\n[TEST 3] Verifica struttura tabella document_embeddings");
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'document_embeddings'
        ) as "exists"
      `);
      
      const tableExists = (result as any)[0]?.exists;
      console.log(`Tabella document_embeddings esiste: ${tableExists ? 'OK' : 'NON ESISTE'}`);
      
      if (!tableExists) {
        console.log("Creazione tabella document_embeddings...");
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS document_embeddings (
            id SERIAL PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            chunk_index INTEGER NOT NULL,
            chunk_content TEXT NOT NULL,
            embedding vector(1536),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);
        console.log("Tabella document_embeddings creata con successo");
      }
    } catch (error) {
      console.error("Errore durante la verifica della tabella:", error);
      return;
    }
    
    // Test 4: Creazione di un documento di test
    console.log("\n[TEST 4] Creazione di un documento di test");
    const testUserId = 1; // Utente di test (deve esistere)
    let testDocumentId = 0;
    const testContent = "Questo è un contenuto di test per verificare il funzionamento di pgvector in GrapholexInsight.";
    
    try {
      // Verifica se l'utente esiste
      const userCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM users WHERE id = ${testUserId}
      `);
      
      if ((userCheck as any)[0]?.count === '0') {
        console.error(`L'utente con ID ${testUserId} non esiste. Impossibile continuare.`);
        return;
      }
      
      // Verifica se esiste già un documento di test
      const docCheck = await db.execute(sql`
        SELECT id FROM documents 
        WHERE user_id = ${testUserId} AND original_filename = 'pgvector_test.txt'
      `);
      
      if ((docCheck as any).length > 0) {
        testDocumentId = (docCheck as any)[0].id;
        console.log(`Documento di test esistente trovato con ID: ${testDocumentId}`);
      } else {
        // Crea un nuovo documento di test
        const insertResult = await db.insert(documents).values({
          userId: testUserId,
          filename: 'pgvector_test.txt', // Campo richiesto
          originalFilename: 'pgvector_test.txt',
          fileType: 'text/plain',
          fileSize: testContent.length, // Nome corretto del campo
          content: testContent,
          indexed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning({ id: documents.id });
        
        testDocumentId = insertResult[0].id;
        console.log(`Nuovo documento di test creato con ID: ${testDocumentId}`);
      }
    } catch (error) {
      console.error("Errore durante la creazione del documento di test:", error);
      return;
    }
    
    // Test 5: Inserimento di un embedding di test
    console.log("\n[TEST 5] Inserimento di un embedding di test");
    
    try {
      // Genera un embedding mock per il contenuto di test
      console.log("Generazione embedding mock di test...");
      const embedding = generateMockEmbedding(testContent);
      console.log(`Embedding mock generato con dimensione: ${embedding.length}`);
      
      // Rimuovi embedding esistenti per questo documento
      await db.execute(sql`
        DELETE FROM document_embeddings 
        WHERE document_id = ${testDocumentId}
      `);
      
      // Inserisci nuovo embedding di test
      await db.execute(sql`
        INSERT INTO document_embeddings (
          document_id, user_id, chunk_index, chunk_content, embedding
        ) VALUES (
          ${testDocumentId}, 
          ${testUserId}, 
          0, 
          ${testContent}, 
          ${sql.raw(`'[${embedding.join(',')}]'::vector`)}
        )
      `);
      
      console.log("Embedding di test inserito con successo");
    } catch (error) {
      console.error("Errore durante l'inserimento dell'embedding di test:", error);
      return;
    }
    
    // Test 6: Ricerca di similarità
    console.log("\n[TEST 6] Ricerca di similarità");
    try {
      const queryText = "Verifica funzionamento pgvector GrapholexInsight";
      console.log(`Query di test: "${queryText}"`);
      
      // Genera embedding mock per la query
      const queryEmbedding = generateMockEmbedding(queryText);
      
      // Esegui query di similarità
      const results = await db.execute(sql`
        SELECT 
          document_id as "documentId", 
          chunk_content as "content", 
          1 - (embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}) as "similarity"
        FROM document_embeddings
        WHERE user_id = ${testUserId}
        ORDER BY similarity DESC
        LIMIT 5
      `);
      
      console.log("Risultati della ricerca:");
      if ((results as any[]).length === 0) {
        console.log("Nessun risultato trovato");
      } else {
        for (const result of results as any[]) {
          console.log(`- Document #${result.documentId} (Similarity: ${result.similarity.toFixed(4)})`);
          console.log(`  Content: "${result.content.substring(0, 50)}..."`);
        }
      }
    } catch (error) {
      console.error("Errore durante la ricerca di similarità:", error);
      return;
    }
    
    // Opzionale: Test 7: Pulizia dei dati di test
    // Per mantenere i dati di test per verifiche successive, commentiamo questa parte
    /*
    console.log("\n[TEST 7] Pulizia dei dati di test");
    try {
      // Rimuovi gli embedding
      await db.execute(sql`
        DELETE FROM document_embeddings 
        WHERE document_id = ${testDocumentId}
      `);
      
      // Rimuovi il documento
      await db.execute(sql`
        DELETE FROM documents
        WHERE id = ${testDocumentId} AND original_filename = 'pgvector_test.txt'
      `);
      
      console.log("Dati di test rimossi con successo");
    } catch (error) {
      console.error("Errore durante la pulizia dei dati di test:", error);
    }
    */
    
    console.log("\n=== TEST COMPLETATI ===");
  } catch (error) {
    console.error("Errore durante i test:", error);
  } finally {
    process.exit(0);
  }
}

main();