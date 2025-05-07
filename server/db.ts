import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from './vite';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

/**
 * Verifica la connessione al database PostgreSQL
 * @returns Promise che si risolve a true se la connessione è OK, false altrimenti
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Esegui una query semplice per verificare la connessione
    const result = await pool.query('SELECT 1 as test');
    
    if (result.rows[0].test === 1) {
      log(`Connessione al database PostgreSQL riuscita`, "database");
      return true;
    }
    
    return false;
  } catch (error) {
    log(`Errore durante il test della connessione al database: ${error}`, "database");
    return false;
  }
}

/**
 * Verifica se l'estensione pgvector è disponibile e installata
 * @returns Promise che si risolve a true se l'estensione è disponibile e installata, false altrimenti
 */
export async function isPgVectorAvailable(): Promise<boolean> {
  try {
    // Controlla se l'estensione vector è installata
    const result = await pool.query(`
      SELECT installed_version FROM pg_available_extensions 
      WHERE name = 'vector' AND installed_version IS NOT NULL
    `);
    
    if (result.rows.length > 0) {
      const version = result.rows[0].installed_version;
      log(`Estensione pgvector installata (versione ${version})`, "database");
      return true;
    }
    
    log(`Estensione pgvector non installata`, "database");
    return false;
  } catch (error) {
    log(`Errore durante la verifica dell'estensione pgvector: ${error}`, "database");
    return false;
  }
}
