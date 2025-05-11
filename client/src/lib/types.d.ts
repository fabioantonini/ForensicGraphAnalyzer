import { User as BaseUser } from "@shared/schema";

// Estende il tipo User dal database con le proprietà specifiche per il client
export interface User extends BaseUser {
  accountType?: string;  // 'regular' o 'demo'
  demoExpiresAt?: Date;  // Data di scadenza della demo
  dataRetentionUntil?: Date;  // Data di eliminazione dei dati dopo scadenza
  isActive?: boolean;  // Indica se l'account è attivo o disabilitato
}

// Interface per la creazione di un account demo
export interface DemoAccountCreation {
  username: string;
  password: string;
  email: string;
  fullName?: string;
  organization?: string;
  profession?: string;
  durationDays: number;
}

// Interface per l'estensione di un account demo
export interface DemoExtension {
  userId: number;
  additionalDays: number;
}