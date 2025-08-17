import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crea il documento PDF
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 60, right: 60 }
});

// Output file
const outputPath = path.join(__dirname, 'GrapholexInsight_Presentation.pdf');
doc.pipe(fs.createWriteStream(outputPath));

// Colori brand
const colors = {
  primary: '#2563eb',
  secondary: '#64748b',
  accent: '#059669',
  text: '#1e293b',
  light: '#f8fafc'
};

// Helper function per testo formattato
function addTitle(text, y = null) {
  if (y) doc.y = y;
  doc.fontSize(24)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(text, { align: 'center' });
  doc.moveDown(1);
}

function addSubtitle(text) {
  doc.fontSize(18)
     .fillColor(colors.secondary)
     .font('Helvetica-Bold')
     .text(text);
  doc.moveDown(0.5);
}

function addSectionTitle(text) {
  doc.fontSize(14)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(text);
  doc.moveDown(0.3);
}

function addBulletPoint(text) {
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text('• ' + text, { indent: 15 });
}

function addParagraph(text) {
  doc.fontSize(11)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(text, { align: 'justify' });
  doc.moveDown(0.5);
}

// PAGINA 1 - Copertina
addTitle('GrapholexInsight', 80);

doc.fontSize(16)
   .fillColor(colors.secondary)
   .font('Helvetica')
   .text('Sistema Completo di Analisi Grafologica Forense', { align: 'center' });

doc.moveDown(2);

doc.fontSize(12)
   .fillColor(colors.text)
   .text('Piattaforma avanzata per l\'analisi, verifica e confronto di firme e documenti', { align: 'center' });

// Box con statistiche principali
doc.y = 300;
doc.rect(60, doc.y, 475, 120)
   .fillAndStroke(colors.light, colors.primary);

doc.y += 20;
doc.fontSize(14)
   .fillColor(colors.primary)
   .font('Helvetica-Bold')
   .text('Caratteristiche Principali:', 80);

doc.fontSize(12)
   .fillColor(colors.text)
   .font('Helvetica');

doc.y += 20;
doc.text('✓ 25+ moduli implementati', 80);
doc.text('✓ Analisi firma con 21 parametri', 80);
doc.text('✓ Sistema RAG con AI integrata', 80);
doc.text('✓ Supporto multilingue completo', 80);
doc.text('✓ Reports peritali automatizzati', 80);

// Footer
doc.y = 750;
doc.fontSize(10)
   .fillColor(colors.secondary)
   .text('Documento generato automaticamente - GrapholexInsight ' + new Date().getFullYear(), { align: 'center' });

// PAGINA 2 - Introduzione
doc.addPage();

addTitle('Introduzione');

addParagraph('GrapholexInsight rappresenta una soluzione tecnologica all\'avanguardia nel campo dell\'analisi grafologica forense. Sviluppato come sistema completo e integrato, offre strumenti professionali per l\'autenticazione di firme, l\'analisi di documenti e la generazione di perizie tecniche.');

addParagraph('La piattaforma combina tecnologie moderne di intelligenza artificiale, elaborazione di immagini e analisi vettoriale per fornire risultati precisi e affidabili nel campo della grafologia forense.');

addSubtitle('Tecnologie Integrate');

addBulletPoint('Frontend moderno con React + TypeScript');
addBulletPoint('Backend Node.js con Express e PostgreSQL');
addBulletPoint('Intelligenza artificiale con OpenAI GPT-4o');
addBulletPoint('Elaborazione immagini con OpenCV e Python');
addBulletPoint('Database vettoriale con pgvector');
addBulletPoint('Sistema OCR multilingue con Tesseract');

// PAGINA 3 - Funzionalità Principali
doc.addPage();

addTitle('Funzionalità Implementate');

addSectionTitle('🔐 Sistema Autenticazione');
addBulletPoint('Login/logout con sessioni persistenti');
addBulletPoint('Registrazione nuovi utenti con validazione email');
addBulletPoint('Reset password tramite Gmail SMTP');
addBulletPoint('Gestione ruoli (admin, user, demo)');
addBulletPoint('Account demo con scadenza automatica');

doc.moveDown(0.5);

addSectionTitle('👤 Gestione Utenti');
addBulletPoint('Profili utente completi (nome, organizzazione, professione)');
addBulletPoint('Pannello amministrazione per gestione utenti');
addBulletPoint('Sistema di ruoli e permessi');
addBulletPoint('Configurazione chiavi API OpenAI personali');

doc.moveDown(0.5);

addSectionTitle('📄 Sistema Documentale');
addBulletPoint('Upload multi-formato (PDF, DOCX, TXT, HTML)');
addBulletPoint('Estrazione testo automatica');
addBulletPoint('Chunking intelligente per documenti lunghi');
addBulletPoint('Sistema di indicizzazione con stato');
addBulletPoint('Filtri avanzati (tipo file, termine ricerca, data)');

doc.moveDown(0.5);

addSectionTitle('🔍 Sistema OCR Avanzato');
addBulletPoint('Integrazione Tesseract.js multilingue');
addBulletPoint('4 modalità preprocessing (Auto, Enhance, Sharpen, Denoise)');
addBulletPoint('Valutazione qualità immagine automatica');
addBulletPoint('Salvataggio automatico nella knowledge base');
addBulletPoint('Progress tracking in tempo reale');

// PAGINA 4 - Analisi Firme
doc.addPage();

addSectionTitle('✍️ Analisi Firme Completa');
addBulletPoint('Upload e processing immagini firme');
addBulletPoint('Integrazione Python/OpenCV per analisi');
addBulletPoint('21 parametri completi: spessore tratto, pressione, curvatura');
addBulletPoint('Sistema di confronto automatico');
addBulletPoint('Soglie autenticità standardizzate (≥85% autentica)');
addBulletPoint('Cropping automatico intelligente con confidence meter');

doc.moveDown(0.5);

addSectionTitle('📊 Sistema Progetti Firme');
addBulletPoint('Gestione progetti con firme di riferimento');
addBulletPoint('Workflow unificato cropping-calibrazione');
addBulletPoint('Calibrazione millimetrica real-world');
addBulletPoint('Confronto parametri dettagliato');
addBulletPoint('Visualizzazione chart comparativi');

doc.moveDown(0.5);

addSectionTitle('📈 Report PDF Peritali');
addBulletPoint('Generazione automatica con PDFKit');
addBulletPoint('Analisi AI dettagliata (OpenAI GPT-4o)');
addBulletPoint('6 sezioni peritali complete');
addBulletPoint('Grafici confronto parametri');
addBulletPoint('Immagini firme integrate');

doc.moveDown(0.5);

addSectionTitle('🤖 RAG (Retrieval Augmented Generation)');
addBulletPoint('Vector database con pgvector (PostgreSQL)');
addBulletPoint('Embedding OpenAI (text-embedding-ada-002)');
addBulletPoint('Ricerca semantica avanzata');
addBulletPoint('Query conversazionali con contesto');
addBulletPoint('Supporto multilingue italiano/inglese');

// PAGINA 5 - Funzionalità Avanzate
doc.addPage();

addSectionTitle('🔒 Anonimizzazione Documenti');
addBulletPoint('Riconoscimento 13 tipi entità (nomi, luoghi, email, telefoni)');
addBulletPoint('Supporto multi-formato (PDF, DOCX, TXT)');
addBulletPoint('Processing AI con OpenAI GPT-4o');
addBulletPoint('Sostituzione intelligente entità');
addBulletPoint('Sistema sicuro file processing');

doc.moveDown(0.5);

addSectionTitle('🧠 Wake Up Quiz System');
addBulletPoint('Generazione domande AI (GPT-4o)');
addBulletPoint('3 categorie: Grafologia Forense, Cultura Generale, Mista');
addBulletPoint('Quiz rapidi (5 domande) e completi (10 domande)');
addBulletPoint('Sistema punteggi e livelli performance');
addBulletPoint('Consigli personalizzati');
addBulletPoint('Multilingue completo (italiano/inglese)');

doc.moveDown(0.5);

addSectionTitle('🌐 Internazionalizzazione');
addBulletPoint('Sistema i18n completo con react-i18next');
addBulletPoint('Traduzioni dinamiche italiano/inglese');
addBulletPoint('Contenuti AI generati nella lingua selezionata');
addBulletPoint('Cambio lingua real-time');

doc.moveDown(0.5);

addSectionTitle('💾 Database Avanzato');
addBulletPoint('PostgreSQL con pgvector per embeddings');
addBulletPoint('Schema Drizzle ORM completo');
addBulletPoint('Relazioni complesse tra entità');
addBulletPoint('Migrazioni automatiche');

doc.moveDown(0.5);

addSectionTitle('📧 Sistema Email');
addBulletPoint('Gmail SMTP integrato (500 email/giorno gratuito)');
addBulletPoint('Template professionali con styling');
addBulletPoint('Sistema fallback intelligente');
addBulletPoint('Configurazione dinamica admin');

// PAGINA 6 - Tecnologie e Architettura
doc.addPage();

addTitle('Architettura Tecnica');

addSectionTitle('🎨 Frontend Moderno');
addBulletPoint('React + TypeScript');
addBulletPoint('ShadcnUI + Radix UI components');
addBulletPoint('TanStack Query per state management');
addBulletPoint('Wouter routing');
addBulletPoint('Responsive design completo');
addBulletPoint('Dark/light mode support');

doc.moveDown(0.5);

addSectionTitle('⚙️ Features Avanzate');
addBulletPoint('Drag & drop interface');
addBulletPoint('Progress tracking real-time');
addBulletPoint('Error handling robusto');
addBulletPoint('Logging dettagliato');
addBulletPoint('Cache management intelligente');
addBulletPoint('Fallback systems multipli');

doc.moveDown(0.5);

addSectionTitle('🔧 Infrastructure');
addBulletPoint('Deployment Replit ready');
addBulletPoint('Environment variables gestite');
addBulletPoint('Workflow automation');
addBulletPoint('Development/production configs');
addBulletPoint('Monitoring e diagnostics');

doc.moveDown(1);

// Box finale con statistiche
doc.rect(60, doc.y, 475, 100)
   .fillAndStroke(colors.light, colors.accent);

doc.y += 15;
doc.fontSize(14)
   .fillColor(colors.accent)
   .font('Helvetica-Bold')
   .text('Statistiche Totali del Sistema:', 80);

doc.fontSize(12)
   .fillColor(colors.text)
   .font('Helvetica');

doc.y += 20;
doc.text('• 25+ moduli principali implementati', 80);
doc.text('• 100+ endpoint API funzionanti', 80);
doc.text('• Sistema multiutente completo', 80);
doc.text('• Production-ready deployment', 80);

// Footer finale
doc.y = 750;
doc.fontSize(10)
   .fillColor(colors.secondary)
   .text('GrapholexInsight - Sistema completo per l\'analisi grafologica forense', { align: 'center' });

// Finalizza il documento
doc.end();

console.log(`PDF generato con successo: ${outputPath}`);