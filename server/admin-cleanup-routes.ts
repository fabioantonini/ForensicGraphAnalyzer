import { Router } from "express";
import { runManualCleanup, getCleanupStatus } from "./demo-cleanup-scheduler";
import { storage } from "./storage";

/**
 * Rotte amministrative per gestione pulizia account demo
 */
export function registerAdminCleanupRoutes(adminRouter: Router) {
  
  // Stato del sistema di pulizia automatica
  adminRouter.get("/cleanup/status", async (req, res) => {
    try {
      const status = getCleanupStatus();
      
      // Aggiungi statistiche aggiuntive
      const demoAccounts = await storage.getDemoAccountsExpiringIn(365); // Tutti gli account demo
      const expiredAccounts = await storage.getDemoAccountsExpiringIn(-1); // Account già scaduti
      const dataToPurge = await storage.getDataForPurge(0); // Dati da eliminare
      
      res.json({
        scheduler: status,
        statistics: {
          totalDemoAccounts: demoAccounts.length,
          expiredAccounts: expiredAccounts.length,
          accountsReadyForPurge: dataToPurge.length,
          documentsReadyForPurge: dataToPurge.reduce((sum, account) => sum + account.documents.length, 0)
        }
      });
    } catch (error) {
      console.error("Errore nel recupero stato pulizia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Esecuzione manuale pulizia
  adminRouter.post("/cleanup/run", async (req, res) => {
    try {
      console.log("[ADMIN] Richiesta pulizia manuale account demo");
      
      const result = await runManualCleanup();
      
      res.json({
        message: "Pulizia manuale completata con successo",
        result: {
          accountsDeactivated: result.deactivated,
          accountsPurged: result.purged
        }
      });
    } catch (error) {
      console.error("Errore durante pulizia manuale:", error);
      res.status(500).json({ 
        message: "Errore durante pulizia manuale",
        error: error instanceof Error ? error.message : "Errore sconosciuto"
      });
    }
  });

  // Lista account demo in scadenza
  adminRouter.get("/cleanup/expiring/:days", async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 7;
      const expiringAccounts = await storage.getDemoAccountsExpiringIn(days);
      
      const accountsInfo = expiringAccounts.map(account => ({
        id: account.id,
        username: account.username,
        email: account.email,
        demoExpiresAt: account.demoExpiresAt,
        dataRetentionUntil: account.dataRetentionUntil,
        isActive: account.isActive,
        createdAt: account.createdAt
      }));
      
      res.json({
        accounts: accountsInfo,
        count: accountsInfo.length,
        criteria: `Account demo che scadono nei prossimi ${days} giorni`
      });
    } catch (error) {
      console.error("Errore nel recupero account in scadenza:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Lista dati pronti per eliminazione
  adminRouter.get("/cleanup/purge-ready", async (req, res) => {
    try {
      const dataToPurge = await storage.getDataForPurge(0);
      
      res.json({
        accounts: dataToPurge,
        count: dataToPurge.length,
        totalDocuments: dataToPurge.reduce((sum, account) => sum + account.documents.length, 0),
        criteria: "Account demo con periodo di conservazione dati scaduto"
      });
    } catch (error) {
      console.error("Errore nel recupero dati per eliminazione:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });
}