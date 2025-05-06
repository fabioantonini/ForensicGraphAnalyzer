import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { Document } from '@shared/schema';
import { log } from './vite';

// Initialize ChromaDB client with in-memory storage
// For Replit's environment, we need to use a specific configuration
const chromaClient = new ChromaClient({
  path: "http://localhost:8000", // Default local path
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Map to store user-specific collections (this will act as our in-memory fallback)
// When ChromaDB is unavailable, we'll use this for simulated operations
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
  try {
    log("Initializing ChromaDB with in-memory storage...", "chromadb");
    await chromaClient.heartbeat();
    log("ChromaDB initialized successfully", "chromadb");
    isChromaAvailable = true;
    return true;
  } catch (error) {
    log(`ChromaDB initialization failed: ${error}`, "chromadb");
    log("Using in-memory fallback for document storage", "chromadb");
    isChromaAvailable = false;
    return false;
  }
}

// Get or create a collection for a user
export async function getUserCollection(userId: number, apiKey?: string): Promise<Collection> {
  if (userCollections.has(userId)) {
    return userCollections.get(userId)!;
  }

  // For testing, create a mock collection if needed
  // In a real application, we would create a proper collection with ChromaDB
  // This is just a placeholder to prevent errors
  const mockCollection = {
    name: `user_${userId}_documents`,
    // Add any other properties needed for your mock implementation
  } as unknown as Collection;
  
  userCollections.set(userId, mockCollection);
  return mockCollection;
  
  // Original implementation - disabled for testing
  /*
  // If ChromaDB is not available, throw error that will be caught by the calling function
  if (!isChromaAvailable) {
    throw new Error("ChromaDB is not available, using in-memory fallback");
  }

  try {
    // Create embedding function using the user's OpenAI API key
    const embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: apiKey,
      openai_model: "text-embedding-ada-002"
    });

    // Create a new collection for the user
    const collection = await chromaClient.getOrCreateCollection({
      name: `user_${userId}_documents`,
      embeddingFunction,
    });

    userCollections.set(userId, collection);
    return collection;
  } catch (error) {
    log(`Error creating collection for user ${userId}: ${error}`, "chromadb");
    throw error;
  }
  */
}

// Add a document to the user's collection
export async function addDocumentToCollection(
  userId: number, 
  document: Document, 
  apiKey?: string  // Made optional
): Promise<boolean> {
  try {
    // Always use in-memory fallback for testing
    const docId = `doc_${document.id}`;
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
    log(`Document ${document.id} added to in-memory storage for user ${userId}`, "chromadb");
    return true;
    
    // Original code - disabled for testing
    /*
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    if (!isChromaAvailable) {
      // Use in-memory fallback when ChromaDB is unavailable
      const docId = `doc_${document.id}`;
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
      log(`Document ${document.id} added to in-memory storage for user ${userId}`, "chromadb");
      return true;
    }
    */

    // If ChromaDB is available, use it
    try {
      const collection = await getUserCollection(userId, apiKey);
      
      // Add document to collection
      await collection.add({
        ids: [`doc_${document.id}`],
        metadatas: [{
          filename: document.originalFilename,
          fileType: document.fileType,
          documentId: document.id,
          userId: userId
        }],
        documents: [document.content]
      });
      
      log(`Document ${document.id} added to collection for user ${userId}`, "chromadb");
      return true;
    } catch (error) {
      log(`Failed to add document to ChromaDB, using in-memory fallback: ${error}`, "chromadb");
      
      // Fallback to in-memory if ChromaDB operation fails
      const docId = `doc_${document.id}`;
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
      log(`Document ${document.id} added to in-memory storage for user ${userId}`, "chromadb");
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
  apiKey?: string, // Made optional
  k: number = 5
): Promise<{
  documents: string[];
  metadatas: any[];
  ids: string[];
  distances: number[];
}> {
  try {
    // Always use in-memory fallback for testing
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
