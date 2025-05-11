/**
 * Utility per la gestione delle immagini
 */
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { log } from './vite';

/**
 * Estrae il DPI dai metadati di un'immagine
 * @param filePath Percorso del file immagine
 * @returns Promise con il valore DPI, o null se non disponibile
 */
export async function extractDPIFromImage(filePath: string): Promise<number | null> {
  try {
    // Verifica che il file esista
    await fs.access(filePath);
    
    log(`Tentativo di estrazione DPI dai metadati dell'immagine: ${filePath}`, 'image-utils');
    
    const metadata = await sharp(filePath).metadata();
    
    // Sharp può estrarre la densità dell'immagine in DPI
    if (metadata.density) {
      log(`DPI estratto dall'immagine: ${metadata.density}`, 'image-utils');
      return metadata.density;
    }
    
    // Se non trovato, restituisce null
    log(`Nessun metadata DPI trovato nell'immagine ${path.basename(filePath)}`, 'image-utils');
    return null;
  } catch (error: any) {
    log(`Errore nell'estrazione del DPI: ${error.message}`, 'image-utils');
    return null;
  }
}

/**
 * Estrae e calcola il DPI più adatto per un'immagine
 * Se il DPI è nei metadati, utilizza quello
 * Altrimenti restituisce il default
 * 
 * @param filePath Percorso del file immagine
 * @param defaultDPI Valore DPI di default (300)
 * @returns Promise con il valore DPI determinato
 */
export async function determineBestDPI(filePath: string, defaultDPI: number = 300): Promise<number> {
  try {
    const extractedDPI = await extractDPIFromImage(filePath);
    
    if (extractedDPI) {
      // Validazione del DPI estratto - deve essere un valore ragionevole
      if (extractedDPI >= 72 && extractedDPI <= 1200) {
        log(`Usando DPI estratto dall'immagine: ${extractedDPI}`, 'image-utils');
        return extractedDPI;
      }
      log(`DPI estratto (${extractedDPI}) fuori dall'intervallo valido, usando default ${defaultDPI}`, 'image-utils');
    }
    
    // Fallback al valore default
    log(`Nessun DPI valido trovato, usando default: ${defaultDPI}`, 'image-utils');
    return defaultDPI;
  } catch (error: any) {
    log(`Errore nella determinazione del DPI: ${error.message}, usando default: ${defaultDPI}`, 'image-utils');
    return defaultDPI;
  }
}