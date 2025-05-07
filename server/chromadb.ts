import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { Document } from '@shared/schema';
import { log } from './vite';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Configurazione directory di persistenza ChromaDB
const CHROMA_PERSISTENCE_DIR = path.join(process.cwd(), 'chroma_data');

// Assicuriamoci che la directory esista
if (!fs.existsSync(CHROMA_PERSISTENCE_DIR)) {
  fs.mkdirSync(CHROMA_PERSISTENCE_DIR, { recursive: true });
  log(`Directory di persistenza ChromaDB creata: ${CHROMA_PERSISTENCE_DIR}`, "chromadb");
}

// APPROCCIO MULTISTRATEGIA
// 1. Primo tentativo: HTTP Client (necessario per JS)
// 2. Secondo tentativo: Persistenza diretta tramite client Python integrato

// Configurazione del client ChromaDB per connettersi al server HTTP
// Definiamo esplicitamente l'host e la porta per garantire la corretta connessione
let chromaClient = new ChromaClient({
  path: 'http://localhost:8000'
});
log(`Client ChromaDB creato in modalità HTTP su http://localhost:8000`, "chromadb");

// Funzione per avviare il server ChromaDB se non è in esecuzione
async function startChromaDBServer(): Promise<boolean> {
  try {
    // Controllo se il server è già in esecuzione
    if (fs.existsSync('chroma.pid')) {
      const pid = parseInt(fs.readFileSync('chroma.pid', 'utf-8').trim(), 10);
      try {
        // In Node.js, process.kill(pid, 0) non uccide il processo,
        // ma verifica solo se il processo esiste e se abbiamo i permessi per inviargli un segnale
        process.kill(pid, 0);
        log(`ChromaDB server è già in esecuzione con PID ${pid}`, "chromadb");
        return true;
      } catch (e) {
        // Se il processo non esiste, rimuovi il file PID
        log(`Rimozione file PID obsoleto`, "chromadb");
        fs.unlinkSync('chroma.pid');
      }
    }

    // Avvio del server ChromaDB
    log(`Tentativo di avvio del server ChromaDB...`, "chromadb");
    
    const serverProcess = child_process.spawn('python', ['server/chroma-server.py'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Salvataggio del PID
    fs.writeFileSync('chroma.pid', serverProcess.pid?.toString() || '');
    
    // Cattura dell'output per il logging
    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        log(`[ChromaDB Server] ${data.toString().trim()}`, "chromadb");
      });
    }
    
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        log(`[ChromaDB Server Error] ${data.toString().trim()}`, "chromadb");
      });
    }
    
    // Ignorare il processo padre per permettergli di continuare a funzionare in background
    serverProcess.unref();
    
    // Attendere un momento per dare tempo al server di avviarsi
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    log(`ChromaDB server avviato con PID ${serverProcess.pid}`, "chromadb");
    return true;
  } catch (error) {
    log(`Errore durante l'avvio del server ChromaDB: ${error}`, "chromadb");
    return false;
  }
}


// Map to store user-specific collections (for our in-memory fallback)
const userCollections = new Map<number, Collection>();
let isChromaAvailable = false;

// Our in-memory document storage (used when ChromaDB is unavailable)
interface InMemoryDocument {
  id: string;
  content: string;
  metadata: any;
  userId: number;
}
const inMemoryDocuments = new Map<string, InMemoryDocument>();

// Initialize ChromaDB service
export async function initializeChromaDB() {
  log(`Verifica disponibilità ChromaDB...`, "chromadb");
  
  // Test function for connection to ChromaDB
  const testConnection = async () => {
    try {
      return await chromaClient.listCollections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Connessione a ChromaDB fallita: ${errorMessage}`);
    }
  };
  
  // Timeout promise to avoid hanging
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout connessione ChromaDB')), 3000);
  });
  
  try {
    // First attempt: try to connect directly
    try {
      const collections = await Promise.race([testConnection(), timeoutPromise]);
      
      // If we get here, connection successful
      if (collections && collections.length > 0) {
        log(`ChromaDB disponibile con ${collections.length} collections esistenti`, "chromadb");
        
        // Log collections for debug
        for (const collection of collections) {
          log(`Collection trovata: ${collection}`, "chromadb");
        }
      } else {
        log(`ChromaDB disponibile, nessuna collection esistente`, "chromadb");
      }
      
      isChromaAvailable = true;
      return true;
    } catch (initialError) {
      // Connection failed on first attempt, try starting server
      const errorMessage = initialError instanceof Error ? initialError.message : String(initialError);
      log(`Tentativo iniziale fallito: ${errorMessage}`, "chromadb");
      log(`Tentativo di avvio del server ChromaDB...`, "chromadb");
      
      // Try to start ChromaDB server
      const serverStarted = await startChromaDBServer();
      
      if (serverStarted) {
        // Wait a moment for server to initialize
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try connecting again
        try {
          const collections = await Promise.race([testConnection(), timeoutPromise]);
          
          if (collections) {
            log(`Connessione al server ChromaDB riuscita dopo l'avvio`, "chromadb");
            isChromaAvailable = true;
            return true;
          }
        } catch (secondError) {
          const secondErrorMessage = secondError instanceof Error ? secondError.message : String(secondError);
          log(`Impossibile connettersi al server ChromaDB dopo l'avvio: ${secondErrorMessage}`, "chromadb");
          // Continue to fallback
        }
      }
      
      // If we're here, all attempts failed - activate fallback
      log(`Impossibile avviare o connettersi al server ChromaDB`, "chromadb");
      log(`Sistema fallback in-memory attivato`, "chromadb");
      isChromaAvailable = false;
      return false;
    }
  } catch (error) {
    // Catch-all error handler
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Problema con ChromaDB: ${errorMessage}`, "chromadb");
    log(`Sistema fallback in-memory attivato per sicurezza`, "chromadb");
    isChromaAvailable = false;
    return false;
  }
}

// Get or create a collection for a user
export async function getUserCollection(userId: number, apiKey?: string): Promise<Collection> {
  // Check if we already have a cached collection for this user
  if (userCollections.has(userId)) {
    return userCollections.get(userId)!;
  }

  // If ChromaDB is not available, create a mock collection for fallback mode
  if (!isChromaAvailable) {
    log(`ChromaDB server not available, using mock collection for user ${userId}`, "chromadb");
    const mockCollection = {
      name: `user_${userId}_documents`,
      // Add properties needed for mock implementation
    } as unknown as Collection;
    
    userCollections.set(userId, mockCollection);
    return mockCollection;
  }

  try {
    // Create embedding function using the user's OpenAI API key or system default
    const embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: apiKey || process.env.OPENAI_API_KEY,
      openai_model: "text-embedding-ada-002"
    });

    // Try to get or create a real collection in ChromaDB
    log(`Creating real ChromaDB collection for user ${userId}`, "chromadb");
    const collection = await chromaClient.getOrCreateCollection({
      name: `user_${userId}_documents`,
      embeddingFunction,
    });

    userCollections.set(userId, collection);
    return collection;
  } catch (error) {
    log(`Error creating collection for user ${userId}: ${error}`, "chromadb");
    // Fall back to mock collection if there's an error with real ChromaDB
    log(`Falling back to mock collection for user ${userId}`, "chromadb");
    const mockCollection = {
      name: `user_${userId}_documents`,
    } as unknown as Collection;
    
    userCollections.set(userId, mockCollection);
    return mockCollection;
  }
}

// Add a document to the user's collection
export async function addDocumentToCollection(
  userId: number, 
  document: Document, 
  apiKey?: string  // Optional - uses system API key if not provided
): Promise<boolean> {
  try {
    const docId = `doc_${document.id}`;
    
    // First, always store in in-memory as fallback regardless of ChromaDB availability
    inMemoryDocuments.set(docId, {
      id: docId,
      content: document.content,
      metadata: {
        filename: document.originalFilename,
        fileType: document.fileType,
        documentId: document.id,
        userId: userId
      },
      userId: userId
    });
    
    // If ChromaDB is not available, just use the in-memory fallback
    if (!isChromaAvailable) {
      log(`ChromaDB not available, document ${document.id} added only to in-memory storage for user ${userId}`, "chromadb");
      return true;
    }
    
    // Try to add to ChromaDB persistent storage
    try {
      log(`Adding document ${document.id} to persistent ChromaDB for user ${userId}`, "chromadb");
      const collection = await getUserCollection(userId, apiKey);
      
      // Add document to collection
      await collection.add({
        ids: [docId],
        metadatas: [{
          filename: document.originalFilename,
          fileType: document.fileType,
          documentId: document.id,
          userId: userId
        }],
        documents: [document.content]
      });
      
      log(`Document ${document.id} successfully added to persistent ChromaDB for user ${userId}`, "chromadb");
      return true;
    } catch (error) {
      log(`Failed to add document to ChromaDB, using in-memory fallback only: ${error}`, "chromadb");
      // We already added to in-memory storage, so we can still return true
      return true;
    }
  } catch (error) {
    log(`Failed to add document to collection: ${error}`, "chromadb");
    return false;
  }
}

// Remove a document from the user's collection
export async function removeDocumentFromCollection(
  userId: number, 
  documentId: number, 
  apiKey?: string // Made optional
): Promise<boolean> {
  try {
    const docId = `doc_${documentId}`;
    
    // First, remove from in-memory storage if it exists there
    if (inMemoryDocuments.has(docId)) {
      inMemoryDocuments.delete(docId);
      log(`Document ${documentId} removed from in-memory storage for user ${userId}`, "chromadb");
    }
    
    // If ChromaDB is available, try to remove it from there as well
    if (isChromaAvailable) {
      try {
        const collection = await getUserCollection(userId, apiKey);
        
        // Remove document from collection
        await collection.delete({
          ids: [docId]
        });
        
        log(`Document ${documentId} removed from ChromaDB collection for user ${userId}`, "chromadb");
      } catch (error) {
        // Log error but don't fail the entire operation
        log(`Notice: Failed to remove from ChromaDB (but removed from in-memory): ${error}`, "chromadb");
      }
    }
    
    return true;
  } catch (error) {
    log(`Failed to remove document from collection: ${error}`, "chromadb");
    return false;
  }
}

// Query the user's collection
export async function queryCollection(
  userId: number, 
  query: string, 
  documentIds: number[],
  apiKey?: string, // Optional - uses system API key if not provided
  k: number = 5
): Promise<{
  documents: string[];
  metadatas: any[];
  ids: string[];
  distances: number[];
}> {
  try {
    // Map documentIds to ChromaDB document IDs format
    const docIds = documentIds && documentIds.length > 0 
      ? documentIds.map(id => `doc_${id}`) 
      : [];
    
    // If ChromaDB is available, try to use it for semantic search
    if (isChromaAvailable) {
      try {
        log(`Querying persistent ChromaDB for user ${userId}`, "chromadb");
        const collection = await getUserCollection(userId, apiKey);
        
        // Prepare filter for user-specific documents and optional document IDs
        const filter: Record<string, any> = { userId: userId };
        
        // Perform the query on the ChromaDB collection
        const results = await collection.query({
          queryTexts: [query],
          nResults: k,
          where: docIds.length > 0 ? { documentId: { $in: documentIds.map(String) } } : undefined,
          include: ["metadatas", "documents", "distances"] as any
        });
        
        if (results.ids[0] && results.ids[0].length > 0) {
          log(`Found ${results.ids[0].length} relevant documents in ChromaDB for query: "${query}"`, "chromadb");
          
          // Ensure that all results are non-null
          const filteredIdx = [];
          for (let i = 0; i < results.ids[0].length; i++) {
            if (results.documents && results.documents[0] && results.documents[0][i]) {
              filteredIdx.push(i);
              log(`  - ${results.metadatas?.[0]?.[i]?.filename || 'Unknown'} (distance: ${results.distances?.[0]?.[i] || 'N/A'})`, "chromadb");
            }
          }
          
          // Create safe filtered results
          return {
            documents: filteredIdx.map(i => (results.documents?.[0]?.[i] || "") as string),
            metadatas: filteredIdx.map(i => results.metadatas?.[0]?.[i] || {}),
            ids: filteredIdx.map(i => results.ids[0][i]),
            distances: filteredIdx.map(i => results.distances?.[0]?.[i] || 1.0)
          };
        }
      } catch (error) {
        log(`ChromaDB query failed, falling back to in-memory search: ${error}`, "chromadb");
        // Continue with fallback
      }
    }
    
    // Fallback to in-memory search when ChromaDB is unavailable or query fails
    log(`Using in-memory documents for query from user ${userId}`, "chromadb");
    
    // Filter documents by user and requested document IDs
    const filteredDocs = Array.from(inMemoryDocuments.values()).filter(doc => {
      // First check if doc belongs to this user
      if (doc.userId !== userId) return false;
      
      // If specific document IDs were requested, check that this doc is in that list
      if (documentIds && documentIds.length > 0) {
        return documentIds.includes(doc.metadata.documentId);
      }
      
      // If no specific docs requested, include all docs for this user
      return true;
    });

    // If no documents found after filtering, return empty results
    if (filteredDocs.length === 0) {
      log(`No documents found for user ${userId} with requested document IDs`, "chromadb");
      return {
        documents: [],
        metadatas: [],
        ids: [],
        distances: []
      };
    }
    
    // Implement a simple relevance scoring for in-memory documents
    // This is a basic approximation of semantic search using keyword matching
    const scoredDocs = filteredDocs.map(doc => {
      // Basic relevance score based on term frequency
      let score = 0;
      
      // Extract keywords from the query (simple approach)
      const keywords = query.toLowerCase()
        .replace(/[.,?!;:"'(){}\[\]]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3); // Only consider words with more than 3 letters
      
      // Count keyword occurrences in the document
      const docContent = doc.content.toLowerCase();
      for (const keyword of keywords) {
        // Count occurrences of each keyword
        const regex = new RegExp(keyword, 'g');
        const matches = docContent.match(regex);
        if (matches) {
          score += matches.length;
        }
        
        // Boost score if the document filename contains the keyword
        const filename = doc.metadata.filename.toLowerCase();
        if (filename.includes(keyword)) {
          score += 10; // Significant boost for filename matches
        }
      }
      
      // Also check if the query explicitly mentions the document by name
      const queryLower = query.toLowerCase();
      const filenameWithoutExt = doc.metadata.filename.toLowerCase().replace(/\.[^\.]+$/, '');
      if (queryLower.includes(filenameWithoutExt)) {
        score += 50; // Very high boost for explicit document references
      }
      
      return { doc, score };
    });
    
    // Sort by relevance score (descending)
    scoredDocs.sort((a, b) => b.score - a.score);
    
    // Take the top k documents
    const topDocs = scoredDocs.slice(0, k);
    
    log(`Found ${topDocs.length} relevant documents for query: "${query}"`, "chromadb");
    for (const {doc, score} of topDocs) {
      log(`  - ${doc.metadata.filename} (score: ${score})`, "chromadb");
    }
    
    // Normalize scores to distances (higher score = lower distance)
    const maxScore = Math.max(...topDocs.map(d => d.score), 1); // Avoid division by zero
    const distances = topDocs.map(d => {
      // Convert scores to distances (0 to 1 range, lower is better)
      return d.score > 0 ? 1 - (d.score / maxScore) : 1.0;
    });
    
    return {
      documents: topDocs.map(d => d.doc.content),
      metadatas: topDocs.map(d => d.doc.metadata),
      ids: topDocs.map(d => d.doc.id),
      distances
    };
  } catch (error) {
    log(`Query failed: ${error}`, "chromadb");
    throw error;
  }
}
