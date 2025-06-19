/**
 * Test per verificare l'implementazione Tesseract.js OCR reale
 */

import { processOCR } from './server/ocr-service';
import fs from 'fs/promises';
import path from 'path';

// Crea un'immagine di test semplice con testo
async function createTestImage(): Promise<Buffer> {
  // Per il test, useremo una delle immagini presenti nel progetto
  const testImagePath = path.join(process.cwd(), 'attached_assets', 'image_1748055037289.png');
  
  try {
    const imageBuffer = await fs.readFile(testImagePath);
    console.log(`✓ Immagine di test caricata: ${testImagePath}`);
    return imageBuffer;
  } catch (error) {
    // Se l'immagine non esiste, creiamo un buffer di test molto semplice
    console.log('⚠ Immagine non trovata, uso buffer di test minimale');
    return Buffer.from('test');
  }
}

async function testTesseractOCR() {
  console.log('=== Test Tesseract.js OCR Reale ===\n');

  try {
    // Carica immagine di test
    const imageBuffer = await createTestImage();
    
    // Configura impostazioni OCR
    const settings = {
      language: 'ita',
      dpi: 300,
      preprocessingMode: 'standard',
      outputFormat: 'text'
    };
    
    console.log('📄 Avvio processamento OCR...');
    console.log(`Impostazioni: ${JSON.stringify(settings, null, 2)}`);
    
    // Esegui OCR
    const startTime = Date.now();
    const result = await processOCR(imageBuffer, 'test-image.png', settings);
    const totalTime = Date.now() - startTime;
    
    // Mostra risultati
    console.log('\n🎯 Risultati OCR:');
    console.log(`📝 Testo estratto (${result.extractedText.length} caratteri):`);
    console.log('─'.repeat(50));
    console.log(result.extractedText);
    console.log('─'.repeat(50));
    
    console.log(`\n📊 Statistiche:`);
    console.log(`• Confidenza: ${result.confidence}%`);
    console.log(`• Lingua rilevata: ${result.language}`);
    console.log(`• Tempo processamento: ${result.processingTime}s`);
    console.log(`• Tempo totale: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`• Pagine: ${result.pageCount || 1}`);
    
    if (result.extractedText.length > 0) {
      console.log('\n✅ Test OCR completato con successo!');
      console.log('🔧 Tesseract.js funziona correttamente');
    } else {
      console.log('\n⚠️ OCR completato ma nessun testo estratto');
      console.log('💡 Potrebbe essere necessaria un\'immagine con testo più chiaro');
    }
    
  } catch (error: any) {
    console.log('\n❌ Errore durante test OCR:');
    console.log(`Error: ${error.message}`);
    console.log('\n🔍 Dettagli errore:');
    console.log(error.stack);
  }
}

// Esegue il test
testTesseractOCR()
  .then(() => {
    console.log('\n🏁 Test completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test fallito:', error);
    process.exit(1);
  });