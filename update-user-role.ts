/**
 * Script per aggiornare il database aggiungendo il campo role alla tabella users
 */

import { sql } from "drizzle-orm";
import { db } from "./server/db";

async function main() {
  try {
    console.log("Verifica se la colonna role già esiste...");
    
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role'
    `);
    
    if ((columnCheck as any[]).length === 0) {
      console.log("Aggiunta colonna role alla tabella users...");
      
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
      `);
      
      console.log("Colonna role aggiunta con successo");
    } else {
      console.log("La colonna role esiste già");
    }
    
    // Imposta gli utenti admin di default se necessario (opzionale)
    console.log("Verifica se l'utente admin già esiste...");
    
    const adminCheck = await db.execute(sql`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `);
    
    if ((adminCheck as any[]).length === 0) {
      console.log("Nessun utente admin trovato. Considera di designare un utente come admin.");
    } else {
      console.log("Utente admin già presente nel sistema");
    }
    
    console.log("Migrazione completata con successo");
  } catch (error) {
    console.error("Errore durante l'aggiornamento del database:", error);
  } finally {
    process.exit(0);
  }
}

main();