import express, { Express, Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { sendEmail, isEmailServiceConfigured } from "./email-service";

// Percorso del file per memorizzare la configurazione email
const EMAIL_CONFIG_PATH = path.join(process.cwd(), ".email-config.json");

// Interfaccia per la configurazione email
interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string | null; // null se non è stato modificato
  isConfigured: boolean;
}

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

// Funzione per caricare la configurazione email dal file
async function loadEmailConfig(): Promise<EmailConfig> {
  try {
    const data = await fs.readFile(EMAIL_CONFIG_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    // Se il file non esiste, restituisci una configurazione vuota
    return {
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "",
      smtpPassword: null,
      isConfigured: false,
    };
  }
}

// Funzione per salvare la configurazione email nel file
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
}