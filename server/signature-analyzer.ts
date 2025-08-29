import { promises as fs } from 'fs';
import path from 'path';
import { SignatureParameters } from '../shared/schema';
import { execSync } from 'child_process';
import sharp from 'sharp';

/**
 * Classe per l'analisi delle firme
 * In una implementazione reale utilizzerebbe librerie di computer vision come OpenCV
 * per estrarre parametri caratteristici dalle immagini delle firme
 */
export class SignatureAnalyzer {
  /**
   * Estrae i parametri caratteristici da un'immagine di firma utilizzando analisi reale
   * @param imagePath Percorso del file dell'immagine
   * @param realWidthMm Larghezza reale della firma in mm
   * @param realHeightMm Altezza reale della firma in mm
   * @returns Parametri estratti dalla firma
   */
  public static async extractParameters(
    imagePath: string, 
    realWidthMm: number, 
    realHeightMm: number
  ): Promise<SignatureParameters> {
    try {
      console.log(`[ANALYZER] Inizio analisi avanzata: ${imagePath}, dimensioni reali: ${realWidthMm}x${realHeightMm}mm`);
      
      // === FASE 1: ANALISI ESISTENTE (MANTENIAMO TUTTO) ===
      // Verifica che il file esista
      await fs.access(imagePath);
      
      // Carica l'immagine con Sharp e applica orientamento EXIF
      const image = sharp(imagePath).rotate(); // Applica automaticamente orientamento EXIF
      const metadata = await image.metadata();
      const { width: pixelWidth, height: pixelHeight } = metadata;
      
      if (!pixelWidth || !pixelHeight) {
        throw new Error('Impossibile determinare le dimensioni dell\'immagine');
      }
      
      // Calcola il fattore di calibrazione (pixel per millimetro)
      const pixelsPerMmX = pixelWidth / realWidthMm;
      const pixelsPerMmY = pixelHeight / realHeightMm;
      const pixelsPerMm = (pixelsPerMmX + pixelsPerMmY) / 2; // Media per uniformità
      
      console.log(`Calibrazione: ${pixelWidth}x${pixelHeight}px -> ${realWidthMm}x${realHeightMm}mm (${pixelsPerMm.toFixed(2)} px/mm)`);
      
      // Ridimensiona se l'immagine è troppo grande per evitare overflow dello stack
      const maxDimension = 2000;
      let processedImage = image;
      let scaleFactor = 1;
      
      if (pixelWidth > maxDimension || pixelHeight > maxDimension) {
        scaleFactor = Math.min(maxDimension / pixelWidth, maxDimension / pixelHeight);
        const newWidth = Math.round(pixelWidth * scaleFactor);
        const newHeight = Math.round(pixelHeight * scaleFactor);
        
        console.log(`Ridimensionamento immagine: ${pixelWidth}x${pixelHeight}px -> ${newWidth}x${newHeight}px (fattore: ${scaleFactor.toFixed(3)})`);
        processedImage = image.resize(newWidth, newHeight, { fit: 'fill' });
      }
      
      // Converte in scala di grigi e applica sogliatura per isolare l'inchiostro
      const grayBuffer = await processedImage
        .greyscale()
        .normalise()
        .raw()
        .toBuffer();
      
      // Usa le dimensioni processate per l'analisi
      const analysisWidth = Math.round(pixelWidth * scaleFactor);
      const analysisHeight = Math.round(pixelHeight * scaleFactor);
      const adjustedPixelsPerMm = pixelsPerMm * scaleFactor;
      
      // === ANALISI ESISTENTE (MANTENIAMO) ===
      const existingAnalysis = await this.analyzeSignatureImage(grayBuffer, analysisWidth, analysisHeight, adjustedPixelsPerMm);
      
      // === FASE 2: ANALISI AVANZATA CON SCRIPT PYTHON ===
      console.log(`[ANALYZER] Avvio analisi parametri avanzati usando script Python`);
      let advancedAnalysis: any = {};
      
      try {
        const pythonCommand = `python3 advanced_signature_analyzer.py analyze "${imagePath}" ${realWidthMm} ${realHeightMm}`;
        const result = execSync(pythonCommand, { 
          encoding: 'utf-8',
          timeout: 30000, // 30 secondi timeout
          cwd: process.cwd()
        });
        
        advancedAnalysis = JSON.parse(result);
        console.log(`[ANALYZER] Parametri avanzati estratti con successo`);
        
      } catch (error) {
        console.warn(`[ANALYZER] Analisi avanzata fallita, uso solo parametri base:`, error);
        advancedAnalysis = {}; // Fallback: usa solo analisi esistente
      }
      
      // === FASE 3: INTEGRAZIONE DEI RISULTATI ===
      console.log(`[ANALYZER] Integrazione parametri esistenti + avanzati`);
      
      // Combina i parametri esistenti con quelli avanzati
      const finalParameters = {
        ...existingAnalysis,
        
        // Aggiungi le dimensioni originali dell'immagine
        width: pixelWidth,
        height: pixelHeight,
        original_width: pixelWidth,
        original_height: pixelHeight,
        realDimensions: {
          widthMm: realWidthMm,
          heightMm: realHeightMm
        },
        
        // Parametri avanzati integrati se disponibili
        ...(advancedAnalysis.proportion !== undefined && {
          proportion: advancedAnalysis.proportion,
          inclination: advancedAnalysis.inclination || 0,
          pressureMean: advancedAnalysis.pressureMean || 0,
          pressureStd: advancedAnalysis.pressureStd || 0,
          avgCurvature: advancedAnalysis.avgCurvature || 0,
          writingStyle: advancedAnalysis.writingStyle || 'Sconosciuto',
          readability: advancedAnalysis.readability || 'Media',
          avgAsolaSize: advancedAnalysis.avgAsolaSize || 0,
          avgSpacing: advancedAnalysis.avgSpacing || 0,
          velocity: advancedAnalysis.velocity || 1,
          overlapRatio: advancedAnalysis.overlapRatio || 0,
          letterConnections: advancedAnalysis.letterConnections || 1,
          baselineStdMm: advancedAnalysis.baselineStdMm || 0,
          // Parametri mancanti aggiunti
          pressureDeviation: advancedAnalysis.pressureStd || 0, // map pressureStd to pressureDeviation  
          connectedComponents: advancedAnalysis.connectedComponents || 1,
          strokeComplexity: advancedAnalysis.strokeComplexity || 0
        })
      };
      
      console.log(`[ANALYZER] Analisi completata con ${Object.keys(finalParameters).length} parametri`);
      return finalParameters;
    } catch (error: any) {
      console.error(`[ANALYZER] Errore nell'analisi della firma ${imagePath}:`, error);
      console.error(`[ANALYZER] Stack trace:`, error.stack);
      throw new Error(`Impossibile analizzare la firma: ${error.message || 'Errore sconosciuto'}`);
    }
  }

  /**
   * Analizza i dati binari dell'immagine per estrarre caratteristiche della firma
   */
  private static async analyzeSignatureImage(
    buffer: Buffer, 
    width: number, 
    height: number, 
    pixelsPerMm: number
  ) {
    console.log(`Analizzando immagine ${width}x${height}px con risoluzione ${pixelsPerMm.toFixed(2)} px/mm`);
    
    // Converte il buffer in una matrice 2D per l'analisi
    const imageMatrix: number[][] = [];
    for (let y = 0; y < height; y++) {
      imageMatrix[y] = [];
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        imageMatrix[y][x] = buffer[index];
      }
    }
    
    // Applica sogliatura per separare inchiostro da sfondo
    const threshold = this.calculateOtsuThreshold(buffer);
    const binaryMatrix = this.applyThreshold(imageMatrix, threshold);
    
    console.log(`Soglia Otsu calcolata: ${threshold}`);
    
    // Analizza le caratteristiche
    const strokeAnalysis = this.analyzeStrokeCharacteristics(binaryMatrix, pixelsPerMm);
    const pressureAnalysis = this.analyzePressurePoints(imageMatrix, binaryMatrix, pixelsPerMm);
    const curvatureAnalysis = this.analyzeCurvature(binaryMatrix, pixelsPerMm);
    const spatialAnalysis = this.analyzeSpatialDistribution(binaryMatrix);
    const connectivityAnalysis = this.analyzeConnectivity(binaryMatrix, pixelsPerMm);
    const featureAnalysis = this.analyzeFeaturePoints(binaryMatrix, pixelsPerMm);
    const geometricAnalysis = this.analyzeGeometricFeatures(binaryMatrix, pixelsPerMm);
    
    // Calcola qualità immagine e rumore di sfondo
    const qualityMetrics = this.calculateImageQuality(imageMatrix, binaryMatrix);
    
    return {
      strokeWidth: strokeAnalysis,
      pressurePoints: pressureAnalysis,
      curvatureMetrics: curvatureAnalysis,
      spatialDistribution: spatialAnalysis,
      connectivity: connectivityAnalysis,
      featurePoints: featureAnalysis,
      geometricFeatures: geometricAnalysis,
      backgroundNoise: qualityMetrics.backgroundNoise,
      imageQuality: qualityMetrics.imageQuality,
      contrastLevel: qualityMetrics.contrastLevel,
    };
  }

  // ================ METODI DI ANALISI DELL'IMMAGINE ================

  /**
   * Calcola la soglia ottimale usando l'algoritmo di Otsu
   */
  private static calculateOtsuThreshold(buffer: Buffer): number {
    // Calcola l'istogramma
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < buffer.length; i++) {
      histogram[buffer[i]]++;
    }
    
    const total = buffer.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 0;
    
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      
      wF = total - wB;
      if (wF === 0) break;
      
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }
    
    return threshold;
  }

  /**
   * Applica sogliatura binaria alla matrice dell'immagine
   */
  private static applyThreshold(matrix: number[][], threshold: number): boolean[][] {
    return matrix.map(row => row.map(pixel => pixel < threshold));
  }

  /**
   * Analizza le caratteristiche del tratto
   */
  private static analyzeStrokeCharacteristics(binaryMatrix: boolean[][], pixelsPerMm: number) {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    let inkPixels = 0;
    let totalPixels = width * height;
    
    // Conta pixel di inchiostro
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binaryMatrix[y][x]) inkPixels++;
      }
    }
    
    // Analizza spessori usando morphological operations
    const strokeWidths = this.measureStrokeWidths(binaryMatrix);
    
    return {
      minMm: (strokeWidths.min || 1) / pixelsPerMm,
      maxMm: (strokeWidths.max || 1) / pixelsPerMm,
      meanMm: strokeWidths.mean / pixelsPerMm,
      variance: strokeWidths.variance,
      pixelCoverage: inkPixels / totalPixels,
    };
  }

  /**
   * Misura gli spessori reali del tratto usando distance transform
   * Calcola la distanza dal centro del tratto alle pareti per ottenere lo spessore effettivo
   */
  private static measureStrokeWidths(binaryMatrix: boolean[][]) {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    
    // Calcola distance transform per trovare la distanza da ogni pixel ai bordi
    const distanceMap = this.computeDistanceTransform(binaryMatrix);
    
    // Trova lo scheletro del tratto (medial axis)
    const skeleton = this.extractSkeleton(binaryMatrix, distanceMap);
    
    // Estrai le misure di spessore dai punti dello scheletro
    const widths: number[] = [];
    const maxSamples = 5000;
    
    for (let y = 0; y < height && widths.length < maxSamples; y++) {
      for (let x = 0; x < width && widths.length < maxSamples; x++) {
        if (skeleton[y][x]) {
          // Lo spessore in questo punto è 2 volte la distanza al bordo
          const thickness = distanceMap[y][x] * 2;
          if (thickness > 0.5) { // Filtro rumore (spessori sotto 0.5 pixel)
            widths.push(thickness);
          }
        }
      }
    }
    
    if (widths.length === 0) {
      // Fallback: calcolo approssimativo basato su area
      const strokeArea = this.calculateStrokeArea(binaryMatrix);
      const strokeLength = this.estimateStrokeLength(binaryMatrix);
      const avgWidth = strokeLength > 0 ? strokeArea / strokeLength : 1;
      return { min: avgWidth * 0.7, max: avgWidth * 1.3, mean: avgWidth, variance: 0.1 };
    }
    
    // Filtra outliers (rimuove il 5% più alto e più basso)
    widths.sort((a, b) => a - b);
    const startIdx = Math.floor(widths.length * 0.05);
    const endIdx = Math.floor(widths.length * 0.95);
    const filteredWidths = widths.slice(startIdx, endIdx);
    
    if (filteredWidths.length === 0) {
      return { min: 1, max: 1, mean: 1, variance: 0 };
    }
    
    const min = filteredWidths[0];
    const max = filteredWidths[filteredWidths.length - 1];
    const sum = filteredWidths.reduce((a, b) => a + b, 0);
    const mean = sum / filteredWidths.length;
    
    const varianceSum = filteredWidths.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    const variance = varianceSum / filteredWidths.length;
    
    return { min, max, mean, variance };
  }

  /**
   * Calcola la distance transform (distanza euclidea ai bordi)
   */
  private static computeDistanceTransform(binaryMatrix: boolean[][]): number[][] {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    const distanceMap: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
    
    // Inizializza: INF per pixel di inchiostro, 0 per background
    const INF = Math.max(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        distanceMap[y][x] = binaryMatrix[y][x] ? INF : 0;
      }
    }
    
    // Forward pass (da top-left a bottom-right)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (binaryMatrix[y][x]) {
          distanceMap[y][x] = Math.min(
            distanceMap[y][x],
            distanceMap[y-1][x] + 1,
            distanceMap[y][x-1] + 1,
            distanceMap[y-1][x-1] + 1.414,
            distanceMap[y-1][x+1] + 1.414
          );
        }
      }
    }
    
    // Backward pass (da bottom-right a top-left)
    for (let y = height - 2; y > 0; y--) {
      for (let x = width - 2; x > 0; x--) {
        if (binaryMatrix[y][x]) {
          distanceMap[y][x] = Math.min(
            distanceMap[y][x],
            distanceMap[y+1][x] + 1,
            distanceMap[y][x+1] + 1,
            distanceMap[y+1][x+1] + 1.414,
            distanceMap[y+1][x-1] + 1.414
          );
        }
      }
    }
    
    return distanceMap;
  }

  /**
   * Estrae lo scheletro del tratto (medial axis)
   */
  private static extractSkeleton(binaryMatrix: boolean[][], distanceMap: number[][]): boolean[][] {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    const skeleton: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (binaryMatrix[y][x] && distanceMap[y][x] > 1) {
          // Un punto appartiene allo scheletro se è un massimo locale della distance map
          const currentDist = distanceMap[y][x];
          let isLocalMax = true;
          
          // Controlla i 8 vicini
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dy === 0 && dx === 0) continue;
              if (distanceMap[y + dy][x + dx] > currentDist) {
                isLocalMax = false;
                break;
              }
            }
            if (!isLocalMax) break;
          }
          
          skeleton[y][x] = isLocalMax;
        }
      }
    }
    
    return skeleton;
  }

  /**
   * Calcola l'area approssimativa del tratto
   */
  private static calculateStrokeArea(binaryMatrix: boolean[][]): number {
    let area = 0;
    for (let y = 0; y < binaryMatrix.length; y++) {
      for (let x = 0; x < binaryMatrix[0].length; x++) {
        if (binaryMatrix[y][x]) area++;
      }
    }
    return area;
  }

  /**
   * Stima la lunghezza del tratto
   */
  private static estimateStrokeLength(binaryMatrix: boolean[][]): number {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    let length = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (binaryMatrix[y][x]) {
          // Conta connessioni ai vicini
          let connections = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dy === 0 && dx === 0) continue;
              if (binaryMatrix[y + dy][x + dx]) connections++;
            }
          }
          // Punti con poche connessioni contribuiscono di più alla lunghezza
          if (connections <= 3) length += 1;
        }
      }
    }
    
    return length;
  }

  /**
   * Analizza i punti di pressione basandosi sull'intensità
   */
  private static analyzePressurePoints(grayMatrix: number[][], binaryMatrix: boolean[][], pixelsPerMm: number) {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    let highPressureAreas = 0;
    let lightPressureAreas = 0;
    let pressureValues: number[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binaryMatrix[y][x]) {
          const intensity = 255 - grayMatrix[y][x]; // Inverti per avere valori alti = inchiostro denso
          pressureValues.push(intensity);
          
          if (intensity > 180) highPressureAreas++;
          else if (intensity < 100) lightPressureAreas++;
        }
      }
    }
    
    const avgPressure = pressureValues.length > 0 ? 
      pressureValues.reduce((a, b) => a + b, 0) / pressureValues.length : 0;
    const pressureVariation = pressureValues.length > 0 ?
      Math.sqrt(pressureValues.reduce((acc, val) => acc + Math.pow(val - avgPressure, 2), 0) / pressureValues.length) / 255 : 0;
    
    return {
      count: pressureValues.length,
      highPressureAreas,
      lightPressureAreas,
      pressureVariation,
    };
  }

  /**
   * Analizza la curvatura e la complessità del tratto
   */
  private static analyzeCurvature(binaryMatrix: boolean[][], pixelsPerMm: number) {
    // Estrae il contorno della firma
    const contours = this.extractContours(binaryMatrix);
    let totalCurveLength = 0;
    let sharpCorners = 0;
    let smoothCurves = 0;
    let curvatureSum = 0;
    
    contours.forEach(contour => {
      const curvatures = this.calculateCurvature(contour);
      totalCurveLength += contour.length / pixelsPerMm;
      
      curvatures.forEach(curvature => {
        curvatureSum += Math.abs(curvature);
        if (Math.abs(curvature) > 0.5) sharpCorners++;
        else if (Math.abs(curvature) > 0.1) smoothCurves++;
      });
    });
    
    return {
      totalCurveLength,
      sharpCorners,
      smoothCurves,
      averageCurvature: curvatureSum / Math.max(1, contours.flat().length),
    };
  }

  /**
   * Estrae i contorni dalla matrice binaria
   */
  private static extractContours(binaryMatrix: boolean[][]): Array<Array<{x: number, y: number}>> {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    const visited = Array.from({length: height}, () => new Array(width).fill(false));
    const contours: Array<Array<{x: number, y: number}>> = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binaryMatrix[y][x] && !visited[y][x]) {
          const contour = this.traceContour(binaryMatrix, visited, x, y);
          if (contour.length > 10) contours.push(contour);
        }
      }
    }
    
    return contours;
  }

  /**
   * Traccia un contorno partendo da un punto
   */
  private static traceContour(binaryMatrix: boolean[][], visited: boolean[][], startX: number, startY: number): Array<{x: number, y: number}> {
    const contour: Array<{x: number, y: number}> = [];
    const stack = [{x: startX, y: startY}];
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    
    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[y][x] || !binaryMatrix[y][x]) {
        continue;
      }
      
      visited[y][x] = true;
      contour.push({x, y});
      
      // Aggiungi vicini (8-connected)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({x: x + dx, y: y + dy});
        }
      }
    }
    
    return contour;
  }

  /**
   * Calcola la curvatura lungo un contorno
   */
  private static calculateCurvature(contour: Array<{x: number, y: number}>): number[] {
    const curvatures: number[] = [];
    
    for (let i = 1; i < contour.length - 1; i++) {
      const p1 = contour[i - 1];
      const p2 = contour[i];
      const p3 = contour[i + 1];
      
      // Calcola vettori
      const v1 = {x: p2.x - p1.x, y: p2.y - p1.y};
      const v2 = {x: p3.x - p2.x, y: p3.y - p2.y};
      
      // Calcola curvatura (cross product normalizzato)
      const cross = v1.x * v2.y - v1.y * v2.x;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      const curvature = mag1 * mag2 > 0 ? cross / (mag1 * mag2) : 0;
      curvatures.push(curvature);
    }
    
    return curvatures;
  }

  /**
   * Analizza la distribuzione spaziale della firma
   */
  private static analyzeSpatialDistribution(binaryMatrix: boolean[][]) {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    
    let sumX = 0, sumY = 0, inkPixels = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binaryMatrix[y][x]) {
          sumX += x;
          sumY += y;
          inkPixels++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    const centerOfMassX = inkPixels > 0 ? (sumX / inkPixels) / width : 0.5;
    const centerOfMassY = inkPixels > 0 ? (sumY / inkPixels) / height : 0.5;
    const inkDensity = inkPixels / (width * height);
    const boundingBoxArea = (maxX - minX) * (maxY - minY);
    const boundingBoxRatio = boundingBoxArea > 0 ? inkPixels / boundingBoxArea : 0;
    
    return {
      centerOfMassX,
      centerOfMassY,
      inkDensity,
      boundingBoxRatio,
    };
  }

  /**
   * Analizza la connettività e la struttura dei tratti
   */
  private static analyzeConnectivity(binaryMatrix: boolean[][], pixelsPerMm: number) {
    const contours = this.extractContours(binaryMatrix);
    const connectedComponents = contours.length;
    
    // Conta le interruzioni (gaps) nel tratto
    let gaps = 0;
    let totalStrokeLength = 0;
    let strokeComplexity = 0;
    
    contours.forEach(contour => {
      totalStrokeLength += contour.length / pixelsPerMm;
      
      // Stima la complessità basata sulla variabilità della direzione
      if (contour.length > 3) {
        const directions = [];
        for (let i = 1; i < contour.length; i++) {
          const dx = contour[i].x - contour[i-1].x;
          const dy = contour[i].y - contour[i-1].y;
          directions.push(Math.atan2(dy, dx));
        }
        
        let directionChanges = 0;
        for (let i = 1; i < directions.length; i++) {
          const angleDiff = Math.abs(directions[i] - directions[i-1]);
          if (angleDiff > Math.PI / 4) directionChanges++;
        }
        strokeComplexity += directionChanges / directions.length;
      }
    });
    
    // Stima gaps basata su componenti disconnessi
    gaps = Math.max(0, connectedComponents - 1);
    
    return {
      connectedComponents,
      gaps,
      totalStrokeLength,
      strokeComplexity: strokeComplexity / Math.max(1, contours.length),
    };
  }

  /**
   * Analizza i punti caratteristici della firma
   */
  private static analyzeFeaturePoints(binaryMatrix: boolean[][], pixelsPerMm: number) {
    const height = binaryMatrix.length;
    const width = binaryMatrix[0].length;
    
    // Trova punti di inizio e fine (estremi)
    let startPoint: [number, number] = [0, 0];
    let endPoint: [number, number] = [0, 0];
    let foundFirst = false;
    
    // Scansiona dall'alto verso il basso, da sinistra a destra
    for (let y = 0; y < height && !foundFirst; y++) {
      for (let x = 0; x < width; x++) {
        if (binaryMatrix[y][x]) {
          startPoint = [x / pixelsPerMm, y / pixelsPerMm];
          foundFirst = true;
          break;
        }
      }
    }
    
    // Scansiona dal basso verso l'alto, da destra a sinistra per l'ultimo punto
    let foundLast = false;
    for (let y = height - 1; y >= 0 && !foundLast; y--) {
      for (let x = width - 1; x >= 0; x--) {
        if (binaryMatrix[y][x]) {
          endPoint = [x / pixelsPerMm, y / pixelsPerMm];
          foundLast = true;
          break;
        }
      }
    }
    
    // Conta loop (regioni chiuse) e incroci
    const contours = this.extractContours(binaryMatrix);
    let loopPoints = 0;
    let crossPoints = 0;
    let ascenders = 0;
    let descenders = 0;
    
    // Analisi semplificata per loop e incroci
    contours.forEach(contour => {
      if (contour.length > 10) {
        const boundingBox = this.getContourBoundingBox(contour);
        const area = (boundingBox.maxX - boundingBox.minX) * (boundingBox.maxY - boundingBox.minY);
        const perimeter = contour.length;
        
        // Stima se è un loop basandosi sul rapporto area/perimetro
        const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
        if (compactness > 0.3) loopPoints++;
        
        // Conta ascenders e descenders basandosi sulla posizione relativa
        const avgY = contour.reduce((sum, p) => sum + p.y, 0) / contour.length;
        if (boundingBox.minY < avgY - 20) ascenders++;
        if (boundingBox.maxY > avgY + 20) descenders++;
      }
    });
    
    return {
      startPoint,
      endPoint,
      loopPoints,
      crossPoints,
      ascenders,
      descenders,
    };
  }

  /**
   * Calcola il bounding box di un contorno
   */
  private static getContourBoundingBox(contour: Array<{x: number, y: number}>) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    contour.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    
    return { minX, maxX, minY, maxY };
  }

  /**
   * Analizza caratteristiche geometriche avanzate
   */
  private static analyzeGeometricFeatures(binaryMatrix: boolean[][], pixelsPerMm: number) {
    const contours = this.extractContours(binaryMatrix);
    let slopeVariation = 0;
    let baselineConsistency = 0;
    const letterSpacing: number[] = [];
    const strokeAngles: number[] = [];
    
    contours.forEach(contour => {
      if (contour.length > 5) {
        // Calcola angoli di stroke
        for (let i = 1; i < contour.length - 1; i++) {
          const p1 = contour[i - 1];
          const p2 = contour[i + 1];
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
          strokeAngles.push(angle);
        }
      }
    });
    
    // Calcola variazione dell'angolo
    if (strokeAngles.length > 0) {
      const avgAngle = strokeAngles.reduce((a, b) => a + b, 0) / strokeAngles.length;
      slopeVariation = Math.sqrt(
        strokeAngles.reduce((acc, angle) => acc + Math.pow(angle - avgAngle, 2), 0) / strokeAngles.length
      ) / 180; // Normalizza a 0-1
    }
    
    // Stima spaziatura tra lettere basandosi su gap orizzontali
    const componentCenters = contours
      .filter(c => c.length > 10)
      .map(contour => {
        const avgX = contour.reduce((sum, p) => sum + p.x, 0) / contour.length;
        return avgX / pixelsPerMm;
      })
      .sort((a, b) => a - b);
    
    for (let i = 1; i < componentCenters.length; i++) {
      letterSpacing.push(componentCenters[i] - componentCenters[i - 1]);
    }
    
    // Stima consistenza baseline
    const yPositions = contours.flat().map(p => p.y);
    if (yPositions.length > 0) {
      const avgY = yPositions.reduce((a, b) => a + b, 0) / yPositions.length;
      const yVariance = yPositions.reduce((acc, y) => acc + Math.pow(y - avgY, 2), 0) / yPositions.length;
      baselineConsistency = Math.max(0, 1 - Math.sqrt(yVariance) / 50); // Normalizza
    }
    
    return {
      slopeVariation,
      baselineConsistency,
      letterSpacing,
      strokeAngles,
    };
  }

  /**
   * Calcola metriche di qualità dell'immagine
   */
  private static calculateImageQuality(grayMatrix: number[][], binaryMatrix: boolean[][]) {
    const height = grayMatrix.length;
    const width = grayMatrix[0].length;
    let backgroundSum = 0;
    let inkSum = 0;
    let backgroundPixels = 0;
    let inkPixels = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binaryMatrix[y][x]) {
          inkSum += grayMatrix[y][x];
          inkPixels++;
        } else {
          backgroundSum += grayMatrix[y][x];
          backgroundPixels++;
        }
      }
    }
    
    const avgBackground = backgroundPixels > 0 ? backgroundSum / backgroundPixels : 255;
    const avgInk = inkPixels > 0 ? inkSum / inkPixels : 0;
    
    const contrastLevel = Math.abs(avgBackground - avgInk) / 255;
    const backgroundNoise = backgroundPixels > 0 ? 
      Math.sqrt(grayMatrix.flat().filter((_, i) => !binaryMatrix[Math.floor(i / width)][i % width])
        .reduce((acc, val) => acc + Math.pow(val - avgBackground, 2), 0) / backgroundPixels) / 255 : 0;
    
    const imageQuality = Math.min(1, contrastLevel * (1 - backgroundNoise));
    
    return {
      backgroundNoise,
      imageQuality,
      contrastLevel,
    };
  }

  // ================ CONFRONTO FIRME ================

  /**
   * Confronta i parametri di una firma da verificare con quelli di un insieme di firme di riferimento
   * @param targetParameters Parametri della firma da verificare
   * @param referenceParameters Array di parametri delle firme di riferimento
   * @returns Valore di similitudine tra 0 e 1 (1 = completamente simile)
   */
  public static compareSignatures(
    targetParameters: SignatureParameters,
    referenceParameters: SignatureParameters[]
  ): number {
    if (!referenceParameters.length) {
      throw new Error('Nessuna firma di riferimento fornita per il confronto');
    }

    console.log(`Confrontando firma con ${referenceParameters.length} firme di riferimento`);

    // Calcola la similitudine media rispetto a tutte le firme di riferimento
    const similarities = referenceParameters.map(refParams => {
      // Similitudine del rapporto d'aspetto (con protezione completa contro valori non validi)
      const targetDims = targetParameters.realDimensions;
      const refDims = refParams.realDimensions;
      const targetAspect = targetParameters.aspectRatio || 
        (targetDims?.widthMm && targetDims?.heightMm ? targetDims.widthMm / targetDims.heightMm : 1.0);
      const refAspect = refParams.aspectRatio || 
        (refDims?.widthMm && refDims?.heightMm ? refDims.widthMm / refDims.heightMm : 1.0);
      const aspectRatioSim = (!isNaN(targetAspect) && !isNaN(refAspect)) ? 
        1 - Math.min(1, Math.abs(targetAspect - refAspect) / 2) : 0.5;
      
      // Similitudine dello spessore del tratto (in unità reali) - con protezione contro valori nulli
      const targetStroke = targetParameters.strokeWidth?.meanMm || 0;
      const refStroke = refParams.strokeWidth?.meanMm || 0;
      const strokeWidthSim = (targetStroke > 0 && refStroke > 0) ? 
        1 - Math.min(1, Math.abs(targetStroke - refStroke) / 2) : 0.5;
      
      // Similitudine della lunghezza totale del tratto - con protezione
      const targetLength = targetParameters.connectivity?.totalStrokeLength || 0;
      const refLength = refParams.connectivity?.totalStrokeLength || 0;
      const maxLength = Math.max(targetLength, refLength);
      const strokeLengthSim = (maxLength > 0) ? 
        1 - Math.min(1, Math.abs(targetLength - refLength) / maxLength) : 0.5;
      
      // Similitudine della distribuzione spaziale - con protezione
      const targetCenterX = targetParameters.spatialDistribution?.centerOfMassX || 0;
      const targetCenterY = targetParameters.spatialDistribution?.centerOfMassY || 0;
      const refCenterX = refParams.spatialDistribution?.centerOfMassX || 0;
      const refCenterY = refParams.spatialDistribution?.centerOfMassY || 0;
      const spatialDiff = Math.abs(targetCenterX - refCenterX) + Math.abs(targetCenterY - refCenterY);
      const spatialSim = 1 - Math.min(1, spatialDiff / 2);
      
      // Similitudine della complessità - con protezione
      const targetComplexity = targetParameters.connectivity?.strokeComplexity || 0;
      const refComplexity = refParams.connectivity?.strokeComplexity || 0;
      const complexitySim = 1 - Math.min(1, Math.abs(targetComplexity - refComplexity));
      
      // Similitudine dei punti caratteristici - con protezione
      const targetLoops = targetParameters.featurePoints?.loopPoints || 0;
      const refLoops = refParams.featurePoints?.loopPoints || 0;
      const featureSim = 1 - Math.min(1, Math.abs(targetLoops - refLoops) / 5);
      
      // Similitudine geometrica - con protezione  
      const targetSlope = targetParameters.geometricFeatures?.slopeVariation || 0;
      const refSlope = refParams.geometricFeatures?.slopeVariation || 0;
      const geometricSim = 1 - Math.min(1, Math.abs(targetSlope - refSlope));
      
      // Calcola il punteggio totale (media ponderata basata su importanza forense)
      let similarity = (
        aspectRatioSim * 0.10 +      // Forma generale
        strokeWidthSim * 0.20 +      // Spessore tratto (molto importante)
        strokeLengthSim * 0.15 +     // Lunghezza complessiva
        spatialSim * 0.15 +          // Distribuzione spaziale
        complexitySim * 0.15 +       // Complessità del movimento
        featureSim * 0.15 +          // Caratteristiche specifiche
        geometricSim * 0.10          // Variazioni geometriche
      );
      
      // Protezione finale contro NaN
      if (isNaN(similarity) || !isFinite(similarity)) {
        similarity = 0.5; // Valore neutro se c'è un problema nel calcolo
      }
      
      console.log(`Similitudine componenti: aspetto=${aspectRatioSim.toFixed(3)}, spessore=${strokeWidthSim.toFixed(3)}, lunghezza=${strokeLengthSim.toFixed(3)}, spaziale=${spatialSim.toFixed(3)}, complessità=${complexitySim.toFixed(3)}, caratteristiche=${featureSim.toFixed(3)}, geometria=${geometricSim.toFixed(3)} -> totale=${similarity.toFixed(3)}`);
      
      return similarity;
    });
    
    // Restituisci la media delle similitudini con protezione finale
    const validSimilarities = similarities.filter(sim => !isNaN(sim) && isFinite(sim));
    const finalSimilarity = validSimilarities.length > 0 ? 
      validSimilarities.reduce((sum, sim) => sum + sim, 0) / validSimilarities.length : 0.5;
    
    console.log(`Similitudine finale: ${finalSimilarity.toFixed(3)} (${validSimilarities.length}/${similarities.length} valori validi)`);
    
    return Math.max(0, Math.min(1, finalSimilarity)); // Assicura che sia tra 0 e 1
  }
}