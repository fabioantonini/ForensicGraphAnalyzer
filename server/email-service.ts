import nodemailer from 'nodemailer';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { storage } from './storage';
import { loadGmailConfig, sendGmailEmail, isGmailServiceConfigured } from './gmail-service';

const generateRandomToken = promisify(randomBytes);

// Map per memorizzare i token di reset e le loro scadenze
interface PasswordResetToken {
  userId: number;
  token: string;
  expiresAt: Date;
}

const passwordResetTokens = new Map<string, PasswordResetToken>();

// Tipi di servizio email
export enum EmailServiceType {
  SMTP = 'smtp',
  GMAIL_API = 'gmail_api'
}

// Configurazione del servizio email
export interface EmailServiceConfig {
  type: EmailServiceType;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string | null;
  isConfigured: boolean;
}

// Crea un transporter SMTP basato sulle impostazioni
function createSMTPTransporter(config: EmailServiceConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: config.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
    secure: config.smtpSecure || process.env.SMTP_SECURE === 'true',
    auth: {
      user: config.smtpUser || process.env.SMTP_USER || '',
      pass: config.smtpPassword || process.env.SMTP_PASSWORD || '',
    },
  });
}

/**
 * Invia un'email utilizzando il provider configurato
 * @param to Indirizzo email del destinatario
 * @param subject Oggetto dell'email
 * @param html Contenuto HTML dell'email
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    // Carica la configurazione corrente
    const emailConfig = await loadEmailConfig();
    
    // Controlla quale provider è configurato
    if (emailConfig.type === EmailServiceType.GMAIL_API) {
      // Carica la configurazione Gmail
      const gmailConfig = await loadGmailConfig();
      if (!isGmailServiceConfigured(gmailConfig)) {
        console.error('Servizio Gmail API non configurato correttamente');
        return false;
      }
      
      // Invia tramite Gmail API
      return await sendGmailEmail(to, subject, html, gmailConfig);
    } else {
      // Configurazione SMTP
      if (!emailConfig.smtpUser || !emailConfig.smtpPassword) {
        console.error('Credenziali SMTP non configurate');
        return false;
      }
      
      // Crea transporter SMTP
      const transporter = createSMTPTransporter(emailConfig);
      
      // Invia email tramite SMTP
      await transporter.sendMail({
        from: `"GrapholexInsight" <${emailConfig.smtpUser}>`,
        to,
        subject,
        html,
      });
      
      return true;
    }
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    return false;
  }
}

/**
 * Carica la configurazione del servizio email
 * @returns Promise con la configurazione del servizio email
 */
export async function loadEmailConfig(): Promise<EmailServiceConfig> {
  const configJson = await storage.getSettings('email_config');
  
  if (!configJson) {
    return {
      type: EmailServiceType.SMTP,
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpSecure: process.env.SMTP_SECURE === 'true',
      smtpUser: process.env.SMTP_USER || '',
      smtpPassword: process.env.SMTP_PASSWORD || '',
      isConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD
    };
  }
  
  try {
    const config = JSON.parse(configJson) as EmailServiceConfig;
    // Determina se il servizio è configurato in base al tipo
    const configuredStatus = config.type === EmailServiceType.SMTP 
      ? !!(config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPassword)
      : config.type === EmailServiceType.GMAIL_API;
    
    return {
      ...config,
      isConfigured: configuredStatus
    };
  } catch (error) {
    console.error('Errore nel parsing della configurazione email:', error);
    return {
      type: EmailServiceType.SMTP,
      isConfigured: false
    };
  }
}

/**
 * Salva la configurazione del servizio email
 * @param config Configurazione da salvare
 * @returns Promise che si risolve quando la configurazione è stata salvata
 */
export async function saveEmailConfig(config: EmailServiceConfig): Promise<void> {
  // Non salvare le password null (per non sovrascrivere quelle esistenti)
  if (config.type === EmailServiceType.SMTP && config.smtpPassword === null) {
    // Recupera la configurazione corrente per mantenere la password
    const currentConfig = await loadEmailConfig();
    config.smtpPassword = currentConfig.smtpPassword;
  }
  
  await storage.saveSettings('email_config', JSON.stringify(config));
}

/**
 * Genera un token di reset password e lo salva nel sistema
 * @param userId ID dell'utente che ha richiesto il reset
 * @returns Token generato
 */
export async function generatePasswordResetToken(userId: number): Promise<string> {
  const tokenBuffer = await generateRandomToken(32);
  const token = tokenBuffer.toString('hex');
  
  // Imposta la scadenza a 1 ora dal momento attuale
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  
  // Salva il token con l'ID utente e la scadenza
  passwordResetTokens.set(token, {
    userId,
    token,
    expiresAt,
  });
  
  return token;
}

/**
 * Verifica se un token di reset password è valido
 * @param token Token da verificare
 * @returns ID dell'utente se il token è valido, altrimenti null
 */
export function verifyPasswordResetToken(token: string): number | null {
  const resetToken = passwordResetTokens.get(token);
  
  // Se il token non esiste o è scaduto, restituisci null
  if (!resetToken || resetToken.expiresAt < new Date()) {
    // Se è scaduto, rimuovilo
    if (resetToken) {
      passwordResetTokens.delete(token);
    }
    return null;
  }
  
  return resetToken.userId;
}

/**
 * Invalida un token di reset password dopo che è stato utilizzato
 * @param token Token da invalidare
 */
export function invalidatePasswordResetToken(token: string): void {
  passwordResetTokens.delete(token);
}

/**
 * Invia un'email per il reset della password
 * @param to Indirizzo email del destinatario
 * @param resetLink Link per il reset della password
 * @param locale Lingua dell'utente per l'internazionalizzazione
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendPasswordResetEmail(to: string, resetLink: string, locale: string = 'it'): Promise<boolean> {
  const subject = locale === 'en' 
    ? 'Password Reset Request - GrapholexInsight' 
    : 'Richiesta di Reset Password - GrapholexInsight';

  const html = locale === 'en'
    ? `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background-color: #4f46e5; padding: 20px; color: white; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">GrapholexInsight</h1>
          <p>Password Reset</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 5px 5px;">
          <p>Hello,</p>
          <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If the button doesn't work, copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #4f46e5;">${resetLink}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">This email was sent automatically. Please do not reply to this email.</p>
        </div>
      </div>
    `
    : `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background-color: #4f46e5; padding: 20px; color: white; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">GrapholexInsight</h1>
          <p>Reset Password</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 5px 5px;">
          <p>Gentile utente,</p>
          <p>Abbiamo ricevuto una richiesta di reset della password. Se non sei stato tu a effettuare questa richiesta, puoi ignorare questa email.</p>
          <p>Per reimpostare la password, clicca sul pulsante qui sotto:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reimposta Password</a>
          </div>
          <p>Questo link scadrà tra 1 ora.</p>
          <p>Se il pulsante non funziona, copia e incolla il seguente link nel tuo browser:</p>
          <p style="word-break: break-all; color: #4f46e5;">${resetLink}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">Questa email è stata inviata automaticamente. Si prega di non rispondere a questa email.</p>
        </div>
      </div>
    `;

  return sendEmail(to, subject, html);
}

/**
 * Verifica se il servizio email è configurato correttamente
 * @param config Configurazione del servizio email da verificare
 * @returns true se il servizio email è configurato correttamente
 */
export function isEmailServiceConfigured(config: EmailServiceConfig): boolean {
  if (config.type === EmailServiceType.SMTP) {
    return !!(config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPassword);
  } else if (config.type === EmailServiceType.GMAIL_API) {
    // La verifica dettagliata viene fatta nella funzione isGmailServiceConfigured
    return true;
  }
  return false;
}