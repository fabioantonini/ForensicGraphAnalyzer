import OpenAI from "openai";
import { log } from "./vite";

// Get system API key
const SYSTEM_API_KEY = process.env.OPENAI_API_KEY;

// Create a context-specific OpenAI client with the user's API key or fallback to system key
export function createOpenAIClient(apiKey?: string) {
  // Try user's key first, then fallback to system key
  const finalApiKey = apiKey || SYSTEM_API_KEY;
  
  if (!finalApiKey) {
    throw new Error("OpenAI API key is required (either user-provided or system)");
  }
  
  return new OpenAI({ apiKey: finalApiKey });
}

// Generate embedding for a text
export async function generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
  // TESTING MODE: Return mock embeddings if no API key available
  if (!apiKey && !SYSTEM_API_KEY) {
    log("Test mode: Generating mock embeddings", "openai");
    
    // Create a deterministic but simple mock embedding based on the text
    // This is for testing only and does not provide semantic similarity 
    const mockEmbedding = new Array(1536).fill(0).map((_, i) => {
      // Use simple hash of the first few characters to generate values
      const seed = text.charCodeAt(i % Math.min(10, text.length)) || 42;
      return (Math.sin(seed * (i + 1)) + 1) / 2; // Values between 0 and 1
    });
    
    return mockEmbedding;
  }
  
  // Normal production mode
  try {
    const openai = createOpenAIClient(apiKey);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    log(`Error generating embedding: ${error}`, "openai");
    throw error;
  }
}

// Chat completion with RAG context
export async function chatWithRAG(
  query: string,
  context: string[],
  apiKey?: string,
  model: string = "gpt-4o",
  temperature: number = 0.7
): Promise<string> {
  // Handle case when context is empty
  if (context.length === 0) {
    log("No relevant context found for query. Informing user.", "openai");
    const isItalian = /[àèéìòù]/i.test(query);
    
    if (isItalian) {
      return "Mi dispiace, non ho trovato documenti rilevanti per rispondere alla tua domanda. Se stai cercando informazioni su un documento specifico, assicurati di averlo caricato e selezionato nella query.";
    } else {
      return "I'm sorry, I couldn't find relevant documents to answer your question. If you're looking for information from a specific document, please make sure you've uploaded it and selected it for the query.";
    }
  }
  
  // Check if the user is explicitly asking about a specific document
  const documentMentionRegex = /(\b(?:file|document|pdf|doc)\b.*?["']([^"']+)["'])|(\b[\w-]+-[\w-]+\.(?:pdf|doc|docx|txt))\b/i;
  const match = query.match(documentMentionRegex);
  const mentionedDoc = match ? (match[2] || match[3]) : null;
  
  // TESTING MODE: Return mock response for testing without OpenAI API
  // This approach allows testing without requiring an API key
  if (!apiKey && !process.env.OPENAI_API_KEY) {
    log("Using mock response for testing without OpenAI API", "openai");
    
    // If a specific document was mentioned but not found in context, inform the user
    if (mentionedDoc && !context.some(c => c.toLowerCase().includes(mentionedDoc.toLowerCase()))) {
      const isItalian = /[àèéìòù]/i.test(query);
      if (isItalian) {
        return `Mi dispiace, non ho accesso al documento "${mentionedDoc}" che hai menzionato. Assicurati di aver caricato il documento e di averlo selezionato per questa query.`;
      } else {
        return `I'm sorry, I don't have access to the document "${mentionedDoc}" you mentioned. Please make sure you've uploaded the document and selected it for this query.`;
      }
    }
    
    // Create a simple response based on the query and context
    const mockResponse = generateMockResponse(query, context);
    return mockResponse;
  }
  
  // Normal production mode
  try {
    const openai = createOpenAIClient(apiKey);
    
    // If a specific document was mentioned but not found in context, inform the user
    if (mentionedDoc && !context.some(c => c.toLowerCase().includes(mentionedDoc.toLowerCase()))) {
      log(`User asked about document "${mentionedDoc}" which is not in context`, "openai");
      
      // Use a simple message to inform the user that the document wasn't found
      const isItalian = /[àèéìòù]/i.test(query);
      if (isItalian) {
        return `Mi dispiace, non ho accesso al documento "${mentionedDoc}" che hai menzionato. Assicurati di aver caricato il documento e di averlo selezionato per questa query.`;
      } else {
        return `I'm sorry, I don't have access to the document "${mentionedDoc}" you mentioned. Please make sure you've uploaded the document and selected it for this query.`;
      }
    }
    
    // Verifica che il modello richiesto sia compatibile con l'API key
    if (model === 'o3' || model === 'o4-mini') {
      try {
        // Test call con zero tokens per verificare l'accesso al modello
        await openai.chat.completions.create({
          model,
          messages: [{ role: "system", content: "Test." }],
          max_tokens: 1
        });
      } catch (modelError: any) {
        // Se c'è un errore 404, probabilmente l'organizzazione non è verificata per i nuovi modelli
        if (modelError.status === 404 && modelError.message && modelError.message.includes('must be verified')) {
          log(`Organizzazione non verificata per l'uso del modello ${model}`, "openai");
          
          // Informare l'utente del problema
          const isItalian = /[àèéìòù]/i.test(query);
          if (isItalian) {
            return `Mi dispiace, ma la tua organizzazione OpenAI non è verificata per utilizzare il modello ${model}. Per accedere a questo modello, visita https://platform.openai.com/settings/organization/general e clicca su "Verify Organization". Se hai appena effettuato la verifica, potrebbero essere necessari fino a 15 minuti prima che l'accesso sia propagato.\n\nNel frattempo, prova a utilizzare gpt-4 o un altro modello disponibile.`;
          } else {
            return `I'm sorry, but your OpenAI organization is not verified to use the ${model} model. To access this model, please visit https://platform.openai.com/settings/organization/general and click on "Verify Organization". If you just verified, it can take up to 15 minutes for access to propagate.\n\nIn the meantime, try using gpt-4 or another available model.`;
          }
        }
      }
    }
    
    // Build system message with context
    const systemMessage = "You are a forensic graphology assistant that helps analyze handwriting and documents. " +
      "Use the following context information to inform your response:\n\n" +
      context.join('\n\n') +
      "\n\nAlways provide concise, accurate information based on the context. If you don't know the answer or it's not in the context, be honest about it. " +
      "When citing information, mention the specific document it came from if possible.\n\n" +
      "Note: Respond in the same language as the query. If the query is in Italian, respond in Italian. If the query is in English, respond in English.";

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    
    // Alcuni modelli (come o3) non supportano il parametro temperatura personalizzato
    const params: any = {
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: query }
      ],
    };
    
    // Aggiungi il parametro temperatura solo se non è un modello che non lo supporta
    if (model !== 'o3' && model !== 'o4-mini') {
      params.temperature = temperature;
    }
    
    const response = await openai.chat.completions.create(params);
    
    return response.choices[0].message.content || "No response generated";
  } catch (error: any) {
    log(`Error in chat completion: ${error}`, "openai");
    
    // Gestione specifica per errori di verifica organizzazione
    if (error.status === 404 && error.message && error.message.includes('must be verified')) {
      const isItalian = /[àèéìòù]/i.test(query);
      if (isItalian) {
        return `Mi dispiace, ma la tua organizzazione OpenAI non è verificata per utilizzare il modello ${model}. Per accedere a questo modello, visita https://platform.openai.com/settings/organization/general e clicca su "Verify Organization". Se hai appena effettuato la verifica, potrebbero essere necessari fino a 15 minuti prima che l'accesso sia propagato.\n\nNel frattempo, prova a utilizzare gpt-4 o un altro modello disponibile.`;
      } else {
        return `I'm sorry, but your OpenAI organization is not verified to use the ${model} model. To access this model, please visit https://platform.openai.com/settings/organization/general and click on "Verify Organization". If you just verified, it can take up to 15 minutes for access to propagate.\n\nIn the meantime, try using gpt-4 or another available model.`;
      }
    }
    
    // Gestione per errori di parametri non supportati (come temperature)
    if (error.status === 400 && error.message && error.message.includes('temperature')) {
      const isItalian = /[àèéìòù]/i.test(query);
      if (isItalian) {
        return `Mi dispiace, il modello ${model} non supporta il parametro di temperatura personalizzato. Stiamo correggendo questo problema. Nel frattempo, prova ad utilizzare un altro modello come gpt-4.`;
      } else {
        return `I'm sorry, the ${model} model does not support custom temperature settings. We're fixing this issue. In the meantime, please try using another model like gpt-4.`;
      }
    }
    
    // Restituisci un messaggio generico di errore
    const isItalian = /[àèéìòù]/i.test(query);
    if (isItalian) {
      return `Mi dispiace, si è verificato un errore durante l'elaborazione della tua richiesta: ${error.message || 'errore sconosciuto'}. Per favore riprova più tardi o contatta l'amministratore del sistema.`;
    } else {
      return `I'm sorry, an error occurred while processing your request: ${error.message || 'unknown error'}. Please try again later or contact the system administrator.`;
    }
  }
}

// Helper function to generate mock responses for testing
function generateMockResponse(query: string, context: string[]): string {
  // Check if the query is in Italian (basic detection)
  const isItalian = /[àèéìòù]/i.test(query);
  
  // Check context for relevant information
  let hasGraphologyInfo = false;
  let hasBaselineInfo = false;
  let hasPressureInfo = false;
  let hasSizeInfo = false;
  let hasSlantInfo = false;
  let hasSpacingInfo = false;
  
  for (const text of context) {
    if (text.includes("graphology")) hasGraphologyInfo = true;
    if (text.includes("baseline")) hasBaselineInfo = true;
    if (text.includes("pressure")) hasPressureInfo = true;
    if (text.includes("size")) hasSizeInfo = true;
    if (text.includes("slant")) hasSlantInfo = true;
    if (text.includes("spacing")) hasSpacingInfo = true;
  }
  
  if (isItalian) {
    // Italian mock responses
    if (query.toLowerCase().includes("grafologia")) {
      return "La grafologia forense è lo studio scientifico della scrittura a mano per analizzare tratti di personalità, modelli comportamentali e caratteristiche psicologiche. Questa disciplina esamina vari aspetti come la linea di base, la pressione, la dimensione, l'inclinazione e la spaziatura per fornire informazioni sul carattere e sullo stato mentale dello scrittore.";
    } else if (query.toLowerCase().includes("linea di base")) {
      return "La linea di base nella grafologia forense si riferisce alla linea invisibile su cui poggia la scrittura. Le linee di base dritte suggeriscono stabilità e autodisciplina, mentre le linee ascendenti possono indicare ottimismo e le linee discendenti potrebbero suggerire stanchezza o pessimismo.";
    } else {
      return "Mi dispiace, non ho abbastanza informazioni nel contesto fornito per rispondere a questa domanda specifica. Potrei aiutarti meglio con una domanda più dettagliata o relativa agli aspetti fondamentali della grafologia forense.";
    }
  } else {
    // English mock responses
    if (query.toLowerCase().includes("key aspects") || query.toLowerCase().includes("what are")) {
      let response = "According to the provided documents, the key aspects of forensic graphology include:\n\n";
      
      if (hasBaselineInfo) {
        response += "1. Baseline analysis - The baseline refers to the invisible line on which handwriting rests. Straight baselines suggest stability and self-discipline. Ascending baselines may indicate optimism, while descending baselines could suggest fatigue or pessimism.\n\n";
      }
      
      if (hasPressureInfo) {
        response += "2. Pressure - The amount of pressure applied when writing can indicate energy levels and emotional intensity. Heavy pressure suggests strong emotions and vitality, while light pressure might indicate sensitivity or reserve.\n\n";
      }
      
      if (hasSizeInfo) {
        response += "3. Size - Large handwriting often reveals extroversion, while small handwriting may indicate introversion or focus on detail.\n\n";
      }
      
      if (hasSlantInfo) {
        response += "4. Slant - The slant of handwriting can reveal emotional responses. Right-slanted writing suggests outgoing, future-oriented personalities. Left-slanted writing may indicate reservation or past orientation. Vertical writing often reveals a balanced, controlled approach.\n\n";
      }
      
      if (hasSpacingInfo) {
        response += "5. Spacing - Spacing between words and letters can indicate social behavior. Wide spacing might suggest a need for space and independence, while crowded spacing could indicate a desire for closeness.\n\n";
      }
      
      response += "Forensic graphology is used in various contexts, including criminal investigations, personnel selection, and psychological assessments. However, it should be combined with other analytical methods for the most accurate results.";
      
      return response;
    } else {
      return "I don't have enough information in the provided context to answer this specific question. I could help better with a question about the fundamental aspects of forensic graphology, such as baseline analysis, pressure, size, slant, or spacing in handwriting.";
    }
  }
}

// Validate API key - can be either user-provided or system key
export async function validateAPIKey(apiKey?: string): Promise<boolean> {
  // TESTING MODE: Always return true in test mode (when running in Replit and no keys available)
  if (process.env.NODE_ENV !== 'production' && !apiKey && !SYSTEM_API_KEY) {
    log("Test mode: Simulating successful API key validation", "openai");
    return true;
  }
  
  try {
    // If no key provided, check if system key is available
    if (!apiKey && !SYSTEM_API_KEY) {
      return false;
    }
    
    const openai = createOpenAIClient(apiKey);
    
    // Make a small request to validate the API key
    await openai.models.list();
    
    return true;
  } catch (error) {
    log(`API key validation failed: ${error}`, "openai");
    return false;
  }
}
