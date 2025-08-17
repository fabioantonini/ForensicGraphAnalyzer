import { loadGmailConfig, sendGmailEmail } from './server/gmail-service.js';

async function testGmailDirect() {
  try {
    console.log('🧪 Test Gmail diretto...');
    
    // Carica configurazione
    const config = await loadGmailConfig();
    console.log('📧 Config Gmail caricata:', {
      email: config.email,
      configured: config.isConfigured,
      hasPassword: !!config.appPassword
    });
    
    if (!config.isConfigured) {
      console.log('❌ Gmail non configurato');
      return;
    }
    
    // Test invio email diretto
    const success = await sendGmailEmail(
      'fabio.antonini.1969@gmail.com',
      '🔥 Test DIRETTO GrapholexInsight Gmail',
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">✅ Test Email Funzionante!</h1>
        <p>Questa è una email di test dal nuovo account <strong>grapholexinsight@gmail.com</strong></p>
        <p>Se la ricevi, il sistema Gmail SMTP funziona perfettamente! 🎉</p>
        <p><em>Controlla anche nella cartella Spam/Promozioni se non la vedi nella posta principale.</em></p>
        <hr>
        <p style="color: #666; font-size: 12px;">GrapholexInsight System - Test Email</p>
      </div>`
    );
    
    console.log('📬 Risultato invio:', success ? '✅ SUCCESS' : '❌ FAILED');
    
  } catch (error) {
    console.error('💥 Errore test Gmail:', error);
  }
}

testGmailDirect();