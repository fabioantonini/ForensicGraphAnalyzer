/**
 * Script per aggiornare il database aggiungendo la tabella anonymizations
 */
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log('Creazione tabella anonymizations...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS anonymizations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        original_document_id INTEGER REFERENCES documents(id),
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        anonymized_file_path TEXT NOT NULL,
        entity_types JSON NOT NULL,
        entity_replacements JSONB NOT NULL,
        detected_entities JSONB NOT NULL,
        processing_status TEXT DEFAULT 'pending' NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    console.log('Tabella anonymizations creata con successo');
    
    // Crea indici per migliorare le performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_anonymizations_user_id ON anonymizations(user_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_anonymizations_processing_status ON anonymizations(processing_status);
    `);
    
    console.log('Indici creati con successo');
    
    process.exit(0);
  } catch (error) {
    console.error('Errore durante la creazione della tabella:', error);
    process.exit(1);
  }
}

main();