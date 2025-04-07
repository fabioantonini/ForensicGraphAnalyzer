import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import mammoth from 'mammoth';
import { log } from './vite';

// Create a fallback implementation for pdf-parse
const pdfParse = async (buffer: Buffer, options?: any) => ({ 
  text: "PDF parsing is currently unavailable. Please install the 'pdf-parse' package for PDF support.",
  numpages: 0,
  numrender: 0,
  info: {},
  metadata: {},
  version: "0.0.0"
});

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
    // Define our own options to avoid requiring test files
    const options = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent()
          .then((textContent: any) => {
            let lastY, text = '';
            for (let item of textContent.items) {
              if (lastY == item.transform[5] || !lastY)
                text += item.str;
              else
                text += '\n' + item.str;
              lastY = item.transform[5];
            }
            return text;
          });
      }
    };
    const pdfData = await pdfParse(buffer, options);
    return pdfData.text;
  } catch (error) {
    log(`Error extracting text from PDF: ${error}`, "document-processor");
    throw new Error('Failed to extract text from PDF');
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
export async function extractTextFromHTML(filepath: string): Promise<string> {
  try {
    const content = await fs.readFile(filepath, 'utf8');
    
    // Simple HTML to text conversion - remove all HTML tags
    // This is a basic implementation - a production app might use a proper HTML parser
    const text = content
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

// Clean up file after processing
export async function cleanupFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath);
  } catch (error) {
    log(`Error cleaning up file: ${error}`, "document-processor");
    // We don't throw here to avoid disrupting the main process
  }
}
