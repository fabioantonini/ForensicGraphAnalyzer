import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import mammoth from 'mammoth';
import { log } from './vite';

// Dynamic import for pdf-parse to avoid initialization issues
let pdfParse: (buffer: Buffer, options?: any) => Promise<{ text: string, numpages: number, info: any, metadata: any, version: string, numrender: number }>;

// Function to initialize pdf-parse when needed
async function getPdfParse() {
  if (!pdfParse) {
    try {
      // Using a more reliable dynamic import pattern
      const pdfParsePkg = await import('pdf-parse');
      pdfParse = pdfParsePkg.default;
    } catch (error) {
      log(`Error loading pdf-parse: ${error}`, "document-processor");
      // Fallback implementation
      pdfParse = async () => ({ 
        text: "PDF parsing failed to initialize",
        numpages: 0,
        numrender: 0,
        info: {},
        metadata: {},
        version: "0.0.0"
      });
    }
  }
  return pdfParse;
}

// File type verification
export function isValidFileType(mimetype: string): boolean {
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'text/plain', // TXT
    'text/html' // HTML
  ];
  
  return validTypes.includes(mimetype);
}

// Generate a unique filename
export function generateFilename(originalname: string): string {
  const ext = path.extname(originalname);
  const randomString = randomBytes(16).toString('hex');
  return `${randomString}${ext}`;
}

// Save uploaded file
export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  // Ensure uploads directory exists
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    log(`Error creating uploads directory: ${error}`, "document-processor");
  }
  
  const filepath = path.join(uploadsDir, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

// Extract text content from PDF
export async function extractTextFromPDF(filepath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filepath);
    
    // Get the pdf-parse function dynamically
    const pdfParser = await getPdfParse();
    
    // Define our own options to improve text extraction
    const options = {
      // Normalize whitespace and improve text extraction
      normalize: true,
      disableCombineTextItems: false
    };
    
    log(`Extracting text from PDF file: ${filepath}`, "document-processor");
    const pdfData = await pdfParser(buffer, options);
    
    log(`PDF parse result - text length: ${pdfData.text?.length || 0}`, "document-processor");
    log(`PDF parse result - first 100 chars: ${pdfData.text?.substring(0, 100) || 'EMPTY'}`, "document-processor");
    
    const extractedText = pdfData.text || "";
    
    // Normalizza il testo rimuovendo spazi multipli ma preservando la struttura
    const normalizedText = extractedText
      .replace(/\s+/g, ' ')  // Sostituisce spazi multipli con uno singolo
      .replace(/\n\s+/g, '\n')  // Rimuove spazi all'inizio delle righe
      .replace(/\s+\n/g, '\n')  // Rimuove spazi alla fine delle righe
      .trim();
    
    log(`PDF text normalized - original: ${extractedText.length}, normalized: ${normalizedText.length}`, "document-processor");
    log(`PDF normalized text preview (first 200 chars): ${normalizedText.substring(0, 200)}`, "document-processor");
    log(`PDF normalized text end (last 100 chars): ${normalizedText.substring(Math.max(0, normalizedText.length - 100))}`, "document-processor");
    
    if (!normalizedText || normalizedText.length === 0 || normalizedText.includes("parsing failed")) {
      log(`PDF extraction returned empty or error text, trying fallback`, "document-processor");
      // Fallback to a simpler approach - try to extract text without custom options
      const basicData = await pdfParser(buffer);
      const fallbackText = basicData.text || "";
      log(`Fallback PDF parse - text length: ${fallbackText.length}`, "document-processor");
      
      if (fallbackText.trim().length > 0) {
        const normalizedFallback = fallbackText
          .replace(/\s+/g, ' ')
          .replace(/\n\s+/g, '\n')
          .replace(/\s+\n/g, '\n')
          .trim();
        log(`Fallback text normalized - length: ${normalizedFallback.length}`, "document-processor");
        return normalizedFallback;
      }
      
      return "PDF text extraction failed - no readable text found";
    }
    
    log(`Returning extracted text with ${normalizedText.length} characters`, "document-processor");
    return normalizedText;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error extracting text from PDF: ${errorMessage}`, "document-processor");
    
    // For PDF parsing issues, provide helpful guidance
    if (errorMessage.includes('bad XRef entry') || errorMessage.includes('parsing failed')) {
      throw new Error(`Questo PDF ha problemi strutturali che impediscono l'estrazione del testo.

Soluzioni alternative:
• Apri il PDF, seleziona tutto il testo (Ctrl+A) e copialo in un file .txt
• Usa "Stampa > Salva come PDF" per riparare il file
• Prova un convertitore online per convertire PDF in testo

Il sistema funziona perfettamente con file .txt come hai visto.`);
    }
    
    throw new Error(`PDF parsing failed: ${errorMessage}. Please try with a different PDF file or convert it to text format.`);
  }
}



// Extract text content from DOCX
export async function extractTextFromDOCX(filepath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filepath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    log(`Error extracting text from DOCX: ${error}`, "document-processor");
    throw new Error('Failed to extract text from DOCX');
  }
}

// Extract text content from PPTX
export async function extractTextFromPPTX(filepath: string): Promise<string> {
  try {
    // For PPTX extraction, we're using a simpler approach since we don't have pptx-extract
    // This is a simplified implementation
    const buffer = await fs.readFile(filepath);
    
    // Extract text using regex from XML files within the PPTX
    // Note: In a production environment, you would want to use a proper PPTX parser
    const text = buffer.toString('utf8');
    
    // Extract text content from XML tags
    const textMatches = text.match(/<a:t>([^<]*)<\/a:t>/g);
    
    if (textMatches) {
      const extractedText = textMatches
        .map(match => match.replace(/<a:t>|<\/a:t>/g, ''))
        .join('\n');
      
      return extractedText;
    }
    
    return "Failed to extract text from PPTX";
  } catch (error) {
    log(`Error extracting text from PPTX: ${error}`, "document-processor");
    throw new Error('Failed to extract text from PPTX');
  }
}

// Extract text content from plain text file
export async function extractTextFromTXT(filepath: string): Promise<string> {
  try {
    const content = await fs.readFile(filepath, 'utf8');
    return content;
  } catch (error) {
    log(`Error extracting text from TXT: ${error}`, "document-processor");
    throw new Error('Failed to extract text from TXT');
  }
}

// Extract text content from HTML file
export async function extractTextFromHTML(filepath: string, content?: string): Promise<string> {
  try {
    // If content is provided directly, use it; otherwise read from file
    let htmlContent = content;
    if (!htmlContent) {
      htmlContent = await fs.readFile(filepath, 'utf8');
    }
    
    // Simple HTML to text conversion - remove all HTML tags
    // This is a basic implementation - a production app might use a proper HTML parser
    const text = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')   // Remove styles
      .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
      .replace(/&amp;/g, '&')    // Replace &amp; with &
      .replace(/&lt;/g, '<')     // Replace &lt; with <
      .replace(/&gt;/g, '>')     // Replace &gt; with >
      .replace(/&quot;/g, '"')   // Replace &quot; with "
      .replace(/&apos;/g, "'")   // Replace &apos; with '
      .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
      .trim();                    // Remove leading/trailing spaces
    
    return text;
  } catch (error) {
    log(`Error extracting text from HTML: ${error}`, "document-processor");
    throw new Error('Failed to extract text from HTML');
  }
}

// Process file based on type
export async function processFile(
  filepath: string, 
  fileType: string
): Promise<string> {
  try {
    let text = '';
    
    if (fileType === 'application/pdf') {
      text = await extractTextFromPDF(filepath);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = await extractTextFromDOCX(filepath);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      text = await extractTextFromPPTX(filepath);
    } else if (fileType === 'text/plain') {
      text = await extractTextFromTXT(filepath);
    } else if (fileType === 'text/html') {
      text = await extractTextFromHTML(filepath);
    } else {
      throw new Error('Unsupported file type');
    }
    
    return text;
  } catch (error) {
    log(`Error processing file: ${error}`, "document-processor");
    throw error;
  }
}

// Fetch HTML content from URL
export async function fetchHtmlFromUrl(url: string): Promise<{ content: string, filename: string }> {
  try {
    // Import fetch dynamically to avoid issues in Node environments
    const fetch = (await import('node-fetch')).default;
    
    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      throw new Error('Invalid URL format');
    }

    // Fetch the URL content
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error('URL does not point to an HTML document');
    }
    
    const content = await response.text();
    
    // Generate a filename from the URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Create a filename based on the URL structure
    const sanitizedPathname = pathname.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const timestamp = Date.now();
    const filename = `${hostname}${sanitizedPathname}_${timestamp}.html`;
    
    return { content, filename };
  } catch (error) {
    log(`Error fetching HTML from URL: ${error}`, "document-processor");
    throw error;
  }
}

// Clean up file after processing
export async function cleanupFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath);
  } catch (error) {
    log(`Error cleaning up file: ${error}`, "document-processor");
    // We don't throw here to avoid disrupting the main process
  }
}
