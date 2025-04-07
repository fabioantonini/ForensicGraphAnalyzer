import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { Document } from '@shared/schema';
import { log } from './vite';

// Initialize ChromaDB client with in-memory storage
// When running in a server environment, we need to be more flexible
// with ChromaDB errors since it's not essential for initial testing
const chromaClient = new ChromaClient();

// Map to store user-specific collections
const userCollections = new Map<number, Collection>();

// Initialize ChromaDB service
export async function initializeChromaDB() {
  try {
    log("Initializing ChromaDB with in-memory storage...", "chromadb");
    await chromaClient.heartbeat();
    log("ChromaDB initialized successfully", "chromadb");
    return true;
  } catch (error) {
    log(`ChromaDB initialization failed: ${error}`, "chromadb");
    return false;
  }
}

// Get or create a collection for a user
export async function getUserCollection(userId: number, apiKey: string): Promise<Collection> {
  if (userCollections.has(userId)) {
    return userCollections.get(userId)!;
  }

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
}

// Add a document to the user's collection
export async function addDocumentToCollection(
  userId: number, 
  document: Document, 
  apiKey: string
): Promise<boolean> {
  try {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

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
    log(`Failed to add document to collection: ${error}`, "chromadb");
    return false;
  }
}

// Remove a document from the user's collection
export async function removeDocumentFromCollection(
  userId: number, 
  documentId: number, 
  apiKey: string
): Promise<boolean> {
  try {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const collection = await getUserCollection(userId, apiKey);
    
    // Remove document from collection
    await collection.delete({
      ids: [`doc_${documentId}`]
    });
    
    log(`Document ${documentId} removed from collection for user ${userId}`, "chromadb");
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
  apiKey: string,
  k: number = 5
): Promise<{
  documents: string[];
  metadatas: any[];
  ids: string[];
  distances: number[];
}> {
  try {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const collection = await getUserCollection(userId, apiKey);
    
    // Create where filter if documentIds are provided
    let whereFilter = undefined;
    if (documentIds && documentIds.length > 0) {
      whereFilter = {
        documentId: { $in: documentIds }
      };
    }
    
    // Query the collection
    const results = await collection.query({
      queryTexts: [query],
      nResults: k,
      where: whereFilter
    });
    
    log(`Query performed for user ${userId}`, "chromadb");
    
    return {
      documents: (results.documents && results.documents[0] ? results.documents[0] : []).filter((doc): doc is string => doc !== null),
      metadatas: results.metadatas && results.metadatas[0] ? results.metadatas[0] : [],
      ids: results.ids && results.ids[0] ? results.ids[0] : [],
      distances: results.distances && results.distances[0] ? results.distances[0] : []
    };
  } catch (error) {
    log(`Query failed: ${error}`, "chromadb");
    throw error;
  }
}
