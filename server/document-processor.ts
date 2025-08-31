import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import mammoth from 'mammoth';
import { log } from './vite';
import { processOCR } from './ocr-service';

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

// File type verification - supports both native documents and scanned images
export function isValidFileType(mimetype: string): boolean {
  const validTypes = [
    // Native document formats
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'text/plain', // TXT
    'text/html', // HTML
    // Image formats for OCR processing
    'image/jpeg',
    'image/png',
    'image/jpg'
  ];
  
  return validTypes.includes(mimetype);
}

// Check if file type requires OCR processing
export function requiresOCR(mimetype: string): boolean {
  const ocrTypes = [
    'image/jpeg',
    'image/png', 
    'image/jpg'
  ];
  return ocrTypes.includes(mimetype);
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
    const pdfParser = await getPdfParse();
    
    log(`Extracting text from PDF file: ${filepath}`, "document-processor");
    
    // Primo tentativo con opzioni normali
    try {
      const pdfData = await pdfParser(buffer, { normalize: true });
      if (pdfData.text && pdfData.text.trim().length > 0) {
        const cleanText = pdfData.text.replace(/\s+/g, ' ').trim();
        log(`PDF extraction successful - ${cleanText.length} characters`, "document-processor");
        return cleanText;
      }
    } catch (firstError) {
      log(`First extraction attempt failed: ${(firstError as Error).message}`, "document-processor");
    }
    
    // Secondo tentativo senza opzioni
    try {
      const basicData = await pdfParser(buffer);
      if (basicData.text && basicData.text.trim().length > 0) {
        const cleanText = basicData.text.replace(/\s+/g, ' ').trim();
        log(`PDF fallback extraction successful - ${cleanText.length} characters`, "document-processor");
        return cleanText;
      }
    } catch (secondError) {
      log(`Second extraction attempt failed: ${(secondError as Error).message}`, "document-processor");
    }
    
    // Terzo tentativo con opzioni minime
    try {
      const minimalData = await pdfParser(buffer, { disableCombineTextItems: true });
      if (minimalData.text && minimalData.text.trim().length > 0) {
        const cleanText = minimalData.text.replace(/\s+/g, ' ').trim();
        log(`PDF minimal extraction successful - ${cleanText.length} characters`, "document-processor");
        return cleanText;
      }
    } catch (thirdError) {
      log(`Third extraction attempt failed: ${(thirdError as Error).message}`, "document-processor");
    }
    
    throw new Error('All PDF extraction methods failed');
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

// Process file based on type - supports both native documents and OCR for scanned content
export async function processFile(
  filepath: string, 
  fileType: string,
  progressCallback?: (progress: number, stage: string) => void
): Promise<string> {
  try {
    let text = '';
    
    // Handle images with OCR
    if (requiresOCR(fileType)) {
      log(`Processing image file with OCR: ${filepath}`, "document-processor");
      progressCallback?.(30, "Avvio OCR per immagine");
      
      const fileBuffer = await fs.readFile(filepath);
      const filename = path.basename(filepath);
      
      const ocrSettings = {
        language: "ita+eng",
        dpi: 300,
        preprocessingMode: "auto" as const,
        outputFormat: "text" as const
      };
      
      const ocrResult = await processOCR(
        fileBuffer, 
        filename, 
        ocrSettings,
        progressCallback
      );
      
      text = ocrResult.extractedText;
      log(`OCR completed for image: ${text.length} characters extracted`, "document-processor");
      
    } else if (fileType === 'application/pdf') {
      // Try native PDF extraction first
      try {
        progressCallback?.(30, "Estrazione testo da PDF");
        text = await extractTextFromPDF(filepath);
        
        // If extracted text is very short, it might be a scanned PDF - use OCR fallback
        if (text.trim().length < 100) {
          log(`PDF appears to be scanned (${text.trim().length} chars), attempting OCR fallback`, "document-processor");
          progressCallback?.(40, "PDF scansionato rilevato, avvio OCR");
          
          const fileBuffer = await fs.readFile(filepath);
          const filename = path.basename(filepath);
          
          const ocrSettings = {
            language: "ita+eng",
            dpi: 300,
            preprocessingMode: "auto" as const,
            outputFormat: "text" as const
          };
          
          const ocrResult = await processOCR(
            fileBuffer, 
            filename, 
            ocrSettings,
            (ocrProgress, stage) => progressCallback?.(40 + (ocrProgress * 0.5), stage)
          );
          
          text = ocrResult.extractedText;
          log(`OCR fallback completed for scanned PDF: ${text.length} characters extracted`, "document-processor");
        } else {
          log(`Native PDF extraction successful: ${text.length} characters`, "document-processor");
        }
      } catch (pdfError) {
        log(`PDF extraction failed, trying OCR fallback: ${pdfError}`, "document-processor");
        progressCallback?.(40, "Errore estrazione PDF, tentativo OCR");
        
        const fileBuffer = await fs.readFile(filepath);
        const filename = path.basename(filepath);
        
        const ocrSettings = {
          language: "ita+eng",
          dpi: 300,
          preprocessingMode: "auto" as const,
          outputFormat: "text" as const
        };
        
        const ocrResult = await processOCR(
          fileBuffer, 
          filename, 
          ocrSettings,
          (ocrProgress, stage) => progressCallback?.(40 + (ocrProgress * 0.5), stage)
        );
        
        text = ocrResult.extractedText;
        log(`OCR fallback completed for problematic PDF: ${text.length} characters extracted`, "document-processor");
      }
      
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      progressCallback?.(30, "Estrazione testo da DOCX");
      text = await extractTextFromDOCX(filepath);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      progressCallback?.(30, "Estrazione testo da PPTX");
      text = await extractTextFromPPTX(filepath);
    } else if (fileType === 'text/plain') {
      progressCallback?.(30, "Lettura file di testo");
      text = await extractTextFromTXT(filepath);
    } else if (fileType === 'text/html') {
      progressCallback?.(30, "Estrazione testo da HTML");
      text = await extractTextFromHTML(filepath);
    } else {
      throw new Error('Unsupported file type');
    }
    
    progressCallback?.(90, "Elaborazione testo completata");
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
