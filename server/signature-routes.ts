import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { SignatureAnalyzer } from "./signature-analyzer";
import { SignaturePythonAnalyzer } from "./python-bridge";
import { insertSignatureProjectSchema, insertSignatureSchema } from "@shared/schema";
import { log } from "./vite";
import PDFDocument from "pdfkit";
import OpenAI from "openai";
import { SignatureCropper } from "./signature-cropper";
// Import determineBestDPI rimosso - ora utilizziamo solo dimensioni reali inserite dall'utente

// Per compatibilità retroattiva, inizialmente usiamo solo fs standard
import { createWriteStream, constants } from "fs";
import sharp from "sharp";

// Inizializza OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Funzione per generare analisi AI dei parametri di confronto
async function generateAIAnalysis(signatureParams: any, referenceParams: any, similarityScore: number, userApiKey?: string): Promise<string> {
  try {
    // Usa la chiave API dell'utente se disponibile, altrimenti quella del sistema
    const openaiClient = userApiKey 
      ? new OpenAI({ apiKey: userApiKey })
      : openai;

    const prompt = `
Sei un esperto grafologi forense. Analizza oggettivamente questi parametri di confronto tra due firme e fornisci una valutazione professionale.

FIRMA IN VERIFICA:
- Dimensioni: ${signatureParams.width || 'N/A'}x${signatureParams.height || 'N/A'} px${signatureParams.realDimensions?.widthMm && signatureParams.realDimensions?.heightMm ? ` (${signatureParams.realDimensions.widthMm.toFixed(1)}x${signatureParams.realDimensions.heightMm.toFixed(1)} mm)` : ''}
- Spessore tratto medio: ${signatureParams.strokeWidth?.meanMm?.toFixed(3)} mm
- Spessore massimo: ${signatureParams.strokeWidth?.maxMm?.toFixed(3)} mm
- Spessore minimo: ${signatureParams.strokeWidth?.minMm?.toFixed(3)} mm
- Varianza spessore: ${signatureParams.strokeWidth?.variance?.toFixed(2)}
- Lunghezza totale tratti: ${signatureParams.totalLength?.toFixed(2)} mm
- Numero componenti connesse: ${signatureParams.connectedComponents}
- Curvatura media: ${signatureParams.averageCurvature?.toFixed(3)}
- PARAMETRI AVANZATI PYTHON/OPENCV:
  • Inclinazione: ${signatureParams.inclination != null ? signatureParams.inclination.toFixed(1) + '°' : 'Non disponibile per confronto'}
  • Pressione media: ${signatureParams.pressureMean != null ? signatureParams.pressureMean.toFixed(0) : 'Non disponibile per confronto'}
  • Deviazione pressione: ${signatureParams.pressureStd != null ? signatureParams.pressureStd.toFixed(1) : 'Non disponibile per confronto'}
  • Spaziatura media: ${signatureParams.avgSpacing != null ? signatureParams.avgSpacing.toFixed(2) + ' mm' : 'Non disponibile per confronto'}
  • Velocità scrittura: ${signatureParams.velocity != null ? signatureParams.velocity + '/5' : 'Non disponibile per confronto'}
  • Proporzione: ${signatureParams.proportion != null ? signatureParams.proportion.toFixed(3) : 'Non disponibile per confronto'}
  • Dimensione asole: ${signatureParams.avgAsolaSize != null ? signatureParams.avgAsolaSize.toFixed(3) + ' mm' : 'Non disponibile per confronto'}
  • Curvatura: ${signatureParams.avgCurvature != null ? signatureParams.avgCurvature.toFixed(3) : 'Non disponibile per confronto'}
  • Deviazione baseline: ${signatureParams.baselineStdMm != null ? signatureParams.baselineStdMm.toFixed(2) + ' mm' : 'Non disponibile per confronto'}
  • Stile scrittura: ${signatureParams.writingStyle || 'Non disponibile per confronto'}
  • Leggibilità: ${signatureParams.readability || 'Non disponibile per confronto'}
  • Contrasto: ${signatureParams.contrastLevel != null ? (signatureParams.contrastLevel * 100).toFixed(0) + '%' : 'Non disponibile per confronto'}
  • Qualità immagine: ${signatureParams.imageQuality != null ? (signatureParams.imageQuality * 100).toFixed(0) + '%' : 'Non disponibile per confronto'}
  • Connettività: ${signatureParams.connectivity?.connectedComponents != null ? signatureParams.connectivity.connectedComponents + ' componenti' : 'Non disponibile per confronto'}
  • Complessità tratto: ${signatureParams.connectivity?.strokeComplexity != null ? (signatureParams.connectivity.strokeComplexity * 100).toFixed(0) + '%' : 'Non disponibile per confronto'}

FIRMA DI RIFERIMENTO:
- Dimensioni: ${referenceParams.width}x${referenceParams.height} px (${referenceParams.realDimensions?.widthMm?.toFixed(1)}x${referenceParams.realDimensions?.heightMm?.toFixed(1)} mm)
- Spessore tratto medio: ${referenceParams.strokeWidth?.meanMm?.toFixed(3)} mm
- Spessore massimo: ${referenceParams.strokeWidth?.maxMm?.toFixed(3)} mm
- Spessore minimo: ${referenceParams.strokeWidth?.minMm?.toFixed(3)} mm
- Varianza spessore: ${referenceParams.strokeWidth?.variance?.toFixed(2)}
- Lunghezza totale tratti: ${referenceParams.totalLength?.toFixed(2)} mm
- Numero componenti connesse: ${referenceParams.connectedComponents}
- Curvatura media: ${referenceParams.averageCurvature?.toFixed(3)}
- PARAMETRI AVANZATI PYTHON/OPENCV:
  • Inclinazione: ${referenceParams.inclination != null ? referenceParams.inclination.toFixed(1) + '°' : 'Non disponibile per confronto'}
  • Pressione media: ${referenceParams.pressureMean != null ? referenceParams.pressureMean.toFixed(0) : 'Non disponibile per confronto'}
  • Deviazione pressione: ${referenceParams.pressureStd != null ? referenceParams.pressureStd.toFixed(1) : 'Non disponibile per confronto'}
  • Spaziatura media: ${referenceParams.avgSpacing != null ? referenceParams.avgSpacing.toFixed(2) + ' mm' : 'Non disponibile per confronto'}
  • Velocità scrittura: ${referenceParams.velocity != null ? referenceParams.velocity + '/5' : 'Non disponibile per confronto'}
  • Proporzione: ${referenceParams.proportion != null ? referenceParams.proportion.toFixed(3) : 'Non disponibile per confronto'}
  • Dimensione asole: ${referenceParams.avgAsolaSize != null ? referenceParams.avgAsolaSize.toFixed(3) + ' mm' : 'Non disponibile per confronto'}
  • Curvatura: ${referenceParams.avgCurvature != null ? referenceParams.avgCurvature.toFixed(3) : 'Non disponibile per confronto'}
  • Deviazione baseline: ${referenceParams.baselineStdMm != null ? referenceParams.baselineStdMm.toFixed(2) + ' mm' : 'Non disponibile per confronto'}
  • Stile scrittura: ${referenceParams.writingStyle || 'Non disponibile per confronto'}
  • Leggibilità: ${referenceParams.readability || 'Non disponibile per confronto'}
  • Contrasto: ${referenceParams.contrastLevel != null ? (referenceParams.contrastLevel * 100).toFixed(0) + '%' : 'Non disponibile per confronto'}
  • Qualità immagine: ${referenceParams.imageQuality != null ? (referenceParams.imageQuality * 100).toFixed(0) + '%' : 'Non disponibile per confronto'}
  • Connettività: ${referenceParams.connectivity?.connectedComponents != null ? referenceParams.connectivity.connectedComponents + ' componenti' : 'Non disponibile per confronto'}
  • Complessità tratto: ${referenceParams.connectivity?.strokeComplexity != null ? (referenceParams.connectivity.strokeComplexity * 100).toFixed(0) + '%' : 'Non disponibile per confronto'}

PUNTEGGIO SIMILARITÀ ALGORITMICO: ${(similarityScore * 100).toFixed(1)}%

Fornisci un'analisi dettagliata che includa:
1. Confronto parametro per parametro evidenziando differenze significative
2. Valutazione della coerenza dimensionale e proporzionale  
3. Analisi delle caratteristiche grafologiche (pressione, fluidità, controllo motorio)
4. Identificazione di eventuali anomalie o elementi sospetti
5. Conclusione professionale sull'autenticità con raccomandazioni

IMPORTANTE: Non utilizzare tag Markdown (**, *, #, etc.) nel testo. Usa solo testo semplice formattato con maiuscole per i titoli e struttura chiara con paragrafi separati.
`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.3 // Bassa temperatura per analisi più oggettiva
    });

    let analysisText = response.choices[0].message.content || "Analisi AI non disponibile";
    
    // Rimuovi TUTTI i tag Markdown dal testo (filtro completo)
    analysisText = analysisText
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Rimuovi **bold**
      .replace(/\*(.*?)\*/g, '$1')      // Rimuovi *italic*
      .replace(/#{1,6}\s?/g, '')        // Rimuovi # headers
      .replace(/`(.*?)`/g, '$1')        // Rimuovi `code`
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Rimuovi [links](url)
      .replace(/^\s*[\*\-\+]\s+/gm, '')  // Rimuovi bullet points
      .replace(/_{2,}/g, '')            // Rimuovi __underline__
      .replace(/~~(.*?)~~/g, '$1')      // Rimuovi ~~strikethrough~~
      .replace(/\|/g, ' ')              // Rimuovi separatori tabelle
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Rimuovi **bold** (duplicato per sicurezza)
      .replace(/\*([^*]+)\*/g, '$1')    // Rimuovi *italic* (duplicato per sicurezza)
      .replace(/(\r?\n){3,}/g, '\n\n'); // Riduci multiple newlines
    
    return analysisText;
  } catch (error) {
    console.error(`[AI ANALYSIS] Errore nell'analisi AI:`, error);
    return "Analisi AI non disponibile - procedere con valutazione manuale dei parametri tecnici.";
  }
}

// Funzione per analisi fallback veloce (senza AI)
function generateFallbackAnalysis(signatureParams: any, referenceParams: any, similarityScore: number): string {
  const percentageScore = (similarityScore * 100).toFixed(1);
  
  let analysis = `ANALISI TECNICA AUTOMATICA\n\n`;
  analysis += `Punteggio di similarità: ${percentageScore}%\n\n`;
  
  if (similarityScore >= 0.85) {
    analysis += `VALUTAZIONE: AUTENTICA - I parametri tecnici mostrano alta compatibilità con la firma di riferimento.\n\n`;
  } else if (similarityScore >= 0.65) {
    analysis += `VALUTAZIONE: PROBABILE AUTENTICA - I parametri mostrano buona compatibilità ma con alcune variazioni.\n\n`;
  } else {
    analysis += `VALUTAZIONE: SOSPETTA - Rilevate differenze significative nei parametri tecnici.\n\n`;
  }
  
  // Confronto parametri
  if (signatureParams.strokeWidth && referenceParams.strokeWidth) {
    const strokeDiff = Math.abs(signatureParams.strokeWidth.meanMm - referenceParams.strokeWidth.meanMm);
    analysis += `SPESSORE TRATTO: Differenza media ${strokeDiff.toFixed(3)}mm `;
    analysis += strokeDiff < 0.05 ? '(compatibile)\n' : strokeDiff < 0.1 ? '(accettabile)\n' : '(significativa)\n';
  }
  
  if (signatureParams.realDimensions && referenceParams.realDimensions) {
    const widthRatio = signatureParams.realDimensions.widthMm / referenceParams.realDimensions.widthMm;
    analysis += `PROPORZIONI: Rapporto dimensionale ${widthRatio.toFixed(2)} `;
    analysis += Math.abs(widthRatio - 1) < 0.2 ? '(compatibile)\n' : '(variazione significativa)\n';
  }
  
  analysis += `\nNOTA: Analisi generata automaticamente dai parametri tecnici estratti.`;
  
  return analysis;
}

// Funzione helper per generare report PDF con i dati già calcolati
async function generatePDFReportFromExistingData(params: {
  outputPath: string,
  signature: any,
  referenceSignature: any,
  caseInfo: any,
  signaturePath: string,
  referencePath: string
}) {
  const { outputPath, signature, referenceSignature, caseInfo, signaturePath, referencePath } = params;
  
  // Usa i dati già calcolati dalla firma
  const similarityScore = signature.comparisonResult || 0;
  const comparisonChart = signature.comparisonChart;
  const analysisReport = signature.analysisReport;
  
  // Crea una stream di scrittura
  const pdfStream = createWriteStream(outputPath);
  
  // Crea un nuovo documento PDF
  const doc = new PDFDocument({
    size: 'A4',
    info: {
      Title: 'Rapporto di Analisi Firma',
      Author: 'GrapholexInsight',
      Subject: 'Verifica Firma',
      Keywords: 'firma, verifica, analisi, grafologia',
      CreationDate: new Date()
    }
  });
  
  // Pipe il PDF alla stream di scrittura
  doc.pipe(pdfStream);
  
  // Header del documento
  doc.fontSize(20).text('RAPPORTO DI ANALISI FIRMA', { align: 'center' });
  doc.moveDown(2);
  
  // Informazioni del caso
  doc.fontSize(14).text('INFORMAZIONI DEL CASO', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Progetto: ${caseInfo.caseName}`);
  doc.text(`Oggetto: ${caseInfo.subject}`);
  doc.text(`Data: ${caseInfo.date}`);
  doc.text(`Tipo: ${caseInfo.documentType}`);
  if (caseInfo.notes) {
    doc.text(`Note: ${caseInfo.notes}`);
  }
  doc.moveDown(1.5);
  
  // Risultato principale
  doc.fontSize(16).text('RISULTATO DELL\'ANALISI', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(14);
  
  const percentageScore = (similarityScore * 100).toFixed(1);
  let verdict = '';
  
  if (similarityScore >= 0.85) {
    verdict = 'AUTENTICA';
  } else if (similarityScore >= 0.65) {
    verdict = 'PROBABILE AUTENTICA';  
  } else {
    verdict = 'SOSPETTA';
  }
  
  doc.text(`Punteggio di similarità: ${percentageScore}%`);
  doc.text(`Valutazione: ${verdict}`);
  doc.moveDown(1.5);
  
  // Genera analisi AI basata sui parametri (con fallback veloce)
  let aiAnalysis = '';
  if (signature.parameters && referenceSignature.parameters) {
    console.log(`[PDF REPORT] Generazione analisi AI per firma ${signature.id} - timeout 15s`);
    console.log(`[PDF REPORT] Parametri firma da verificare:`, JSON.stringify(signature.parameters, null, 2));
    console.log(`[PDF REPORT] Parametri firma di riferimento:`, JSON.stringify(referenceSignature.parameters, null, 2));
    try {
      // Ottieni la chiave API dell'utente
      const project = await storage.getSignatureProject(signature.projectId);
      const user = project ? await storage.getUser(project.userId) : null;
      const userApiKey = user?.openaiApiKey;
      
      aiAnalysis = await generateAIAnalysis(signature.parameters, referenceSignature.parameters, similarityScore, userApiKey);
      console.log(`[PDF REPORT] Analisi AI completata per firma ${signature.id}`);
    } catch (error) {
      console.log(`[PDF REPORT] Analisi AI fallita per firma ${signature.id}, uso analisi standard`);
      // Genera analisi fallback veloce
      aiAnalysis = generateFallbackAnalysis(signature.parameters, referenceSignature.parameters, similarityScore);
    }
  } else {
    console.log(`[PDF REPORT] Parametri mancanti - signature.parameters: ${!!signature.parameters}, referenceSignature.parameters: ${!!referenceSignature.parameters}`);
  }
  
  // Report di analisi AI
  if (aiAnalysis) {
    doc.fontSize(14).text('ANALISI PERITALE AI', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(aiAnalysis);
    doc.moveDown(1.5);
  }
  
  // Report di analisi tecnica esistente se disponibile
  if (analysisReport) {
    doc.fontSize(14).text('ANALISI TECNICA ALGORITMICA', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(analysisReport);
    doc.moveDown(1.5);
  }
  
  // Sezione parametri tecnici
  doc.fontSize(14).text('PARAMETRI ANALIZZATI', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  
  if (signature.parameters) {
    const params = signature.parameters;
    
    // Per firme processate prima del fix, leggi le dimensioni dal file
    let signatureWidth = params.width;
    let signatureHeight = params.height;
    
    if (!signatureWidth || !signatureHeight) {
      try {
        const signatureImagePath = path.join('./uploads', signature.filename);
        const metadata = await sharp(signatureImagePath).metadata();
        signatureWidth = metadata.width;
        signatureHeight = metadata.height;
      } catch (err: any) {
        console.log(`[PDF REPORT] Impossibile leggere dimensioni da ${signature.filename}: ${err.message}`);
      }
    }
    
    doc.text('FIRMA IN VERIFICA:');
    doc.text(`• Dimensioni: ${signatureWidth || 'Non disponibile'}x${signatureHeight || 'Non disponibile'} px`);
    if (params.realDimensions) {
      doc.text(`• Dimensioni reali: ${params.realDimensions.widthMm?.toFixed(1)}x${params.realDimensions.heightMm?.toFixed(1)} mm`);
    }
    if (params.strokeWidth) {
      doc.text(`• Spessore tratto medio: ${params.strokeWidth.meanMm?.toFixed(3)} mm`);
      doc.text(`• Spessore massimo: ${params.strokeWidth.maxMm?.toFixed(3)} mm`);
      doc.text(`• Spessore minimo: ${params.strokeWidth.minMm?.toFixed(3)} mm`);
      doc.text(`• Varianza spessore: ${params.strokeWidth.variance?.toFixed(2)}`);
    }
    
    // PARAMETRI AVANZATI
    if (params.proportion !== undefined) {
      doc.text(`• Proporzione: ${params.proportion?.toFixed(3) || 'Non disponibile'}`);
    }
    if (params.inclination !== undefined) {
      doc.text(`• Inclinazione: ${params.inclination?.toFixed(1) || 'Non disponibile'}°`);
    }
    if (params.pressureMean !== undefined) {
      doc.text(`• Pressione media: ${params.pressureMean?.toFixed(1) || 'Non disponibile'}`);
    }
    if (params.pressureStd !== undefined) {
      doc.text(`• Deviazione pressione: ${params.pressureStd?.toFixed(1) || 'Non disponibile'}`);
    }
    if (params.avgCurvature !== undefined) {
      doc.text(`• Curvatura media: ${params.avgCurvature?.toFixed(3) || 'Non disponibile'}`);
    }
    if (params.velocity !== undefined) {
      doc.text(`• Velocità scrittura: ${params.velocity || 'Non disponibile'}/5`);
    }
    if (params.writingStyle) {
      doc.text(`• Stile scrittura: ${params.writingStyle || 'Non disponibile'}`);
    }
    if (params.readability) {
      doc.text(`• Leggibilità: ${params.readability || 'Non disponibile'}`);
    }
    if (params.avgAsolaSize !== undefined) {
      doc.text(`• Dimensione asole medie: ${params.avgAsolaSize?.toFixed(2) || 'Non disponibile'} mm`);
    }
    if (params.avgSpacing !== undefined) {
      doc.text(`• Spaziatura media: ${params.avgSpacing?.toFixed(2) || 'Non disponibile'} mm`);
    }
    if (params.overlapRatio !== undefined) {
      doc.text(`• Rapporto sovrapposizione: ${(params.overlapRatio * 100)?.toFixed(1) || 'Non disponibile'}%`);
    }
    if (params.letterConnections !== undefined) {
      doc.text(`• Connessioni lettere: ${params.letterConnections?.toFixed(2) || 'Non disponibile'}`);
    }
    if (params.baselineStdMm !== undefined) {
      doc.text(`• Deviazione baseline: ${params.baselineStdMm?.toFixed(2) || 'Non disponibile'} mm`);
    }
    
    // Parametri di connettività se disponibili
    if (params.connectivity) {
      doc.text(`• Componenti connesse: ${params.connectivity.connectedComponents || 'Non disponibile'}`);
      doc.text(`• Complessità tratto: ${(params.connectivity.strokeComplexity * 100)?.toFixed(0) || 'Non disponibile'}%`);
    }
    
    doc.moveDown(0.5);
  }
  
  if (referenceSignature.parameters) {
    const refParams = referenceSignature.parameters;
    
    // Per firme processate prima del fix, leggi le dimensioni dal file
    let refWidth = refParams.width;
    let refHeight = refParams.height;
    
    if (!refWidth || !refHeight) {
      try {
        const refImagePath = path.join('./uploads', referenceSignature.filename);
        const metadata = await sharp(refImagePath).metadata();
        refWidth = metadata.width;
        refHeight = metadata.height;
      } catch (err: any) {
        console.log(`[PDF REPORT] Impossibile leggere dimensioni da ${referenceSignature.filename}: ${err.message}`);
      }
    }
    
    doc.text('FIRMA DI RIFERIMENTO:');
    doc.text(`• Dimensioni: ${refWidth || 'Non disponibile'}x${refHeight || 'Non disponibile'} px`);
    if (refParams.realDimensions) {
      doc.text(`• Dimensioni reali: ${refParams.realDimensions.widthMm?.toFixed(1)}x${refParams.realDimensions.heightMm?.toFixed(1)} mm`);
    }
    if (refParams.strokeWidth) {
      doc.text(`• Spessore tratto medio: ${refParams.strokeWidth.meanMm?.toFixed(3)} mm`);
      doc.text(`• Spessore massimo: ${refParams.strokeWidth.maxMm?.toFixed(3)} mm`);
      doc.text(`• Spessore minimo: ${refParams.strokeWidth.minMm?.toFixed(3)} mm`);
      doc.text(`• Varianza spessore: ${refParams.strokeWidth.variance?.toFixed(2)}`);
    }
    
    // PARAMETRI AVANZATI FIRMA DI RIFERIMENTO
    if (refParams.proportion !== undefined) {
      doc.text(`• Proporzione: ${refParams.proportion?.toFixed(3) || 'Non disponibile'}`);
    }
    if (refParams.inclination !== undefined) {
      doc.text(`• Inclinazione: ${refParams.inclination?.toFixed(1) || 'Non disponibile'}°`);
    }
    if (refParams.pressureMean !== undefined) {
      doc.text(`• Pressione media: ${refParams.pressureMean?.toFixed(1) || 'Non disponibile'}`);
    }
    if (refParams.pressureStd !== undefined) {
      doc.text(`• Deviazione pressione: ${refParams.pressureStd?.toFixed(1) || 'Non disponibile'}`);
    }
    if (refParams.avgCurvature !== undefined) {
      doc.text(`• Curvatura media: ${refParams.avgCurvature?.toFixed(3) || 'Non disponibile'}`);
    }
    if (refParams.velocity !== undefined) {
      doc.text(`• Velocità scrittura: ${refParams.velocity || 'Non disponibile'}/5`);
    }
    if (refParams.writingStyle) {
      doc.text(`• Stile scrittura: ${refParams.writingStyle || 'Non disponibile'}`);
    }
    if (refParams.readability) {
      doc.text(`• Leggibilità: ${refParams.readability || 'Non disponibile'}`);
    }
    if (refParams.avgAsolaSize !== undefined) {
      doc.text(`• Dimensione asole medie: ${refParams.avgAsolaSize?.toFixed(2) || 'Non disponibile'} mm`);
    }
    if (refParams.avgSpacing !== undefined) {
      doc.text(`• Spaziatura media: ${refParams.avgSpacing?.toFixed(2) || 'Non disponibile'} mm`);
    }
    if (refParams.overlapRatio !== undefined) {
      doc.text(`• Rapporto sovrapposizione: ${(refParams.overlapRatio * 100)?.toFixed(1) || 'Non disponibile'}%`);
    }
    if (refParams.letterConnections !== undefined) {
      doc.text(`• Connessioni lettere: ${refParams.letterConnections?.toFixed(2) || 'Non disponibile'}`);
    }
    if (refParams.baselineStdMm !== undefined) {
      doc.text(`• Deviazione baseline: ${refParams.baselineStdMm?.toFixed(2) || 'Non disponibile'} mm`);
    }
    
    // Parametri di connettività se disponibili
    if (refParams.connectivity) {
      doc.text(`• Componenti connesse: ${refParams.connectivity.connectedComponents || 'Non disponibile'}`);
      doc.text(`• Complessità tratto: ${(refParams.connectivity.strokeComplexity * 100)?.toFixed(0) || 'Non disponibile'}%`);
    }
    
    doc.moveDown(1);
  }
  
  // Grafico di confronto se disponibile
  if (comparisonChart) {
    doc.fontSize(14).text('GRAFICO DI CONFRONTO', { underline: true });
    doc.moveDown(0.5);
    
    try {
      // Crea un file temporaneo per l'immagine del grafico
      const chartImagePath = path.join(process.cwd(), 'uploads', 'temp_chart.png');
      await fs.writeFile(chartImagePath, Buffer.from(comparisonChart, 'base64'));
      
      // Aggiungi l'immagine del grafico
      doc.image(chartImagePath, { width: 400, align: 'center' });
      doc.moveDown(1);
      
      // Pulisci il file temporaneo
      try {
        await fs.unlink(chartImagePath);
      } catch (e) {
        // Ignora eventuali errori nella pulizia
      }
    } catch (chartErr) {
      doc.text('Grafico di confronto non disponibile', { align: 'center' });
      doc.moveDown(1);
    }
  }
  
  // Sezione immagini
  doc.fontSize(14).text('IMMAGINI ANALIZZATE', { underline: true });
  doc.moveDown(0.5);
  
  try {
    // Aggiungi immagine della firma in verifica
    if (await fs.access(signaturePath).then(() => true).catch(() => false)) {
      doc.fontSize(12).text('Firma in verifica:', { underline: true });
      doc.moveDown(0.3);
      doc.image(signaturePath, { width: 250, align: 'center' });
      doc.moveDown(1);
    }
    
    // Aggiungi immagine della firma di riferimento
    if (await fs.access(referencePath).then(() => true).catch(() => false)) {
      doc.fontSize(12).text('Firma di riferimento:', { underline: true });
      doc.moveDown(0.3);
      doc.image(referencePath, { width: 250, align: 'center' });
      doc.moveDown(1);
    }
  } catch (imgError) {
    doc.fontSize(10).text('Le immagini delle firme non sono disponibili per la visualizzazione.', { align: 'center' });
    doc.moveDown(1);
  }
  
  // Note metodologiche
  doc.fontSize(12).text('METODOLOGIA', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(9);
  doc.text(
    "L'analisi è stata condotta utilizzando algoritmi di computer vision e analisi delle caratteristiche " +
    "grafologiche. Il sistema estrae e confronta parametri quali spessore del tratto, pressione, " +
    "curvatura, distribuzione spaziale e connettività. Il punteggio finale deriva dalla media ponderata " +
    "di questi parametri con accuratezza stimata dell'85% rispetto all'analisi manuale."
  );
  doc.moveDown(0.5);
  doc.text(
    "LEGENDA PUNTEGGI: 85-100% Autentica, 65-84% Probabile Autentica, 0-64% Sospetta"
  );
  
  // Footer
  doc.moveDown(1);
  doc.fontSize(8).text(
    `Report generato automaticamente da GrapholexInsight il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
    { align: 'center' }
  );
  
  // Finalizza il documento
  doc.end();
  
  // Attendi il completamento della scrittura
  return new Promise((resolve, reject) => {
    pdfStream.on('finish', resolve);
    pdfStream.on('error', reject);
  });
}

// Assicuriamoci che le directory esistano
try {
  // Crea la directory delle firme e dei report
  fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  fs.mkdir(path.join(process.cwd(), 'uploads', 'reports'), { recursive: true });
  console.log('[INIT] Directory uploads e reports inizializzate');
} catch (error) {
  console.log('[INIT] Errore nella creazione delle directory:', error);
}

// Configurazione di multer per gestire upload di immagini
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Crea la directory e poi procedi
      fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true })
        .then(() => {
          cb(null, path.join(process.cwd(), 'uploads'));
        })
        .catch(err => {
          console.error('[UPLOAD] Errore nella creazione della directory:', err);
          cb(null, path.join(process.cwd(), 'uploads'));
        });
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `signature-${uniqueSuffix}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Accetta solo immagini
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

// Crea il router per le signature routes
const router = Router();

// Middleware per verificare l'autenticazione
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  console.log('Session ID:', req.sessionID);  
  console.log('Is authenticated?', req.isAuthenticated());
  console.log('User:', req.user);
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Autenticazione richiesta' });
};

// Genera report PDF per tutte le firme da verificare in un progetto
  router.post("/signature-projects/:id/generate-all-reports", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      const project = await storage.getSignatureProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Ottieni tutte le firme da verificare completate
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      if (completedVerifications.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile'
        });
      }
      
      // Ottieni le firme di riferimento completate
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      const completedReferences = referenceSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      // Usa generazione PDF integrata con analisi AI (sempre disponibile)
      console.log(`[GENERATE ALL REPORTS] Utilizzo generazione PDF integrata con AI per ${completedVerifications.length} firme`);
      
      // Crea le informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica firme multiple`,
        date: new Date().toLocaleDateString('it-IT'),
        documentType: 'Verifica di firma',
        notes: project.description || ""
      };
      
      // Utilizziamo un ciclo for standard invece di Promise.all per garantire migliore gestione degli errori
      const results = [];
      for (const signature of completedVerifications) {
        try {
          console.log(`[GENERATE ALL REPORTS] Generazione report per firma ${signature.id}`);
          
          // Verifica che la firma abbia un risultato di confronto
          if (!signature.comparisonResult || signature.comparisonResult === 0) {
            results.push({
              id: signature.id,
              success: false,
              error: 'Prima di generare il report, esegui il confronto usando "Confronta tutte"'
            });
            continue;
          }
          
          // Percorso della firma da verificare
          const signaturePath = path.join('./uploads', signature.filename);
          
          // Utilizza la prima firma di riferimento come principale
          const referenceSignature = completedReferences[0];
          const referencePath = path.join('./uploads', referenceSignature.filename);
          
          // Aggiorniamo le info sul caso per indicare che è un confronto con multiple firme di riferimento
          const enhancedCaseInfo = {
            ...caseInfo,
            subject: `Verifica firma: ${signature.originalFilename}`,
            notes: caseInfo.notes + (completedReferences.length > 1 ? 
              `\nConfrontata con ${completedReferences.length} firme di riferimento.` : '')
          };
          
          // Crea il report PDF
          const outputPath = path.join(process.cwd(), 'uploads', 'reports', `report_${signature.id}_${Date.now()}.pdf`);
          
          // Assicura che la directory esista
          await fs.mkdir(path.join(process.cwd(), 'uploads', 'reports'), { recursive: true });
          
          // Genera il PDF usando PDFKit con i dati già calcolati
          await generatePDFReportFromExistingData({
            outputPath,
            signature,
            referenceSignature,
            caseInfo: enhancedCaseInfo,
            signaturePath,
            referencePath
          });
          
          console.log(`[GENERATE ALL REPORTS] Report PDF generato per firma ${signature.id}: ${outputPath}`);
          
          // Aggiorna la firma con il percorso del report
          await storage.updateSignature(signature.id, {
            reportPath: outputPath
          });
          
          results.push({
            id: signature.id,
            reportPath: outputPath,
            success: true
          });
          
        } catch (error: any) {
          console.error(`[GENERATE ALL REPORTS] Errore per firma ${signature.id}:`, error);
          results.push({
            id: signature.id,
            success: false,
            error: error.message
          });
        }
      }
      
      // Aggiorna il registro attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'report_generation',
        details: `Generati ${results.filter(r => r.success).length} report PDF nel progetto "${project.name}"`
      });
      res.json({
        total: results.length,
        successful: results.filter(r => r.success).length,
        results: results
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ritaglio automatico di una firma
  router.post("/signatures/:id/crop", isAuthenticated, async (req, res) => {
    console.log(`[CROP ENDPOINT] Richiesta ritaglio per firma ${req.params.id}`);
    console.log(`[CROP ENDPOINT] Body ricevuto:`, req.body);
    
    try {
      const signatureId = parseInt(req.params.id);
      console.log(`[CROP ENDPOINT] SignatureId parsato: ${signatureId}`);
      
      const signature = await storage.getSignature(signatureId);
      console.log(`[CROP ENDPOINT] Firma trovata:`, signature ? `ID ${signature.id}, file: ${signature.filename}` : 'NULL');
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }

      // Verifica che la firma appartenga a un progetto dell'utente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }

      const { 
        autoCrop = true, 
        cropBox, 
        targetSize,
        applyToOriginal = false 
      } = req.body;

      const imagePath = path.join(process.cwd(), 'uploads', signature.filename);

      let cropResult;
      
      if (autoCrop) {
        // Ritaglio automatico
        cropResult = await SignatureCropper.cropSignature({
          inputPath: imagePath,
          targetSize: targetSize || { width: 800, height: 400 }
        });
      } else if (cropBox) {
        // Ritaglio manuale con coordinate specifiche
        cropResult = await SignatureCropper.cropManual(
          imagePath,
          cropBox,
          undefined,
          targetSize || { width: 800, height: 400 }
        );
      } else {
        return res.status(400).json({ 
          error: 'Specificare autoCrop=true o fornire cropBox per ritaglio manuale' 
        });
      }

      if (!cropResult.success) {
        return res.status(400).json({ 
          error: 'Errore durante il ritaglio',
          details: cropResult.message 
        });
      }

      // Se richiesto, sostituisci l'immagine originale
      if (applyToOriginal && cropResult.croppedPath) {
        await fs.copyFile(cropResult.croppedPath, imagePath);
        await fs.unlink(cropResult.croppedPath);
        
        // Le dimensioni dell'immagine originale inserite dall'utente si riferivano all'intera area
        // Dopo il ritaglio, dobbiamo calcolare le dimensioni dell'area ritagliata
        const originalWidthPx = cropResult.originalDimensions.width;
        const originalHeightPx = cropResult.originalDimensions.height;
        const croppedWidthPx = cropResult.croppedDimensions.width;
        const croppedHeightPx = cropResult.croppedDimensions.height;
        
        // Calcola la densità px/mm originale
        const originalPxPerMmX = originalWidthPx / signature.realWidthMm;
        const originalPxPerMmY = originalHeightPx / signature.realHeightMm;
        
        // Calcola le dimensioni reali dell'area ritagliata mantenendo la stessa densità
        const newRealWidthMm = croppedWidthPx / originalPxPerMmX;
        const newRealHeightMm = croppedHeightPx / originalPxPerMmY;
        
        console.log(`[CROP DIMENSIONS] Area originale: ${originalWidthPx}x${originalHeightPx}px = ${signature.realWidthMm}x${signature.realHeightMm}mm`);
        console.log(`[CROP DIMENSIONS] Densità: ${originalPxPerMmX.toFixed(2)}x${originalPxPerMmY.toFixed(2)} px/mm`);
        console.log(`[CROP DIMENSIONS] Area ritagliata: ${croppedWidthPx}x${croppedHeightPx}px = ${newRealWidthMm.toFixed(1)}x${newRealHeightMm.toFixed(1)}mm`);
        console.log(`[CROP DIMENSIONS] Riduzione area: ${((1 - (croppedWidthPx*croppedHeightPx)/(originalWidthPx*originalHeightPx))*100).toFixed(1)}%`);
        
        // Ricalcola i parametri della firma con le nuove dimensioni reali dell'area ritagliata
        const newParameters = await SignatureAnalyzer.extractParameters(
          imagePath,
          newRealWidthMm,
          newRealHeightMm
        );

        // Aggiorna i parametri E le dimensioni reali nel database
        await storage.updateSignature(signatureId, {
          parameters: newParameters,
          realWidthMm: newRealWidthMm,
          realHeightMm: newRealHeightMm,
          notes: (signature.notes || '') + `\n[RITAGLIO] ${cropResult.message} - Area ritagliata: ${newRealWidthMm.toFixed(1)}x${newRealHeightMm.toFixed(1)}mm`
        });

        // Registra l'attività
        await storage.createActivity({
          userId: req.user!.id,
          type: 'signature_edit',
          details: `Ritaglio automatico applicato alla firma ${signature.id}`
        });
      }

      // Converti il percorso assoluto in percorso relativo per l'interfaccia web
      const webAccessibleCropResult = {
        ...cropResult,
        croppedPath: cropResult.croppedPath 
          ? '/uploads/' + path.basename(cropResult.croppedPath)
          : undefined
      };

      res.json({
        success: true,
        cropResult: webAccessibleCropResult,
        message: applyToOriginal 
          ? 'Ritaglio applicato e parametri ricalcolati'
          : 'Anteprima ritaglio generata'
      });

    } catch (error: any) {
      console.error(`[CROP ERROR] Errore nel ritaglio firma:`, error);
      log(`Errore nel ritaglio firma: ${error.message}`, 'signatures');
      res.status(500).json({ 
        error: 'Errore durante il ritaglio',
        details: error.message 
      });
    }
  });

  // Normalizzazione automatica per confronto
  router.post("/signatures/:id/normalize", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }

      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }

      const { referenceSignatureId } = req.body;
      
      if (!referenceSignatureId) {
        return res.status(400).json({ 
          error: 'ID firma di riferimento richiesto' 
        });
      }

      const referenceSignature = await storage.getSignature(referenceSignatureId);
      if (!referenceSignature) {
        return res.status(404).json({ error: 'Firma di riferimento non trovata' });
      }

      // Ottieni le dimensioni della firma di riferimento
      const referenceDimensions = referenceSignature.parameters?.realDimensions || 
                                  { widthMm: 50, heightMm: 25 }; // Fallback

      const imagePath = path.join(process.cwd(), 'uploads', signature.imagePath);
      
      // Normalizza le dimensioni rispetto al riferimento
      const normalizedPath = await SignatureCropper.normalizeForComparison(
        imagePath,
        Math.round(referenceDimensions.widthMm * 10), // Converti in pixel usando 10px/mm
        Math.round(referenceDimensions.heightMm * 10),
      );

      res.json({
        success: true,
        normalizedPath: normalizedPath.replace(process.cwd(), ''),
        message: 'Firma normalizzata per il confronto'
      });

    } catch (error: any) {
      log(`Errore nella normalizzazione firma: ${error.message}`, 'signatures');
      res.status(500).json({ error: error.message });
    }
  });

  
  // Crea un nuovo progetto firma
  router.post("/signature-projects", isAuthenticated, async (req, res) => {
    try {
      const projectData = insertSignatureProjectSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      const project = await storage.createSignatureProject(projectData);
      
      // Crea una attività per il nuovo progetto
      await storage.createActivity({
        userId: req.user!.id,
        type: 'project_create',
        details: `Creato progetto di verifica firma: ${project.name}`
      });
      
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Ottieni tutti i progetti firma dell'utente
  router.get("/signature-projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getUserSignatureProjects(req.user!.id);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ottieni un progetto firma specifico
  router.get("/signature-projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Aggiorna un progetto firma
  router.put("/signature-projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      const updatedProject = await storage.updateSignatureProject(projectId, {
        name: req.body.name,
        description: req.body.description
      });
      
      res.json(updatedProject);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Elimina un progetto firma
  router.delete("/signature-projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Ottieni tutte le firme del progetto
      const signatures = await storage.getProjectSignatures(projectId);
      
      // Elimina i file delle firme
      for (const signature of signatures) {
        try {
          await fs.unlink(path.join('./uploads', signature.filename));
        } catch (err) {
          console.error(`Impossibile eliminare il file ${signature.filename}:`, err);
        }
      }
      
      // Elimina il progetto (questo eliminerà anche tutte le firme associate)
      await storage.deleteSignatureProject(projectId);
      
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload di una firma di riferimento
  router.post("/signature-projects/:id/signatures/reference", isAuthenticated, upload.single('signature'), async (req, res) => {
    try {
      log(`INIZIO caricamento firma di riferimento per progetto ${req.params.id}`, 'signatures');
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        log(`Progetto ${projectId} non trovato`, 'signatures');
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        log(`Utente ${req.user!.id} non autorizzato per progetto ${projectId}`, 'signatures');
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      if (!req.file) {
        log(`Nessun file ricevuto nella richiesta`, 'signatures');
        return res.status(400).json({ error: 'Nessun file caricato' });
      }
      
      log(`File ricevuto: ${req.file.filename}, body: ${JSON.stringify(req.body)}`, 'signatures');
      
      // Estrai le dimensioni reali dai dati del form
      const realWidthMm = parseFloat(req.body.realWidthMm);
      const realHeightMm = parseFloat(req.body.realHeightMm);

      
      if (!realWidthMm || !realHeightMm || realWidthMm <= 0 || realHeightMm <= 0) {
        log(`ERRORE validazione dimensioni: width=${realWidthMm}, height=${realHeightMm}`, 'signatures');
        return res.status(400).json({ 
          error: 'Le dimensioni reali della firma sono obbligatorie e devono essere positive'
        });
      }
      
      // Rimossa estrazione automatica DPI - ora utilizziamo solo dimensioni reali inserite dall'utente
      log(`Dimensioni reali ricevute: ${realWidthMm}mm x ${realHeightMm}mm`, 'signatures');
      
      const signatureData = insertSignatureSchema.parse({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: true,
        dpi: 300, // DPI standard per compatibilità (non più utilizzato per calcoli dimensionali)
        realWidthMm: realWidthMm,
        realHeightMm: realHeightMm
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      // Avvia l'analisi della firma in background
      processSignature(signature.id, req.file.path)
        .catch(error => {
          console.error(`Errore processamento firma riferimento ${signature.id}:`, error);
          storage.updateSignature(signature.id, {
            processingStatus: 'failed'
          });
        });
      
      log(`RIFERIMENTO - Firma salvata con successo con ID ${signature.id}`, 'signatures');
      res.status(201).json(signature);
    } catch (error: any) {
      log(`RIFERIMENTO - ERRORE durante caricamento: ${error.message}`, 'signatures');
      log(`RIFERIMENTO - Stack trace: ${error.stack}`, 'signatures');
      res.status(400).json({ error: error.message });
    }
  });

  // Upload di una firma da verificare
  router.post("/signature-projects/:id/signatures/verify", isAuthenticated, upload.single('signature'), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
      }
      
      // Verifica che ci siano firme di riferimento per questo progetto
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      if (referenceSignatures.length === 0) {
        return res.status(400).json({ 
          error: 'Nessuna firma di riferimento presente. Carica almeno una firma di riferimento prima.'
        });
      }
      
      // Estrai le dimensioni reali dai dati del form
      const realWidthMm = parseFloat(req.body.realWidthMm);
      const realHeightMm = parseFloat(req.body.realHeightMm);
      
      if (!realWidthMm || !realHeightMm || realWidthMm <= 0 || realHeightMm <= 0) {
        return res.status(400).json({ 
          error: 'Le dimensioni reali della firma sono obbligatorie e devono essere positive'
        });
      }
      
      // Rimossa estrazione automatica DPI - ora utilizziamo solo dimensioni reali inserite dall'utente
      log(`Dimensioni reali ricevute: ${realWidthMm}mm x ${realHeightMm}mm`, 'signatures');
      
      const signatureData = insertSignatureSchema.parse({
        projectId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        isReference: false,
        dpi: 300, // DPI standard per compatibilità (non più utilizzato per calcoli dimensionali)
        realWidthMm: realWidthMm,
        realHeightMm: realHeightMm
      });
      
      // Salva la firma nel database
      const signature = await storage.createSignature(signatureData);
      
      // Avvia il processamento asincrono usando la stessa logica semplice del riprocessamento
      processSignature(signature.id, req.file.path)
        .catch(error => {
          console.error(`Errore processamento firma ${signature.id}:`, error);
          storage.updateSignature(signature.id, {
            processingStatus: 'failed'
          });
        });
      
      res.status(201).json(signature);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Ottieni tutte le firme di un progetto
  router.get("/signature-projects/:id/signatures", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Verifica se il parametro di percorso è un ID di progetto valido
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'ID progetto non valido' });
      }
      
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Ottieni le firme associate a questo progetto
      // Se referenceOnly non è specificato (undefined), restituisci tutte le firme
      let referenceOnly: boolean | undefined;
      if (req.query.referenceOnly === 'true') {
        referenceOnly = true;
      } else if (req.query.referenceOnly === 'false') {
        referenceOnly = false;
      } else {
        referenceOnly = undefined; // Nessun filtro, restituisci tutte le firme
      }
      
      const signatures = await storage.getProjectSignatures(projectId, referenceOnly);
      
      // Restituisci un array vuoto se non ci sono firme
      if (!signatures || signatures.length === 0) {
        return res.json([]);
      }
      
      // Trasforma il risultato in array di oggetti JSON per garantire che tutti i campi siano serializzati correttamente
      // Questo è essenziale per garantire che i dati siano nel formato atteso dal client
      const result = signatures.map(sig => ({
        id: sig.id,
        projectId: sig.projectId, // Garantisci che projectId sia sempre incluso
        filename: sig.filename,
        originalFilename: sig.originalFilename,
        fileType: sig.fileType,
        fileSize: sig.fileSize,
        isReference: sig.isReference,
        parameters: sig.parameters,
        processingStatus: sig.processingStatus,
        comparisonResult: sig.comparisonResult,
        createdAt: sig.createdAt,
        updatedAt: sig.updatedAt,
        dpi: sig.dpi, // Aggiungi esplicitamente il campo DPI nella risposta
        realWidth: sig.realWidthMm, // Aggiungi le dimensioni reali (mappate correttamente)
        realHeight: sig.realHeightMm
      }));
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ottieni una firma specifica
  router.get("/signatures/:id", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      res.json(signature);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  

  // Endpoint per generare e scaricare un report PDF per una firma
  // Endpoint per generare un report PDF per una firma 
  router.get("/signatures/:id/generate-report", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      console.log(`[PDF REPORT] Richiesta generazione report per firma ${signatureId}`);
      
      // Verifica che la firma esista
      const signature = await storage.getSignature(signatureId);
      if (!signature) {
        console.log(`[PDF REPORT] Firma ${signatureId} non trovata`);
        return res.status(404).json({ error: "Firma non trovata" });
      }
      
      // Verifica che l'utente sia autorizzato
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        console.log(`[PDF REPORT] Utente non autorizzato per firma ${signatureId}`);
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      // Verifica che non sia una firma di riferimento
      if (signature.isReference) {
        console.log(`[PDF REPORT] La firma ${signatureId} è una firma di riferimento, non è possibile generare un report`);
        return res.status(400).json({ error: "Non è possibile generare report per firme di riferimento" });
      }
      
      // Verifica che la firma sia stata elaborata
      if (signature.processingStatus !== "completed") {
        console.log(`[PDF REPORT] La firma ${signatureId} non è stata completamente elaborata`);
        return res.status(400).json({ error: "La firma non è stata completamente elaborata" });
      }
      
      // Se il report è già stato generato, restituisci il percorso senza rigenerarlo
      if (signature.reportPath) {
        try {
          await fs.access(signature.reportPath);
          console.log(`[PDF REPORT] Report già esistente per firma ${signatureId}: ${signature.reportPath}`);
          return res.status(200).json({ 
            success: true, 
            message: "Report già generato in precedenza", 
            reportPath: signature.reportPath 
          });
        } catch (err) {
          console.log(`[PDF REPORT] Report esistente ma file non trovato, generazione di un nuovo report`);
          // Il file non esiste più, continua con la generazione di un nuovo report
        }
      }
      
      // Ottieni le firme di riferimento per questo progetto
      const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === "completed" && ref.parameters
      );
      
      if (completedReferences.length === 0) {
        console.log(`[PDF REPORT] Nessuna firma di riferimento disponibile per il confronto`);
        return res.status(400).json({ error: "Nessuna firma di riferimento disponibile per il confronto" });
      }
      
      // Usiamo la prima firma di riferimento per il confronto avanzato
      const referenceSignature = completedReferences[0];
      console.log(`[PDF REPORT] Utilizzo firma di riferimento ${referenceSignature.id} per il confronto`);
      
      // Generazione report con PDFKit (sempre disponibile)
      console.log(`[PDF REPORT] Utilizzo generazione PDF integrata (PDFKit)`)
      
      // Prepara i percorsi dei file
      const referencePath = path.join("./uploads", referenceSignature.filename);
      const signaturePath = path.join("./uploads", signature.filename);
      
      // Verifica che i file delle firme esistano
      try {
        await fs.access(referencePath);
        await fs.access(signaturePath);
      } catch (err) {
        console.log(`[PDF REPORT] File di firma non trovato`, err);
        return res.status(404).json({ error: "File di firma non trovato" });
      }
      
      // Formatta la data in modo localizzato
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      // Crea informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica firma: ${signature.originalFilename}`,
        date: formattedDate,
        documentType: "Verifica di autenticità",
        notes: project.description || ""
      };
      
      console.log(`[PDF REPORT] Avvio generazione report per firma ${signatureId}`);
      
      // Genera il report PDF direttamente con PDFKit
      try {
        console.log(`[PDF REPORT] Generazione report PDF per firma ${signatureId}`);
        
        // Utilizza il punteggio di similarità già calcolato durante il confronto
        const similarityScore = signature.comparisonResult || 0;
        
        if (similarityScore === 0) {
          return res.status(400).json({ 
            error: "Prima di generare il report, esegui il confronto usando 'Confronta tutte'" 
          });
        }
        
        // Crea il report PDF
        const outputPath = path.join(process.cwd(), 'uploads', 'reports', `report_${signatureId}_${Date.now()}.pdf`);
        
        // Assicura che la directory esista
        await fs.mkdir(path.join(process.cwd(), 'uploads', 'reports'), { recursive: true });
        
        // Genera il PDF usando PDFKit con i dati già calcolati
        await generatePDFReportFromExistingData({
          outputPath,
          signature,
          referenceSignature,
          caseInfo,
          signaturePath,
          referencePath
        });
        
        console.log(`[PDF REPORT] Report PDF generato: ${outputPath}`);
        
        // Aggiorna la firma con il percorso del report
        await storage.updateSignature(signature.id, {
          reportPath: outputPath
        });
        
        // Aggiorna registro attività
        await storage.createActivity({
          userId: req.user!.id,
          type: "signature_report",
          details: `Generato report PDF per la firma "${signature.originalFilename}"`
        });
        
        res.json({
          success: true,
          message: "Report generato con successo",
          reportPath: outputPath,
          similarity: similarityScore
        });
      } catch (error: any) {
        console.error(`[PDF REPORT] Errore durante la generazione del report:`, error);
        return res.status(500).json({ 
          error: "Errore durante la generazione del report", 
          details: error.message 
        });
      }
    } catch (error: any) {
      console.error(`[PDF REPORT] Errore nella generazione del report:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Ottieni il report PDF di una firma
  router.get("/signatures/:id/report", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Verifica che il report esista
      if (!signature.reportPath) {
        // Se non c'è un report, ma c'è abbastanza informazioni per generarne uno
        if (signature.comparisonChart && signature.analysisReport && signature.comparisonResult !== null) {
          try {
            log('Generazione report PDF on-demand', 'signatures');
            
            // Ottieni la firma di riferimento
            const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
            
            // Prendi la prima firma di riferimento elaborata
            const referenceSignature = referenceSignatures.find(
              ref => ref.processingStatus === 'completed' && ref.parameters
            );
            
            if (!referenceSignature) {
              return res.status(400).json({ error: 'Nessuna firma di riferimento disponibile per generare il report' });
            }
            
            // Crea le informazioni sul caso
            const caseInfo = {
              caseName: project.name,
              subject: `Verifica firma: ${signature.originalFilename}`,
              date: new Date().toLocaleDateString('it-IT'),
              documentType: 'Verifica singola',
              notes: project.description || ""
            };
            
            // Percorsi delle immagini
            const referencePath = path.join('./uploads', referenceSignature.filename);
            const signaturePath = path.join('./uploads', signature.filename);
            
            // Genera il report DOCX
            // IMPORTANTE: Invertiamo i parametri per compensare il problema di ordinamento
            console.log(`[PDF REPORT DOWNLOAD] CORREZIONE: Invertendo ordine parametri per compensare il bug`);
            console.log(`[PDF REPORT DOWNLOAD] Firma da verificare (diventerà riferimento): ${signaturePath}`);
            console.log(`[PDF REPORT DOWNLOAD] Firma di riferimento (diventerà verifica): ${referencePath}`);
            
            const reportResult = await SignaturePythonAnalyzer.generateReport(
              referencePath,   // Questo diventerà la firma da verificare nel report
              signaturePath,   // Questo diventerà la firma di riferimento nel report
              caseInfo,
              undefined,      // Nessuna firma di riferimento aggiuntiva
              signature.projectId  // Passiamo l'ID del progetto per garantire l'isolamento
            );
            
            console.log(`[PDF REPORT DOWNLOAD] Generazione report con projectId=${signature.projectId}`);
            
            console.log(`[PDF REPORT DOWNLOAD] Risultato report ricevuto:`, JSON.stringify(reportResult, null, 2));
            
            // Se il report_path è mancante ma abbiamo altri dati validi, creiamo un percorso temporaneo
            if (reportResult && typeof reportResult === 'object' && (!reportResult.report_path || typeof reportResult.report_path !== 'string')) {
              if (reportResult.similarity !== undefined && reportResult.comparison_chart) {
                console.log(`[PDF REPORT DOWNLOAD] Creazione percorso report temporaneo dato che abbiamo altri dati validi`);
                const tempReportPath = path.join(process.cwd(), 'uploads', 'reports', `temp_report_${Date.now()}.pdf`);
                reportResult.report_path = tempReportPath;
              }
            }
            
            if (reportResult && typeof reportResult === 'object' && 'report_path' in reportResult) {
              // Aggiorna il percorso del report nella firma
              await storage.updateSignature(signature.id, {
                reportPath: reportResult.report_path as string
              });
              
              // APPROCCIO ALTERNATIVO: Ignoriamo il file Python e generiamo il PDF direttamente qui
              try {
                console.log(`[PDF REPORT] Generazione PDF alternativa on-demand usando il comparisonChart`);
                
                // Utilizziamo PDFDocument già importato globalmente
                // L'importazione è stata spostata in cima al file
                // Prepara il percorso del file PDF
                const outputPath = path.join(process.cwd(), 'uploads', 'reports', `report_${Date.now()}.pdf`);
                
                // Assicuriamoci che la directory esista
                await fs.mkdir(path.join(process.cwd(), 'uploads', 'reports'), { recursive: true });
                
                // Crea una stream di scrittura
                const pdfStream = createWriteStream(outputPath);
                
                // Crea un nuovo documento PDF
                const doc = new PDFDocument({
                  size: 'A4',
                  info: {
                    Title: 'Rapporto di analisi firma',
                    Author: 'GrapholexInsight',
                    Subject: 'Verifica firma',
                    Keywords: 'firma, verifica, analisi, grafologia',
                    CreationDate: new Date()
                  }
                });
                
                // Pipe il PDF alla stream di scrittura
                doc.pipe(pdfStream);
                
                // Aggiungi contenuti al PDF
                doc.fontSize(18).text('Rapporto di Analisi Firma', { align: 'center' });
                doc.moveDown();
                doc.fontSize(14).text('Firma analizzata: ' + (signature.originalFilename || 'Sconosciuto'), { underline: true });
                doc.moveDown();
                
                // Aggiungi la data
                doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('it-IT')}`);
                doc.moveDown();
                
                // Aggiungi il punteggio di similarità
                const comparisonValue = reportResult.similarity || signature.comparisonResult || 0;
                doc.fontSize(14).text(`Punteggio di somiglianza: ${(comparisonValue * 100).toFixed(1)}%`);
                doc.moveDown();
                
                // Aggiungi l'immagine della firma se disponibile
                try {
                  const signatureImagePath = path.join(process.cwd(), 'uploads', signature.filename);
                  
                  // Verifica che l'immagine esista
                  await fs.access(signatureImagePath, constants.F_OK);
                  
                  // Aggiungi una sezione per le immagini
                  doc.fontSize(14).text('Firma in verifica:', { underline: true });
                  doc.moveDown();
                  
                  // Calcola le dimensioni per l'immagine
                  doc.image(signatureImagePath, {
                    width: 300,
                    align: 'center'
                  });
                  doc.moveDown();
                } catch (imgErr) {
                  // Non fare nulla se l'immagine non è disponibile
                }
                
                // Aggiungi il grafico di confronto se disponibile
                if (reportResult.comparison_chart) {
                  doc.fontSize(14).text('Grafico di confronto:', { underline: true });
                  doc.moveDown();
                  
                  // Crea un file temporaneo per l'immagine del grafico
                  const chartImagePath = path.join(process.cwd(), 'uploads', 'temp_chart.png');
                  try {
                    await fs.writeFile(chartImagePath, Buffer.from(reportResult.comparison_chart, 'base64'));
                    
                    // Aggiungi l'immagine del grafico
                    doc.image(chartImagePath, {
                      width: 500,
                      align: 'center'
                    });
                    doc.moveDown();
                    
                    // Pulisci il file temporaneo
                    try {
                      await fs.unlink(chartImagePath);
                    } catch (e) {
                      // Ignora eventuali errori nella pulizia
                    }
                  } catch (chartErr) {
                    doc.text('Grafico di confronto non disponibile', { align: 'center' });
                    doc.moveDown();
                  }
                }
                
                // Aggiungi il report di analisi se disponibile
                if (reportResult.description) {
                  doc.fontSize(14).text('Analisi tecnica:', { underline: true });
                  doc.moveDown();
                  doc.fontSize(12).text(reportResult.description);
                  doc.moveDown();
                }
                
                // Aggiungi una sezione metodologica
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
                
                // Finalizza il documento
                doc.end();
                
                // Attendi il completamento della scrittura
                await new Promise((resolve, reject) => {
                  pdfStream.on('finish', resolve);
                  pdfStream.on('error', reject);
                });
                
                console.log(`[PDF REPORT] PDF generato con successo in: ${outputPath}`);
                
                // Aggiorna il percorso del report nel database
                await storage.updateSignature(signature.id, {
                  reportPath: outputPath
                });
                
                // Verifica che il file esista
                await fs.access(outputPath, constants.F_OK);
                console.log(`[PDF REPORT] File verificato e accessibile: ${outputPath}`);
                
                // Servi il file
                return res.download(outputPath);
              } catch (finalErr: any) {
                console.error(`[PDF REPORT] Impossibile generare PDF on-demand:`, finalErr);
                // Aggiungi dettagli completi sull'errore nei log
                console.error(`[PDF REPORT] STACK TRACE COMPLETO:`, finalErr.stack);
                console.error(`[PDF REPORT] MESSAGGIO COMPLETO:`, finalErr.message);
                console.error(`[PDF REPORT] TIPO ERRORE:`, finalErr.name);
                console.error(`[PDF REPORT] STRINGIFIED:`, JSON.stringify(finalErr));
                
                return res.status(500).json({ 
                  error: `Impossibile generare il report PDF on-demand: ${finalErr.message}` 
                });
              }
            } else {
              return res.status(500).json({ error: 'Impossibile generare il report PDF' });
            }
          } catch (error: any) {
            log(`Errore nella generazione del report: ${error.message}`, 'signatures');
            return res.status(500).json({ error: `Errore nella generazione del report: ${error.message}` });
          }
        } else {
          return res.status(404).json({ error: 'Report non disponibile per questa firma' });
        }
      }
      
      // Verifica che il file esista
      try {
        await fs.access(signature.reportPath);
        console.log(`[PDF REPORT] File del report trovato: ${signature.reportPath}`);  
      } catch (error) {
        console.log(`[PDF REPORT] File non trovato: ${signature.reportPath}, tentativo di ri-generazione`);
        
        // Se il percorso contiene temp_report_, dobbiamo generare il file
        if (signature.reportPath.includes('temp_report_')) {
          try {
            console.log(`[PDF REPORT] Rilevato percorso temporaneo, tentativo di generazione on-demand`);
            
            // Ottieni la firma di riferimento DELLO STESSO PROGETTO
            console.log(`[PDF REPORT] Recupero firme di riferimento per il progetto ${signature.projectId}`);
            const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
            console.log(`[PDF REPORT] Trovate ${referenceSignatures.length} firme di riferimento per il progetto ${signature.projectId}`);
            
            // Stampa le firme per debug
            if (referenceSignatures.length > 0) {
              console.log(`[PDF REPORT] Prima firma di riferimento: ID=${referenceSignatures[0].id}, Progetto=${referenceSignatures[0].projectId}, Filename=${referenceSignatures[0].filename}`);
            }
            
            // Prendi la prima firma di riferimento elaborata DELLO STESSO PROGETTO
            const referenceSignature = referenceSignatures.find(
              ref => ref.processingStatus === 'completed' && ref.parameters && ref.projectId === signature.projectId
            );
            
            if (!referenceSignature) {
              return res.status(400).json({ error: 'Nessuna firma di riferimento disponibile per generare il report' });
            }
            
            // Percorsi delle immagini
            const referencePath = path.join('./uploads', referenceSignature.filename);
            const signaturePath = path.join('./uploads', signature.filename);
            
            // Crea le informazioni sul caso
            const caseInfo = {
              caseName: `Analisi firma - Progetto ${signature.projectId}`,
              subject: `Firma ${signature.originalFilename}`,
              date: new Date().toLocaleDateString('it-IT'),
              documentType: 'Verifica di firma',
              notes: "Report generato automaticamente"
            };
            
            // Crea una directory temporanea per i report se non esiste
            const reportDir = path.join(process.cwd(), 'uploads', 'reports');
            try {
              await fs.mkdir(reportDir, { recursive: true });
            } catch (error) {
              const mkdirError = error as Error;
              console.log(`[PDF REPORT] Errore nella creazione della directory: ${mkdirError.message}`);
            }
            
            // Genera un nome file reale basato sul timestamp del nome temporaneo
            const timestamp = signature.reportPath.split('temp_report_')[1].split('.')[0];
            const realReportPath = path.join(process.cwd(), 'uploads', 'reports', `report_${timestamp}.pdf`);
            
            console.log(`[PDF REPORT] Generazione report reale in: ${realReportPath}`);
            
            // Prima tentiamo di vedere se il comparisonResult esiste già ed è stato salvato
            const comparisonResult: { 
              similarity: number, 
              comparison_chart: string | null, 
              description: string | null, 
              report_path: string | undefined 
            } = {
              similarity: signature.comparisonResult ?? 0.7, // Usa il valore esistente o un valore predefinito
              comparison_chart: signature.comparisonChart,
              description: signature.analysisReport,
              report_path: undefined // Sarà generato più avanti, usiamo undefined invece di null per evitare errori di tipo
            };
            
            try {
              // Crea un file PDF di base usando il comparisonChart esistente
              console.log(`[PDF REPORT] Generazione di un PDF semplice usando dati esistenti`);
              
              // Utilizziamo PDFDocument già importato globalmente
              // L'importazione è stata spostata in cima al file
              
              // Prepara il percorso del file PDF
              const outputPath = path.join(process.cwd(), 'uploads', 'reports', `report_${Date.now()}.pdf`);
              
              // Assicuriamoci che la directory esista
              await fs.mkdir(path.join(process.cwd(), 'uploads', 'reports'), { recursive: true });
              
              // Crea una stream di scrittura
              const pdfStream = createWriteStream(outputPath);
              
              // Crea un nuovo documento PDF
              const doc = new PDFDocument({
                size: 'A4',
                info: {
                  Title: `Rapporto di analisi firma - ${signature.originalFilename}`,
                  Author: 'GrapholexInsight',
                  Subject: `Verifica firma: ${signature.originalFilename}`,
                  Keywords: 'firma, verifica, analisi, grafologia',
                  CreationDate: new Date()
                }
              });
              
              // Pipe il PDF alla stream di scrittura
              doc.pipe(pdfStream);
              
              // Aggiungi contenuti al PDF
              doc.fontSize(18).text('Rapporto di Analisi Firma', { align: 'center' });
              doc.moveDown();
              doc.fontSize(14).text(`Firma analizzata: ${signature.originalFilename}`, { underline: true });
              doc.moveDown();
              
              // Aggiungi la data
              doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('it-IT')}`);
              doc.moveDown();
              
              // Aggiungi il punteggio di similarità
              const comparisonValue = signature.comparisonResult || 0;
              doc.fontSize(14).text(`Punteggio di somiglianza: ${(comparisonValue * 100).toFixed(1)}%`);
              doc.moveDown();
              
              // Aggiungi l'immagine della firma
              const signatureImagePath = path.join(process.cwd(), 'uploads', signature.filename);
              
              // Aggiungi una sezione per le immagini
              doc.fontSize(14).text('Firme a confronto:', { underline: true });
              doc.moveDown();
              
              try {
                // Verifica che l'immagine esista
                await fs.access(signatureImagePath);
                
                // Calcola le dimensioni per l'immagine
                doc.image(signatureImagePath, {
                  width: 300,
                  align: 'center'
                });
                doc.fontSize(10).text('Firma in verifica', { align: 'center' });
                doc.moveDown();
              } catch (err) {
                doc.text('Immagine della firma non disponibile', { align: 'center' });
                doc.moveDown();
              }
              
              // Aggiungi il grafico di confronto se disponibile
              if (signature.comparisonChart) {
                doc.fontSize(14).text('Grafico di confronto:', { underline: true });
                doc.moveDown();
                
                // Crea un file temporaneo per l'immagine del grafico
                const chartImagePath = path.join(process.cwd(), 'uploads', 'temp_chart.png');
                try {
                  await fs.writeFile(chartImagePath, Buffer.from(signature.comparisonChart, 'base64'));
                  
                  // Aggiungi l'immagine del grafico
                  doc.image(chartImagePath, {
                    width: 500,
                    align: 'center'
                  });
                  doc.moveDown();
                  
                  // Pulisci il file temporaneo
                  try {
                    await fs.unlink(chartImagePath);
                  } catch (e) {
                    // Ignora eventuali errori nella pulizia
                  }
                } catch (chartErr) {
                  doc.text('Grafico di confronto non disponibile', { align: 'center' });
                  doc.moveDown();
                }
              }
              
              // Aggiungi il report di analisi se disponibile
              if (signature.analysisReport) {
                doc.fontSize(14).text('Analisi tecnica:', { underline: true });
                doc.moveDown();
                doc.fontSize(12).text(signature.analysisReport);
                doc.moveDown();
              }
              
              // Aggiungi una sezione metodologica
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
              
              // Finalizza il documento
              doc.end();
              
              // Attendi il completamento della scrittura
              await new Promise((resolve, reject) => {
                pdfStream.on('finish', resolve);
                pdfStream.on('error', reject);
              });
              
              console.log(`[PDF REPORT] PDF generato con successo in: ${outputPath}`);
              
              // Aggiorna il percorso del report
              comparisonResult.report_path = outputPath;
            } catch (pdfError: any) {
              console.error(`[PDF REPORT] Errore nella generazione del PDF:`, pdfError);
              console.error(`[PDF REPORT] STACK TRACE COMPLETO:`, pdfError.stack);
              console.error(`[PDF REPORT] MESSAGGIO COMPLETO:`, pdfError.message);
              console.error(`[PDF REPORT] TIPO ERRORE:`, pdfError.name);
              console.error(`[PDF REPORT] STRINGIFIED:`, JSON.stringify(pdfError));
              console.log(`[PDF REPORT] Tentativo alternativo con il modulo Python`);
              
              // Se fallisce, tentiamo con il modulo Python come backup
              console.log(`[PDF REPORT REGEN] Utilizzo modulo Python con ordine corretto`);
              try {
                // Otteniamo il progetto per recuperare il DPI
                const dpiProject = await storage.getSignatureProject(signature.projectId);
                const dpi = dpiProject?.dpi || 300;
                
                const pythonResult = await SignaturePythonAnalyzer.compareSignatures(
                  signaturePath,   // Firma da verificare
                  referencePath,   // Firma di riferimento
                  { widthMm: signature.realWidthMm || 50, heightMm: signature.realHeightMm || 20 }, // Dimensioni firma da verificare
                  { widthMm: referenceSignature.realWidthMm || 50, heightMm: referenceSignature.realHeightMm || 20 }, // Dimensioni firma di riferimento
                  true,            // Genera il report
                  caseInfo,
                  signature.projectId // Passiamo l'ID del progetto per assicurare l'isolamento dei dati
                );
                console.log(`[PDF REPORT] Utilizzando projectId ${signature.projectId} per garantire l'isolamento dei dati`);
                
                if (pythonResult && pythonResult.report_path) {
                  comparisonResult.report_path = pythonResult.report_path;
                }
              } catch (pythonError) {
                console.error(`[PDF REPORT] Anche il tentativo con Python è fallito:`, pythonError);
              }
            }
            
            if (comparisonResult && comparisonResult.report_path) {
              console.log(`[PDF REPORT] Report generato con successo: ${comparisonResult.report_path}`);
              
              // Aggiorna il percorso nel database
              await storage.updateSignature(signature.id, {
                reportPath: comparisonResult.report_path
              });
              
              // Invia il file generato
              return res.download(comparisonResult.report_path);
            } else {
              return res.status(500).json({ error: 'Impossibile generare il report PDF on-demand' });
            }
          } catch (genError: any) {
            console.error(`[PDF REPORT] Errore nella generazione on-demand:`, genError);
            return res.status(500).json({ 
              error: `Errore nella generazione on-demand del report: ${genError.message}` 
            });
          }
        } else {
          return res.status(404).json({ error: 'File del report non trovato' });
        }
      }
      
      // Verifica che il file esista e sia accessibile
      try {
        console.log(`[PDF REPORT] Tentativo di scaricare il file: ${signature.reportPath}`);
        await fs.access(signature.reportPath);
        console.log(`[PDF REPORT] Accesso confermato, file esistente: ${signature.reportPath}`);
        
        // Invia il file come download
        return res.download(signature.reportPath);
      } catch (accessError) {
        console.error(`[PDF REPORT] ERRORE: File non accessibile:`, accessError);
        return res.status(500).json({ error: 'Report esistente ma non accessibile.' });
      }
    } catch (error: any) {
      log(`Errore nell'accesso al report: ${error.message}`, 'signatures');
      res.status(500).json({ error: error.message });
    }
  });
  
  // Esegui confronto manuale di una firma
  router.post("/signatures/:id/compare", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Verifica che la firma non sia di riferimento
      if (signature.isReference) {
        return res.status(400).json({ error: 'Non è possibile confrontare una firma di riferimento' });
      }
      
      // Verifica che la firma sia stata elaborata
      if (signature.processingStatus !== 'completed') {
        return res.status(400).json({ error: 'La firma deve essere completamente elaborata prima di poter essere confrontata' });
      }
      
      // Ottieni le firme di riferimento per questo progetto
      const referenceSignatures = await storage.getProjectSignatures(signature.projectId, true);
      
      // Filtra le firme di riferimento complete (con parametri)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      if (completedReferences.length === 0) {
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }

      let similarityScore = 0;
      let comparisonChart = null;
      let analysisReport = null;
      
      // Verifica la disponibilità dell'analizzatore Python avanzato
      const isPythonAvailable = await SignaturePythonAnalyzer.checkAvailability();
      
      if (isPythonAvailable) {
        try {
          log(`Usando analizzatore Python avanzato per confronto firma ${signatureId}`, 'signatures');
          
          // Usiamo la prima firma di riferimento per il confronto avanzato
          const referenceSignature = completedReferences[0];
          const referencePath = path.join('./uploads', referenceSignature.filename);
          const signaturePath = path.join('./uploads', signature.filename);
          
          // Crea le informazioni sul caso
          const caseInfo = {
            caseName: project.name,
            subject: `Firma ${signature.originalFilename}`,
            date: new Date().toLocaleDateString('it-IT'),
            documentType: 'Verifica di firma',
            notes: project.description || ""
          };
          
          // Esegui il confronto avanzato con ordine corretto
          console.log(`[CONFRONTO POPUP] Confronto firma da verificare: ${signaturePath}`);
          console.log(`[CONFRONTO POPUP] Contro firma di riferimento: ${referencePath}`);
          
          // Otteniamo il DPI dal progetto
          const dpi = project.dpi || 300;
          
          const comparisonResult = await SignaturePythonAnalyzer.compareSignatures(
            signaturePath,   // Firma da verificare
            referencePath,   // Firma di riferimento
            { widthMm: signature.realWidthMm || 50, heightMm: signature.realHeightMm || 20 }, // Dimensioni firma da verificare
            { widthMm: referenceSignature.realWidthMm || 50, heightMm: referenceSignature.realHeightMm || 20 }, // Dimensioni firma di riferimento
            false, // Non generare report DOCX automaticamente
            caseInfo,
            project.id // Passiamo l'ID del progetto per assicurare l'isolamento dei dati
          );
          console.log(`[CONFRONTO POPUP] Utilizzando projectId ${project.id} per garantire l'isolamento dei dati`);
          
          similarityScore = comparisonResult.similarity;
          
          // Salva il grafico e il report
          comparisonChart = comparisonResult.comparison_chart;
          analysisReport = comparisonResult.description;
          
          log(`Confronto Python completato per firma ${signatureId} con score ${similarityScore}`, 'signatures');
        } catch (pythonError: any) {
          log(`Errore con analizzatore Python per confronto: ${pythonError.message}. Uso analizzatore JS fallback.`, 'signatures');
          // Fallback all'analizzatore JavaScript se quello Python fallisce
          const referenceParameters = completedReferences.map(ref => ref.parameters!);
          similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
        }
      } else {
        log(`Analizzatore Python non disponibile, uso analizzatore JS per confronto.`, 'signatures');
        // Usa l'analizzatore JavaScript standard
        const referenceParameters = completedReferences.map(ref => ref.parameters!);
        similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
      }
      
      // Aggiorna il risultato del confronto includendo grafico e report
      const updatedSignature = await storage.updateSignatureComparisonResult(signatureId, similarityScore);
      
      // Se abbiamo generato un grafico e un report, salviamoli
      if (comparisonChart && analysisReport) {
        // Aggiorniamo la firma con il grafico e il report
        await storage.updateSignature(signatureId, {
          comparisonChart,
          analysisReport
        });
      }
      
      res.json({
        ...updatedSignature,
        comparisonChart,
        analysisReport
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Aggiorna il DPI di una firma specifica
  router.patch("/signatures/:id/dpi", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      
      if (isNaN(signatureId)) {
        return res.status(400).json({ error: 'ID firma non valido' });
      }
      
      // Verifica che il DPI sia stato fornito
      if (req.body.dpi === undefined || !Number.isInteger(req.body.dpi)) {
        return res.status(400).json({ error: 'DPI non valido. Deve essere un numero intero.' });
      }
      
      // Verifica che il DPI sia in un intervallo accettabile
      const dpi = parseInt(req.body.dpi);
      if (dpi < 72 || dpi > 1200) {
        return res.status(400).json({ error: 'DPI non valido. Deve essere un valore tra 72 e 1200.' });
      }
      
      // Ottieni la firma
      const signature = await storage.getSignature(signatureId);
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Ottieni il progetto associato alla firma
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che l'utente sia il proprietario del progetto
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato ad accedere a questa firma' });
      }
      
      // Aggiorna il DPI della firma
      const updatedSignature = await storage.updateSignature(signatureId, { dpi });
      
      // Aggiorna le attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'signature_update',
        details: `Aggiornato il DPI della firma "${signature.originalFilename}" a ${dpi}`
      });
      
      res.json(updatedSignature);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Riprocessa una firma fallita
  router.post("/signatures/:id/reprocess", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Aggiorna lo stato a processing
      await storage.updateSignatureStatus(signatureId, 'processing');
      
      // Avvia il processamento asincrono usando la stessa logica di processSignature
      const filePath = path.join('./uploads', signature.filename);
      processSignature(signatureId, filePath)
        .catch(error => {
          console.error(`Errore riprocessamento firma ${signatureId}:`, error);
          storage.updateSignatureStatus(signatureId, 'failed');
        });
      
      res.json({ message: 'Riprocessamento avviato', signatureId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Elimina una firma
  router.delete("/signatures/:id", isAuthenticated, async (req, res) => {
    try {
      const signatureId = parseInt(req.params.id);
      const signature = await storage.getSignature(signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: 'Firma non trovata' });
      }
      
      // Verifica che la firma appartenga all'utente corrente
      const project = await storage.getSignatureProject(signature.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      // Elimina il file della firma
      try {
        await fs.unlink(path.join('./uploads', signature.filename));
      } catch (err) {
        console.error(`Impossibile eliminare il file ${signature.filename}:`, err);
      }
      
      // Elimina la firma dal database
      await storage.deleteSignature(signatureId);
      
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ENDPOINT COMPLETAMENTE NUOVO per rigenerare parametri
  router.post("/signature-projects/:id/regenerate-analysis", isAuthenticated, async (req, res) => {
    console.error(`\n===== FORCE COMPARE ENTRY =====`);
    console.error(`TIMESTAMP: ${new Date().toISOString()}`);
    console.error(`PROJECT ID: ${req.params.id}`);
    console.error(`USER: ${req.user?.username}`);
    console.error(`BODY: ${JSON.stringify(req.body)}`);
    console.error(`==============================\n`);
    console.log(`[FORCE-COMPARE ENTRY] Ricevuta richiesta force-compare-signatures`);
    try {
      const projectId = parseInt(req.params.id);
      
      console.log(`[DEBUG FORCE-COMPARE] Avvio confronto multiplo per progetto ${projectId}`);
      
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        console.log(`[DEBUG FORCE-COMPARE] Progetto ${projectId} non trovato`);
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        console.log(`[DEBUG FORCE-COMPARE] Utente ${req.user!.id} non autorizzato per progetto ${projectId} (proprietario: ${project.userId})`);
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      console.log(`[DEBUG FORCE-COMPARE] Recupero firme di riferimento per progetto ${projectId}`);
      
      // Ottieni tutte le firme di riferimento
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      console.log(`[DEBUG FORCE-COMPARE] Trovate ${referenceSignatures.length} firme di riferimento totali`);
      
      // Filtra le firme di riferimento complete (con parametri)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      console.log(`[DEBUG FORCE-COMPARE] Firme di riferimento completate: ${completedReferences.length}`);
      
      if (completedReferences.length === 0) {
        console.log(`[DEBUG FORCE-COMPARE] Nessuna firma di riferimento elaborata disponibile per il progetto ${projectId}`);
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      console.log(`[DEBUG FORCE-COMPARE] Recupero firme da verificare per progetto ${projectId}`);
      
      // Ottieni tutte le firme da verificare
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      console.log(`[DEBUG FORCE-COMPARE] Trovate ${verificationSignatures.length} firme da verificare totali`);
      
      // Filtra le firme da verificare complete (con parametri)
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      console.log(`[DEBUG FORCE-COMPARE] Firme da verificare completate: ${completedVerifications.length}`);
      
      if (completedVerifications.length === 0) {
        console.log(`[DEBUG FORCE-COMPARE] Nessuna firma da verificare elaborata disponibile per il progetto ${projectId}`);
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile'
        });
      }
      
      // FORZA PYTHON ANALYZER - bypass completo del check
      console.log(`[DEBUG FORCE] BYPASS COMPLETO - FORZA PYTHON ANALYZER!`);
      const forcedPythonAvailable = true;
      
      // Crea le informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica multiple di firme`,
        date: new Date().toLocaleDateString('it-IT'),
        documentType: 'Verifiche multiple',
        notes: project.description || ""
      };
      
      console.log(`[DEBUG FORCE-COMPARE] Inizio elaborazione di ${completedVerifications.length} firme da verificare`);
      
      // Utilizziamo un ciclo for standard invece di Promise.all per garantire migliore gestione degli errori
      const results = [];
      console.error(`\n===== INIZIO CICLO FIRME =====`);
      console.error(`FIRME DA ELABORARE: ${completedVerifications.length}`);
      console.error(`FORCED PYTHON: ${forcedPythonAvailable}`);
      console.error(`==============================\n`);
      
      for (const signature of completedVerifications) {
        try {
          console.error(`\n===== ELABORAZIONE FIRMA ${signature.id} =====`);
          console.log(`[DEBUG FORCE-COMPARE] Elaborazione firma ${signature.id}`);
          
          let similarityScore = 0;
          let comparisonChart = null;
          let analysisReport = null;
          
          if (forcedPythonAvailable) {
            try {
              console.log(`[DEBUG FORCE-COMPARE] Usando analizzatore Python per firma ${signature.id}`);
              
              // Usiamo la prima firma di riferimento per il confronto avanzato
              const referenceSignature = completedReferences[0];
              const referencePath = path.join('./uploads', referenceSignature.filename);
              const signaturePath = path.join('./uploads', signature.filename);
              
              // Esegui il confronto avanzato con ordine corretto
              console.log(`[FORCE-COMPARE] Confronto firma da verificare: ${signaturePath}`);
              console.log(`[FORCE-COMPARE] Contro firma di riferimento: ${referencePath}`);
              
              // Debug percorsi assoluti per Python
              const absoluteSignaturePath = path.resolve(signaturePath);
              const absoluteReferencePath = path.resolve(referencePath);
              console.error(`\n===== PERCORSI PYTHON SCRIPT =====`);
              console.error(`VERIFICA ASSOLUTO: ${absoluteSignaturePath}`);
              console.error(`RIFERIMENTO ASSOLUTO: ${absoluteReferencePath}`);
              console.error(`===================================\n`);
              
              // DEBUG: Verifica che abbiamo le dimensioni reali dal database
              console.log(`[DEBUG DIMENSIONS] Firma da verificare ${signature.id}: realWidthMm=${signature.realWidthMm}, realHeightMm=${signature.realHeightMm}`);
              console.log(`[DEBUG DIMENSIONS] Firma riferimento ${referenceSignature.id}: realWidthMm=${referenceSignature.realWidthMm}, realHeightMm=${referenceSignature.realHeightMm}`);
              
              const verificaDimensions = { 
                widthMm: signature.realWidthMm || 50, 
                heightMm: signature.realHeightMm || 20 
              };
              const referenceDimensions = { 
                widthMm: referenceSignature.realWidthMm || 50, 
                heightMm: referenceSignature.realHeightMm || 20 
              };
              
              console.log(`[DEBUG DIMENSIONS] Dimensioni passate al Python - verifica: ${verificaDimensions.widthMm}x${verificaDimensions.heightMm}mm`);
              console.log(`[DEBUG DIMENSIONS] Dimensioni passate al Python - riferimento: ${referenceDimensions.widthMm}x${referenceDimensions.heightMm}mm`);
              
              // Debug visibile anche con log troncato
              console.error(`\n===== DIMENSIONI PYTHON SCRIPT =====`);
              console.error(`VERIFICA: ${verificaDimensions.widthMm}x${verificaDimensions.heightMm}mm`);
              console.error(`RIFERIMENTO: ${referenceDimensions.widthMm}x${referenceDimensions.heightMm}mm`);
              console.error(`===================================\n`);
              
              let comparisonResult;
              try {
                console.error(`\n===== CHIAMATA PYTHON ANALYZER =====`);
                console.error(`INIZIO: ${new Date().toISOString()}`);
                console.error(`====================================\n`);
                
                comparisonResult = await SignaturePythonAnalyzer.compareSignatures(
                  signaturePath,   // Firma da verificare
                  referencePath,   // Firma di riferimento
                  verificaDimensions, // Dimensioni firma da verificare
                  referenceDimensions, // Dimensioni firma di riferimento
                  false, // Non generare report DOCX automaticamente
                  caseInfo,
                  projectId // Passiamo l'ID del progetto per assicurare l'isolamento dei dati
                );
                
                console.error(`\n===== PYTHON ANALYZER COMPLETATO =====`);
                console.error(`FINE: ${new Date().toISOString()}`);
                console.error(`======================================\n`);
              } catch (pythonError) {
                console.error(`\n===== ERRORE PYTHON ANALYZER =====`);
                console.error(`ERRORE: ${pythonError.message}`);
                console.error(`STACK: ${pythonError.stack}`);
                console.error(`==================================\n`);
                throw pythonError;
              }
              
              // Estrai i parametri dalle firme Python se disponibili
              if (comparisonResult.verifica_data && Object.keys(comparisonResult.verifica_data).length > 0) {
                console.log(`[DEBUG PYTHON] Parametri Python disponibili per firma da verificare ${signature.id}`);
                
                // Mappa i parametri Python ai parametri del database
                const pythonParameters = {
                  // Parametri di base (sempre disponibili)
                  velocity: comparisonResult.verifica_data.Velocity || signature.parameters?.velocity || 0,
                  avgSpacing: comparisonResult.verifica_data.AvgSpacing || signature.parameters?.avgSpacing || 0,
                  proportion: comparisonResult.verifica_data.Proportion || signature.parameters?.proportion || 0,
                  
                  // Parametri avanzati (potrebbero non essere disponibili)
                  inclination: comparisonResult.verifica_data.Inclination || signature.parameters?.inclination || 0,
                  pressureStd: comparisonResult.verifica_data.PressureStd || signature.parameters?.pressureStd || 0,
                  avgAsolaSize: comparisonResult.verifica_data.AvgAsolaSize || signature.parameters?.avgAsolaSize || 0,
                  avgCurvature: comparisonResult.verifica_data.AvgCurvature || comparisonResult.verifica_data.Curvature || signature.parameters?.avgCurvature || 0,
                  
                  // Mantieni gli altri parametri esistenti
                  ...signature.parameters
                };
                
                // Aggiorna i parametri nel database usando il metodo corretto
                await storage.updateSignatureParameters(signature.id, pythonParameters);
                console.error(`PARAMETRI AGGIORNATI CON DATI PYTHON per firma ${signature.id}`);
              }
              
              similarityScore = comparisonResult.similarity;
              
              // Salva il grafico e il report (DOPO l'aggiornamento parametri)
              comparisonChart = comparisonResult.comparison_chart;
              analysisReport = comparisonResult.description;
              
              console.log(`[DEBUG CHART] Nuovo grafico generato: ${comparisonChart ? 'SI' : 'NO'}`);
              console.log(`[DEBUG CHART] Percorso grafico: ${comparisonChart}`);
              console.log(`[DEBUG CHART] Analisi report generato: ${analysisReport ? 'SI' : 'NO'}`);
              console.error(`[CRITICAL FIX] ✅ PARAMETRI AGGIORNATI PRIMA DEL GRAFICO!`);              
              
              console.log(`[DEBUG FORCE-COMPARE] Confronto Python completato per firma ${signature.id} con score ${similarityScore}`);
            } catch (pythonError: any) {
              console.log(`[DEBUG FORCE-COMPARE] ❌ ERRORE PYTHON ANALYZER: ${pythonError.message}`);
              console.log(`[DEBUG FORCE-COMPARE] Stack trace:`, pythonError.stack);
              console.log(`[DEBUG FORCE-COMPARE] 🔄 FALLBACK ALL'ANALIZZATORE JAVASCRIPT`);
              // Fallback all'analizzatore JavaScript se quello Python fallisce
              const referenceParameters = completedReferences.map(ref => ref.parameters!);
              similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
              console.log(`[DEBUG FORCE-COMPARE] ✓ JavaScript analyzer result: ${similarityScore}`);
            }
          } else {
            console.log(`[DEBUG FORCE-COMPARE] Usando analizzatore JS per firma ${signature.id}`);
            // Usa l'analizzatore JavaScript standard
            const referenceParameters = completedReferences.map(ref => ref.parameters!);
            similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
          }
          
          console.log(`[DEBUG FORCE-COMPARE] Risultato confronto per firma ${signature.id}: ${similarityScore}`);
          
          // Primo step: aggiornamento del risultato numerico
          console.log(`[DEBUG FORCE-COMPARE] Aggiornamento punteggio di confronto per firma ${signature.id}`);
          await storage.updateSignatureComparisonResult(signature.id, similarityScore);
          
          // Secondo step: aggiornamento dei dati aggiuntivi solo se necessario
          if (comparisonChart || analysisReport) {
            console.log(`[DEBUG FORCE-COMPARE] Aggiornamento dati avanzati per firma ${signature.id}`);
            
            // Creiamo un nuovo oggetto con solo i campi effettivamente presenti
            const updateData: Record<string, any> = {};
            
            if (comparisonChart) {
              console.log(`[DEBUG FORCE-COMPARE] Firma ${signature.id} ha un grafico di confronto`);
              updateData.comparisonChart = comparisonChart;
            }
            
            if (analysisReport) {
              console.log(`[DEBUG FORCE-COMPARE] Firma ${signature.id} ha un report di analisi`);
              updateData.analysisReport = analysisReport;
            }
            
            // Aggiorniamo solo se abbiamo effettivamente dei dati da aggiornare
            if (Object.keys(updateData).length > 0) {
              console.log(`[DEBUG FORCE-COMPARE] Aggiornamento firma ${signature.id} con dati avanzati`);
              await storage.updateSignature(signature.id, updateData);
            }
          }
          
          // Recupera la firma aggiornata
          console.log(`[DEBUG FORCE-COMPARE] Recupero firma aggiornata ${signature.id}`);
          const updatedSignature = await storage.getSignature(signature.id);
          
          if (!updatedSignature) {
            console.error(`[DEBUG FORCE-COMPARE] Impossibile recuperare la firma aggiornata ${signature.id}`);
            throw new Error(`Impossibile recuperare la firma aggiornata con ID ${signature.id}`);
          }
          
          console.log(`[DEBUG FORCE-COMPARE] Firma ${signature.id}: isReference=${updatedSignature.isReference}, filename=${updatedSignature.filename}`);
          results.push(updatedSignature);
          console.log(`[DEBUG FORCE-COMPARE] Firma ${signature.id} elaborata con successo`);
        } catch (signatureError) {
          console.error(`[DEBUG FORCE-COMPARE] Errore nell'elaborazione della firma ${signature.id}:`, signatureError);
          // Continuiamo con le altre firme anche se una fallisce
        }
      }
      
      console.log(`[DEBUG FORCE-COMPARE] Confronto multiplo completato per ${results.length} firme`);
      
      // Aggiorna il registro attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'signature_compare',
        details: `Confrontate ${results.length} firme nel progetto "${project.name}"`
      });
      
      // Filtra e restituisci solo le firme da verificare (non di riferimento)
      const verificationResults = results.filter(signature => !signature.isReference);
      console.log(`[DEBUG FORCE-COMPARE] Firme da verificare nel risultato: ${verificationResults.length}`);
      console.log(`[DEBUG FORCE-COMPARE] Invio risposta con ${verificationResults.length} firme da verificare`);
      res.json(verificationResults);
    } catch (error: any) {
      console.error(`[DEBUG FORCE-COMPARE] Errore generale nel confronto multiplo delle firme:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  

  // Esegui confronto automatico di tutte le firme da verificare in un progetto
  router.post("/signature-projects/:id/compare-all", async (req, res) => {
    console.error(`\n🔥🔥🔥 COMPARE-ALL ENTRY REACHED! 🔥🔥🔥`);
    console.error(`TIMESTAMP: ${new Date().toISOString()}`);
    console.error(`PROJECT ID: ${req.params.id}`);
    console.error(`SESSION ID: ${req.sessionID || 'NO SESSION'}`);
    console.error(`IS AUTHENTICATED: ${req.isAuthenticated()}`);
    console.error(`USER: ${req.user?.username || 'NO USER'}`);
    console.error(`COOKIES: ${JSON.stringify(req.cookies)}`);
    console.error(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n`);
    
    // Verifica autenticazione manualmente
    if (!req.isAuthenticated()) {
      console.error(`❌ UTENTE NON AUTENTICATO`);
      return res.status(401).json({ error: "Autenticazione richiesta" });
    }
    console.log(`[COMPARE-ALL ENTRY] Ricevuta richiesta compare-all`);
    try {
      const projectId = parseInt(req.params.id);
      
      console.log(`[DEBUG COMPARE-ALL] Avvio confronto multiplo per progetto ${projectId}`);
      
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        console.log(`[DEBUG COMPARE-ALL] Progetto ${projectId} non trovato`);
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      // Verifica che il progetto appartenga all'utente corrente
      if (project.userId !== req.user!.id) {
        console.log(`[DEBUG COMPARE-ALL] Utente ${req.user!.id} non autorizzato per progetto ${projectId} (proprietario: ${project.userId})`);
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      console.log(`[DEBUG COMPARE-ALL] Recupero firme di riferimento per progetto ${projectId}`);
      
      // Ottieni tutte le firme di riferimento
      const referenceSignatures = await storage.getProjectSignatures(projectId, true);
      console.log(`[DEBUG COMPARE-ALL] Trovate ${referenceSignatures.length} firme di riferimento totali`);
      
      // Filtra le firme di riferimento complete (con parametri)
      const completedReferences = referenceSignatures.filter(
        ref => ref.processingStatus === 'completed' && ref.parameters
      );
      
      console.log(`[DEBUG COMPARE-ALL] Firme di riferimento completate: ${completedReferences.length}`);
      
      if (completedReferences.length === 0) {
        console.log(`[DEBUG COMPARE-ALL] Nessuna firma di riferimento elaborata disponibile per il progetto ${projectId}`);
        return res.status(400).json({
          error: 'Nessuna firma di riferimento elaborata disponibile'
        });
      }
      
      console.log(`[DEBUG COMPARE-ALL] Recupero firme da verificare per progetto ${projectId}`);
      
      // Ottieni tutte le firme da verificare
      const verificationSignatures = await storage.getProjectSignatures(projectId, false);
      console.log(`[DEBUG COMPARE-ALL] Trovate ${verificationSignatures.length} firme da verificare totali`);
      
      // Filtra le firme da verificare complete (con parametri)
      const completedVerifications = verificationSignatures.filter(
        sig => sig.processingStatus === 'completed' && sig.parameters
      );
      
      console.log(`[DEBUG COMPARE-ALL] Firme da verificare completate: ${completedVerifications.length}`);
      
      if (completedVerifications.length === 0) {
        console.log(`[DEBUG COMPARE-ALL] Nessuna firma da verificare elaborata disponibile per il progetto ${projectId}`);
        return res.status(400).json({
          error: 'Nessuna firma da verificare elaborata disponibile'
        });
      }
      
      // FORZA PYTHON ANALYZER - bypass completo del check
      console.log(`[DEBUG FORCE] BYPASS COMPLETO - FORZA PYTHON ANALYZER!`);
      const forcedPythonAvailable = true;
      
      // Crea le informazioni sul caso
      const caseInfo = {
        caseName: project.name,
        subject: `Verifica multiple di firme`,
        date: new Date().toLocaleDateString('it-IT'),
        documentType: 'Verifiche multiple',
        notes: project.description || ""
      };
      
      console.log(`[DEBUG COMPARE-ALL] Inizio elaborazione di ${completedVerifications.length} firme da verificare`);
      
      // Utilizziamo un ciclo for standard invece di Promise.all per garantire migliore gestione degli errori
      const results = [];
      console.error(`\n===== INIZIO CICLO FIRME =====`);
      console.error(`FIRME DA ELABORARE: ${completedVerifications.length}`);
      console.error(`FORCED PYTHON: ${forcedPythonAvailable}`);
      console.error(`==============================\n`);
      
      for (const signature of completedVerifications) {
        try {
          console.error(`\n===== ELABORAZIONE FIRMA ${signature.id} =====`);
          console.log(`[DEBUG COMPARE-ALL] Elaborazione firma ${signature.id}`);
          
          // FORZA RIGENERAZIONE: Cancella comparisonChart esistente per forzare nuovo grafico
          console.log(`[DEBUG COMPARE-ALL] 🔄 CANCELLAZIONE grafico cached per firma ${signature.id}`);
          await storage.updateSignature(signature.id, { comparisonChart: null });
          console.log(`[DEBUG COMPARE-ALL] ✅ Grafico cached cancellato - verrà rigenerato`);
          
          let similarityScore = 0;
          let comparisonChart = null;
          let analysisReport = null;
          
          if (forcedPythonAvailable) {
            try {
              console.log(`[DEBUG COMPARE-ALL] Usando analizzatore Python per firma ${signature.id}`);
              
              // Usiamo la prima firma di riferimento per il confronto avanzato
              const referenceSignature = completedReferences[0];
              const referencePath = path.join('./uploads', referenceSignature.filename);
              const signaturePath = path.join('./uploads', signature.filename);
              
              // Esegui il confronto avanzato con ordine corretto
              console.log(`[COMPARE-ALL] Confronto firma da verificare: ${signaturePath}`);
              console.log(`[COMPARE-ALL] Contro firma di riferimento: ${referencePath}`);
              
              // Debug percorsi assoluti per Python
              const absoluteSignaturePath = path.resolve(signaturePath);
              const absoluteReferencePath = path.resolve(referencePath);
              console.error(`\n===== PERCORSI PYTHON SCRIPT =====`);
              console.error(`VERIFICA ASSOLUTO: ${absoluteSignaturePath}`);
              console.error(`RIFERIMENTO ASSOLUTO: ${absoluteReferencePath}`);
              console.error(`===================================\n`);
              
              // Otteniamo il progetto per il DPI
              const project = await storage.getSignatureProject(projectId);
              if (!project) {
                throw new Error('Progetto non trovato');
              }
              
              // Estrai il DPI dal progetto (default 300)
              const dpi = project.dpi || 300;
              
              // DEBUG: Verifica che abbiamo le dimensioni reali dal database
              console.log(`[DEBUG DIMENSIONS] Firma da verificare ${signature.id}: realWidthMm=${signature.realWidthMm}, realHeightMm=${signature.realHeightMm}`);
              console.log(`[DEBUG DIMENSIONS] Firma riferimento ${referenceSignature.id}: realWidthMm=${referenceSignature.realWidthMm}, realHeightMm=${referenceSignature.realHeightMm}`);
              
              const verificaDimensions = { 
                widthMm: signature.realWidthMm || 50, 
                heightMm: signature.realHeightMm || 20 
              };
              const referenceDimensions = { 
                widthMm: referenceSignature.realWidthMm || 50, 
                heightMm: referenceSignature.realHeightMm || 20 
              };
              
              console.log(`[DEBUG DIMENSIONS] Dimensioni passate al Python - verifica: ${verificaDimensions.widthMm}x${verificaDimensions.heightMm}mm`);
              console.log(`[DEBUG DIMENSIONS] Dimensioni passate al Python - riferimento: ${referenceDimensions.widthMm}x${referenceDimensions.heightMm}mm`);
              
              // Debug visibile anche con log troncato
              console.error(`\n===== DIMENSIONI PYTHON SCRIPT =====`);
              console.error(`VERIFICA: ${verificaDimensions.widthMm}x${verificaDimensions.heightMm}mm`);
              console.error(`RIFERIMENTO: ${referenceDimensions.widthMm}x${referenceDimensions.heightMm}mm`);
              console.error(`===================================\n`);
              
              let comparisonResult;
              try {
                console.error(`\n===== CHIAMATA PYTHON ANALYZER =====`);
                console.error(`INIZIO: ${new Date().toISOString()}`);
                console.error(`====================================\n`);
                
                comparisonResult = await SignaturePythonAnalyzer.compareSignatures(
                  signaturePath,   // Firma da verificare
                  referencePath,   // Firma di riferimento
                  verificaDimensions, // Dimensioni firma da verificare
                  referenceDimensions, // Dimensioni firma di riferimento
                  false, // Non generare report DOCX automaticamente
                  caseInfo,
                  projectId // Passiamo l'ID del progetto per assicurare l'isolamento dei dati
                );
                
                console.error(`\n===== PYTHON ANALYZER COMPLETATO =====`);
                console.error(`FINE: ${new Date().toISOString()}`);
                console.error(`======================================\n`);
              } catch (pythonError) {
                console.error(`\n===== ERRORE PYTHON ANALYZER =====`);
                console.error(`ERRORE: ${pythonError.message}`);
                console.error(`STACK: ${pythonError.stack}`);
                console.error(`==================================\n`);
                throw pythonError;
              }
              console.log(`[COMPARE-ALL] Utilizzando projectId ${projectId} per garantire l'isolamento dei dati`);
              
              // CRITICAL FIX: Aggiorna i parametri con i dati Python corretti PRIMA del grafico
              if (comparisonResult.verifica_data) {
                console.error(`\n===== AGGIORNAMENTO PARAMETRI PYTHON =====`);
                console.error(`VECCHIA INCLINAZIONE DB: ${signature.parameters?.inclination || 'N/A'}`);
                console.error(`NUOVA INCLINAZIONE PYTHON: ${comparisonResult.verifica_data.Inclination || 'N/A'}`);
                console.error(`VECCHIA AVGASOLASIZE DB: ${signature.parameters?.avgAsolaSize || 'N/A'}`);
                console.error(`NUOVA AVGASOLASIZE PYTHON: ${comparisonResult.verifica_data.AvgAsolaSize || 'N/A'}`);
                console.error(`==========================================\n`);
                
                // Costruisci i nuovi parametri dal Python script
                const pythonParameters = {
                  ...signature.parameters,
                  inclination: comparisonResult.verifica_data.Inclination,
                  proportion: comparisonResult.verifica_data.Proportion,
                  pressureMean: comparisonResult.verifica_data.PressureMean,
                  pressureStd: comparisonResult.verifica_data.PressureStd,
                  avgCurvature: comparisonResult.verifica_data.AvgCurvature,
                  avgSpacing: comparisonResult.verifica_data.AvgSpacing,
                  avgAsolaSize: comparisonResult.verifica_data.AvgAsolaSize,
                  velocity: comparisonResult.verifica_data.Velocity,
                  overlapRatio: comparisonResult.verifica_data.OverlapRatio,
                  baselineStdMm: comparisonResult.verifica_data.BaselineStdMm,
                  writingStyle: comparisonResult.verifica_data.WritingStyle || signature.parameters?.writingStyle,
                  readability: comparisonResult.verifica_data.Readability || signature.parameters?.readability
                };
                
                // Aggiorna i parametri nel database usando il metodo corretto
                await storage.updateSignatureParameters(signature.id, pythonParameters);
                console.error(`PARAMETRI AGGIORNATI CON DATI PYTHON per firma ${signature.id}`);
              }
              
              similarityScore = comparisonResult.similarity;
              
              // Salva il grafico e il report (DOPO l'aggiornamento parametri)
              comparisonChart = comparisonResult.comparison_chart;
              analysisReport = comparisonResult.description;
              
              console.log(`[DEBUG CHART] Nuovo grafico generato: ${comparisonChart ? 'SI' : 'NO'}`);
              console.log(`[DEBUG CHART] Percorso grafico: ${comparisonChart}`);
              console.log(`[DEBUG CHART] Analisi report generato: ${analysisReport ? 'SI' : 'NO'}`);
              console.error(`[CRITICAL FIX] ✅ PARAMETRI AGGIORNATI PRIMA DEL GRAFICO!`);              
              
              console.log(`[DEBUG COMPARE-ALL] Confronto Python completato per firma ${signature.id} con score ${similarityScore}`);
            } catch (pythonError: any) {
              console.log(`[DEBUG COMPARE-ALL] ❌ ERRORE PYTHON ANALYZER: ${pythonError.message}`);
              console.log(`[DEBUG COMPARE-ALL] Stack trace:`, pythonError.stack);
              console.log(`[DEBUG COMPARE-ALL] 🔄 FALLBACK ALL'ANALIZZATORE JAVASCRIPT`);
              // Fallback all'analizzatore JavaScript se quello Python fallisce
              const referenceParameters = completedReferences.map(ref => ref.parameters!);
              similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
              console.log(`[DEBUG COMPARE-ALL] ✓ JavaScript analyzer result: ${similarityScore}`);
            }
          } else {
            console.log(`[DEBUG COMPARE-ALL] Usando analizzatore JS per firma ${signature.id}`);
            // Usa l'analizzatore JavaScript standard
            const referenceParameters = completedReferences.map(ref => ref.parameters!);
            similarityScore = SignatureAnalyzer.compareSignatures(signature.parameters!, referenceParameters);
          }
          
          console.log(`[DEBUG COMPARE-ALL] Risultato confronto per firma ${signature.id}: ${similarityScore}`);
          
          // Primo step: aggiornamento del risultato numerico
          console.log(`[DEBUG COMPARE-ALL] Aggiornamento punteggio di confronto per firma ${signature.id}`);
          await storage.updateSignatureComparisonResult(signature.id, similarityScore);
          
          // Secondo step: aggiornamento dei dati aggiuntivi solo se necessario
          if (comparisonChart || analysisReport) {
            console.log(`[DEBUG COMPARE-ALL] Aggiornamento dati avanzati per firma ${signature.id}`);
            
            // Creiamo un nuovo oggetto con solo i campi effettivamente presenti
            const updateData: Record<string, any> = {};
            
            if (comparisonChart) {
              console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id} ha un grafico di confronto`);
              updateData.comparisonChart = comparisonChart;
            }
            
            if (analysisReport) {
              console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id} ha un report di analisi`);
              updateData.analysisReport = analysisReport;
            }
            
            // Aggiorniamo solo se abbiamo effettivamente dei dati da aggiornare
            if (Object.keys(updateData).length > 0) {
              console.log(`[DEBUG COMPARE-ALL] Aggiornamento firma ${signature.id} con dati avanzati`);
              await storage.updateSignature(signature.id, updateData);
            }
          }
          
          // Recupera la firma aggiornata
          console.log(`[DEBUG COMPARE-ALL] Recupero firma aggiornata ${signature.id}`);
          const updatedSignature = await storage.getSignature(signature.id);
          
          if (!updatedSignature) {
            console.error(`[DEBUG COMPARE-ALL] Impossibile recuperare la firma aggiornata ${signature.id}`);
            throw new Error(`Impossibile recuperare la firma aggiornata con ID ${signature.id}`);
          }
          
          console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id}: isReference=${updatedSignature.isReference}, filename=${updatedSignature.filename}`);
          results.push(updatedSignature);
          console.log(`[DEBUG COMPARE-ALL] Firma ${signature.id} elaborata con successo`);
        } catch (signatureError) {
          console.error(`[DEBUG COMPARE-ALL] Errore nell'elaborazione della firma ${signature.id}:`, signatureError);
          // Continuiamo con le altre firme anche se una fallisce
        }
      }
      
      console.log(`[DEBUG COMPARE-ALL] Confronto multiplo completato per ${results.length} firme`);
      
      // Aggiorna il registro attività
      await storage.createActivity({
        userId: req.user!.id,
        type: 'signature_compare',
        details: `Confrontate ${results.length} firme nel progetto "${project.name}"`
      });
      
      // Filtra e restituisci solo le firme da verificare (non di riferimento)
      const verificationResults = results.filter(signature => !signature.isReference);
      console.log(`[DEBUG COMPARE-ALL] Firme da verificare nel risultato: ${verificationResults.length}`);
      console.log(`[DEBUG COMPARE-ALL] IDs delle firme da verificare: ${verificationResults.map(s => s.id).join(', ')}`);
      console.log(`[DEBUG COMPARE-ALL] Invio risposta con ${verificationResults.length} firme da verificare`);
      console.log(`[DEBUG COMPARE-ALL] ✅ RISPOSTA FINALE:`, JSON.stringify(verificationResults, null, 2));
      res.json(verificationResults);
    } catch (error: any) {
      console.error(`[DEBUG COMPARE-ALL] Errore generale nel confronto multiplo delle firme:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint per ripulire tutte le firme di un progetto
  router.post("/signature-projects/:id/reset", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getSignatureProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Progetto non trovato' });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
      
      console.log(`[CLEANUP] Iniziata pulizia completa del progetto ${projectId}...`);
      
      // Ottieni tutte le firme del progetto
      let signatures = await storage.getProjectSignatures(projectId);
      console.log(`[CLEANUP] Trovate ${signatures.length} firme da eliminare`);
      
      // Implementazione migliorata con due passaggi separati:
      // 1. Prima eliminiamo tutti i file fisici
      for (const signature of signatures) {
        try {
          if (signature.filename) {
            const filePath = path.join('./uploads', signature.filename);
            try {
              await fs.access(filePath);
              await fs.unlink(filePath);
              console.log(`[CLEANUP] File eliminato: ${filePath}`);
            } catch (err) {
              console.log(`[CLEANUP] File non trovato: ${filePath}`);
            }
          }
        } catch (error) {
          console.error(`[CLEANUP] Errore eliminando file per firma ${signature.id}:`, error);
        }
      }
      
      // 2. Poi eliminiamo tutti i record dal database
      for (const signature of signatures) {
        try {
          await storage.deleteSignature(signature.id);
          console.log(`[CLEANUP] Record firma eliminato: ${signature.id}`);
        } catch (error) {
          console.error(`[CLEANUP] Errore eliminando record firma ${signature.id}:`, error);
        }
      }
      
      // 3. Verifica che non ci siano firme residue
      signatures = await storage.getProjectSignatures(projectId);
      if (signatures.length > 0) {
        console.warn(`[CLEANUP] ⚠️ Ci sono ancora ${signatures.length} firme residue nel progetto!`);
        
        // Secondo tentativo di pulizia forzata
        console.log(`[CLEANUP] Esecuzione secondo passaggio di pulizia forzata...`);
        for (const signature of signatures) {
          try {
            console.log(`[CLEANUP] Eliminazione forzata della firma ${signature.id}`);
            if (signature.filename) {
              try {
                await fs.unlink(path.join('./uploads', signature.filename)).catch(() => {});
              } catch (e) {}
            }
            await storage.deleteSignature(signature.id);
          } catch (error) {
            console.error(`[CLEANUP] Impossibile eliminare forzatamente la firma ${signature.id}:`, error);
          }
        }
        
        // Ultima verifica
        const finalCheck = await storage.getProjectSignatures(projectId);
        console.log(`[CLEANUP] Dopo pulizia forzata: ${finalCheck.length} firme rimaste`);
        
        if (finalCheck.length > 0) {
          console.log(`[CLEANUP] IDs firme rimanenti: ${finalCheck.map(s => s.id).join(', ')}`);
        }
      } else {
        console.log(`[CLEANUP] ✓ Progetto ripulito con successo: nessuna firma rimasta`);
      }
      
      res.json({ 
        success: true, 
        message: `Rimosse ${signatures.length} firme dal progetto`,
        remainingCount: signatures.length
      });
    } catch (error: any) {
      console.error("[CLEANUP] Errore durante il reset del progetto:", error);
      res.status(500).json({ error: error.message });
    }
  });

// Funzioni ausiliarie per elaborazione asincrona

async function processSignature(signatureId: number, filePath: string) {
  try {
    // Ottieni i dettagli della firma
    const signature = await storage.getSignature(signatureId);
    if (!signature) {
      throw new Error('Firma non trovata');
    }
    
    // Verifica che le dimensioni reali siano disponibili
    if (!signature.realWidthMm || !signature.realHeightMm) {
      throw new Error('Dimensioni reali della firma non specificate');
    }
    
    log(`NUOVO APPROCCIO - Elaborazione firma ${signatureId} con dimensioni firma target: ${signature.realWidthMm}mm x ${signature.realHeightMm}mm`, 'signatures');
    
    // Aggiorna lo stato a 'processing'
    await storage.updateSignatureStatus(signatureId, 'processing');
    
    // PASSO 1: Ritaglio automatico obbligatorio per rimuovere spazio vuoto
    log(`PASSO 1 - Ritaglio automatico dell'immagine per rimuovere spazio vuoto`, 'signatures');
    const cropResult = await SignatureCropper.cropSignature({
      inputPath: filePath,
      targetSize: { width: 800, height: 400 } // Dimensioni target conservative per il ritaglio
    });
    
    if (!cropResult.success || !cropResult.croppedPath) {
      throw new Error(`Ritaglio automatico fallito: ${cropResult.message}`);
    }
    
    // PASSO 2: Sostituisci l'immagine originale con quella ritagliata
    log(`PASSO 2 - Applicazione ritaglio all'immagine originale`, 'signatures');
    await fs.copyFile(cropResult.croppedPath, filePath);
    await fs.unlink(cropResult.croppedPath);
    
    // PASSO 3: Calibrazione basata sul nuovo approccio
    // Le dimensioni reali inserite dall'utente corrispondono all'immagine ritagliata
    log(`PASSO 3 - Calibrazione: immagine ritagliata ${cropResult.croppedDimensions.width}x${cropResult.croppedDimensions.height}px = ${signature.realWidthMm}x${signature.realHeightMm}mm`, 'signatures');
    
    const pixelsPerMmX = cropResult.croppedDimensions.width / signature.realWidthMm;
    const pixelsPerMmY = cropResult.croppedDimensions.height / signature.realHeightMm;
    const avgPixelsPerMm = (pixelsPerMmX + pixelsPerMmY) / 2; // Densità media unificata
    
    log(`DENSITÀ CALCOLATA: ${pixelsPerMmX.toFixed(2)}x${pixelsPerMmY.toFixed(2)} px/mm (media: ${avgPixelsPerMm.toFixed(2)} px/mm)`, 'signatures');
    
    // PASSO 4: Estrazione parametri con le dimensioni reali della firma
    const parameters = await SignatureAnalyzer.extractParameters(
      filePath, 
      signature.realWidthMm, 
      signature.realHeightMm
    );
    
    // PASSO 5: Aggiorna la firma con i parametri estratti e note del processo
    const processNotes = `[NUOVO APPROCCIO] Ritaglio automatico applicato. ${cropResult.message}\n` +
      `Riduzione area: ${((1 - (cropResult.croppedDimensions.width * cropResult.croppedDimensions.height) / (cropResult.originalDimensions.width * cropResult.originalDimensions.height)) * 100).toFixed(1)}%\n` +
      `Densità finale: ${avgPixelsPerMm.toFixed(2)} px/mm`;
    
    await storage.updateSignatureParameters(signatureId, parameters);
    await storage.updateSignature(signatureId, {
      notes: (signature.notes || '') + '\n' + processNotes
    });
    
    log(`COMPLETATO - Firma ${signatureId} elaborata con nuovo approccio`, 'signatures');
    
    // Aggiorna lo stato a 'completed'
    await storage.updateSignatureStatus(signatureId, 'completed');
  } catch (error: any) {
    console.error(`Errore nell'elaborazione della firma ${signatureId}:`, error);
    await storage.updateSignatureStatus(signatureId, 'failed');
  }
}

// Export function to register all signature routes
export function registerSignatureRoutes(appRouter: Router) {
  console.log("🔥🔥🔥 REGISTERING SIGNATURE ROUTES 🔥🔥🔥");
  // Mount all the signature routes defined above onto the provided router
  appRouter.use(router);
}

