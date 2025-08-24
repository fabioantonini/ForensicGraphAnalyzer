/**
 * Utilità per la creazione e gestione di report PDF
 */

import path from 'path';
import * as fs from 'fs/promises';
import { createWriteStream, constants } from 'fs';
import { log } from './vite';
import PDFDocument from 'pdfkit';

// Path per i file temporanei
const REPORTS_DIR = path.join(process.cwd(), 'uploads', 'reports');

// Assicura che la directory dei report esista
export async function ensureReportDirectory() {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    log(`Directory reports inizializzata: ${REPORTS_DIR}`, 'pdf-utils');
    return true;
  } catch (error) {
    console.error(`[PDF] Errore nella creazione della directory reports:`, error);
    return false;
  }
}

// Genera un ID univoco per i file report
export function generateReportId() {
  return `report_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

// Genera un nome file per il report
export function generateReportFilename(signatureId: number) {
  return `report_firma_${signatureId}_${Date.now()}.pdf`;
}

// Genera un percorso completo per il report
export function generateReportPath(filename: string) {
  return path.join(REPORTS_DIR, filename);
}

// Verifica se un file esiste
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Pulisce un file temporaneo
export async function cleanupTempFile(filePath: string): Promise<boolean> {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[PDF] Errore nella pulizia del file temporaneo:`, error);
    return false;
  }
}

// Crea un file temporaneo dalla stringa base64
export async function createBase64TempFile(base64String: string, extension: string = 'png'): Promise<string | null> {
  try {
    await ensureReportDirectory();
    const tempFilePath = path.join(REPORTS_DIR, `temp_${Date.now()}.${extension}`);
    await fs.writeFile(tempFilePath, Buffer.from(base64String, 'base64'));
    return tempFilePath;
  } catch (error) {
    console.error(`[PDF] Errore nella creazione del file temporaneo:`, error);
    return null;
  }
}

// Genera un PDF per la firma usando dati esistenti
export async function generateSignatureReportPDF(data: {
  signatureId: number,
  originalFilename: string,
  projectName: string,
  signatureImagePath: string,
  similarityScore: number,
  comparisonChart: string | null,
  analysisReport: string | null,
  // === NUOVI PARAMETRI DI NATURALEZZA ===
  naturalnessScore?: number | null,
  verdict?: string | null,
  confidenceLevel?: number | null,
  verdictExplanation?: string | null
}): Promise<{ success: boolean, reportPath?: string, error?: string }> {
  try {
    // Utilizziamo PDFDocument già importato globalmente
    
    // Assicuriamoci che la directory esista
    await ensureReportDirectory();
    
    // Crea un nome e percorso per il report
    const filename = generateReportFilename(data.signatureId);
    const outputPath = generateReportPath(filename);
    
    // Crea una stream di scrittura
    const pdfStream = createWriteStream(outputPath);
    
    // Crea un nuovo documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      info: {
        Title: `Rapporto di analisi firma - ${data.originalFilename}`,
        Author: 'GrapholexInsight',
        Subject: `Verifica firma: ${data.originalFilename}`,
        Keywords: 'firma, verifica, analisi, grafologia',
        CreationDate: new Date()
      }
    });
    
    // Pipe il PDF alla stream di scrittura
    doc.pipe(pdfStream);
    
    // Intestazione
    doc.fontSize(22).text('GrapholexInsight', { align: 'center' });
    doc.fontSize(18).text('Rapporto di Analisi Firma', { align: 'center' });
    doc.moveDown();
    
    // Informazioni generali
    doc.fontSize(14).text(`Progetto: ${data.projectName}`, { underline: true });
    doc.moveDown();
    doc.fontSize(14).text(`Firma analizzata: ${data.originalFilename}`, { underline: true });
    doc.moveDown();
    
    // Data e ID
    doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('it-IT')}`);
    doc.fontSize(12).text(`ID Firma: ${data.signatureId}`);
    doc.moveDown();
    
    // Punteggio
    doc.fontSize(14).text(`Punteggio di somiglianza: ${(data.similarityScore * 100).toFixed(1)}%`);
    doc.moveDown();
    
    // === NUOVA SEZIONE: PARAMETRI DI NATURALEZZA ===
    if (data.naturalnessScore !== null && data.naturalnessScore !== undefined) {
      doc.fontSize(14).text('Analisi di Naturalezza (Anti-Dissimulazione):', { underline: true });
      doc.moveDown();
      
      doc.fontSize(12).text(`🧠 Indice di Naturalezza: ${(data.naturalnessScore * 100).toFixed(1)}%`);
      
      if (data.verdict) {
        doc.fontSize(12).text(`🎯 Verdetto: ${data.verdict}`);
      }
      
      if (data.confidenceLevel) {
        doc.fontSize(12).text(`⚡ Livello di Confidenza: ${(data.confidenceLevel * 100).toFixed(0)}%`);
      }
      
      if (data.verdictExplanation) {
        doc.fontSize(10).text(`💡 Spiegazione: ${data.verdictExplanation}`, { align: 'justify' });
      }
      
      // Spiegazione tecnica della naturalezza
      doc.moveDown();
      doc.fontSize(10).text(
        "L'Indice di Naturalezza combina tre parametri avanzati: Fluidità dei tratti (coordinazione motoria), " +
        "Consistenza della Pressione (controllo dell'intensità), e Coordinazione Generale (regolarità delle curve). " +
        "Valori bassi possono indicare falsificazione, mentre valori intermedi possono suggerire dissimulazione autentica.",
        { align: 'justify' }
      );
      doc.moveDown();
    }
    
    // Immagine della firma
    try {
      // Verifica che l'immagine esista
      const imageExists = await fileExists(data.signatureImagePath);
      
      if (imageExists) {
        // Aggiungi una sezione per le immagini
        doc.fontSize(14).text('Firma in verifica:', { underline: true });
        doc.moveDown();
        
        // Calcola le dimensioni per l'immagine
        doc.image(data.signatureImagePath, {
          width: 300,
          align: 'center'
        });
        doc.moveDown();
      } else {
        doc.text('Immagine della firma non disponibile', { align: 'center' });
        doc.moveDown();
      }
    } catch (imgErr) {
      doc.text('Errore nel caricamento dell\'immagine', { align: 'center' });
      doc.moveDown();
      console.error('[PDF] Errore nel caricamento dell\'immagine:', imgErr);
    }
    
    // Grafico di confronto
    if (data.comparisonChart) {
      doc.fontSize(14).text('Grafico di confronto:', { underline: true });
      doc.moveDown();
      
      // Crea un file temporaneo per l'immagine del grafico
      const chartImagePath = await createBase64TempFile(data.comparisonChart);
      
      if (chartImagePath) {
        try {
          // Aggiungi l'immagine del grafico
          doc.image(chartImagePath, {
            width: 500,
            align: 'center'
          });
          doc.moveDown();
          
          // Pulisci il file temporaneo
          await cleanupTempFile(chartImagePath);
        } catch (chartErr) {
          doc.text('Errore nel caricamento del grafico', { align: 'center' });
          doc.moveDown();
          console.error('[PDF] Errore nel caricamento del grafico:', chartErr);
        }
      } else {
        doc.text('Grafico di confronto non disponibile', { align: 'center' });
        doc.moveDown();
      }
    }
    
    // Report di analisi
    if (data.analysisReport) {
      doc.fontSize(14).text('Analisi tecnica:', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(data.analysisReport);
      doc.moveDown();
    }
    
    // Metodologia
    doc.fontSize(14).text('Metodologia di analisi:', { underline: true });
    doc.moveDown();
    doc.fontSize(10).text(
      "L'analisi delle firme utilizza un approccio multi-parametro che considera diversi aspetti " +
      "grafologici e metrici delle firme confrontate. Il sistema estrae e confronta i seguenti parametri:\n\n" +
      "- Proporzioni (15%): Larghezza, altezza e rapporto proporzionale della firma\n" +
      "- Caratteristiche dei tratti (25%): Spessore, pressione e variabilità dei tratti\n" +
      "- Curvatura (20%): Angoli, curve e fluidità del tratto\n" +
      "- Distribuzione spaziale (20%): Densità e posizionamento dei tratti nell'area della firma\n" +
      "- Connettività (20%): Continuità e frammentazione dei tratti\n\n" +
      "Il punteggio di somiglianza combinato deriva dalla media ponderata di questi parametri, con " +
      "un'accuratezza stimata dell'85% rispetto all'analisi manuale di un esperto grafologo. " +
      "Punteggi superiori all'80% indicano un'alta probabilità di autenticità."
    );
    
    // Note legali
    doc.moveDown();
    doc.fontSize(8).fillColor('gray').text(
      "Nota: Questo report è generato automaticamente da un sistema di analisi computazionale e non " +
      "costituisce una perizia legale. Per scopi legali o forensi, consultare un esperto grafologo certificato.",
      { align: 'center' }
    );
    
    // Finalizza il documento
    doc.end();
    
    // Attendi il completamento della scrittura
    return new Promise((resolve, reject) => {
      pdfStream.on('finish', () => {
        log(`PDF generato con successo in: ${outputPath}`, 'pdf-utils');
        resolve({ success: true, reportPath: outputPath });
      });
      
      pdfStream.on('error', (err) => {
        console.error(`[PDF] Errore nella scrittura del PDF:`, err);
        reject({ success: false, error: `Errore nella scrittura del PDF: ${err.message}` });
      });
    });
    
  } catch (error: any) {
    console.error(`[PDF] Errore nella generazione del PDF:`, error);
    return { success: false, error: `Errore nella generazione del PDF: ${error.message}` };
  }
}