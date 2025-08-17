import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { storage } from './storage';
import {
  sendEmailWithSendGrid,
  sendPasswordResetEmailWithSendGrid,
  isSendGridConfigured
} from './sendgrid-service';

const generateRandomToken = promisify(randomBytes);

// Map per memorizzare i token di reset e le loro scadenze
interface PasswordResetToken {
  userId: number;
  token: string;
  expiresAt: Date;
}

const passwordResetTokens = new Map<string, PasswordResetToken>();

/**
 * Invia un'email utilizzando il provider configurato
 * @param to Indirizzo email del destinatario
 * @param subject Oggetto dell'email
 * @param html Contenuto HTML dell'email
 * @returns Promise che si risolve a true se l'email è stata inviata con successo
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    // Utilizziamo SendGrid come provider principale
    return await sendEmailWithSendGrid(to, subject, html);
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    return false;
  }
}

/**
 * Verifica se il servizio email è configurato correttamente
 * @returns true se il servizio email è configurato correttamente
 */
export async function isEmailServiceConfigured(): Promise<boolean> {
  return await isSendGridConfigured();
}

/**
 * Genera un token di reset password e lo salva nel sistema
 * @param userId ID dell'utente che ha richiesto il reset
 * @returns Token generato
 */
export async function generatePasswordResetToken(userId: number): Promise<string> {
  // Genera un token casuale
  const buffer = await generateRandomToken(32);
  const token = buffer.toString('hex');
  
  // Imposta la scadenza a 1 ora
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  
  // Memorizza il token
  passwordResetTokens.set(token, {
    userId,
    token,
    expiresAt
  });
  
  return token;
}

/**
 * Verifica se un token di reset password è valido
 * @param token Token da verificare
 * @returns true se il token è valido, false altrimenti
 */
export function verifyPasswordResetToken(token: string): boolean {
  const tokenData = passwordResetTokens.get(token);
  
  // Verifica esistenza e validità del token
  if (!tokenData || tokenData.expiresAt < new Date()) {
    return false;
  }
  
  return true;
}

/**
 * Ottiene l'ID utente da un token di reset password valido
 * @param token Token da verificare
 * @returns ID dell'utente se il token è valido, altrimenti null
 */
export function getUserIdFromResetToken(token: string): number | null {
  const tokenData = passwordResetTokens.get(token);
  
  // Verifica esistenza e validità del token
  if (!tokenData || tokenData.expiresAt < new Date()) {
    return null;
  }
  
  return tokenData.userId;
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
  return sendPasswordResetEmailWithSendGrid(to, resetLink, locale);
}

// Esportiamo questi tipi e funzioni per mantenere la compatibilità con il resto del codice
export enum EmailServiceType {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid'
}

export interface EmailServiceConfig {
  type: EmailServiceType;
  isConfigured: boolean;
}

export async function loadEmailConfig(): Promise<EmailServiceConfig> {
  return {
    type: EmailServiceType.SENDGRID,
    isConfigured: await isSendGridConfigured()
  };
}

export async function saveEmailConfig(config: EmailServiceConfig): Promise<void> {
  // Questa funzione non fa nulla in questa versione semplificata
  // Potremmo implementarla in futuro se necessario
}