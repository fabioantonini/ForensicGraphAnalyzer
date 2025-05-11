/**
 * Modulo per il tracciamento del progresso delle operazioni asincrone
 * Usato principalmente per monitorare il caricamento di documenti nel vector datastore
 */

// Map che associa ID del documento con lo stato di avanzamento
interface ProgressInfo {
  totalChunks: number;
  processedChunks: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  startTime: number;
  endTime?: number;
}

const progressMap = new Map<number, ProgressInfo>();

/**
 * Inizializza il tracciamento del progresso per un documento
 * @param documentId ID del documento
 * @param totalChunks Numero totale di chunk da processare
 */
export function initProgress(documentId: number, totalChunks: number): void {
  progressMap.set(documentId, {
    totalChunks,
    processedChunks: 0,
    status: 'pending',
    startTime: Date.now()
  });
}

/**
 * Aggiorna il progresso di elaborazione di un documento
 * @param documentId ID del documento
 * @param processedChunks Numero di chunk processati finora
 */
export function updateProgress(documentId: number, processedChunks: number): void {
  const progress = progressMap.get(documentId);
  if (progress) {
    progress.processedChunks = processedChunks;
    progress.status = 'processing';
  }
}

/**
 * Segna il completamento dell'elaborazione di un documento
 * @param documentId ID del documento
 */
export function completeProgress(documentId: number): void {
  const progress = progressMap.get(documentId);
  if (progress) {
    progress.processedChunks = progress.totalChunks;
    progress.status = 'completed';
    progress.endTime = Date.now();
  }
}

/**
 * Segna il fallimento dell'elaborazione di un documento
 * @param documentId ID del documento
 * @param error Messaggio di errore
 */
export function failProgress(documentId: number, error: string): void {
  const progress = progressMap.get(documentId);
  if (progress) {
    progress.status = 'failed';
    progress.error = error;
    progress.endTime = Date.now();
  }
}

/**
 * Ottiene lo stato di avanzamento di un documento
 * @param documentId ID del documento
 * @returns Informazioni sullo stato di avanzamento
 */
export function getProgress(documentId: number): ProgressInfo | undefined {
  return progressMap.get(documentId);
}

/**
 * Trasferisce le informazioni di progresso da un ID temporaneo a un ID documento reale
 * Utile quando iniziamo il tracciamento prima di avere l'ID del documento
 * @param tempId ID temporaneo usato inizialmente
 * @param realId ID reale del documento
 * @returns true se il trasferimento è riuscito, false altrimenti
 */
export function transferProgress(tempId: number, realId: number): boolean {
  const progress = progressMap.get(tempId);
  if (!progress) return false;
  
  // Copia il progress al nuovo ID
  progressMap.set(realId, {
    ...progress,
    // Preserviamo il tempo di inizio originale
    startTime: progress.startTime
  });
  
  // Rimuovi il tracker temporaneo
  progressMap.delete(tempId);
  
  return true;
}

/**
 * Calcola la percentuale di completamento
 * @param documentId ID del documento
 * @returns Percentuale di completamento (0-100)
 */
export function getProgressPercentage(documentId: number): number {
  const progress = progressMap.get(documentId);
  if (!progress) return 0;
  
  if (progress.totalChunks === 0) return 100;
  return Math.round((progress.processedChunks / progress.totalChunks) * 100);
}

/**
 * Rimuove le informazioni di avanzamento per un documento (pulizia)
 * @param documentId ID del documento
 */
export function clearProgress(documentId: number): void {
  progressMap.delete(documentId);
}

/**
 * Calcola il tempo stimato rimanente in secondi
 * @param documentId ID del documento
 * @returns Tempo stimato rimanente in secondi, o undefined se non calcolabile
 */
export function getEstimatedTimeRemaining(documentId: number): number | undefined {
  const progress = progressMap.get(documentId);
  if (!progress || progress.processedChunks === 0 || progress.status !== 'processing') return undefined;
  
  const elapsedTime = Date.now() - progress.startTime;
  const processedPercentage = progress.processedChunks / progress.totalChunks;
  
  // Se abbiamo elaborato almeno una parte, possiamo stimare il tempo rimanente
  if (processedPercentage > 0) {
    const totalEstimatedTime = elapsedTime / processedPercentage;
    const remainingTime = totalEstimatedTime - elapsedTime;
    return Math.round(remainingTime / 1000); // Converti in secondi
  }
  
  return undefined;
}