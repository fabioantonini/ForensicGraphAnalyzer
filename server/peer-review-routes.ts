/**
 * Routes per il sistema Peer Review delle perizie grafologiche
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { peerReviews, insertPeerReviewSchema, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { analyzePeerReview, getENFSIFramework, getClassificationInfo } from "./peer-review-service";
// Import middleware functions from auth.ts
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";
import { getVersionString } from "@shared/version";

const router = express.Router();

// Configurazione multer per upload perizie
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'peer-reviews');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `peer-review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Usa PDF, DOCX o TXT.'));
    }
  }
});

/**
 * Estrae testo dal file caricato
 */
async function extractTextFromFile(filePath: string, originalFilename: string): Promise<string> {
  const ext = path.extname(originalFilename).toLowerCase();
  
  try {
    if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf8');
    } 
    else if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const result = await pdfParse(buffer);
      return result.text;
    }
    else if (ext === '.docx') {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    else {
      throw new Error(`Formato file non supportato: ${ext}`);
    }
  } catch (error: any) {
    console.error(`[PEER-REVIEW] Errore estrazione testo da ${originalFilename}:`, error);
    throw new Error(`Impossibile estrarre testo dal file: ${error.message}`);
  }
}

/**
 * POST /api/peer-review/submit
 * Carica e analizza una perizia grafica
 */
router.post('/submit', requireAuth, upload.single('perizia'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File della perizia richiesto' });
    }

    const userId = req.user!.id;
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userApiKey = user[0]?.openaiApiKey;

    console.log(`[PEER-REVIEW] Avvio analisi perizia per utente ${userId}: ${req.file.originalname}`);

    // Estrae il testo dal file
    const peritiaContent = await extractTextFromFile(req.file.path, req.file.originalname);
    
    if (!peritiaContent.trim()) {
      // Cleanup file se estrazione fallisce
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Il file caricato sembra essere vuoto o non leggibile' });
    }

    console.log(`[PEER-REVIEW] Testo estratto: ${peritiaContent.length} caratteri`);

    // Analizza la perizia con il framework ENFSI
    const analysisResult = await analyzePeerReview(peritiaContent, userApiKey || undefined, userId);

    // Salva i risultati nel database
    const [peerReview] = await db.insert(peerReviews).values({
      userId,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || 'application/pdf',
      overallScore: analysisResult.overallScore,
      status: 'completed',
      criteriaResults: analysisResult.criteriaResults,
      suggestions: analysisResult.suggestions,
      classification: analysisResult.classification,
      processingTime: analysisResult.processingTime,
    }).returning();

    console.log(`[PEER-REVIEW] Analisi salvata con ID: ${peerReview.id}`);

    // Cleanup del file temporaneo (opzionale - potremmo volerlo mantenere)
    // fs.unlinkSync(req.file.path);

    res.json({
      id: peerReview.id,
      overallScore: analysisResult.overallScore,
      classification: analysisResult.classification,
      criteriaResults: analysisResult.criteriaResults,
      suggestions: analysisResult.suggestions,
      processingTime: analysisResult.processingTime,
      filename: req.file.originalname
    });

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore durante il submit:', error);
    
    // Cleanup file in caso di errore
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('[PEER-REVIEW] Errore cleanup file:', cleanupError);
      }
    }

    res.status(500).json({ 
      error: 'Errore durante l\'analisi della perizia',
      details: error.message 
    });
  }
});

/**
 * GET /api/peer-review/history
 * Ottiene lo storico delle analisi peer review per l'utente
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const reviews = await db
      .select({
        id: peerReviews.id,
        originalFilename: peerReviews.originalFilename,
        fileSize: peerReviews.fileSize,
        overallScore: peerReviews.overallScore,
        classification: peerReviews.classification,
        status: peerReviews.status,
        processingTime: peerReviews.processingTime,
        createdAt: peerReviews.createdAt
      })
      .from(peerReviews)
      .where(eq(peerReviews.userId, userId))
      .orderBy(desc(peerReviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Conta il totale per la paginazione
    const totalCount = await db
      .select({ count: peerReviews.id })
      .from(peerReviews)
      .where(eq(peerReviews.userId, userId));

    res.json({
      reviews,
      totalCount: totalCount.length,
      page,
      totalPages: Math.ceil(totalCount.length / limit)
    });

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore recupero storico:', error);
    res.status(500).json({ error: 'Errore nel recupero dello storico' });
  }
});

/**
 * GET /api/peer-review/:id
 * Ottiene i dettagli completi di una specifica analisi
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const userId = req.user!.id;

    const [review] = await db
      .select()
      .from(peerReviews)
      .where(and(eq(peerReviews.id, reviewId), eq(peerReviews.userId, userId)))
      .limit(1);

    if (!review) {
      return res.status(404).json({ error: 'Analisi non trovata' });
    }

    // Aggiunge informazioni sulla classificazione
    const classificationInfo = getClassificationInfo(review.classification);

    res.json({
      ...review,
      classificationInfo
    });

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore recupero dettagli:', error);
    res.status(500).json({ error: 'Errore nel recupero dei dettagli' });
  }
});

/**
 * GET /api/peer-review/framework/criteria
 * Ottiene i criteri del framework ENFSI
 */
router.get('/framework/criteria', requireAuth, async (req, res) => {
  try {
    const language = req.query.lang as string || 'it';
    const framework = getENFSIFramework(language);
    res.json(framework);
  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore recupero framework:', error);
    res.status(500).json({ error: 'Errore nel recupero dei criteri' });
  }
});

/**
 * DELETE /api/peer-review/:id
 * Elimina un'analisi peer review
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const userId = req.user!.id;

    // Verifica che l'analisi appartenga all'utente e la elimina
    const result = await db.delete(peerReviews)
      .where(and(eq(peerReviews.id, reviewId), eq(peerReviews.userId, userId)))
      .returning({ id: peerReviews.id });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Analisi non trovata' });
    }

    console.log(`[PEER-REVIEW] Analisi ${reviewId} eliminata per utente ${userId}`);
    res.json({ success: true, message: 'Analisi eliminata con successo' });

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore eliminazione:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

/**
 * GET /api/peer-review/stats/summary
 * Statistiche riassuntive delle analisi peer review per l'utente
 */
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const stats = await db
      .select({
        id: peerReviews.id,
        overallScore: peerReviews.overallScore,
        classification: peerReviews.classification,
        processingTime: peerReviews.processingTime
      })
      .from(peerReviews)
      .where(eq(peerReviews.userId, userId));

    const totalReviews = stats.length;
    const averageScore = totalReviews > 0 
      ? Math.round(stats.reduce((sum, r) => sum + r.overallScore, 0) / totalReviews)
      : 0;

    // Conta per classificazione
    const classificationCounts = stats.reduce((acc: any, review) => {
      acc[review.classification] = (acc[review.classification] || 0) + 1;
      return acc;
    }, {});

    const averageProcessingTime = totalReviews > 0
      ? Math.round(stats.reduce((sum, r) => sum + (r.processingTime || 0), 0) / totalReviews)
      : 0;

    res.json({
      totalReviews,
      averageScore,
      averageProcessingTime,
      classificationCounts,
      recentReviews: stats.slice(-5) // Ultime 5 analisi
    });

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore statistiche:', error);
    res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
  }
});

/**
 * GET /api/peer-review/:id/report
 * Genera e scarica il report PDF per una specifica analisi
 */
router.get('/:id/report', requireAuth, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const userId = req.user!.id;

    const [review] = await db
      .select()
      .from(peerReviews)
      .where(and(eq(peerReviews.id, reviewId), eq(peerReviews.userId, userId)))
      .limit(1);

    if (!review) {
      return res.status(404).json({ error: 'Analisi non trovata' });
    }

    console.log(`[PEER-REVIEW] Generazione report PDF per analisi ID: ${reviewId}`);

    // Genera il report PDF utilizzando PDFKit con numerazione pagine
    const doc = new PDFDocument({ margin: 50 });
    
    // Aggiunge numerazione pagine automatica
    let pageNumber = 1;
    const addPageNumber = () => {
      doc.fontSize(8).fillColor('#6b7280');
      doc.text(`Pagina ${pageNumber}`, 50, 750, { align: 'center', width: 495 });
      pageNumber++;
    };
    
    // Override del metodo addPage per includere numerazione
    const originalAddPage = doc.addPage.bind(doc);
    doc.addPage = (options?: any) => {
      addPageNumber();
      const result = originalAddPage(options);
      return result;
    };
    
    // Genera nome file basato su quello originale
    const originalName = review.originalFilename;
    const nameWithoutExt = path.parse(originalName).name;
    // Rimuovi caratteri speciali e spazi per compatibility browser
    const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    const reportFilename = `${cleanName}_peer_review.pdf`;
    
    
    // Imposta headers per download con encoding sicuro
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFilename}"; filename*=UTF-8''${encodeURIComponent(reportFilename)}`);
    
    // Pipe del documento al response
    doc.pipe(res);

    // Header del documento con logo e branding migliorato
    const headerY = doc.y;
    doc.rect(50, headerY, 495, 60).fillAndStroke('#1e40af', '#1e40af');
    doc.fillColor('#ffffff');
    doc.fontSize(26).text('📊 GrapholexInsight', { align: 'center' }, 60, headerY + 10);
    doc.fontSize(16).text('Report Analisi ENFSI Forense', { align: 'center' }, 60, headerY + 32);
    doc.fontSize(11).text('Conformità agli Standard Europei di Perizia Grafica', { align: 'center' }, 60, headerY + 48);
    doc.fillColor('#212529');
    doc.y = headerY + 70;
    doc.moveDown(1);
    
    // Box Executive Summary
    const boxY = doc.y;
    doc.rect(50, boxY, 495, 80).fillAndStroke('#f8f9fa', '#dee2e6');
    doc.fillColor('#212529');
    doc.fontSize(14).text('Executive Summary', 60, boxY + 10, { underline: true });
    doc.fontSize(12);
    doc.text(`File: ${review.originalFilename}`, 60, boxY + 30);
    doc.text(`Data analisi: ${new Date(review.createdAt).toLocaleDateString('it-IT')}`, 300, boxY + 30);
    doc.text(`Punteggio: ${review.overallScore}/100 (${review.classification.toUpperCase()})`, 60, boxY + 45);
    doc.text(`Tempo elaborazione: ${review.processingTime}s`, 300, boxY + 45);
    
    // Badge di classificazione con colori
    const badgeColors: any = {
      'eccellente': '#10B981',
      'buono': '#F59E0B', 
      'sufficiente': '#F97316',
      'insufficiente': '#EF4444'
    };
    const badgeColor = badgeColors[review.classification] || '#6B7280';
    doc.rect(450, boxY + 8, 80, 20).fillAndStroke(badgeColor, badgeColor);
    doc.fillColor('#FFFFFF').fontSize(10).text(review.classification.toUpperCase(), 455, boxY + 13);
    doc.fillColor('#212529');
    
    doc.y = boxY + 90;
    doc.moveDown();

    // === TABELLA RIASSUNTIVA PUNTEGGI ===
    doc.fontSize(14).text('📈 Riassunto Punteggi per Categoria', { underline: true });
    doc.moveDown(0.5);
    
    const tableY = doc.y;
    const tableHeight = 200;
    const colWidth = 165;
    
    // Header tabella
    doc.rect(50, tableY, colWidth, 25).fillAndStroke('#1e40af', '#1e40af');
    doc.rect(50 + colWidth, tableY, colWidth, 25).fillAndStroke('#1e40af', '#1e40af');
    doc.rect(50 + colWidth * 2, tableY, colWidth, 25).fillAndStroke('#1e40af', '#1e40af');
    
    doc.fillColor('#ffffff').fontSize(10);
    doc.text('Categoria ENFSI', 55, tableY + 8);
    doc.text('Punteggio', 55 + colWidth + 60, tableY + 8);
    doc.text('Valutazione', 55 + colWidth * 2 + 50, tableY + 8);
    
    // Righe tabella
    const tableCriteriaResults = review.criteriaResults as any;
    const tableCategoryNames = {
      structureInfo: 'Struttura Obbligatoria',
      materialDocumentation: 'Documentazione Materiale',
      methodology: 'Metodologia e Procedure',
      technicalAnalysis: 'Analisi Tecnica', 
      validation: 'Validazione e Controlli',
      presentation: 'Presentazione'
    };
    
    let rowY = tableY + 25;
    Object.entries(tableCriteriaResults).forEach(([key, criterion]: [string, any], index: number) => {
      const categoryName = (tableCategoryNames as any)[key] || key;
      const score = criterion.score || 0;
      const evaluation = score >= 85 ? '🟢 Eccellente' : score >= 70 ? '🟡 Buono' : score >= 60 ? '🟠 Sufficiente' : '🔴 Insufficiente';
      
      // Alternar colori righe
      const rowColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(50, rowY, colWidth * 3, 25).fillAndStroke(rowColor, '#e2e8f0');
      
      doc.fillColor('#374151').fontSize(9);
      doc.text(categoryName, 55, rowY + 8, { width: colWidth - 10 });
      doc.text(`${score}%`, 55 + colWidth + 60, rowY + 8);
      doc.text(evaluation, 55 + colWidth * 2 + 10, rowY + 8);
      
      rowY += 25;
    });
    
    doc.y = rowY + 10;
    doc.moveDown();

    // === SEZIONE 1: ANALISI DETTAGLIATA PER CATEGORIA ===
    doc.addPage();
    doc.fontSize(18).text('1. Analisi ENFSI Dettagliata', { underline: true });
    doc.moveDown();

    const criteriaResults = review.criteriaResults as any;
    const categoryNames = {
      structureInfo: 'Struttura Obbligatoria della Relazione',
      materialDocumentation: 'Documentazione del Materiale',
      methodology: 'Metodologia e Procedure',
      technicalAnalysis: 'Analisi Tecnica Specialistica', 
      validation: 'Validazione e Controlli Qualità',
      presentation: 'Presentazione e Valutazione'
    };

    Object.entries(tableCriteriaResults).forEach(([key, criterion]: [string, any], index: number) => {
      const categoryName = (tableCategoryNames as any)[key] || key;
      const score = criterion.score || 0;
      const weight = criterion.weight || 0;
      
      // Header categoria con barra di progresso visiva
      const categoryY = doc.y;
      doc.rect(50, categoryY, 495, 45).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#1e293b');
      doc.fontSize(16).text(`${index + 1}. ${categoryName}`, 60, categoryY + 12);
      doc.fontSize(12).text(`Score: ${score}% | Peso: ${weight}%`, 60, categoryY + 28);
      
      // Barra progresso score più grande
      const progressWidth = (score / 100) * 180;
      const progressColor = score >= 85 ? '#10B981' : score >= 70 ? '#F59E0B' : score >= 60 ? '#F97316' : '#EF4444';
      doc.rect(350, categoryY + 15, 180, 12).fillAndStroke('#e5e7eb', '#d1d5db');
      if (progressWidth > 0) {
        doc.rect(350, categoryY + 15, progressWidth, 12).fillAndStroke(progressColor, progressColor);
      }
      doc.fillColor('#ffffff').fontSize(10).text(`${score}%`, 425, categoryY + 18);
      
      doc.y = categoryY + 55;
      doc.fillColor('#374151');
      
      // Parsing completamente riscritto per sub-criteri
      const details = criterion.details || '';
      
      doc.fontSize(12).text('Valutazione dettagliata:', { indent: 20 });
      doc.moveDown(0.5);
      
      // Parsing robusto per sub-criteri con regex
      if (details.includes('Analisi dettagliata')) {
        // Estrai i sub-criteri usando pattern più robusti
        const subcriteriaPattern = /(\w+):\s*(\d+)%\s*-\s*Evidenza:\s*"([^"]*)"?\s*Gap:\s*([^(]*)\(Severità:\s*(\w+)\)/g;
        let match;
        let hasSubcriteria = false;
        
        while ((match = subcriteriaPattern.exec(details)) !== null) {
          hasSubcriteria = true;
          const [, criterionName, scoreStr, evidence, gap, severity] = match;
          const subScore = parseInt(scoreStr);
          
          // Box per ogni sub-criterio con layout migliorato
          const subY = doc.y;
          const subBoxHeight = Math.max(80, Math.ceil((evidence.length + gap.length) / 2)); // Altezza dinamica
          
          // Colore basato su score
          const subColor = subScore >= 85 ? '#f0fdf4' : subScore >= 70 ? '#fffbeb' : subScore >= 60 ? '#fff7ed' : '#fef2f2';
          const subBorderColor = subScore >= 85 ? '#10b981' : subScore >= 70 ? '#f59e0b' : subScore >= 60 ? '#f97316' : '#ef4444';
          const textColor = subScore >= 85 ? '#065f46' : subScore >= 70 ? '#92400e' : subScore >= 60 ? '#9a3412' : '#991b1b';
          
          doc.rect(70, subY, 460, subBoxHeight).fillAndStroke(subColor, subBorderColor);
          
          // Header sub-criterio
          doc.fillColor('#1f2937');
          doc.fontSize(12).text(`• ${criterionName.charAt(0).toUpperCase() + criterionName.slice(1)}`, 80, subY + 10, { underline: true });
          doc.fillColor(textColor).fontSize(11).text(`${subScore}%`, 480, subY + 10);
          
          // Evidenza (formattata meglio)
          doc.fillColor('#374151');
          doc.fontSize(10).text('Evidenza trovata:', 80, subY + 28);
          doc.fontSize(9).text(`"${evidence.trim()}"`, 80, subY + 42, { 
            width: 440, 
            align: 'justify',
            lineGap: 1
          });
          
          // Gap/Miglioramenti
          const cleanGap = gap.trim().replace(/\s+/g, ' ');
          doc.fillColor('#6b7280');
          doc.fontSize(9).text('Area di miglioramento:', 80, subY + 58);
          doc.fontSize(9).text(cleanGap, 80, subY + 70, { 
            width: 440, 
            align: 'justify',
            lineGap: 1
          });
          
          // Severità indicator
          const severityColor = severity === 'alta' ? '#ef4444' : severity === 'media' ? '#f59e0b' : '#10b981';
          doc.fillColor(severityColor).fontSize(8).text(`Priorità: ${severity.toUpperCase()}`, 400, subY + subBoxHeight - 12);
          
          doc.y = subY + subBoxHeight + 8;
        }
        
        // Fallback se il parsing strutturato fallisce
        if (!hasSubcriteria) {
          // Parsing semplificato per contenuti meno strutturati
          const cleanDetails = details
            .replace(/Analisi dettagliata[^:]*:/g, '')
            .replace(/•\s*/g, '\n• ')
            .replace(/Gap:\s*/g, '\nGap: ')
            .replace(/Evidenza:\s*/g, '\nEvidenza: ')
            .split('\n')
            .filter((line: string) => line.trim())
            .slice(0, 8); // Limita a max 8 linee per evitare overflow
          
          const summaryY = doc.y;
          doc.rect(70, summaryY, 460, Math.min(100, cleanDetails.length * 12 + 20)).fillAndStroke('#f8fafc', '#e2e8f0');
          
          let currentY = summaryY + 10;
          cleanDetails.forEach((line: string) => {
            if (currentY < summaryY + 90) { // Evita overflow del box
              const trimmedLine = line.trim().substring(0, 80); // Tronca linee troppo lunghe
              doc.fillColor('#374151');
              doc.fontSize(9).text(trimmedLine, 80, currentY, { width: 440 });
              currentY += 12;
            }
          });
          
          doc.y = Math.max(currentY + 10, summaryY + 110);
        }
        
      } else {
        // Dettagli generici semplificati
        const summaryY = doc.y;
        const cleanDetails = details.replace(/\s+/g, ' ').trim().substring(0, 200);
        
        doc.rect(70, summaryY, 460, 60).fillAndStroke('#f9fafb', '#d1d5db');
        doc.fillColor('#374151');
        doc.fontSize(10).text('Valutazione generale:', 80, summaryY + 10);
        doc.fontSize(9).text(cleanDetails, 80, summaryY + 26, { 
          width: 440, 
          align: 'justify',
          lineGap: 2
        });
        
        doc.y = summaryY + 70;
      }
      
      doc.moveDown(1);
      
      // Separatore elegante tra categorie
      if (index < Object.keys(criteriaResults).length - 1) {
        doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
        doc.moveDown(1);
      }
      
      // Gestione nuova pagina se necessario
      if (doc.y > 650) {
        doc.addPage();
      }
    });

    // === SEZIONE 2: SUGGERIMENTI E RACCOMANDAZIONI ===
    doc.addPage();
    doc.fontSize(18).text('2. Piano di Miglioramento', { underline: true });
    doc.moveDown();

    const suggestions = review.suggestions || '';
    
    // Parsing suggerimenti strutturati
    if (suggestions.includes('PRIORITÀ')) {
      // Suggerimenti prioritizzati strutturati
      const sections = suggestions.split(/(?=🔴|🟡|🟢|⚠️)/);
      
      sections.forEach(section => {
        if (section.includes('SUGGERIMENTI PRIORITIZZATI')) {
          doc.fontSize(14).text('Raccomandazioni Prioritarie', { underline: true });
          doc.moveDown(0.5);
          
          // Estrai suggerimenti numerati
          const prioritySuggestions = section.split(/\d+\.\s\[PRIORITÀ\s/).slice(1);
          prioritySuggestions.forEach((suggestion, index) => {
            const lines = suggestion.trim().split('\n');
            const priority = lines[0]?.match(/([^\]]+)/)?.[1] || 'MEDIA';
            const category = lines[0]?.split('] ')?.[1] || '';
            
            // Box per ogni suggerimento
            const suggY = doc.y;
            const priorityColor = priority.includes('ALTA') ? '#FEF2F2' : priority.includes('MEDIA') ? '#FFFBEB' : '#F0FDF4';
            const borderColor = priority.includes('ALTA') ? '#EF4444' : priority.includes('MEDIA') ? '#F59E0B' : '#10B981';
            
            doc.rect(50, suggY, 495, 60).fillAndStroke(priorityColor, borderColor);
            doc.fillColor('#1F2937');
            doc.fontSize(11).text(`${index + 1}. [${priority}] ${category}`, 60, suggY + 8, { underline: true });
            
            // Estrai contenuti specifici
            lines.forEach(line => {
              if (line.includes('Problema:')) {
                doc.fontSize(9).text(line.trim(), 60, suggY + 22, { width: 475 });
              } else if (line.includes('Raccomandazione:')) {
                doc.fontSize(9).text(line.trim(), 60, suggY + 35, { width: 475 });
              } else if (line.includes('Impatto atteso:')) {
                doc.fontSize(8).text(line.trim(), 60, suggY + 48, { width: 475 });
              }
            });
            
            doc.y = suggY + 70;
          });
          
        } else if (section.includes('AZIONI IMMEDIATE') || section.includes('Piano di Implementazione')) {
          doc.addPage();
          doc.fontSize(16).text('ALTA PRIORITA\' - Piano Implementazione Immediata', { underline: true });
          doc.moveDown(0.8);
          
          // Box rosso per azioni immediate
          const immediateY = doc.y;
          doc.rect(50, immediateY, 495, 80).fillAndStroke('#fef2f2', '#ef4444');
          doc.fillColor('#dc2626');
          doc.fontSize(12).text('AZIONI IMMEDIATE (entro 1 settimana)', 60, immediateY + 12, { underline: true });
          doc.fillColor('#374151');
          
          const immediateActions = [
            'Implementare processo di revisione tra pari documentato',
            'Documentare catena di custodia per ogni materiale ricevuto',
            'Aggiungere firme digitali/fisiche sui documenti ufficiali'
          ];
          
          let yPos = immediateY + 32;
          immediateActions.forEach((action, index) => {
            doc.fontSize(10).text(`${index + 1}. ${action}`, 70, yPos, { width: 460 });
            yPos += 15;
          });
          
          doc.y = immediateY + 90;
          
        } else if (section.includes('BREVE TERMINE') || section.includes('1-3 settimane')) {
          doc.moveDown(1);
          doc.fontSize(16).text('MEDIA PRIORITA\' - Piano Breve Termine (1-3 settimane)', { underline: true });
          doc.moveDown(0.8);
          
          // Box giallo per azioni breve termine
          const shortTermY = doc.y;
          doc.rect(50, shortTermY, 495, 60).fillAndStroke('#fffbeb', '#f59e0b');
          doc.fillColor('#92400e');
          doc.fontSize(12).text('AZIONI BREVE TERMINE', 60, shortTermY + 12, { underline: true });
          doc.fillColor('#374151');
          
          const shortTermActions = [
            'Documentare esplicitamente ipotesi alternative considerate',
            'Migliorare dettagli su tracciabilità e autenticazione'
          ];
          
          let yPos = shortTermY + 32;
          shortTermActions.forEach((action, index) => {
            doc.fontSize(10).text(`${index + 1}. ${action}`, 70, yPos, { width: 460 });
            yPos += 12;
          });
          
          doc.y = shortTermY + 70;
          
        } else if (section.includes('LUNGO TERMINE') || section.includes('1-3 mesi')) {
          doc.moveDown(1);
          doc.fontSize(16).text('BASSA PRIORITA\' - Piano Lungo Termine (1-3 mesi)', { underline: true });
          doc.moveDown(0.8);
          
          // Box verde per azioni lungo termine
          const longTermY = doc.y;
          doc.rect(50, longTermY, 495, 60).fillAndStroke('#f0fdf4', '#10b981');
          doc.fillColor('#065f46');
          doc.fontSize(12).text('AZIONI LUNGO TERMINE', 60, longTermY + 12, { underline: true });
          doc.fillColor('#374151');
          
          const longTermActions = [
            'Fornire analisi dettagliata caratteristiche individuali',
            'Implementare sistema qualità avanzato per validazione'
          ];
          
          let yPos = longTermY + 32;
          longTermActions.forEach((action: string, index: number) => {
            doc.fontSize(10).text(`${index + 1}. ${action}`, 70, yPos, { width: 460 });
            yPos += 12;
          });
          
          doc.y = longTermY + 70;
          
        } else if (section.includes('PROBLEMI CRITICI') || section.includes('Categoria:')) {
          doc.addPage();
          doc.fontSize(18).text('PROBLEMI CRITICI IDENTIFICATI', { underline: true });
          doc.moveDown(1);
          
          // Parsing migliorato per problemi critici
          const criticalPattern = /Categoria:\s*(\w+)[\s\S]*?Evidenza:\s*"([^"]*)"[\s\S]*?Impatto:\s*([^R]*?)Raccomandazione:\s*([^.]*\.)/g;
          let criticalMatch;
          let problemIndex = 1;
          
          while ((criticalMatch = criticalPattern.exec(section)) !== null) {
            const [, category, evidence, impact, recommendation] = criticalMatch;
            
            // Box critico per ogni problema
            const critY = doc.y;
            doc.rect(50, critY, 495, 120).fillAndStroke('#fef2f2', '#ef4444');
            
            // Header problema
            doc.fillColor('#dc2626');
            doc.fontSize(14).text(`PROBLEMA CRITICO ${problemIndex}`, 60, critY + 12, { underline: true });
            
            // Categoria
            doc.fillColor('#1f2937');
            doc.fontSize(11).text(`Categoria: ${category.toUpperCase()}`, 60, critY + 32);
            
            // Evidenza
            doc.fillColor('#374151');
            doc.fontSize(10).text('Evidenza:', 60, critY + 48);
            doc.fontSize(9).text(`"${evidence.trim()}"`, 60, critY + 62, { width: 460, align: 'justify' });
            
            // Impatto
            doc.fontSize(10).text('Impatto:', 60, critY + 78);
            doc.fontSize(9).text(impact.trim(), 60, critY + 92, { width: 460, align: 'justify' });
            
            // Raccomandazione
            doc.fillColor('#059669');
            doc.fontSize(10).text('Raccomandazione:', 60, critY + 106);
            
            doc.y = critY + 130;
            problemIndex++;
          }
        }
      });
      
    } else {
      // Suggerimenti semplici fallback
      doc.fontSize(12).text('Raccomandazioni Generali:', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(suggestions, { align: 'justify', indent: 20 });
    }
    
    // === SEZIONE 3: METODOLOGIA E CONFORMITÀ ===
    doc.addPage();
    doc.fontSize(18).text('3. Metodologia e Standard ENFSI', { underline: true });
    doc.moveDown();
    
    doc.fontSize(12).text('Standard di Riferimento:', { underline: true });
    doc.fontSize(10).text('• ENFSI Guideline for Evaluative Reporting in Forensic Science (2015)', { indent: 20 });
    doc.text('• Best Practice Manual for the Forensic Examination of Handwriting (2018)', { indent: 20 });
    doc.text('• ISO/IEC 17025:2017 - General requirements for testing and calibration laboratories', { indent: 20 });
    doc.moveDown();
    
    doc.fontSize(12).text('Framework di Valutazione:', { underline: true });
    doc.fontSize(10).text('Il presente report utilizza un sistema di valutazione a 39 parametri conformi agli standard ENFSI, con analisi multi-step che include:', { indent: 20, align: 'justify' });
    doc.text('• Estrazione automatica di citazioni specifiche dal documento', { indent: 30 });
    doc.text('• Valutazione granulare dei sub-criteri con pesi differenziati', { indent: 30 });
    doc.text('• Identificazione automatica di problemi critici e gap di conformità', { indent: 30 });
    doc.text('• Generazione di raccomandazioni prioritizzate e actionable', { indent: 30 });
    doc.moveDown();
    
    doc.fontSize(12).text('Scale di Valutazione:', { underline: true });
    doc.fontSize(10);
    doc.fillColor('#10B981').text('• ECCELLENTE (90-100%): Conformità completa agli standard ENFSI', { indent: 20 });
    doc.fillColor('#F59E0B').text('• BUONO (75-89%): Standard rispettati, dettagli minori da migliorare', { indent: 20 });
    doc.fillColor('#F97316').text('• SUFFICIENTE (60-74%): Base accettabile, alcune lacune metodologiche', { indent: 20 });
    doc.fillColor('#EF4444').text('• INSUFFICIENTE (<60%): Criteri fondamentali mancanti, revisioni necessarie', { indent: 20 });
    doc.fillColor('#000000');
    
    // Footer finale
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e2e8f0');
    doc.moveDown(0.5);
    doc.fontSize(8).text(`Report generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')} - GrapholexInsight ${getVersionString()}`, { align: 'center' });
    doc.text('Sistema di Analisi Forense Conforme agli Standard ENFSI', { align: 'center' });

    // Aggiungi numero pagina alla pagina finale
    addPageNumber();
    
    // Finalizza il documento
    doc.end();

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore generazione report:', error);
    res.status(500).json({ error: 'Errore nella generazione del report' });
  }
});

export default router;