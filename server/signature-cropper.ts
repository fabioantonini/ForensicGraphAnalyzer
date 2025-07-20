import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

interface CropOptions {
  inputPath: string;
  outputPath?: string;
  targetSize?: { width: number; height: number };
  autoCrop?: boolean;
  cropBox?: { left: number; top: number; width: number; height: number };
}

interface CropResult {
  success: boolean;
  croppedPath?: string;
  originalDimensions: { width: number; height: number };
  croppedDimensions: { width: number; height: number };
  cropBox: { left: number; top: number; width: number; height: number };
  confidence: number;
  needsManualAdjustment: boolean;
  message: string;
}

export class SignatureCropper {
  
  /**
   * Rileva automaticamente i bordi della firma e la ritaglia
   */
  static async cropSignature(options: CropOptions): Promise<CropResult> {
    const { inputPath, outputPath, targetSize } = options;
    
    try {
      console.log(`[CROP] Inizio ritaglio per: ${inputPath}`);
      
      // Carica l'immagine con Sharp
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      console.log(`[CROP] Metadata immagine: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Impossibile leggere le dimensioni dell\'immagine');
      }

      const originalDimensions = {
        width: metadata.width,
        height: metadata.height
      };

      // Converti in scala di grigi per analisi
      console.log(`[CROP] Conversione in scala di grigi...`);
      const grayscaleBuffer = await image
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      console.log(`[CROP] Buffer scala di grigi: ${grayscaleBuffer.info.width}x${grayscaleBuffer.info.height}, canali: ${grayscaleBuffer.info.channels}`);

      // Trova i bordi non vuoti
      const bounds = await this.findSignatureBounds(
        grayscaleBuffer.data,
        grayscaleBuffer.info.width,
        grayscaleBuffer.info.height
      );
      
      console.log(`[CROP] Bounds calcolati:`, bounds);

      // Calcola la confidenza basata sui bordi trovati
      const confidence = this.calculateConfidence(bounds, originalDimensions);
      console.log(`[CROP] Confidenza calcolata: ${confidence}`);
      
      // Aggiungi margine per evitare tagli troppo stretti
      const margin = Math.min(bounds.width, bounds.height) * 0.05; // 5% di margine
      console.log(`[CROP] Margine calcolato: ${margin}`);
      
      const left = Math.max(0, bounds.left - margin);
      const top = Math.max(0, bounds.top - margin);
      const right = Math.min(originalDimensions.width, bounds.left + bounds.width + margin);
      const bottom = Math.min(originalDimensions.height, bounds.top + bounds.height + margin);
      
      console.log(`[CROP] Coordinate intermedie: left=${left}, top=${top}, right=${right}, bottom=${bottom}`);
      
      const cropBox = {
        left: left,
        top: top,
        width: right - left,
        height: bottom - top
      };
      
      console.log(`[CROP] CropBox finale:`, cropBox);

      // Validazione delle dimensioni del crop
      if (cropBox.width <= 0 || cropBox.height <= 0) {
        throw new Error(`Dimensioni crop invalide: ${cropBox.width}x${cropBox.height}`);
      }

      if (cropBox.left < 0 || cropBox.top < 0 || 
          cropBox.left + cropBox.width > originalDimensions.width ||
          cropBox.top + cropBox.height > originalDimensions.height) {
        throw new Error(`Coordinate crop fuori dai limiti dell'immagine`);
      }

      // Determina il path di output
      const finalOutputPath = outputPath || this.generateCroppedPath(inputPath);
      
      // Esegui il ritaglio
      let croppedImage = image.extract({
        left: Math.round(Math.max(0, cropBox.left)),
        top: Math.round(Math.max(0, cropBox.top)),
        width: Math.round(Math.min(cropBox.width, originalDimensions.width - cropBox.left)),
        height: Math.round(Math.min(cropBox.height, originalDimensions.height - cropBox.top))
      });

      // Ridimensiona se richiesto
      if (targetSize) {
        croppedImage = croppedImage.resize(targetSize.width, targetSize.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
      }

      await croppedImage.jpeg({ quality: 95 }).toFile(finalOutputPath);

      // Ottieni le dimensioni finali
      const finalMetadata = await sharp(finalOutputPath).metadata();
      const croppedDimensions = {
        width: finalMetadata.width || targetSize?.width || cropBox.width,
        height: finalMetadata.height || targetSize?.height || cropBox.height
      };

      return {
        success: true,
        croppedPath: finalOutputPath,
        originalDimensions,
        croppedDimensions,
        cropBox,
        confidence,
        needsManualAdjustment: confidence < 0.6,
        message: this.generateMessage(confidence, bounds, originalDimensions)
      };

    } catch (error: any) {
      return {
        success: false,
        originalDimensions: { width: 0, height: 0 },
        croppedDimensions: { width: 0, height: 0 },
        cropBox: { left: 0, top: 0, width: 0, height: 0 },
        confidence: 0,
        needsManualAdjustment: true,
        message: `Errore durante il ritaglio: ${error.message}`
      };
    }
  }

  /**
   * Ritaglio manuale con coordinate specificate
   */
  static async cropManual(
    inputPath: string,
    cropBox: { left: number; top: number; width: number; height: number },
    outputPath?: string,
    targetSize?: { width: number; height: number }
  ): Promise<CropResult> {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Impossibile leggere le dimensioni dell\'immagine');
      }

      const originalDimensions = {
        width: metadata.width,
        height: metadata.height
      };

      // Valida le coordinate
      const validatedCropBox = {
        left: Math.max(0, Math.min(cropBox.left, originalDimensions.width - 1)),
        top: Math.max(0, Math.min(cropBox.top, originalDimensions.height - 1)),
        width: Math.min(cropBox.width, originalDimensions.width - cropBox.left),
        height: Math.min(cropBox.height, originalDimensions.height - cropBox.top)
      };

      const finalOutputPath = outputPath || this.generateCroppedPath(inputPath);
      
      // Esegui il ritaglio manuale
      let croppedImage = image.extract({
        left: Math.round(validatedCropBox.left),
        top: Math.round(validatedCropBox.top),
        width: Math.round(validatedCropBox.width),
        height: Math.round(validatedCropBox.height)
      });

      // Ridimensiona se richiesto
      if (targetSize) {
        croppedImage = croppedImage.resize(targetSize.width, targetSize.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
      }

      await croppedImage.jpeg({ quality: 95 }).toFile(finalOutputPath);

      const finalMetadata = await sharp(finalOutputPath).metadata();
      const croppedDimensions = {
        width: finalMetadata.width || targetSize?.width || validatedCropBox.width,
        height: finalMetadata.height || targetSize?.height || validatedCropBox.height
      };

      return {
        success: true,
        croppedPath: finalOutputPath,
        originalDimensions,
        croppedDimensions,
        cropBox: validatedCropBox,
        confidence: 1.0, // Manuale = massima confidenza
        needsManualAdjustment: false,
        message: 'Ritaglio manuale completato con successo'
      };

    } catch (error: any) {
      return {
        success: false,
        originalDimensions: { width: 0, height: 0 },
        croppedDimensions: { width: 0, height: 0 },
        cropBox,
        confidence: 0,
        needsManualAdjustment: true,
        message: `Errore durante il ritaglio manuale: ${error.message}`
      };
    }
  }

  /**
   * Trova i bordi della firma nell'immagine
   */
  private static async findSignatureBounds(
    pixels: Buffer,
    width: number,
    height: number
  ): Promise<{ left: number; top: number; width: number; height: number }> {
    
    // Per fogli A4 grandi, usa sempre l'algoritmo avanzato
    const isLargeImage = width > 2000 || height > 2500;
    
    if (isLargeImage) {
      console.log(`[FORCE] Immagine A4 rilevata ${width}x${height}, forzando algoritmo avanzato...`);
      return this.findSignatureBoundsAdvanced(pixels, width, height);
    }
    
    const threshold = 240;
    console.log(`[DEBUG] Immagine normale ${width}x${height}, threshold=${threshold}`);
    
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    // Prima passata: scansiona tutti i pixel per trovare i bounds
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        const pixelValue = pixels[pixelIndex];
        
        if (pixelValue < threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Per fogli A4, prova sempre l'algoritmo avanzato se i bounds coprono >80% dell'immagine
    if (isLargeImage && maxX !== -1) {
      const foundWidth = maxX - minX + 1;
      const foundHeight = maxY - minY + 1;
      const coverage = (foundWidth * foundHeight) / (width * height);
      
      console.log(`[DEBUG] Coverage calcolata: ${(coverage*100).toFixed(1)}% (${foundWidth}x${foundHeight} su ${width}x${height})`);
      
      if (coverage > 0.8) {
        console.log(`Prima scansione ha coperto ${(coverage*100).toFixed(1)}% dell'immagine, provo algoritmo avanzato per A4...`);
        return this.findSignatureBoundsAdvanced(pixels, width, height);
      } else {
        console.log(`[DEBUG] Coverage ${(coverage*100).toFixed(1)}% sotto soglia 80%, uso bounds normali`);
      }
    }

    // Se non trovato nulla, prova algoritmo avanzato per fogli A4
    if (maxX === -1 && isLargeImage) {
      console.log('Prima scansione fallita, provo algoritmo avanzato per A4...');
      return this.findSignatureBoundsAdvanced(pixels, width, height);
    }

    // Se non sono stati trovati pixel della firma, usa l'intera immagine
    if (maxX === -1) {
      console.log('Nessun pixel della firma rilevato, usando intera immagine');
      return {
        left: 0,
        top: 0,
        width: width,
        height: height
      };
    }

    const bounds = {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };

    console.log(`Bounds rilevati: left=${bounds.left}, top=${bounds.top}, width=${bounds.width}, height=${bounds.height}`);
    return bounds;
  }

  /**
   * Calcola la confidenza del ritaglio automatico
   */
  private static calculateConfidence(
    bounds: { left: number; top: number; width: number; height: number },
    originalDimensions: { width: number; height: number }
  ): number {
    // Calcola la percentuale di spazio vuoto rimosso
    const originalArea = originalDimensions.width * originalDimensions.height;
    const croppedArea = bounds.width * bounds.height;
    const areaReduction = 1 - (croppedArea / originalArea);
    
    // Calcola il rapporto di aspetto della firma
    const aspectRatio = bounds.width / bounds.height;
    const aspectScore = aspectRatio > 0.3 && aspectRatio < 10 ? 1 : 0.5; // Firme realistiche
    
    // Calcola la dimensione relativa della firma
    const sizeScore = croppedArea > (originalArea * 0.01) ? 1 : 0.5; // Almeno 1% dell'immagine
    
    // Confidenza finale
    let confidence = (areaReduction * 0.6) + (aspectScore * 0.3) + (sizeScore * 0.1);
    
    // Bonus se c'è una significativa riduzione di spazio vuoto
    if (areaReduction > 0.5) {
      confidence += 0.2;
    }
    
    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Genera un messaggio descrittivo del risultato
   */
  private static generateMessage(
    confidence: number,
    bounds: { left: number; top: number; width: number; height: number },
    originalDimensions: { width: number; height: number }
  ): string {
    const areaReduction = 1 - ((bounds.width * bounds.height) / (originalDimensions.width * originalDimensions.height));
    const reductionPercent = (areaReduction * 100).toFixed(1);
    
    if (confidence >= 0.8) {
      return `Ritaglio automatico riuscito! Rimosso ${reductionPercent}% di spazio vuoto con alta precisione.`;
    } else if (confidence >= 0.6) {
      return `Ritaglio completato con confidenza media. Rimosso ${reductionPercent}% di spazio vuoto. Verifica il risultato.`;
    } else {
      return `Ritaglio automatico con bassa confidenza. Rimosso ${reductionPercent}% di spazio. Considera un ritaglio manuale per risultati migliori.`;
    }
  }

  /**
   * Genera il path per la versione ritagliata
   */
  private static generateCroppedPath(originalPath: string): string {
    const parsedPath = path.parse(originalPath);
    const timestamp = Date.now();
    return path.join(parsedPath.dir, `${parsedPath.name}_cropped_${timestamp}${parsedPath.ext}`);
  }

  /**
   * Genera un'anteprima del ritaglio senza salvare
   */
  static async previewCrop(
    inputPath: string,
    cropBox?: { left: number; top: number; width: number; height: number }
  ): Promise<{ previewBase64: string; bounds?: any }> {
    try {
      const image = sharp(inputPath);
      
      let previewImage;
      let bounds;
      
      if (cropBox) {
        // Anteprima con coordinate specifiche
        previewImage = image.extract({
          left: Math.round(cropBox.left),
          top: Math.round(cropBox.top),
          width: Math.round(cropBox.width),
          height: Math.round(cropBox.height)
        });
      } else {
        // Anteprima con ritaglio automatico
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) {
          throw new Error('Impossibile leggere le dimensioni dell\'immagine');
        }

        const grayscaleBuffer = await image
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });

        bounds = await this.findSignatureBounds(
          grayscaleBuffer.data,
          grayscaleBuffer.info.width,
          grayscaleBuffer.info.height
        );

        previewImage = image.extract({
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height
        });
      }

      // Ridimensiona per anteprima
      const previewBuffer = await previewImage
        .resize(400, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 85 })
        .toBuffer();

      const previewBase64 = `data:image/jpeg;base64,${previewBuffer.toString('base64')}`;
      
      return { previewBase64, bounds };
      
    } catch (error: any) {
      throw new Error(`Errore nella generazione dell'anteprima: ${error.message}`);
    }
  }

  /**
   * Algoritmo avanzato per rilevare firme piccole su fogli A4
   */
  private static async findSignatureBoundsAdvanced(
    pixels: Buffer,
    width: number,
    height: number
  ): Promise<{ left: number; top: number; width: number; height: number }> {
    
    console.log('[ADVANCED] Inizio algoritmo avanzato per firme piccole...');
    
    // Multiple soglie per catturare firme molto chiare
    const thresholds = [245, 240, 235, 230];
    
    for (const threshold of thresholds) {
      console.log(`[ADVANCED] Provo soglia ${threshold}...`);
      
      let minX = width;
      let maxX = -1;
      let minY = height;
      let maxY = -1;
      let pixelCount = 0;

      // Scansiona con soglia più sensibile
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = y * width + x;
          const pixelValue = pixels[pixelIndex];
          
          if (pixelValue < threshold) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            pixelCount++;
          }
        }
      }

      // Verifica se i bounds sono ragionevoli per una firma
      if (maxX !== -1) {
        const foundWidth = maxX - minX + 1;
        const foundHeight = maxY - minY + 1;
        const area = foundWidth * foundHeight;
        const imageArea = width * height;
        const areaRatio = area / imageArea;
        
        console.log(`[ADVANCED] Soglia ${threshold}: trovati ${pixelCount} pixel, area ratio: ${areaRatio.toFixed(4)}`);
        console.log(`[ADVANCED] Bounds: ${foundWidth}x${foundHeight} at (${minX},${minY})`);
        
        // Per fogli A4, cerca firme che occupano una percentuale ragionevole dell'area
        // Ma non troppo poco (rumore) e non troppo tanto (intera pagina)
        const pixelDensity = pixelCount / (foundWidth * foundHeight);
        
        console.log(`[ADVANCED] Densità pixel: ${(pixelDensity*100).toFixed(2)}% nell'area trovata`);
        
        // Se l'area copre meno del 90% dell'immagine e ha una densità ragionevole
        if (areaRatio < 0.9 && pixelDensity > 0.02 && pixelCount > 500) {
          console.log(`[ADVANCED] ✓ Firma rilevata con soglia ${threshold}! Area=${(areaRatio*100).toFixed(1)}%, densità=${(pixelDensity*100).toFixed(2)}%`);
          return {
            left: minX,
            top: minY,
            width: foundWidth,
            height: foundHeight
          };
        }
      }
    }

    // Se nemmeno l'algoritmo avanzato trova nulla, prova sampling a griglia
    console.log('[ADVANCED] Provo sampling a griglia...');
    return this.findSignatureByGridSampling(pixels, width, height);
  }

  /**
   * Algoritmo di sampling a griglia per firme molto chiare
   */
  private static async findSignatureByGridSampling(
    pixels: Buffer,
    width: number,
    height: number
  ): Promise<{ left: number; top: number; width: number; height: number }> {
    
    const gridSize = 100; // Griglia più grossolana per evitare rumore
    const threshold = 210; // Soglia più bassa per catturare firme deboli
    
    console.log(`[GRID] Analisi densità regioni ${Math.floor(width/gridSize)}x${Math.floor(height/gridSize)} con soglia ${threshold}`);

    // Array per memorizzare densità per ogni cella
    const gridDensities: number[][] = [];
    const gridRows = Math.floor(height / gridSize);
    const gridCols = Math.floor(width / gridSize);
    
    // Calcola densità per ogni cella
    for (let gridY = 0; gridY < gridRows; gridY++) {
      gridDensities[gridY] = [];
      for (let gridX = 0; gridX < gridCols; gridX++) {
        let darkPixels = 0;
        let totalPixels = 0;

        // Campiona tutti i pixel di questa cella
        for (let dy = 0; dy < gridSize && (gridY * gridSize + dy) < height; dy += 5) {
          for (let dx = 0; dx < gridSize && (gridX * gridSize + dx) < width; dx += 5) {
            const y = gridY * gridSize + dy;
            const x = gridX * gridSize + dx;
            const pixelIndex = y * width + x;
            const pixelValue = pixels[pixelIndex];
            
            if (pixelValue < threshold) {
              darkPixels++;
            }
            totalPixels++;
          }
        }

        const density = totalPixels > 0 ? darkPixels / totalPixels : 0;
        gridDensities[gridY][gridX] = density;
      }
    }
    
    // Trova la densità media e massima
    let totalDensity = 0;
    let maxDensity = 0;
    let cellCount = 0;
    
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const density = gridDensities[gy][gx];
        totalDensity += density;
        maxDensity = Math.max(maxDensity, density);
        cellCount++;
      }
    }
    
    const avgDensity = totalDensity / cellCount;
    
    console.log(`[GRID] Densità media: ${(avgDensity*100).toFixed(2)}%, massima: ${(maxDensity*100).toFixed(2)}%`);
    
    // Usa una soglia dinamica basata sulla densità media
    const dynamicThreshold = Math.max(avgDensity * 3, 0.15); // Almeno 3x la media o 15%
    
    console.log(`[GRID] Soglia dinamica densità: ${(dynamicThreshold*100).toFixed(2)}%`);
    
    let minGridX = gridCols;
    let maxGridX = -1;
    let minGridY = gridRows;
    let maxGridY = -1;
    let validCells = 0;

    // Trova celle che superano la soglia dinamica
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        if (gridDensities[gy][gx] > dynamicThreshold) {
          minGridX = Math.min(minGridX, gx);
          maxGridX = Math.max(maxGridX, gx);
          minGridY = Math.min(minGridY, gy);
          maxGridY = Math.max(maxGridY, gy);
          validCells++;
        }
      }
    }

    if (maxGridX !== -1 && validCells >= 3) { // Almeno 3 celle valide
      // Converti coordinate griglia in pixel con margine
      const margin = gridSize / 2;
      const left = Math.max(0, minGridX * gridSize - margin);
      const top = Math.max(0, minGridY * gridSize - margin);
      const right = Math.min(width, (maxGridX + 1) * gridSize + margin);
      const bottom = Math.min(height, (maxGridY + 1) * gridSize + margin);
      
      const finalWidth = right - left;
      const finalHeight = bottom - top;
      const coverageRatio = (finalWidth * finalHeight) / (width * height);
      
      console.log(`[GRID] ✓ ${validCells} celle dense trovate, bounds: ${finalWidth}x${finalHeight} (copertura ${(coverageRatio*100).toFixed(1)}%)`);
      
      // Se la copertura è ragionevole, usa questi bounds
      if (coverageRatio < 0.8) {
        return {
          left: left,
          top: top,
          width: finalWidth,
          height: finalHeight
        };
      } else {
        console.log(`[GRID] Copertura troppo alta (${(coverageRatio*100).toFixed(1)}%), usando fallback`);
      }
    } else {
      console.log(`[GRID] Solo ${validCells} celle valide trovate (minimum: 3)`);
    }

    // Ultimo fallback: usa intera immagine
    console.log('[GRID] Nessuna firma concentrata rilevata, uso intera immagine come fallback');
    return {
      left: 0,
      top: 0,
      width: width,
      height: height
    };
  }
}