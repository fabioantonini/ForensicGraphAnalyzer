import OpenAI from "openai";
import { log } from "./vite";

// Create a context-specific OpenAI client with the user's API key
export function createOpenAIClient(apiKey: string) {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }
  
  return new OpenAI({ apiKey });
}

// Generate embedding for a text
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
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
  apiKey: string,
  model: string = "gpt-4o",
  temperature: number = 0.7
): Promise<string> {
  try {
    const openai = createOpenAIClient(apiKey);
    
    // Build system message with context
    const systemMessage = `
You are a forensic graphology assistant that helps analyze handwriting and documents.
Use the following context information to inform your response:

${context.join('\n\n')}

Always provide concise, accurate information based on the context. If you don't know the answer or it's not in the context, be honest about it.
When citing information, mention the specific document it came from if possible.
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

// Validate API key
export async function validateAPIKey(apiKey: string): Promise<boolean> {
  try {
    const openai = createOpenAIClient(apiKey);
    
    // Make a small request to validate the API key
    await openai.models.list();
    
    return true;
  } catch (error) {
    log(`API key validation failed: ${error}`, "openai");
    return false;
  }
}
