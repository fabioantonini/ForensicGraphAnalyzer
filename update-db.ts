import * as schema from './shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  // Create signatureProjects table
  try {
    console.log('Creating signatureProjects table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signature_projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('signatureProjects table created successfully');
  } catch (error) {
    console.error('Failed to create signatureProjects table:', error);
  }

  // Create signatures table
  try {
    console.log('Creating signatures table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signatures (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES signature_projects(id),
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        is_reference BOOLEAN DEFAULT TRUE NOT NULL,
        parameters JSONB,
        processing_status TEXT DEFAULT 'pending' NOT NULL,
        comparison_result REAL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('signatures table created successfully');
  } catch (error) {
    console.error('Failed to create signatures table:', error);
  }
  
  // Aggiungi le colonne mancanti alla tabella signatures
  try {
    console.log('Aggiunta colonne per l\'analisi avanzata alla tabella signatures...');
    await pool.query(`
      ALTER TABLE signatures
      ADD COLUMN IF NOT EXISTS comparison_chart TEXT,
      ADD COLUMN IF NOT EXISTS analysis_report TEXT,
      ADD COLUMN IF NOT EXISTS report_path TEXT;
    `);
    console.log('Colonne aggiunte con successo alla tabella signatures');
  } catch (error) {
    console.error('Failed to add columns to signatures table:', error);
  }

  console.log('Database update completed');
  await pool.end();
}

main().catch(console.error);