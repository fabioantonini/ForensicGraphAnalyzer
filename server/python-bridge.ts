/**
 * Modulo ponte per l'integrazione con l'analizzatore avanzato di firme in Python
 * Fornisce metodi per l'analisi delle firme utilizzando il codice Python
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { log } from './vite';

interface ComparisonResult {
  similarity: number;
  verdict: string;
  verifica_parameters: any;
  reference_parameters: any;
  comparison_chart: string;  // Base64-encoded image
  description: string;
  report_path?: string;
  error?: string;
}

interface CaseInfo {
  caseName?: string;
  subject?: string;
  date?: string;
  documentType?: string;
  notes?: string;
}

/**
 * Classe per l'interazione con lo script Python di analisi avanzata delle firme
 */
export class SignaturePythonAnalyzer {
  private static readonly pythonScript = path.join(process.cwd(), 'server', 'advanced-signature-analyzer.py');

  /**
   * Controlla che lo script Python sia disponibile
   * @returns Promise che si risolve se lo script esiste, altrimenti si rifiuta
   */
  public static async checkAvailability(): Promise<boolean> {
    try {
      await fs.access(this.pythonScript);
      return true;
    } catch (error) {
      log(`Script Python non trovato: ${this.pythonScript}`, 'python-bridge');
      return false;
    }
  }

  /**
   * Analizza una singola firma
   * @param signaturePath Percorso del file dell'immagine della firma
   * @returns Promise con i parametri estratti dalla firma
   */
  public static async analyzeSignature(signaturePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3', [
        this.pythonScript,
        signaturePath,
        signaturePath,  // Usiamo lo stesso file due volte per evitare errori
        '--no-report'   // Non generiamo report per singole analisi
      ]);

      let outputData = '';
      let errorData = '';

      process.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorData += data.toString();
        log(`Python error: ${data}`, 'python-bridge');
      });

      process.on('close', (code) => {
        if (code !== 0) {
          log(`Processo Python terminato con codice ${code}`, 'python-bridge');
          reject(new Error(`Errore nell'analisi della firma: ${errorData}`));
          return;
        }

        try {
          const result = JSON.parse(outputData);
          if (result.error) {
            reject(new Error(result.error));
          } else if (result.verifica_parameters) {
            resolve(result.verifica_parameters);
          } else {
            reject(new Error('Formato di risposta non valido dallo script Python'));
          }
        } catch (error: any) {
          reject(new Error(`Errore nel parsing del risultato: ${error.message}`));
        }
      });
    });
  }

  /**
   * Confronta due firme utilizzando lo script Python avanzato
   * @param verificaPath Percorso della firma da verificare
   * @param referencePath Percorso della firma di riferimento
   * @param generateReport Se true, genera un report PDF
   * @param caseInfo Informazioni opzionali sul caso per il report
   * @returns Promise con i risultati del confronto
   */
  public static async compareSignatures(
    verificaPath: string,
    referencePath: string,
    generateReport: boolean = false,
    caseInfo?: CaseInfo
  ): Promise<ComparisonResult> {
    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScript,
        verificaPath,
        referencePath
      ];

      if (generateReport) {
        args.push('--report');
      }

      // Se ci sono informazioni sul caso, le passiamo come JSON
      if (caseInfo) {
        args.push('--case-info');
        args.push(JSON.stringify(caseInfo));
      }

      const process = spawn('python3', args);

      let outputData = '';
      let errorData = '';

      process.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorData += data.toString();
        log(`Python error: ${data}`, 'python-bridge');
      });

      process.on('close', (code) => {
        if (code !== 0) {
          log(`Processo Python terminato con codice ${code}`, 'python-bridge');
          reject(new Error(`Errore nel confronto delle firme: ${errorData}`));
          return;
        }

        try {
          console.log(`[PYTHON BRIDGE] Output ricevuto:`, outputData);
          const result = JSON.parse(outputData) as ComparisonResult;
          
          // Verifica che report_path sia una stringa
          if (result.report_path && typeof result.report_path !== 'string') {
            console.log(`[PYTHON BRIDGE] Correzione report_path da ${result.report_path} a stringa`);
            // Se non è una stringa, ma è presente, lo convertiamo in stringa
            result.report_path = String(result.report_path);
          }
          
          resolve(result);
        } catch (error: any) {
          console.error(`[PYTHON BRIDGE] Errore nel parsing JSON:`, error, `Output raw:`, outputData);
          reject(new Error(`Errore nel parsing del risultato: ${error.message}`));
        }
      });
    });
  }

  /**
   * Genera un report comparativo in formato PDF
   * @param verificaPath Percorso della firma da verificare
   * @param referencePath Percorso della firma di riferimento principale
   * @param caseInfo Informazioni sul caso per il report
   * @param additionalReferencePaths Array opzionale di percorsi di firme di riferimento aggiuntive
   * @returns Promise con il risultato del confronto, incluso il percorso del report
   */
  public static async generateReport(
    verificaPath: string,
    referencePath: string,
    caseInfo?: CaseInfo,
    additionalReferencePaths?: string[]
  ): Promise<ComparisonResult> {
    try {
      console.log(`[PYTHON BRIDGE] Generazione report per firma verifica: ${verificaPath}`);
      console.log(`[PYTHON BRIDGE] Firma riferimento principale: ${referencePath}`);
      
      if (additionalReferencePaths && additionalReferencePaths.length > 0) {
        console.log(`[PYTHON BRIDGE] Incluse ${additionalReferencePaths.length} firme di riferimento aggiuntive`);
      }
      
      // IMPORTANTE: Qui c'è un problema - lo script Python scambia i percorsi delle firme
      // Invertiamo intenzionalmente l'ordine dei parametri per compensare
      console.log(`[PYTHON BRIDGE] CORREZIONE: Invertendo l'ordine dei parametri per compensare il bug`);
      const result = await this.compareSignatures(referencePath, verificaPath, true, caseInfo);
      
      if (!result.report_path) {
        console.log('[PYTHON BRIDGE] Report generato ma percorso non presente nel risultato');
        throw new Error('Percorso del report non presente nel risultato');
      }
      console.log(`[PYTHON BRIDGE] Report generato con successo: ${result.report_path}`);
      return result;
    } catch (error: any) {
      console.error(`[PYTHON BRIDGE] Errore nella generazione del report: ${error.message}`);
      throw new Error(`Errore nella generazione del report: ${error.message}`);
    }
  }
}