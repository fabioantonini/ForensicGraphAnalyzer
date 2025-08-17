const { loadGmailConfig, sendGmailEmail } = require('./server/gmail-service');

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
      'Test GrapholexInsight Gmail',
      '<h1>Test Email</h1><p>Questa è una email di test dal nuovo account grapholexinsight@gmail.com</p><p>Se la ricevi, tutto funziona! 🎉</p>'
    );
    
    console.log('📬 Risultato invio:', success ? '✅ SUCCESS' : '❌ FAILED');
    
  } catch (error) {
    console.error('💥 Errore test Gmail:', error);
  }
}

testGmailDirect();