/**
 * Script per aggiornare il database aggiungendo il campo dpi alla tabella signature_projects
 */

import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { log } from "./server/vite";

async function main() {
  try {
    // Verifica se la colonna esiste già
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'signature_projects' AND column_name = 'dpi'
    `);

    // Se la colonna non esiste, aggiungila
    if (result.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE signature_projects
        ADD COLUMN dpi INTEGER NOT NULL DEFAULT 300
      `);
      log('[DB] Colonna dpi aggiunta alla tabella signature_projects con successo');
    } else {
      log('[DB] La colonna dpi esiste già nella tabella signature_projects');
    }
    
    console.log("Aggiornamento completato con successo");
    process.exit(0);
  } catch (error) {
    console.error("Errore durante l'aggiornamento:", error);
    process.exit(1);
  }
}

main();