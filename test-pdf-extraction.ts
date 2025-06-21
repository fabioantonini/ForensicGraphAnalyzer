/**
 * Test per verificare l'estrazione del testo PDF
 */
import { extractTextFromPDF } from './server/document-processor';
import fs from 'fs/promises';
import path from 'path';

async function testPdfExtraction() {
  try {
    console.log("=== Test Estrazione PDF ===");
    
    // Crea un file PDF di test con contenuto
    const testPdfPath = './test_document.txt';
    
    // Verifica se esiste un file PDF di test
    try {
      const testFiles = await fs.readdir('./attached_assets');
      const pdfFiles = testFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
      
      if (pdfFiles.length > 0) {
        const pdfFile = pdfFiles[0];
        const pdfPath = path.join('./attached_assets', pdfFile);
        
        console.log(`Testando estrazione da: ${pdfFile}`);
        
        const extractedText = await extractTextFromPDF(pdfPath);
        
        console.log(`Testo estratto (${extractedText.length} caratteri):`);
        console.log("=".repeat(50));
        console.log(extractedText.substring(0, 500) + (extractedText.length > 500 ? "..." : ""));
        console.log("=".repeat(50));
        
        if (extractedText.length === 0) {
          console.log("❌ ERRORE: Nessun testo estratto!");
        } else {
          console.log(`✅ Successo: ${extractedText.length} caratteri estratti`);
        }
      } else {
        console.log("Nessun file PDF trovato per il test");
      }
    } catch (error) {
      console.error("Errore durante il test:", error);
    }
  } catch (error) {
    console.error("Errore generale:", error);
  }
}

testPdfExtraction();