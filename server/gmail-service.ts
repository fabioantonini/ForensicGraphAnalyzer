import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

const GMAIL_CONFIG_PATH = path.join(process.cwd(), '.gmail-config.json');

export interface GmailConfig {
  email: string;
  appPassword: string;
  isConfigured: boolean;
}

/**
 * Carica la configurazione Gmail
 * @returns Configurazione Gmail
 */
export async function loadGmailConfig(): Promise<GmailConfig> {
  try {
    // Verifica se esiste il file di configurazione
    try {
      await fs.access(GMAIL_CONFIG_PATH);
    } catch (error) {
      // Se il file non esiste, crea una configurazione vuota
      await fs.writeFile(
        GMAIL_CONFIG_PATH,
        JSON.stringify({
          email: "",
          appPassword: "",
          isConfigured: false
        }, null, 2),
        "utf8"
      );
    }

    // Leggi la configurazione
    const configStr = await fs.readFile(GMAIL_CONFIG_PATH, "utf8");
    const config = JSON.parse(configStr) as GmailConfig;

    // Se abbiamo variabili d'ambiente, usale come fallback
    if (process.env.GMAIL_EMAIL && !config.email) {
      config.email = process.env.GMAIL_EMAIL;
    }
    if (process.env.GMAIL_APP_PASSWORD && !config.appPassword) {
      config.appPassword = process.env.GMAIL_APP_PASSWORD;
    }

    // Verifica se la configurazione è valida
    config.isConfigured = !!(config.email && config.appPassword);

    return config;
  } catch (error) {
    console.error("Errore nel caricamento della configurazione Gmail:", error);
    
    // Ritorna una configurazione vuota
    return {
      email: process.env.GMAIL_EMAIL || "",
      appPassword: process.env.GMAIL_APP_PASSWORD || "",
      isConfigured: !!(process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD)
    };
  }
}

/**
 * Salva la configurazione Gmail
 * @param config Configurazione da salvare
 */
export async function saveGmailConfig(config: GmailConfig): Promise<void> {
  try {
    // Aggiorna le variabili d'ambiente
    if (config.email) {
      process.env.GMAIL_EMAIL = config.email;
    }
    if (config.appPassword) {
      process.env.GMAIL_APP_PASSWORD = config.appPassword;
    }

    // Verifica se la configurazione è valida
    config.isConfigured = !!(config.email && config.appPassword);

    // Salva la configurazione
    await fs.writeFile(
      GMAIL_CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Errore nel salvataggio della configurazione Gmail:", error);
    throw error;
  }
}

/**
 * Crea transporter per Gmail SMTP
 * @param config Configurazione Gmail
 * @returns Transporter configurato
 */
function createGmailTransporter(config: GmailConfig) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email,
      pass: config.appPassword
    }
  });
}

/**
 * Invia un'email utilizzando Gmail SMTP
 * @param to Indirizzo email del destinatario
 * @param subject Oggetto dell'email
 * @param html Contenuto HTML dell'email
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendEmailWithGmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const config = await loadGmailConfig();
    
    if (!config.isConfigured) {
      console.error("Gmail non configurato");
      return false;
    }

    const transporter = createGmailTransporter(config);

    // Invia l'email
    await transporter.sendMail({
      from: `GrapholexInsight <${config.email}>`,
      to,
      subject,
      html
    });

    console.log(`Email inviata con successo a ${to} via Gmail`);
    return true;
  } catch (error) {
    console.error("Errore nell'invio dell'email con Gmail:", error);
    
    // Messaggi di errore più specifici per debug
    if (error.code === 'EAUTH') {
      console.error("❌ GMAIL AUTH ERROR: Username/Password non accettati");
      console.error("🔧 Verifica: 1) Verifica in 2 passaggi attiva 2) Password app corretta 3) Account Gmail corretto");
    }
    return false;
  }
}

/**
 * Verifica se Gmail è configurato correttamente
 * @returns true se Gmail è configurato correttamente
 */
export async function isGmailConfigured(): Promise<boolean> {
  try {
    const config = await loadGmailConfig();
    return config.isConfigured;
  } catch (error) {
    return false;
  }
}

/**
 * Invia un'email di test per verificare la configurazione Gmail
 * @param to Indirizzo email di destinazione per il test
 * @returns Promise che si risolve a true se il test è riuscito
 */
export async function testGmailConfiguration(to: string): Promise<boolean> {
  return sendEmailWithGmail(
    to,
    "Test Configurazione Gmail SMTP",
    "<p>Questa è un'email di test per verificare la configurazione di Gmail SMTP per GrapholexInsight.</p><p>Se ricevi questa email, la configurazione funziona correttamente! 🎉</p>"
  );
}

/**
 * Invia un'email per il reset della password utilizzando Gmail
 * @param to Indirizzo email del destinatario
 * @param resetLink Link per il reset della password
 * @param locale Lingua dell'utente per l'internazionalizzazione
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendPasswordResetEmailWithGmail(to: string, resetLink: string, locale: string = 'it'): Promise<boolean> {
  const subject = locale === 'en' 
    ? "Password Reset Request - GrapholexInsight" 
    : "Richiesta di reimpostazione password - GrapholexInsight";
  
  const html = locale === 'en'
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Password Reset Request</h1>
        <p>You have requested to reset your password for <strong>GrapholexInsight</strong>.</p>
        <p>Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #2563eb;"><a href="${resetLink}">${resetLink}</a></p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          If you did not request a password reset, please ignore this email.<br>
          This link will expire in 1 hour for security reasons.
        </p>
        <p style="color: #6b7280; font-size: 12px;">
          GrapholexInsight - Forensic Graphology Analysis System
        </p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Richiesta di reimpostazione password</h1>
        <p>Hai richiesto di reimpostare la password per <strong>GrapholexInsight</strong>.</p>
        <p>Clicca sul pulsante qui sotto per impostare una nuova password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reimposta Password</a>
        </div>
        <p>Oppure copia e incolla questo link nel tuo browser:</p>
        <p style="word-break: break-all; color: #2563eb;"><a href="${resetLink}">${resetLink}</a></p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          Se non hai richiesto la reimpostazione della password, ignora questa email.<br>
          Questo link scadrà tra 1 ora per motivi di sicurezza.
        </p>
        <p style="color: #6b7280; font-size: 12px;">
          GrapholexInsight - Sistema di Analisi Grafologica Forense
        </p>
      </div>
    `;

  return sendEmailWithGmail(to, subject, html);
}