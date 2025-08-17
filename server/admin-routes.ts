import express, { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { 
  sendEmail,
  isEmailServiceConfigured
} from "./email-service";
import {
  loadSendGridConfig,
  saveSendGridConfig,
  SendGridConfig,
  testSendGridConfiguration,
  isSendGridConfigured
} from "./sendgrid-service";
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
      // Ad esempio: numero di utenti, documenti, query, ecc.
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
        stats.totalSize = await storage.getStorageUsed();
      } catch (e) {
        console.error("Error getting storage used:", e);
      }

      res.json(stats);
    } catch (error) {
      console.error("Errore nel recupero delle statistiche:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per eliminare un utente (solo admin)
  adminRouter.delete("/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
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

  // Rotta per ottenere la configurazione SendGrid (solo admin)
  adminRouter.get("/sendgrid-config", async (req, res) => {
    try {
      const config = await loadSendGridConfig();
      // Non inviare la API key al client
      const safeConfig = { 
        ...config, 
        apiKey: config.apiKey ? "********" : "" 
      };
      res.json(safeConfig);
    } catch (error) {
      console.error("Errore nel recupero della configurazione SendGrid:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per testare la configurazione SendGrid
  adminRouter.post("/test-sendgrid", async (req, res) => {
    try {
      // Verifica se SendGrid è configurato
      if (!await isSendGridConfigured()) {
        return res.status(400).json({ message: "SendGrid non configurato" });
      }
      
      // Invia un'email di test all'utente loggato
      const success = await testSendGridConfiguration(req.user!.email);
      
      if (success) {
        res.json({ message: "Email di test inviata con successo" });
      } else {
        res.status(500).json({ message: "Invio email di test fallito" });
      }
    } catch (error) {
      console.error("Errore nel test della configurazione SendGrid:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per aggiornare la configurazione SendGrid
  adminRouter.post("/sendgrid-config", async (req, res) => {
    try {
      const config = req.body as SendGridConfig;
      
      // Valida la configurazione SendGrid
      if (config.isConfigured) {
        if (!config.apiKey && config.apiKey !== "********") {
          return res.status(400).json({ message: "API Key SendGrid mancante" });
        }
        if (!config.senderEmail) {
          return res.status(400).json({ message: "Email mittente mancante" });
        }
      }

      // Se l'API key è "********", mantieni quella esistente
      if (config.apiKey === "********") {
        const currentConfig = await loadSendGridConfig();
        config.apiKey = currentConfig.apiKey;
      }

      await saveSendGridConfig(config);
      
      // Se la configurazione è stata disabilitata o aggiornata con successo
      if (!config.isConfigured) {
        res.json({ message: "Configurazione SendGrid disabilitata" });
      } else {
        // Testa la configurazione
        const testEmail = req.user!.email;
        const success = await sendEmail(
          testEmail,
          "Test Configurazione SendGrid",
          "<p>Questa è un'email di test per verificare la configurazione di SendGrid.</p>"
        );

        if (success) {
          res.json({ message: "Configurazione SendGrid aggiornata e testata con successo" });
        } else {
          res.status(500).json({ message: "Configurazione salvata ma test fallito. Verifica i parametri." });
        }
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento della configurazione SendGrid:", error);
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
      // Utilizziamo createUser invece di createDemoUser se il metodo specifico non esiste
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
        // Fallback se createDemoUser non è disponibile
        user = await storage.createUser({
          username,
          password,
          confirmPassword: password, // Aggiungiamo confirmPassword
          email,
          fullName: fullName || null,
          organization: organization || null,
          profession: profession || null
        });
      }

      res.status(201).json({ 
        message: "Account demo creato con successo",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName
        }
      });
    } catch (error) {
      console.error("Errore nella creazione dell'account demo:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per estendere la durata di un account demo (solo admin)
  adminRouter.post("/extend-demo/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { durationDays } = req.body;

      if (!durationDays || durationDays <= 0) {
        return res.status(400).json({ message: "Durata di estensione non valida" });
      }

      // Controlla se l'utente esiste
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Se il metodo specifico esiste, usa quello
      if (typeof storage.extendDemoAccount === 'function') {
        try {
          const updatedUser = await storage.extendDemoAccount(userId, parseInt(durationDays.toString()));
          
          res.json({ 
            message: "Durata dell'account demo estesa con successo",
            user: {
              id: updatedUser.id,
              username: updatedUser.username,
              email: updatedUser.email,
              demoExpiresAt: updatedUser.demoExpiresAt
            }
          });
        } catch (error) {
          console.error("Errore nell'estensione dell'account demo:", error);
          res.status(500).json({ message: "Errore durante l'estensione dell'account demo" });
        }
      } else {
        // Fallback se extendDemoAccount non è disponibile
        res.status(501).json({ message: "Funzionalità non implementata" });
      }
    } catch (error) {
      console.error("Errore nell'estensione dell'account demo:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Registra le rotte di amministrazione
  app.use("/api/admin", adminRouter);
}