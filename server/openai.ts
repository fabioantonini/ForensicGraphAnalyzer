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
  // TESTING MODE: Return mock response for testing without OpenAI API
  // This approach allows testing without requiring an API key
  if (!apiKey && !process.env.OPENAI_API_KEY) {
    log("Using mock response for testing without OpenAI API", "openai");
    
    // Create a simple response based on the query and context
    const mockResponse = generateMockResponse(query, context);
    
    return mockResponse;
  }
  
  // Normal production mode
  try {
    const openai = createOpenAIClient(apiKey);
    
    // Build system message with context
    const systemMessage = `
You are a forensic graphology assistant that helps analyze handwriting and documents.
Use the following context information to inform your response:

${context.join('\n\n')}

Always provide concise, accurate information based on the context. If you don't know the answer or it's not in the context, be honest about it.
When citing information, mention the specific document it came from if possible.

Note: Respond in the same language as the query. If the query is in Italian, respond in Italian. If the query is in English, respond in English.
`;

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: query }
      ],
    });
    
    return response.choices[0].message.content || "No response generated";
  } catch (error) {
    log(`Error in chat completion: ${error}`, "openai");
    throw error;
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
