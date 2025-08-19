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

    // Genera il report PDF utilizzando PDFKit
    const doc = new PDFDocument({ margin: 50 });
    
    // Imposta headers per download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-peer-review-${reviewId}.pdf"`);
    
    // Pipe del documento al response
    doc.pipe(res);

    // Header del documento
    doc.fontSize(20).text('Report Analisi ENFSI', { align: 'center' });
    doc.moveDown();
    
    // Informazioni documento
    doc.fontSize(14).text(`File: ${review.originalFilename}`);
    doc.text(`Data analisi: ${new Date(review.createdAt).toLocaleDateString('it-IT')}`);
    doc.text(`Punteggio complessivo: ${review.overallScore}/100`);
    doc.text(`Classificazione: ${review.classification.toUpperCase()}`);
    doc.text(`Tempo di elaborazione: ${review.processingTime}s`);
    doc.moveDown();

    // Sezione criteri
    doc.fontSize(16).text('Analisi per Categoria', { underline: true });
    doc.moveDown();

    const criteriaResults = review.criteriaResults as any;
    Object.entries(criteriaResults).forEach(([key, criterion]: [string, any]) => {
      const categoryNames = {
        structureInfo: 'Struttura e Informazioni',
        materialDocumentation: 'Documentazione Materiale',
        methodology: 'Metodologia',
        technicalAnalysis: 'Analisi Tecnica', 
        validation: 'Validazione',
        presentation: 'Presentazione',
        competence: 'Competenze'
      };
      
      doc.fontSize(12);
      const categoryName = (categoryNames as any)[key] || key;
      doc.text(`${categoryName}: ${criterion.score}% (Peso: ${criterion.weight}%)`);
      doc.fontSize(10);
      doc.text(criterion.details, { indent: 20 });
      doc.moveDown(0.5);
    });

    // Suggerimenti
    doc.addPage();
    doc.fontSize(16).text('Suggerimenti per Miglioramento', { underline: true });
    doc.moveDown();
    doc.fontSize(10).text(review.suggestions);
    
    // Footer
    doc.moveDown();
    doc.fontSize(8).text(`Report generato il ${new Date().toLocaleDateString('it-IT')} - GrapholexInsight`, { align: 'center' });

    // Finalizza il documento
    doc.end();

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore generazione report:', error);
    res.status(500).json({ error: 'Errore nella generazione del report' });
  }
});

export default router;