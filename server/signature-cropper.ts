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
    
    // Soglia dinamica per determinare se un pixel è parte della firma
    const isLargeImage = width > 2000 || height > 2500;
    const threshold = isLargeImage ? 250 : 240;
    
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

    // Se non trovato con soglia normale, prova algoritmo avanzato per fogli A4
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
}