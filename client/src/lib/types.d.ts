// Import base types from shared schema
// This is a type declaration file to extend the base types with client-specific properties

// Estende il tipo User dal database con le proprietà specifiche per il client
export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  fullName: string | null;
  organization: string | null;
  profession: string | null;
  openaiApiKey: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
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