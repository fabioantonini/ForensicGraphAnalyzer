/**
 * Servizio per l'analisi Peer Review delle perizie grafologiche
 * Utilizza il framework ENFSI per valutare la conformità delle relazioni peritali
 */

import { createOpenAIClient } from "./openai";

// Framework ENFSI multilingue per valutazione perizie
const ENFSI_FRAMEWORK_IT = {
  structureInfo: {
    name: "Struttura Obbligatoria della Relazione",
    weight: 15,
    criteria: [
      "Identificatore univoco del caso",
      "Nome e indirizzo del laboratorio/esperto", 
      "Identità dell'esaminatore e qualifiche",
      "Firma dell'esaminatore forense",
      "Date (firma relazione, ricevimento materiale)",
      "Nome e status del trasmettitore",
      "Sistema di numerazione pagine"
    ]
  },
  materialDocumentation: {
    name: "Documentazione del Materiale",
    weight: 15,
    criteria: [
      "Elenco completo del materiale presentato",
      "Stato del materiale e imballaggio alla ricezione",
      "Eventuali alterazioni, danni o contaminazioni",
      "Informazioni ricevute con il materiale",
      "Chain of custody (catena di custodia)"
    ]
  },
  methodology: {
    name: "Metodologia e Procedure",
    weight: 25,
    criteria: [
      "Definizione chiara dello scopo dell'esame",
      "Descrizione dell'approccio sistematico utilizzato",
      "Considerazione di ipotesi alternative (pro/contro)",
      "Priorità e sequenza degli esami giustificate",
      "Dettagli degli esami/analisi effettuati",
      "Uso di attrezzature appropriate",
      "Test non distruttivi prioritari"
    ]
  },
  technicalAnalysis: {
    name: "Analisi Tecnica Specialistica",
    weight: 20,
    criteria: [
      "Parametri di analisi delle manoscritture",
      "Variazioni nella manoscrittura analizzate",
      "Stili di scrittura identificati",
      "Fluidità grafica valutata",
      "Fattori esterni e interni considerati",
      "Processo di comparazione descritto",
      "Caratteristiche individuali vs. di classe"
    ]
  },
  validation: {
    name: "Validazione e Controlli Qualità", 
    weight: 15,
    criteria: [
      "Peer Review obbligatoria eseguita",
      "Evidenze decisive confermate da secondo esperto",
      "Controlli di qualità applicati",
      "Validazione delle tecniche utilizzate",
      "Protocolli anti-contaminazione seguiti"
    ]
  },
  presentation: {
    name: "Presentazione e Valutazione",
    weight: 10,
    criteria: [
      "Risultati chiari e supportati da esami",
      "Valutazione della significatività nel contesto",
      "Opinione dell'esperto con motivazioni",
      "Scale di conclusioni standardizzate",
      "Documentazione adeguata e tracciabile"
    ]
  }
};

const ENFSI_FRAMEWORK_EN = {
  structureInfo: {
    name: "Mandatory Report Structure",
    weight: 15,
    criteria: [
      "Unique case identifier",
      "Name and address of laboratory/expert", 
      "Examiner identity and qualifications",
      "Forensic examiner signature",
      "Dates (report signature, material receipt)",
      "Name and status of submitter",
      "Page numbering system"
    ]
  },
  materialDocumentation: {
    name: "Material Documentation",
    weight: 15,
    criteria: [
      "Complete list of submitted material",
      "Material condition and packaging upon receipt",
      "Any alterations, damage or contamination",
      "Information received with material",
      "Chain of custody"
    ]
  },
  methodology: {
    name: "Methodology and Procedures",
    weight: 25,
    criteria: [
      "Clear definition of examination purpose",
      "Description of systematic approach used",
      "Consideration of alternative hypotheses (pro/contra)",
      "Justified examination priority and sequence",
      "Details of examinations/analyses performed",
      "Use of appropriate equipment",
      "Non-destructive tests prioritized"
    ]
  },
  technicalAnalysis: {
    name: "Specialized Technical Analysis",
    weight: 20,
    criteria: [
      "Handwriting analysis parameters",
      "Handwriting variations analyzed",
      "Writing styles identified",
      "Graphic fluency assessed",
      "External and internal factors considered",
      "Comparison process described",
      "Individual vs. class characteristics"
    ]
  },
  validation: {
    name: "Validation and Quality Controls", 
    weight: 15,
    criteria: [
      "Mandatory peer review performed",
      "Key evidence confirmed by second expert",
      "Quality controls applied",
      "Validation of techniques used",
      "Anti-contamination protocols followed"
    ]
  },
  presentation: {
    name: "Presentation and Assessment",
    weight: 10,
    criteria: [
      "Clear results supported by examinations",
      "Significance assessment in context",
      "Expert opinion with reasoning",
      "Standardized conclusion scales",
      "Adequate and traceable documentation"
    ]
  }
};

// Sistema di classificazione conformità
const getClassification = (score: number): string => {
  if (score >= 90) return "eccellente";
  if (score >= 75) return "buono";
  if (score >= 60) return "sufficiente";
  return "insufficiente";
};

const getClassificationColor = (classification: string): string => {
  switch (classification) {
    case "eccellente": return "#10B981"; // green
    case "buono": return "#F59E0B"; // yellow
    case "sufficiente": return "#F97316"; // orange
    default: return "#EF4444"; // red
  }
};

/**
 * Analizza una perizia grafica utilizzando il framework ENFSI
 */
export async function analyzePeerReview(
  peritiaContent: string,
  userApiKey?: string,
  userId?: number
): Promise<{
  overallScore: number;
  classification: string;
  criteriaResults: any;
  suggestions: string;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  try {
    console.log('[PEER-REVIEW] Avvio analisi perizia grafica con framework ENFSI');
    
    const openai = await createOpenAIClient(userApiKey, userId);
    
    // Costruisce il prompt di sistema con framework ENFSI
    const systemPrompt = `Sei un esperto in perizia grafica forense specializzato nella valutazione della conformità alle best practice ENFSI.

Il tuo compito è analizzare una relazione peritale grafica e valutarla secondo il framework ENFSI per determinare la sua conformità agli standard professionali.

FRAMEWORK DI VALUTAZIONE ENFSI:

1. STRUTTURA OBBLIGATORIA DELLA RELAZIONE (15%)
   - Identificatore univoco del caso
   - Nome e indirizzo del laboratorio/esperto
   - Identità dell'esaminatore e qualifiche
   - Firma dell'esaminatore forense
   - Date (firma relazione, ricevimento materiale)
   - Nome e status del trasmettitore
   - Sistema di numerazione pagine

2. DOCUMENTAZIONE DEL MATERIALE (15%)
   - Elenco completo del materiale presentato
   - Stato del materiale e imballaggio alla ricezione
   - Eventuali alterazioni, danni o contaminazioni
   - Informazioni ricevute con il materiale
   - Chain of custody

3. METODOLOGIA E PROCEDURE (25%)
   - Definizione chiara dello scopo dell'esame
   - Descrizione dell'approccio sistematico utilizzato
   - Considerazione di ipotesi alternative
   - Dettagli degli esami/analisi effettuati
   - Uso di attrezzature appropriate

4. ANALISI TECNICA SPECIALISTICA (20%)
   - Parametri di analisi delle manoscritture
   - Variazioni nella manoscrittura
   - Stili di scrittura identificati
   - Processo di comparazione
   - Caratteristiche individuali vs. di classe

5. VALIDAZIONE E CONTROLLI QUALITÀ (15%)
   - Peer Review obbligatoria eseguita
   - Evidenze decisive confermate
   - Controlli di qualità applicati
   - Validazione delle tecniche

6. PRESENTAZIONE E VALUTAZIONE (10%)
   - Risultati chiari e supportati
   - Valutazione della significatività
   - Opinione dell'esperto motivata
   - Documentazione tracciabile

Per ogni categoria, assegna:
- Score: punteggio da 0 a 100
- Details: analisi dettagliata di cosa è presente/mancante
- Weight: peso della categoria (già specificato)

Fornisci anche:
- Suggestions: suggerimenti specifici per migliorare la conformità
- Motiva sempre le tue valutazioni con esempi specifici dal testo

RISPOSTA IN FORMATO JSON:
{
  "structureInfo": { "score": 85, "details": "...", "weight": 15 },
  "materialDocumentation": { "score": 70, "details": "...", "weight": 15 },
  "methodology": { "score": 90, "details": "...", "weight": 25 },
  "technicalAnalysis": { "score": 80, "details": "...", "weight": 20 },
  "validation": { "score": 60, "details": "...", "weight": 15 },
  "presentation": { "score": 85, "details": "...", "weight": 10 },
  "suggestions": "Suggerimenti specifici per migliorare la conformità agli standard ENFSI..."
}`;

    console.log('[PEER-REVIEW] Invio richiesta a OpenAI per analisi conformità ENFSI');

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // il modello più recente OpenAI
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analizza la seguente perizia grafica secondo il framework ENFSI e fornisci una valutazione dettagliata della conformità agli standard professionali:\n\n${peritiaContent}` 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Temperatura bassa per coerenza nell'analisi
      max_tokens: 4000
    });

    const analysisResult = JSON.parse(response.choices[0].message.content || '{}');
    console.log('[PEER-REVIEW] Analisi completata, elaborazione risultati');

    // Calcola il punteggio complessivo ponderato
    const categories = ['structureInfo', 'materialDocumentation', 'methodology', 'technicalAnalysis', 'validation', 'presentation'];
    let totalScore = 0;
    let totalWeight = 0;

    const criteriaResults: any = {};

    for (const category of categories) {
      const categoryData = analysisResult[category];
      if (categoryData) {
        const weight = ENFSI_FRAMEWORK_IT[category as keyof typeof ENFSI_FRAMEWORK_IT]?.weight || 0;
        totalScore += (categoryData.score * weight);
        totalWeight += weight;
        
        criteriaResults[category] = {
          score: categoryData.score,
          details: categoryData.details,
          weight: weight
        };
      }
    }

    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const classification = getClassification(overallScore);
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`[PEER-REVIEW] Analisi completata: Score ${overallScore}, Classificazione: ${classification}`);

    return {
      overallScore,
      classification,
      criteriaResults,
      suggestions: analysisResult.suggestions || "Nessun suggerimento specifico fornito.",
      processingTime
    };

  } catch (error: any) {
    console.error('[PEER-REVIEW] Errore durante l\'analisi:', error);
    throw new Error(`Errore nell'analisi della perizia: ${error.message}`);
  }
}

/**
 * Ottiene i criteri del framework ENFSI
 */
export function getENFSIFramework(language: string = 'it') {
  const framework = language === 'en' ? ENFSI_FRAMEWORK_EN : ENFSI_FRAMEWORK_IT;
  return {
    framework,
    classifications: {
      eccellente: { min: 90, max: 100, description: "Conformità completa ENFSI" },
      buono: { min: 75, max: 89, description: "Standard rispettati, dettagli minori" },
      sufficiente: { min: 60, max: 74, description: "Base accettabile, alcune lacune" },
      insufficiente: { min: 0, max: 59, description: "Criteri fondamentali mancanti" }
    }
  };
}

/**
 * Ottiene informazioni sulla classificazione
 */
export function getClassificationInfo(classification: string) {
  const descriptions = {
    eccellente: "La perizia rispetta completamente gli standard ENFSI e rappresenta un esempio di eccellenza professionale.",
    buono: "La perizia rispetta la maggior parte degli standard ENFSI con solo dettagli minori da migliorare.",
    sufficiente: "La perizia ha una struttura di base accettabile ma presenta alcune lacune metodologiche che dovrebbero essere corrette.",
    insufficiente: "La perizia non rispetta i criteri fondamentali ENFSI e richiede significative revisioni prima dell'uso professionale."
  };

  return {
    classification,
    description: descriptions[classification as keyof typeof descriptions] || "Classificazione non riconosciuta",
    color: getClassificationColor(classification)
  };
}