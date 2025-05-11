import express, { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { 
  sendEmail, 
  EmailServiceType,
  EmailServiceConfig,
  loadEmailConfig,
  saveEmailConfig
} from "./email-service";
import {
  generateAuthUrl,
  getTokenFromCode,
  GmailConfig,
  loadGmailConfig,
  saveGmailConfig,
  isGmailServiceConfigured
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
      
      try {
        // Try to get new users in the last 7 days if the method exists
        if (typeof storage.getNewUsers === 'function') {
          stats.newUsers = await storage.getNewUsers(7);
        }
      } catch (e) {
        console.error("Error getting new users:", e);
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

  // Rotta per ottenere la configurazione email (solo admin)
  adminRouter.get("/email-config", async (req, res) => {
    try {
      const config = await loadEmailConfig();
      // Non inviare la password al client
      const safeConfig = { 
        ...config, 
        smtpPassword: config.smtpPassword ? "********" : null 
      };
      res.json(safeConfig);
    } catch (error) {
      console.error("Errore nel recupero della configurazione email:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per ottenere la configurazione Gmail (solo admin)
  adminRouter.get("/gmail-config", async (req, res) => {
    try {
      const config = await loadGmailConfig();
      // Non inviare il client secret al client
      const safeConfig = { 
        ...config, 
        clientSecret: config.clientSecret ? "********" : "" 
      };
      res.json(safeConfig);
    } catch (error) {
      console.error("Errore nel recupero della configurazione Gmail:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per aggiornare la configurazione email SMTP (solo admin)
  adminRouter.post("/email-config", async (req, res) => {
    try {
      const config = req.body as EmailServiceConfig;
      
      // Valida la configurazione per SMTP
      if (config.type === EmailServiceType.SMTP && config.isConfigured) {
        if (!config.smtpHost) {
          return res.status(400).json({ message: "Host SMTP mancante" });
        }
        if (!config.smtpPort) {
          return res.status(400).json({ message: "Porta SMTP mancante" });
        }
        if (!config.smtpUser) {
          return res.status(400).json({ message: "Utente SMTP mancante" });
        }
      }

      await saveEmailConfig(config);
      
      // Se la configurazione è stata disabilitata o aggiornata con successo
      if (!config.isConfigured) {
        res.json({ message: "Configurazione email disabilitata" });
      } else {
        // Testa la configurazione
        const testEmail = req.user!.email;
        const success = await sendEmail(
          testEmail,
          "Test Configurazione Email",
          "<p>Questa è un'email di test per verificare la configurazione del server email.</p>"
        );

        if (success) {
          res.json({ message: "Configurazione email aggiornata e testata con successo" });
        } else {
          res.status(500).json({ message: "Configurazione salvata ma test fallito. Verifica i parametri." });
        }
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento della configurazione email:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Rotta per aggiornare la configurazione Gmail (solo admin)
  adminRouter.post("/gmail-config", async (req, res) => {
    try {
      const config = req.body as GmailConfig;
      
      // Valida la configurazione Gmail
      if (config.isConfigured) {
        if (!config.clientId) {
          return res.status(400).json({ message: "Client ID mancante" });
        }
        if (!config.clientSecret) {
          // Se il client secret è "********", non è stato modificato
          const currentConfig = await loadGmailConfig();
          if (currentConfig.clientSecret) {
            config.clientSecret = currentConfig.clientSecret;
          } else {
            return res.status(400).json({ message: "Client Secret mancante" });
          }
        }
        if (!config.redirectUri) {
          return res.status(400).json({ message: "URI di reindirizzamento mancante" });
        }
      }

      await saveGmailConfig(config);
      
      // Se la configurazione è stata disabilitata o non c'è ancora un refresh token
      if (!config.isConfigured || !config.refreshToken) {
        if (!config.isConfigured) {
          res.json({ message: "Configurazione Gmail disabilitata" });
        } else {
          // Genera l'URL di autorizzazione
          const authUrl = generateAuthUrl(config);
          res.json({ 
            message: "Configurazione Gmail salvata. Autorizzazione richiesta.", 
            authUrl 
          });
        }
      } else {
        // Se abbiamo già un refresh token, testiamo la configurazione
        const testEmail = req.user!.email;
        const success = await sendEmail(
          testEmail,
          "Test Configurazione Gmail",
          "<p>Questa è un'email di test per verificare la configurazione dell'API Gmail.</p>"
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

  // Rotta per gestire il callback OAuth di Gmail
  adminRouter.get("/gmail-auth-callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Codice di autorizzazione mancante" });
      }

      // Carica la configurazione Gmail corrente
      const config = await loadGmailConfig();
      
      if (!config.isConfigured || !config.clientId || !config.clientSecret) {
        return res.status(400).json({ message: "Configurazione Gmail non valida" });
      }

      // Ottieni il refresh token dal codice di autorizzazione
      const refreshToken = await getTokenFromCode(config, code);
      
      // Aggiorna la configurazione con il refresh token
      config.refreshToken = refreshToken;
      await saveGmailConfig(config);

      // Reindirizza all'interfaccia di amministrazione
      res.redirect('/admin?gmailConfigured=true');
    } catch (error) {
      console.error("Errore nell'elaborazione del callback OAuth:", error);
      res.status(500).json({ message: "Errore nell'elaborazione del callback OAuth" });
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
          email,
          confirmPassword: password,
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