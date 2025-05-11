import express, { Express, Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { 
  sendEmail, 
  isEmailServiceConfigured, 
  generatePasswordResetToken, 
  verifyPasswordResetToken,
  invalidatePasswordResetToken,
  sendPasswordResetEmail,
  EmailServiceType,
  EmailServiceConfig,
  loadEmailConfig as getEmailConfig,
  saveEmailConfig
} from "./email-service";
import {
  generateAuthUrl,
  getTokenFromCode,
  GmailConfig,
  loadGmailConfig,
  saveGmailConfig
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

// Funzione per salvare la configurazione email
async function saveEmailConfig(config: EmailConfig): Promise<void> {
  // Se la password è vuota e c'è già una configurazione, mantieni la password attuale
  if (!config.smtpPassword) {
    try {
      const existingConfig = await loadEmailConfig();
      if (existingConfig.smtpPassword) {
        config.smtpPassword = existingConfig.smtpPassword;
      }
    } catch (error) {
      // Ignora errori
    }
  }

  // Imposta isConfigured a true se tutti i campi obbligatori sono presenti
  config.isConfigured = !!(
    config.smtpHost &&
    config.smtpPort &&
    config.smtpUser &&
    config.smtpPassword
  );

  // Salva la configurazione nel file
  await fs.writeFile(EMAIL_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  // Aggiorna le variabili d'ambiente
  process.env.SMTP_HOST = config.smtpHost;
  process.env.SMTP_PORT = config.smtpPort.toString();
  process.env.SMTP_SECURE = config.smtpSecure.toString();
  process.env.SMTP_USER = config.smtpUser;
  if (config.smtpPassword) {
    process.env.SMTP_PASSWORD = config.smtpPassword;
  }
}

// Funzione per configurare le rotte di amministrazione
export function setupAdminRoutes(app: Express) {
  // Applica il middleware isAdmin a tutte le rotte di amministrazione
  app.use("/api/admin", isAdmin);

  // Ottieni configurazione email
  app.get("/api/admin/email-config", async (req, res) => {
    try {
      const config = await loadEmailConfig();
      
      // Non inviare la password al client per sicurezza
      // ma invia un indicatore se è impostata
      const safeConfig = {
        ...config,
        smtpPassword: config.smtpPassword ? true : null,
      };

      res.status(200).json(safeConfig);
    } catch (error) {
      console.error("Error loading email config:", error);
      res.status(500).json({ message: "Failed to load email configuration" });
    }
  });

  // Salva configurazione email
  app.post("/api/admin/email-config", async (req, res) => {
    try {
      const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword } = req.body;

      const config: EmailConfig = {
        smtpHost,
        smtpPort: parseInt(smtpPort, 10),
        smtpSecure: !!smtpSecure,
        smtpUser,
        smtpPassword: smtpPassword || null,
        isConfigured: false, // Sarà aggiornato da saveEmailConfig
      };

      await saveEmailConfig(config);

      // Crea un'attività per registrare la modifica
      await storage.createActivity({
        userId: req.user!.id,
        type: "email_config_update",
        details: "Email configuration updated",
      });

      res.status(200).json({ message: "Email configuration saved successfully" });
    } catch (error) {
      console.error("Error saving email config:", error);
      res.status(500).json({ message: "Failed to save email configuration" });
    }
  });

  // Test dell'invio di email
  app.post("/api/admin/test-email", async (req, res) => {
    try {
      if (!isEmailServiceConfigured()) {
        return res.status(400).json({ message: "Email service is not configured" });
      }

      const adminEmail = req.user!.email;
      const testSubject = "GrapholexInsight - Test Email";
      const testContent = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <div style="background-color: #4f46e5; padding: 20px; color: white; text-align: center; border-radius: 5px 5px 0 0;">
            <h1 style="margin: 0;">GrapholexInsight</h1>
            <p>Test Email</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 5px 5px;">
            <p>Ciao,</p>
            <p>Questa è un'email di test inviata da GrapholexInsight.</p>
            <p>Se stai ricevendo questa email, la configurazione del servizio email è corretta.</p>
            <p>Data e ora del test: ${new Date().toLocaleString()}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">Questa email è stata inviata automaticamente. Si prega di non rispondere a questa email.</p>
          </div>
        </div>
      `;

      const emailSent = await sendEmail(adminEmail, testSubject, testContent);

      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send test email" });
      }

      // Crea un'attività per registrare il test
      await storage.createActivity({
        userId: req.user!.id,
        type: "email_test",
        details: "Email test sent",
      });

      res.status(200).json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email: " + (error as Error).message });
    }
  });
  
  // Le seguenti rotte NON richiedono autenticazione
  
  // Rotta per richiedere il reset della password
  app.post("/api/request-password-reset", async (req, res) => {
    try {
      const { email, locale = 'it' } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email richiesta" });
      }
      
      // Verifica se il servizio email è configurato
      if (!isEmailServiceConfigured()) {
        return res.status(500).json({ message: "Il servizio email non è configurato. Contatta l'amministratore." });
      }
      
      // Trova l'utente con questa email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Per sicurezza, non rivelare che l'utente non esiste
        return res.json({ 
          success: true, 
          message: "Se l'indirizzo è associato a un account, riceverai un'email con le istruzioni per reimpostare la password." 
        });
      }
      
      // Genera un token di reset
      const token = await generatePasswordResetToken(user.id);
      
      // Costruisci il link di reset
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      
      // Invia l'email
      const emailSent = await sendPasswordResetEmail(email, resetLink, locale);
      
      // Registra l'attività
      await storage.createActivity({
        userId: user.id,
        type: "password_reset_request",
        details: "Password reset requested"
      });
      
      res.json({ 
        success: true, 
        message: "Se l'indirizzo è associato a un account, riceverai un'email con le istruzioni per reimpostare la password." 
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Errore nella richiesta di reset password" });
    }
  });
  
  // Rotta per verificare il token di reset
  app.get("/api/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token mancante o non valido" });
      }
      
      // Verifica il token
      const userId = verifyPasswordResetToken(token);
      
      if (!userId) {
        return res.json({ valid: false, message: "Token non valido o scaduto" });
      }
      
      res.json({ valid: true });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ valid: false, message: "Errore nella verifica del token" });
    }
  });
  
  // Rotta per reimpostare la password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token e nuova password richiesti" });
      }
      
      // Verifica il token
      const userId = verifyPasswordResetToken(token);
      
      if (!userId) {
        return res.status(400).json({ message: "Token non valido o scaduto" });
      }
      
      // Trova l'utente
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }
      
      // Aggiorna la password dell'utente
      const success = await storage.updateUserPassword(userId, newPassword);
      
      if (success) {
        // Invalida il token dopo l'uso
        invalidatePasswordResetToken(token);
        
        // Registra l'attività
        await storage.createActivity({
          userId,
          type: "password_reset_complete",
          details: "Password reset completed"
        });
        
        res.json({ success: true, message: "Password aggiornata con successo" });
      } else {
        res.status(500).json({ message: "Errore nell'aggiornamento della password" });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Errore nel reset della password" });
    }
  });
}