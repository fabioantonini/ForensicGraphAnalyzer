import express, { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { 
  sendEmail,
  isEmailServiceConfigured
} from "./email-service";
import {
  loadGmailConfig,
  saveGmailConfig,
  GmailConfig,
  testGmailConfiguration,
  isGmailConfigured
} from "./gmail-service";

// Funzione per verificare se l'utente è un amministratore
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
}

// Configurazione delle rotte di amministrazione
export function setupAdminRoutes(app: Express) {
  // Middleware per verificare se l'utente è un amministratore
  const adminRouter = express.Router();
  adminRouter.use(isAdmin);

  // Rotta per ottenere tutti gli utenti (solo admin)
  adminRouter.get("/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Errore nel recupero degli utenti:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per ottenere statistiche del sistema (solo admin)
  adminRouter.get("/stats", async (req, res) => {
    try {
      // Implementa la logica per ottenere statistiche
      const stats = {
        userCount: 0,
        documentCount: 0,
        queryCount: 0,
        totalSize: 0,
        newUsers: []
      };
      
      try {
        stats.userCount = await storage.getUserCount();
      } catch (e) {
        console.error("Error getting user count:", e);
      }
      
      try {
        stats.documentCount = await storage.getDocumentCount();
      } catch (e) {
        console.error("Error getting document count:", e);
      }

      try {
        stats.queryCount = await storage.getQueryCount();
      } catch (e) {
        console.error("Error getting query count:", e);
      }

      try {
        stats.totalSize = await storage.getTotalStorageSize();
      } catch (e) {
        console.error("Error getting storage size:", e);
      }

      try {
        stats.newUsers = await storage.getRecentUsers(5);
      } catch (e) {
        console.error("Error getting recent users:", e);
      }

      res.json(stats);
    } catch (error) {
      console.error("Errore nelle statistiche:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per modificare il ruolo di un utente (solo admin)
  adminRouter.put("/users/:userId/role", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { role } = req.body;

      if (!role || (role !== "admin" && role !== "user")) {
        return res.status(400).json({ message: "Ruolo non valido" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Non consentire di modificare il proprio ruolo
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Non puoi modificare il tuo ruolo" });
      }

      await storage.updateUserRole(userId, role);
      
      res.status(200).json({ message: "Ruolo aggiornato con successo" });
    } catch (error) {
      console.error("Errore nella modifica del ruolo:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per eliminare un utente (solo admin)
  adminRouter.delete("/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Non consentire l'eliminazione dell'utente stesso
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Non puoi eliminare il tuo account" });
      }

      // Controlla se l'utente esiste
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Elimina l'utente
      await storage.deleteUser(userId);
      
      res.status(200).json({ message: "Utente eliminato con successo" });
    } catch (error) {
      console.error("Errore nell'eliminazione dell'utente:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // ====== GMAIL CONFIGURATION ROUTES ======
  
  // Rotta per ottenere la configurazione Gmail
  adminRouter.get("/gmail-config", async (req, res) => {
    try {
      const config = await loadGmailConfig();
      // Non inviare la password al client
      const safeConfig = { 
        ...config, 
        appPassword: config.appPassword ? "********" : "" 
      };
      res.json(safeConfig);
    } catch (error) {
      console.error("Errore nel recupero della configurazione Gmail:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per testare la configurazione Gmail
  adminRouter.post("/test-gmail", async (req, res) => {
    try {
      // Verifica se Gmail è configurato
      if (!await isGmailConfigured()) {
        return res.status(400).json({ message: "Gmail non configurato" });
      }
      
      // Invia un'email di test all'utente loggato
      const success = await testGmailConfiguration(req.user!.email);
      
      if (success) {
        res.json({ message: "Email di test inviata con successo tramite Gmail" });
      } else {
        res.status(500).json({ message: "Invio email di test fallito" });
      }
    } catch (error) {
      console.error("Errore nel test della configurazione Gmail:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per aggiornare la configurazione Gmail
  adminRouter.post("/gmail-config", async (req, res) => {
    try {
      const config = req.body as GmailConfig;
      
      // Valida la configurazione Gmail
      if (config.isConfigured) {
        if (!config.email) {
          return res.status(400).json({ message: "Email Gmail mancante" });
        }
        if (!config.appPassword && config.appPassword !== "********") {
          return res.status(400).json({ message: "Password App Gmail mancante" });
        }
      }

      // Se la password è "********", mantieni quella esistente
      if (config.appPassword === "********") {
        const currentConfig = await loadGmailConfig();
        config.appPassword = currentConfig.appPassword;
      }

      await saveGmailConfig(config);
      
      // Se la configurazione è stata disabilitata o aggiornata con successo
      if (!config.isConfigured) {
        res.json({ message: "Configurazione Gmail disabilitata" });
      } else {
        // Testa la configurazione
        const testEmail = req.user!.email;
        const success = await sendEmail(
          testEmail,
          "Test Configurazione Gmail SMTP",
          "<p>Questa è un'email di test per verificare la configurazione di Gmail SMTP per GrapholexInsight.</p><p>Se ricevi questa email, la configurazione funziona correttamente! 🎉</p>"
        );

        if (success) {
          res.json({ message: "Configurazione Gmail aggiornata e testata con successo" });
        } else {
          res.status(500).json({ message: "Configurazione salvata ma test fallito. Verifica i parametri." });
        }
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento della configurazione Gmail:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per creare un account demo (solo admin)
  adminRouter.post("/create-demo-account", async (req, res) => {
    try {
      const { username, email, password, durationDays, fullName, organization, profession } = req.body;

      // Validazione base
      if (!username || !email || !password || !durationDays) {
        return res.status(400).json({ message: "Dati mancanti per la creazione dell'account demo" });
      }

      // Controlla se username o email esistono già
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome utente già in uso" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email già in uso" });
      }

      // Crea l'account demo
      let user;
      if (typeof storage.createDemoUser === 'function') {
        user = await storage.createDemoUser({
          username,
          email,
          password,
          durationDays: parseInt(durationDays.toString()),
          fullName: fullName || null,
          organization: organization || null,
          profession: profession || null
        });
      } else {
        // Fallback usando createUser con expiresAt calcolato
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + parseInt(durationDays.toString()));
        
        user = await storage.createUser({
          username,
          email,
          password,
          fullName: fullName || null,
          organization: organization || null,
          profession: profession || null,
          accountType: "demo" as any,
          demoExpiresAt: expirationDate
        });
      }

      res.status(201).json({ 
        message: "Account demo creato con successo",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          accountType: user.accountType || "demo"
        }
      });
    } catch (error) {
      console.error("Errore nella creazione dell'account demo:", error);
      res.status(500).json({ message: "Errore nella creazione dell'account demo" });
    }
  });

  // Rotta per configurazione generale email
  adminRouter.get("/email-config", async (req, res) => {
    try {
      const isConfigured = await isEmailServiceConfigured();
      const gmailConfigured = await isGmailConfigured();
      
      res.json({
        isConfigured,
        providers: {
          gmail: gmailConfigured
        }
      });
    } catch (error) {
      console.error("Errore nella configurazione email:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Stato del sistema di pulizia automatica
  adminRouter.get("/cleanup/status", async (req, res) => {
    try {
      const { getCleanupStatus } = await import('./demo-cleanup-scheduler');
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
      
      const { runManualCleanup } = await import('./demo-cleanup-scheduler');
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

  // Monta le rotte admin
  app.use("/api/admin", adminRouter);
}