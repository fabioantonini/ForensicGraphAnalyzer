import path from 'path';
import fs from 'fs';
import { SignatureAnalyzer } from './server/signature-analyzer';
import { initDatabase } from './server/storage';

async function testReprocessSignature() {
  try {
    console.log('[TEST] Avvio test reprocessing firma 109');
    
    // Inizializza il database
    const storage = await initDatabase();
    
    // Dati della firma
    const signatureId = 109;
    const filename = 'signature-1752929614602-116720695.jpg';
    const filePath = path.join('uploads', filename);
    
    console.log('[TEST] File path:', filePath);
    console.log('[TEST] File exists:', fs.existsSync(filePath));
    
    // Ottieni la firma dal database
    const signature = await storage.getSignature(signatureId);
    if (!signature) {
      throw new Error('Firma non trovata nel database');
    }
    
    console.log('[TEST] Firma dal database:', {
      id: signature.id,
      filename: signature.filename,
      realWidthMm: signature.realWidthMm,
      realHeightMm: signature.realHeightMm,
      processingStatus: signature.processingStatus
    });
    
    // Aggiorna stato a processing
    await storage.updateSignatureStatus(signatureId, 'processing');
    console.log('[TEST] Stato aggiornato a processing');
    
    // Testa l'estrazione parametri con le dimensioni reali
    console.log('[TEST] Avvio estrazione parametri...');
    const parameters = await SignatureAnalyzer.extractParameters(
      filePath,
      signature.realWidthMm!,
      signature.realHeightMm!
    );
    
    console.log('[TEST] Parametri estratti:', parameters);
    
    // Aggiorna i parametri nel database
    await storage.updateSignatureParameters(signatureId, parameters);
    console.log('[TEST] Parametri salvati nel database');
    
    // Aggiorna stato a completed
    await storage.updateSignatureStatus(signatureId, 'completed');
    console.log('[TEST] Stato aggiornato a completed');
    
    console.log('[TEST] Test completato con successo!');
    
  } catch (error: any) {
    console.error('[TEST] Errore nel test:', error);
    console.error('[TEST] Stack:', error.stack);
  }
}

testReprocessSignature();