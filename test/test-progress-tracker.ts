/**
 * Script di test per verificare il funzionamento del progress tracker
 */

import {
  initProgress,
  updateProgress,
  completeProgress,
  failProgress,
  getProgress,
  getProgressPercentage,
  getEstimatedTimeRemaining,
  clearProgress
} from '../server/progress-tracker';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("Test del progress tracker");
  
  // Simula l'elaborazione di un documento con ID 9999
  const documentId = 9999;
  const totalChunks = 5;
  
  console.log(`Inizializzazione progresso per documento ${documentId} con ${totalChunks} chunks`);
  initProgress(documentId, totalChunks);
  
  let progress = getProgress(documentId);
  console.log("Stato iniziale:", progress);
  console.log("Percentuale di completamento:", getProgressPercentage(documentId), "%");
  
  // Simulazione dell'elaborazione
  for (let i = 0; i < totalChunks; i++) {
    await sleep(500); // Attendi 500ms per simulare l'elaborazione
    
    updateProgress(documentId, i + 1);
    progress = getProgress(documentId);
    
    console.log(`Chunk ${i + 1}/${totalChunks} elaborato`);
    console.log("Percentuale di completamento:", getProgressPercentage(documentId), "%");
    console.log("Tempo stimato rimanente:", getEstimatedTimeRemaining(documentId), "secondi");
  }
  
  // Segna come completato
  completeProgress(documentId);
  progress = getProgress(documentId);
  console.log("Stato finale:", progress);
  
  // Test del caso di errore
  console.log("\nTest del caso di errore");
  const errorDocumentId = 8888;
  initProgress(errorDocumentId, 10);
  updateProgress(errorDocumentId, 3); // Elaborati 3 chunks
  
  // Simula un errore
  failProgress(errorDocumentId, "Errore di test durante l'elaborazione");
  
  const errorProgress = getProgress(errorDocumentId);
  console.log("Stato con errore:", errorProgress);
  
  // Pulizia
  clearProgress(documentId);
  clearProgress(errorDocumentId);
  
  console.log("\nTest completato");
}

main().catch(error => {
  console.error("Errore durante l'esecuzione del test:", error);
  process.exit(1);
});