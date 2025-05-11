/**
 * Servizio per l'invio di email tramite Gmail API con OAuth 2.0
 */
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';

// Definizione del tipo di configurazione per Gmail OAuth
export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  isConfigured: boolean;
}

// Scopes richiesti per l'API Gmail
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

/**
 * Crea un client OAuth2 per Gmail API
 * @param config Configurazione OAuth
 * @returns Client OAuth2
 */
function createOAuth2Client(config: GmailConfig): OAuth2Client {
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

/**
 * Genera l'URL per l'autorizzazione OAuth
 * @param config Configurazione OAuth
 * @returns URL di autorizzazione
 */
export function generateAuthUrl(config: GmailConfig): string {
  const oauth2Client = createOAuth2Client(config);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Forza la richiesta di un nuovo refresh token
  });
}

/**
 * Ottiene un token di accesso dal codice di autorizzazione
 * @param config Configurazione OAuth
 * @param code Codice di autorizzazione
 * @returns Promise con il refresh token
 */
export async function getTokenFromCode(config: GmailConfig, code: string): Promise<string> {
  const oauth2Client = createOAuth2Client(config);
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.refresh_token) {
    throw new Error('Non è stato ottenuto un refresh token. Prova ad autorizzare nuovamente.');
  }
  
  return tokens.refresh_token;
}

/**
 * Invia un'email utilizzando Gmail API
 * @param to Indirizzo email del destinatario
 * @param subject Oggetto dell'email
 * @param html Contenuto HTML dell'email
 * @param config Configurazione Gmail OAuth
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendGmailEmail(to: string, subject: string, html: string, config: GmailConfig): Promise<boolean> {
  try {
    if (!config.refreshToken) {
      console.error('Refresh token non configurato per Gmail API');
      return false;
    }
    
    const oauth2Client = createOAuth2Client(config);
    oauth2Client.setCredentials({ refresh_token: config.refreshToken });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Preparazione del messaggio email secondo le specifiche MIME
    const emailContent = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      '',
      html
    ].join('\r\n');
    
    // Converti la stringa email in formato Base64 URL-safe
    const encodedEmail = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Invio dell'email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    return true;
  } catch (error) {
    console.error('Errore nell\'invio dell\'email tramite Gmail API:', error);
    return false;
  }
}

/**
 * Verifica se il servizio Gmail API è configurato correttamente
 * @param config Configurazione Gmail OAuth
 * @returns true se il servizio è configurato correttamente
 */
export function isGmailServiceConfigured(config: GmailConfig): boolean {
  return !!(config && config.clientId && config.clientSecret && config.refreshToken);
}

/**
 * Salva la configurazione Gmail API
 * @param config Configurazione da salvare
 * @returns Promise che si risolve quando la configurazione è stata salvata
 */
export async function saveGmailConfig(config: GmailConfig): Promise<void> {
  await storage.saveSettings('gmail_config', JSON.stringify(config));
}

/**
 * Carica la configurazione Gmail API
 * @returns Promise con la configurazione caricata
 */
export async function loadGmailConfig(): Promise<GmailConfig> {
  const configJson = await storage.getSettings('gmail_config');
  
  if (!configJson) {
    return {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      refreshToken: '',
      isConfigured: false
    };
  }
  
  try {
    const config = JSON.parse(configJson);
    config.isConfigured = isGmailServiceConfigured(config);
    return config;
  } catch (error) {
    console.error('Errore nel parsing della configurazione Gmail:', error);
    return {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      refreshToken: '',
      isConfigured: false
    };
  }
}