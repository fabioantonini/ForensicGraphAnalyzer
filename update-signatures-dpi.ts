/**
 * Script per aggiornare il database aggiungendo il campo dpi alla tabella signatures
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
      WHERE table_name = 'signatures' AND column_name = 'dpi'
    `);

    // Se la colonna non esiste, aggiungila
    if (result.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE signatures
        ADD COLUMN dpi INTEGER NOT NULL DEFAULT 300
      `);
      log('[DB] Colonna dpi aggiunta alla tabella signatures con successo');
      
      // Inizializza ogni firma con il DPI del progetto a cui appartiene
      await db.execute(sql`
        UPDATE signatures s
        SET dpi = (
          SELECT sp.dpi 
          FROM signature_projects sp 
          WHERE sp.id = s.project_id
        )
      `);
      log('[DB] DPI inizializzato per tutte le firme dai relativi progetti');
    } else {
      log('[DB] La colonna dpi esiste già nella tabella signatures');
    }
    
    console.log("Aggiornamento completato con successo");
    process.exit(0);
  } catch (error) {
    console.error("Errore durante l'aggiornamento:", error);
    process.exit(1);
  }
}

main();