import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

// Script per aggiungere le colonne mancanti alla tabella delle firme

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL non è impostato");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Verifico se le colonne esistono...");

  // Controlla se le colonne esistono già
  const columnsExist = await db.execute(sql`
    SELECT 
      COUNT(*) as count_comparison_chart,
      COUNT(*) as count_analysis_report,
      COUNT(*) as count_report_path
    FROM information_schema.columns 
    WHERE table_name = 'signatures' AND (
      column_name = 'comparison_chart' OR 
      column_name = 'analysis_report' OR 
      column_name = 'report_path'
    );
  `);

  console.log("Risultato verifica:", columnsExist);

  // Aggiungi le colonne mancanti
  try {
    console.log("Aggiungo le colonne mancanti...");
    
    // Utilizziamo l'approccio "safe" con IF NOT EXISTS per evitare errori se le colonne esistono già
    await db.execute(sql`
      ALTER TABLE signatures 
      ADD COLUMN IF NOT EXISTS comparison_chart TEXT,
      ADD COLUMN IF NOT EXISTS analysis_report TEXT,
      ADD COLUMN IF NOT EXISTS report_path TEXT;
    `);
    
    console.log("Colonne aggiunte con successo!");
  } catch (error) {
    console.error("Errore durante l'aggiunta delle colonne:", error);
    process.exit(1);
  }

  await pool.end();
  console.log("Fatto!");
}

main();