import { storage } from "./storage";

/**
 * Sistema automatico di pulizia account demo scaduti
 * - Disattiva account scaduti ogni ora
 * - Elimina dati dopo il periodo di conservazione ogni giorno
 */

let cleanupInterval: NodeJS.Timeout | null = null;
let purgeInterval: NodeJS.Timeout | null = null;

/**
 * Avvia il sistema di pulizia automatica degli account demo
 */
export function startDemoCleanupScheduler() {
  console.log("[DEMO-CLEANUP] Avvio sistema pulizia automatica account demo");
  
  // Task ogni ora: disattiva account scaduti
  cleanupInterval = setInterval(async () => {
    try {
      console.log("[DEMO-CLEANUP] Controllo account demo scaduti...");
      const deactivatedCount = await storage.deactivateExpiredDemoAccounts();
      
      if (deactivatedCount > 0) {
        console.log(`[DEMO-CLEANUP] ✅ Disattivati ${deactivatedCount} account demo scaduti`);
      } else {
        console.log("[DEMO-CLEANUP] Nessun account demo da disattivare");
      }
    } catch (error) {
      console.error("[DEMO-CLEANUP] ❌ Errore durante disattivazione account demo:", error);
    }
  }, 60 * 60 * 1000); // Ogni ora

  // Task ogni 6 ore: elimina dati dopo periodo di conservazione
  purgeInterval = setInterval(async () => {
    try {
      console.log("[DEMO-CLEANUP] Controllo dati demo da eliminare...");
      const dataToPurge = await storage.getDataForPurge(0); // 0 giorni = elimina tutto scaduto
      
      if (dataToPurge.length > 0) {
        console.log(`[DEMO-CLEANUP] Trovati ${dataToPurge.length} account con dati da eliminare`);
        
        let totalPurged = 0;
        for (const accountData of dataToPurge) {
          try {
            // Elimina tutti i dati dell'utente
            await storage.deleteUserData(accountData.userId);
            totalPurged++;
            console.log(`[DEMO-CLEANUP] ✅ Eliminati dati utente ${accountData.userId} (${accountData.documents.length} documenti)`);
          } catch (error) {
            console.error(`[DEMO-CLEANUP] ❌ Errore eliminazione dati utente ${accountData.userId}:`, error);
          }
        }
        
        console.log(`[DEMO-CLEANUP] ✅ Pulizia completata: ${totalPurged}/${dataToPurge.length} account eliminati`);
      } else {
        console.log("[DEMO-CLEANUP] Nessun dato demo da eliminare");
      }
    } catch (error) {
      console.error("[DEMO-CLEANUP] ❌ Errore durante eliminazione dati demo:", error);
    }
  }, 6 * 60 * 60 * 1000); // Ogni 6 ore

  console.log("[DEMO-CLEANUP] ✅ Sistema pulizia automatica avviato");
  console.log("[DEMO-CLEANUP] - Disattivazione account scaduti: ogni ora");  
  console.log("[DEMO-CLEANUP] - Eliminazione dati scaduti: ogni 6 ore");
}

/**
 * Ferma il sistema di pulizia automatica
 */
export function stopDemoCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[DEMO-CLEANUP] Task disattivazione account fermato");
  }
  
  if (purgeInterval) {
    clearInterval(purgeInterval);
    purgeInterval = null;
    console.log("[DEMO-CLEANUP] Task eliminazione dati fermato");
  }
  
  console.log("[DEMO-CLEANUP] ✅ Sistema pulizia automatica fermato");
}

/**
 * Esegue immediatamente la pulizia manuale
 */
export async function runManualCleanup(): Promise<{ deactivated: number; purged: number }> {
  console.log("[DEMO-CLEANUP] Avvio pulizia manuale...");
  
  try {
    // Disattiva account scaduti
    const deactivatedCount = await storage.deactivateExpiredDemoAccounts();
    console.log(`[DEMO-CLEANUP] Disattivati ${deactivatedCount} account demo scaduti`);
    
    // Elimina dati scaduti
    const dataToPurge = await storage.getDataForPurge(0);
    let purgedCount = 0;
    
    for (const accountData of dataToPurge) {
      try {
        await storage.deleteUserData(accountData.userId);
        purgedCount++;
        console.log(`[DEMO-CLEANUP] Eliminati dati utente ${accountData.userId}`);
      } catch (error) {
        console.error(`[DEMO-CLEANUP] Errore eliminazione utente ${accountData.userId}:`, error);
      }
    }
    
    console.log(`[DEMO-CLEANUP] ✅ Pulizia manuale completata: ${deactivatedCount} disattivati, ${purgedCount} eliminati`);
    
    return { deactivated: deactivatedCount, purged: purgedCount };
  } catch (error) {
    console.error("[DEMO-CLEANUP] ❌ Errore durante pulizia manuale:", error);
    throw error;
  }
}

/**
 * Ottieni statistiche sui task di pulizia
 */
export function getCleanupStatus(): { active: boolean; nextCleanup: Date | null; nextPurge: Date | null } {
  const now = new Date();
  
  return {
    active: cleanupInterval !== null && purgeInterval !== null,
    nextCleanup: cleanupInterval ? new Date(now.getTime() + 60 * 60 * 1000) : null, // +1 ora
    nextPurge: purgeInterval ? new Date(now.getTime() + 6 * 60 * 60 * 1000) : null // +6 ore
  };
}