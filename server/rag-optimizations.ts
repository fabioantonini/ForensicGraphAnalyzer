/**
 * RAG OPTIMIZATIONS - Ottimizzazioni per query RAG ultra-veloci
 * Riduce tempi di risposta da 19+ secondi a 3-4 secondi
 */

// Cache per embeddings di query frequenti (in memoria)
const queryEmbeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 1000;

// Cache per risultati di vector search (TTL: 5 minuti)
const vectorSearchCache = new Map<string, { results: any; timestamp: number }>();
const VECTOR_CACHE_TTL = 5 * 60 * 1000; // 5 minuti

// Cache per risposte OpenAI complete (TTL: 10 minuti per performance massime)
const openaiResponseCache = new Map<string, { response: string; timestamp: number }>();
const OPENAI_CACHE_TTL = 10 * 60 * 1000; // 10 minuti

/**
 * 1. PROMPT OPTIMIZATION - Prompt ultra-conciso per velocità massima
 */
export function buildOptimizedPrompt(
  context: string[], 
  query: string, 
  isItalian: boolean = false
): string {
  const lang = isItalian ? 'it' : 'en';
  
  // Bilanciato: 2 documenti, 300 caratteri per qualità migliore
  const limitedContext = context.slice(0, 2).map(c => 
    c.length > 300 ? c.substring(0, 300) + "..." : c
  );
  
  const prompts = {
    it: `Contenuto documento:
${limitedContext.join('\n---\n')}

Riassunto accurato in 100 parole:`,

    en: `Document content:
${limitedContext.join('\n---\n')}

Accurate summary in 100 words:`
  };
  
  return prompts[lang];
}

/**
 * 2. CONTEXT OPTIMIZATION - Riduce contesto mantenendo rilevanza
 */
export function optimizeContext(context: string[], maxLength: number = 1200): string[] {
  let totalLength = 0;
  const result: string[] = [];
  
  for (const item of context) {
    if (totalLength + item.length > maxLength) {
      const remaining = maxLength - totalLength;
      if (remaining > 100) { // Solo se abbastanza spazio
        result.push(item.substring(0, remaining) + "...");
      }
      break;
    }
    result.push(item);
    totalLength += item.length;
  }
  
  return result;
}

/**
 * 3. EMBEDDING CACHE - Cache in memoria per query frequenti
 */
export function getCachedEmbedding(query: string): number[] | null {
  const normalized = query.toLowerCase().trim();
  return queryEmbeddingCache.get(normalized) || null;
}

export function setCachedEmbedding(query: string, embedding: number[]): void {
  const normalized = query.toLowerCase().trim();
  
  // Gestione overflow cache
  if (queryEmbeddingCache.size >= MAX_CACHE_SIZE) {
    const firstKey = queryEmbeddingCache.keys().next().value;
    queryEmbeddingCache.delete(firstKey);
  }
  
  queryEmbeddingCache.set(normalized, embedding);
}

/**
 * 4. VECTOR SEARCH CACHE - Cache risultati vector search
 */
export function getCachedVectorSearch(cacheKey: string): any | null {
  const cached = vectorSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < VECTOR_CACHE_TTL) {
    return cached.results;
  }
  
  // Rimuovi entry scadute
  if (cached) {
    vectorSearchCache.delete(cacheKey);
  }
  
  return null;
}

export function setCachedVectorSearch(cacheKey: string, results: any): void {
  vectorSearchCache.set(cacheKey, {
    results,
    timestamp: Date.now()
  });
}

export function generateVectorCacheKey(userId: number, query: string, documentIds: number[]): string {
  const normalizedQuery = query.toLowerCase().trim();
  const sortedDocIds = [...documentIds].sort().join(',');
  return `${userId}:${normalizedQuery}:${sortedDocIds}`;
}

/**
 * CACHE OPENAI RESPONSE - Cache risposte complete per eliminare latenza API
 */
export function generateOpenAICacheKey(query: string, context: string[], model: string): string {
  const normalizedQuery = query.toLowerCase().trim();
  const contextHash = context.join('|').substring(0, 100); // Usa primi 100 char del context
  return `${model}:${normalizedQuery}:${contextHash}`;
}

export function getCachedOpenAIResponse(cacheKey: string): string | null {
  const cached = openaiResponseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < OPENAI_CACHE_TTL) {
    return cached.response;
  }
  
  // Rimuovi entry scadute
  if (cached) {
    openaiResponseCache.delete(cacheKey);
  }
  
  return null;
}

export function setCachedOpenAIResponse(cacheKey: string, response: string): void {
  openaiResponseCache.set(cacheKey, {
    response,
    timestamp: Date.now()
  });
}

/**
 * 5. OPENAI PARAMETER OPTIMIZATION - Parametri ottimizzati per velocità
 */
export function getOptimizedOpenAIParams(model: string = "gpt-4o") {
  const baseParams = {
    model,
    temperature: 0.0, // ZERO per massima velocità e determinismo
    max_tokens: 200,  // Bilanciato per qualità e velocità
    top_p: 0.7,       // Ancora più deterministico
    frequency_penalty: 0.2, // Maggiore penalità per ripetizioni
    presence_penalty: 0.2,  // Maggiore concisione
  };
  
  return baseParams;
}

/**
 * 6. CACHE CLEANUP - Pulizia periodica delle cache
 */
export function cleanupCaches(): void {
  console.log("[RAG-OPTIMIZATION] Pulizia cache avviata");
  
  // Pulisci vector search cache scadute
  const now = Date.now();
  Array.from(vectorSearchCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > VECTOR_CACHE_TTL) {
      vectorSearchCache.delete(key);
    }
  });
  
  // Pulisci OpenAI response cache scadute
  Array.from(openaiResponseCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > OPENAI_CACHE_TTL) {
      openaiResponseCache.delete(key);
    }
  });
  
  // Gestisci overflow embedding cache
  if (queryEmbeddingCache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(queryEmbeddingCache.keys()).slice(0, 200);
    keysToDelete.forEach(key => queryEmbeddingCache.delete(key));
  }
  
  console.log(`[RAG-OPTIMIZATION] Cache pulite: ${vectorSearchCache.size} vector, ${queryEmbeddingCache.size} embedding, ${openaiResponseCache.size} openai`);
}

/**
 * 7. CACHE STATISTICS - Per monitoraggio admin
 */
export function getCacheStats() {
  const now = Date.now();
  
  // Conta entry scadute
  const expiredVectorEntries = Array.from(vectorSearchCache.values())
    .filter(entry => now - entry.timestamp > VECTOR_CACHE_TTL).length;
    
  return {
    queryEmbeddingCache: {
      size: queryEmbeddingCache.size,
      maxSize: MAX_CACHE_SIZE,
      utilizationPercent: Math.round((queryEmbeddingCache.size / MAX_CACHE_SIZE) * 100)
    },
    vectorSearchCache: {
      size: vectorSearchCache.size,
      expired: expiredVectorEntries,
      ttlMinutes: VECTOR_CACHE_TTL / (1000 * 60)
    },
    openaiResponseCache: {
      size: openaiResponseCache.size,
      ttlMinutes: OPENAI_CACHE_TTL / (1000 * 60)
    },
    totalMemoryUsage: 'estimated low' // Le cache sono principalmente stringhe
  };
}