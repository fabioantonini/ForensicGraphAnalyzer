import sgMail from '@sendgrid/mail';
import fs from 'fs/promises';
import path from 'path';

const SENDGRID_CONFIG_PATH = path.join(process.cwd(), '.sendgrid-config.json');

export interface SendGridConfig {
  apiKey: string;
  senderEmail: string;
  isConfigured: boolean;
}

/**
 * Carica la configurazione SendGrid
 * @returns Configurazione SendGrid
 */
export async function loadSendGridConfig(): Promise<SendGridConfig> {
  try {
    // Verifica se esiste il file di configurazione
    try {
      await fs.access(SENDGRID_CONFIG_PATH);
    } catch (error) {
      // Se il file non esiste, crea una configurazione vuota
      await fs.writeFile(
        SENDGRID_CONFIG_PATH,
        JSON.stringify({
          apiKey: "",
          senderEmail: "",
          isConfigured: false
        }, null, 2),
        "utf8"
      );
    }

    // Leggi la configurazione
    const configStr = await fs.readFile(SENDGRID_CONFIG_PATH, "utf8");
    const config = JSON.parse(configStr) as SendGridConfig;

    // Se abbiamo variabili d'ambiente, usale come fallback
    if (process.env.SENDGRID_API_KEY && !config.apiKey) {
      config.apiKey = process.env.SENDGRID_API_KEY;
    }
    if (process.env.SENDGRID_SENDER_EMAIL && !config.senderEmail) {
      config.senderEmail = process.env.SENDGRID_SENDER_EMAIL;
    }

    // Verifica se la configurazione è valida
    config.isConfigured = !!(config.apiKey && config.senderEmail);

    return config;
  } catch (error) {
    console.error("Errore nel caricamento della configurazione SendGrid:", error);
    
    // Ritorna una configurazione vuota
    return {
      apiKey: process.env.SENDGRID_API_KEY || "",
      senderEmail: process.env.SENDGRID_SENDER_EMAIL || "",
      isConfigured: !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_SENDER_EMAIL)
    };
  }
}

/**
 * Salva la configurazione SendGrid
 * @param config Configurazione da salvare
 */
export async function saveSendGridConfig(config: SendGridConfig): Promise<void> {
  try {
    // Aggiorna le variabili d'ambiente
    if (config.apiKey) {
      process.env.SENDGRID_API_KEY = config.apiKey;
    }
    if (config.senderEmail) {
      process.env.SENDGRID_SENDER_EMAIL = config.senderEmail;
    }

    // Verifica se la configurazione è valida
    config.isConfigured = !!(config.apiKey && config.senderEmail);

    // Configura SendGrid se la configurazione è valida
    if (config.isConfigured) {
      sgMail.setApiKey(config.apiKey);
    }

    // Salva la configurazione
    await fs.writeFile(
      SENDGRID_CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Errore nel salvataggio della configurazione SendGrid:", error);
    throw error;
  }
}

/**
 * Invia un'email utilizzando SendGrid
 * @param to Indirizzo email del destinatario
 * @param subject Oggetto dell'email
 * @param html Contenuto HTML dell'email
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendEmailWithSendGrid(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const config = await loadSendGridConfig();
    
    if (!config.isConfigured) {
      console.error("SendGrid non configurato");
      return false;
    }

    // Configura SendGrid
    sgMail.setApiKey(config.apiKey);

    // Invia l'email
    await sgMail.send({
      to,
      from: config.senderEmail,
      subject,
      html
    });

    return true;
  } catch (error) {
    console.error("Errore nell'invio dell'email con SendGrid:", error);
    return false;
  }
}

/**
 * Verifica se SendGrid è configurato correttamente
 * @returns true se SendGrid è configurato correttamente
 */
export async function isSendGridConfigured(): Promise<boolean> {
  try {
    const config = await loadSendGridConfig();
    return config.isConfigured;
  } catch (error) {
    return false;
  }
}

/**
 * Invia un'email di test per verificare la configurazione SendGrid
 * @param to Indirizzo email di destinazione per il test
 * @returns Promise che si risolve a true se il test è riuscito
 */
export async function testSendGridConfiguration(to: string): Promise<boolean> {
  return sendEmailWithSendGrid(
    to,
    "Test Configurazione SendGrid",
    "<p>Questa è un'email di test per verificare la configurazione di SendGrid.</p>"
  );
}

/**
 * Invia un'email per il reset della password utilizzando SendGrid
 * @param to Indirizzo email del destinatario
 * @param resetLink Link per il reset della password
 * @param locale Lingua dell'utente per l'internazionalizzazione
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendPasswordResetEmailWithSendGrid(to: string, resetLink: string, locale: string = 'it'): Promise<boolean> {
  const subject = locale === 'en' 
    ? "Password Reset Request" 
    : "Richiesta di reimpostazione password";
  
  const html = locale === 'en'
    ? `
      <h1>Password Reset Request</h1>
      <p>You have requested to reset your password for GrapholexInsight.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `
    : `
      <h1>Richiesta di reimpostazione password</h1>
      <p>Hai richiesto di reimpostare la password per GrapholexInsight.</p>
      <p>Clicca sul link qui sotto per impostare una nuova password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Se non hai richiesto la reimpostazione della password, ignora questa email.</p>
      <p>Questo link scadrà tra 1 ora.</p>
    `;

  return sendEmailWithSendGrid(to, subject, html);
}