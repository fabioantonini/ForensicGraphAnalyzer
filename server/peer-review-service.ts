/**
 * Servizio per l'analisi Peer Review delle perizie grafologiche
 * Utilizza il framework ENFSI per valutare la conformità delle relazioni peritali
 */

import { createOpenAIClient } from "./openai";

// Framework ENFSI esteso con 39 parametri forensi dettagliati
const ENFSI_DETAILED_FRAMEWORK_IT = {
  structureInfo: {
    name: "Struttura Obbligatoria della Relazione",
    weight: 15,
    subcriteria: {
      caseIdentifier: {
        name: "Identificatore Univoco Caso",
        weight: 3.0,
        description: "Numero/codice caso univoco, riferimenti legali",
        indicators: ["numero protocollo", "riferimento tribunale", "codice alfanumerico", "data/anno identificativo"]
      },
      expertLaboratoryData: {
        name: "Dati Esperto/Laboratorio", 
        weight: 3.0,
        description: "Nome, indirizzo, accreditamenti, partita IVA",
        indicators: ["ragione sociale completa", "indirizzo fisico", "certificazioni", "codice fiscale/partita IVA"]
      },
      examinerQualifications: {
        name: "Qualifiche Esaminatore",
        weight: 3.0,
        description: "Titoli, specializzazioni, esperienza, formazione",
        indicators: ["laurea pertinente", "master/specializzazioni", "anni esperienza", "corsi aggiornamento"]
      },
      signatures: {
        name: "Firme e Autenticazione",
        weight: 2.0,
        description: "Firma digitale/fisica, timbri, autenticazione",
        indicators: ["firma leggibile", "timbro professionale", "firma digitale", "data apposizione"]
      },
      completeDates: {
        name: "Date Complete",
        weight: 2.0,
        description: "Data ricevimento, analisi, firma relazione",
        indicators: ["data ricevimento materiale", "data inizio analisi", "data completamento", "data firma relazione"]
      },
      submitterInfo: {
        name: "Dati Trasmettitore",
        weight: 1.0,
        description: "Nome, qualità, autorità di riferimento",
        indicators: ["nome completo mittente", "qualità giuridica", "autorità competente", "recapiti"]
      },
      pageNumbering: {
        name: "Sistema Numerazione",
        weight: 1.0,
        description: "Numerazione progressiva, totale pagine",
        indicators: ["numerazione sequenziale", "formato 'X di Y'", "coerenza numerazione", "assenza salti"]
      }
    }
  },
  materialDocumentation: {
    name: "Documentazione del Materiale",
    weight: 15,
    subcriteria: {
      materialList: {
        name: "Elenco Completo Materiale",
        weight: 4.0,
        description: "Inventario dettagliato di tutti gli elementi ricevuti",
        indicators: ["numero elementi", "descrizione dettagliata", "formato/supporto", "identificazione univoca"]
      },
      receptionConditions: {
        name: "Stato Ricevimento",
        weight: 3.0,
        description: "Condizioni fisiche e imballaggio alla ricezione",
        indicators: ["integrità imballaggio", "stato conservazione", "presenza sigilli", "documentazione accompagnatoria"]
      },
      alterationsDamages: {
        name: "Alterazioni/Danni",
        weight: 3.0,
        description: "Documentazione di problemi, contaminazioni, alterazioni",
        indicators: ["danni fisici", "macchie/alterazioni", "parti mancanti", "contaminazioni"]
      },
      materialInformation: {
        name: "Informazioni Materiale",
        weight: 3.0,
        description: "Metadati, informazioni di contesto ricevute",
        indicators: ["data creazione", "provenienza", "storia conservazione", "precedenti analisi"]
      },
      chainCustody: {
        name: "Catena Custodia",
        weight: 2.0,
        description: "Tracciabilità completa del materiale",
        indicators: ["registro passaggi", "identificazione operatori", "date/orari", "firme responsabili"]
      }
    }
  },
  methodology: {
    name: "Metodologia e Procedure",
    weight: 25,
    subcriteria: {
      examPurpose: {
        name: "Scopo Esame",
        weight: 5.0,
        description: "Definizione chiara degli obiettivi e quesiti",
        indicators: ["quesiti specifici", "obiettivi misurabili", "ambito definito", "limitazioni dichiarate"]
      },
      systematicApproach: {
        name: "Approccio Sistematico",
        weight: 6.0,
        description: "Metodologia strutturata e riproducibile",
        indicators: ["protocollo standardizzato", "sequenza logica", "criteri oggettivi", "riproducibilità"]
      },
      alternativeHypotheses: {
        name: "Ipotesi Alternative",
        weight: 5.0,
        description: "Considerazione di scenari pro e contro",
        indicators: ["ipotesi autenticità", "ipotesi falsificazione", "scenari intermedi", "valutazione probabilistica"]
      },
      examinationSequence: {
        name: "Sequenza Esami",
        weight: 4.0,
        description: "Priorità e logica dei procedimenti",
        indicators: ["ordine giustificato", "test non distruttivi prima", "conservazione evidenze", "documentazione step"]
      },
      analysisDetails: {
        name: "Dettagli Analisi",
        weight: 3.0,
        description: "Specificità tecniche delle procedure",
        indicators: ["parametri misurati", "soglie decisionali", "margini errore", "incertezze"]
      },
      appropriateEquipment: {
        name: "Attrezzature Appropriate",
        weight: 2.0,
        description: "Strumentazione idonea e calibrata",
        indicators: ["strumenti adeguati", "calibrazioni recenti", "manutenzioni", "specifiche tecniche"]
      }
    }
  },
  technicalAnalysis: {
    name: "Analisi Tecnica Specialistica",
    weight: 20,
    subcriteria: {
      graphologicalParameters: {
        name: "Parametri Grafologici",
        weight: 5.0,
        description: "Completezza parametri misurati (39 parametri ENFSI)",
        indicators: ["pressione tratto", "velocità esecuzione", "inclinazione", "spaziatura", "curvatura", "collegamenti"]
      },
      handwritingVariations: {
        name: "Variazioni Manoscrittura",
        weight: 4.0,
        description: "Analisi variabilità naturale vs. anomala",
        indicators: ["range normalità", "deviazioni significative", "pattern ripetitivi", "inconsistenze sospette"]
      },
      writingStyles: {
        name: "Stili Scrittura",
        weight: 4.0,
        description: "Classificazione e identificazione stili",
        indicators: ["corsivo/stampatello", "forme lettere", "legature", "personalizzazioni caratteristiche"]
      },
      comparisonProcess: {
        name: "Processo Comparazione",
        weight: 4.0,
        description: "Metodologia confronto sistematico",
        indicators: ["criterio per criterio", "pesi relativi", "soglie decisione", "algoritmi utilizzati"]
      },
      individualFeatures: {
        name: "Caratteristiche Individuali",
        weight: 3.0,
        description: "Distinzione caratteristiche individuali vs. classe",
        indicators: ["tratti unici", "specificità personali", "elementi comuni", "rarità statistiche"]
      }
    }
  },
  validation: {
    name: "Validazione e Controlli Qualità",
    weight: 15,
    subcriteria: {
      peerReview: {
        name: "Peer Review Obbligatoria",
        weight: 5.0,
        description: "Revisione indipendente da secondo esperto",
        indicators: ["revisore qualificato", "analisi indipendente", "concordanza/discordanza", "risoluzione differenze"]
      },
      evidenceConfirmation: {
        name: "Conferma Evidenze",
        weight: 4.0,
        description: "Validazione findings critici",
        indicators: ["evidenze decisive verificate", "metodi alternativi", "conferma indipendente", "documentazione validazione"]
      },
      qualityControls: {
        name: "Controlli Qualità",
        weight: 3.0,
        description: "Procedure QC implementate",
        indicators: ["controlli interni", "standard riferimento", "calibrazioni", "protocolli documentati"]
      },
      techniqueValidation: {
        name: "Validazione Tecniche",
        weight: 3.0,
        description: "Standard metodologici rispettati",
        indicators: ["tecniche validate", "letteratura scientifica", "protocolli ENFSI", "certificazioni"]
      }
    }
  },
  presentation: {
    name: "Presentazione e Valutazione",
    weight: 10,
    subcriteria: {
      clearResults: {
        name: "Chiarezza Risultati",
        weight: 4.0,
        description: "Comprensibilità e supporto evidenze",
        indicators: ["linguaggio chiaro", "risultati inequivocabili", "evidenze mostrate", "logica consequenziale"]
      },
      contextSignificance: {
        name: "Significatività Contesto",
        weight: 2.0,
        description: "Rilevanza nel contesto legale",
        indicators: ["impatto decisionale", "rilevanza quesiti", "contestualizzazione", "limitazioni dichiarate"]
      },
      expertOpinion: {
        name: "Opinione Motivata",
        weight: 2.0,
        description: "Giustificazioni e motivazioni dell'esperto",
        indicators: ["conclusioni motivate", "gradi certezza", "evidenze a supporto", "ragionamento logico"]
      },
      traceability: {
        name: "Tracciabilità",
        weight: 2.0,
        description: "Documentazione processo completa",
        indicators: ["step documentati", "decisioni motivate", "archivio evidenze", "riproducibilità"]
      }
    }
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
 * Analizza una perizia grafica utilizzando il framework ENFSI con approccio multi-step
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
  detailedAnalysis?: any;
}> {
  const startTime = Date.now();
  
  try {
    console.log('[PEER-REVIEW] Avvio analisi perizia grafica con framework ENFSI multi-step');
    
    const openai = await createOpenAIClient(userApiKey, userId);
    
    // STEP 1: Analisi strutturale preliminare per estrarre citazioni
    console.log('[PEER-REVIEW] Step 1: Analisi strutturale preliminare');
    const structuralPrompt = `Sei un esperto forense ENFSI. Analizza questo documento per estrarre elementi strutturali specifici.

Devi identificare e citare ESATTAMENTE dal testo (con virgolette):
- Identificatori caso/riferimenti
- Nomi di esperti/laboratori/trasmettitori  
- Date significative
- Metodologie menzionate
- Strumenti/attrezzature citate
- Conclusioni/opinioni espresse

Fornisci output JSON con citazioni specifiche:
{
  "documentStructure": {
    "caseIdentifiers": ["citazione 1", "citazione 2"],
    "expertInfo": ["nome esperto", "laboratorio"],  
    "dates": ["data 1", "data 2"],
    "methodologies": ["metodologia citata"],
    "equipment": ["strumento citato"],
    "conclusions": ["conclusione specifica"]
  },
  "documentStats": {
    "totalPages": 0,
    "hasPageNumbers": true/false,
    "hasSectionHeaders": true/false,
    "hasFooters": true/false
  },
  "keyFindings": [
    {
      "category": "struttura/metodologia/tecnica/validazione",
      "finding": "descrizione specifica", 
      "quote": "citazione esatta dal documento",
      "location": "sezione/paragrafo approssimativo",
      "severity": "critica/alta/media/bassa"
    }
  ]
}`;

    const structuralResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: structuralPrompt },
        { role: "user", content: `Analizza strutturalmente questo documento:\n\n${peritiaContent}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000
    });

    const structuralAnalysis = JSON.parse(structuralResponse.choices[0].message.content || '{}');
    
    // STEP 2: Analisi dettagliata per categoria ENFSI con sub-criteri
    console.log('[PEER-REVIEW] Step 2: Analisi dettagliata per categoria ENFSI');
    const detailedPrompt = `Sei un esperto forense ENFSI. Analizza questo documento secondo il framework ENFSI utilizzando i dati strutturali già identificati.

ANALISI STRUTTURALE DISPONIBILE:
${JSON.stringify(structuralAnalysis, null, 2)}

FRAMEWORK ENFSI DETTAGLIATO - evaluta ogni sub-criterio:

1. STRUTTURA OBBLIGATORIA (15%):
   - Identificatore caso (3%): presente/assente, qualità
   - Dati esperto/laboratorio (3%): completezza informazioni
   - Qualifiche esaminatore (3%): dettaglio credenziali
   - Firma/autenticazione (2%): presenza firma digitale/fisica  
   - Date complete (2%): tutte le date richieste
   - Trasmettitore (1%): identificazione mittente
   - Numerazione pagine (1%): sistema numerazione

2. DOCUMENTAZIONE MATERIALE (15%):
   - Elenco materiale (4%): completezza inventario
   - Stato ricevimento (3%): descrizione condizioni
   - Alterazioni/danni (3%): documentazione problemi
   - Info materiale (3%): metadati ricevuti
   - Chain of custody (2%): tracciabilità

3. METODOLOGIA (25%):
   - Scopo esame (5%): chiarezza obiettivi
   - Approccio sistematico (6%): metodologia strutturata
   - Ipotesi alternative (5%): considerazione pro/contro
   - Sequenza esami (4%): logica procedimenti
   - Dettagli analisi (3%): specificità tecniche
   - Attrezzature (2%): appropriatezza strumenti

4. ANALISI TECNICA (20%):
   - Parametri grafologici (5%): completezza parametri
   - Variazioni manoscrittura (4%): analisi variabilità
   - Stili scrittura (4%): classificazione stili
   - Processo comparazione (4%): metodologia confronto
   - Caratteristiche individuali (3%): vs. caratteristiche classe

5. VALIDAZIONE (15%):
   - Peer review (5%): presenza revisione
   - Conferma evidenze (4%): validazione findings
   - Controlli qualità (3%): procedure QC
   - Validazione tecniche (3%): standard metodologici

6. PRESENTAZIONE (10%):
   - Chiarezza risultati (4%): comprensibilità 
   - Significatività (2%): rilevanza contesto
   - Motivazioni (2%): giustificazioni opinioni
   - Tracciabilità (2%): documentazione processo

Per ogni SUB-CRITERIO fornisci:
- Score: 0-100
- Evidence: citazione specifica dal documento (se presente)  
- Gap: cosa manca specificamente
- Severity: quanto è grave la mancanza

RISPOSTA JSON:
{
  "categories": {
    "structureInfo": {
      "overallScore": 85,
      "subcriteria": {
        "caseIdentifier": { "score": 90, "evidence": "citazione", "gap": "dettaglio mancante", "severity": "media" },
        "expertData": { "score": 80, "evidence": "", "gap": "", "severity": "bassa" }
      }
    }
  },
  "criticalIssues": [
    {
      "category": "categoria",
      "issue": "problema specifico", 
      "evidence": "citazione dal documento",
      "impact": "impatto sulla validità",
      "recommendation": "azione specifica raccomandata"
    }
  ]
}`;

    const detailedResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: detailedPrompt },
        { role: "user", content: `Documento da analizzare:\n\n${peritiaContent}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 4000
    });

    const detailedAnalysis = JSON.parse(detailedResponse.choices[0].message.content || '{}');
    
    // STEP 3: Generazione suggerimenti actionable specifici
    console.log('[PEER-REVIEW] Step 3: Generazione suggerimenti specifici');
    const suggestionPrompt = `Basandoti sull'analisi dettagliata ENFSI, genera suggerimenti SPECIFICI e ACTIONABLE per migliorare la conformità.

DATI ANALISI:
${JSON.stringify(detailedAnalysis, null, 2)}

CITAZIONI STRUTTURALI:
${JSON.stringify(structuralAnalysis, null, 2)}

Genera suggerimenti che siano:
1. SPECIFICI: Non generici ma basati sui gap identificati
2. ACTIONABLE: Con step concreti da seguire
3. PRIORITIZZATI: Ordina per impatto sulla conformità
4. CON ESEMPI: Fornisci template/esempi quando possibile

Formato richiesto:
{
  "prioritySuggestions": [
    {
      "priority": "alta/media/bassa",
      "category": "categoria ENFSI",  
      "issue": "problema specifico identificato",
      "evidence": "citazione dal documento che dimostra il problema",
      "recommendation": "azione specifica da fare",
      "example": "esempio concreto o template",
      "impact": "miglioramento atteso nel punteggio"
    }
  ],
  "implementationRoadmap": {
    "immediate": ["azione 1", "azione 2"],
    "shortTerm": ["azione 3", "azione 4"], 
    "longTerm": ["azione 5"]
  }
}`;

    const suggestionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: suggestionPrompt },
        { role: "user", content: "Genera suggerimenti specifici basati sull'analisi fornita." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 2500
    });

    const suggestionAnalysis = JSON.parse(suggestionResponse.choices[0].message.content || '{}');

    // Conversione dei dati multi-step nel formato legacy per compatibilità
    console.log('[PEER-REVIEW] Elaborazione risultati per compatibilità legacy');
    
    const criteriaResults: any = {};
    let totalScore = 0;
    let totalWeight = 0;

    // Converte i risultati dettagliati nel formato legacy
    const categories = ['structureInfo', 'materialDocumentation', 'methodology', 'technicalAnalysis', 'validation', 'presentation'];
    
    for (const category of categories) {
      const categoryData = detailedAnalysis.categories?.[category];
      if (categoryData) {
        const weight = ENFSI_DETAILED_FRAMEWORK_IT[category as keyof typeof ENFSI_DETAILED_FRAMEWORK_IT]?.weight || 0;
        const score = categoryData.overallScore || 0;
        
        // Crea descrizione dettagliata con sub-criteri
        let details = `Analisi dettagliata (Score: ${score}%):\n\n`;
        
        if (categoryData.subcriteria) {
          Object.entries(categoryData.subcriteria).forEach(([subKey, subData]: [string, any]) => {
            details += `• ${subKey}: ${subData.score}% - `;
            if (subData.evidence) {
              details += `Evidenza: "${subData.evidence}" `;
            }
            if (subData.gap) {
              details += `Gap: ${subData.gap} `;
            }
            details += `(Severità: ${subData.severity})\n`;
          });
        }
        
        totalScore += (score * weight);
        totalWeight += weight;
        
        criteriaResults[category] = {
          score: score,
          details: details.trim(),
          weight: weight
        };
      }
    }

    // Genera suggerimenti consolidati
    let consolidatedSuggestions = "SUGGERIMENTI PRIORITIZZATI PER IL MIGLIORAMENTO:\n\n";
    
    // Aggiungi suggerimenti prioritari
    if (suggestionAnalysis.prioritySuggestions) {
      suggestionAnalysis.prioritySuggestions.forEach((suggestion: any, index: number) => {
        consolidatedSuggestions += `${index + 1}. [PRIORITÀ ${suggestion.priority?.toUpperCase()}] ${suggestion.category}\n`;
        consolidatedSuggestions += `   Problema: ${suggestion.issue}\n`;
        if (suggestion.evidence) {
          consolidatedSuggestions += `   Evidenza: "${suggestion.evidence}"\n`;
        }
        consolidatedSuggestions += `   Raccomandazione: ${suggestion.recommendation}\n`;
        if (suggestion.example) {
          consolidatedSuggestions += `   Esempio: ${suggestion.example}\n`;
        }
        consolidatedSuggestions += `   Impatto atteso: ${suggestion.impact}\n\n`;
      });
    }

    // Aggiungi roadmap implementazione
    if (suggestionAnalysis.implementationRoadmap) {
      consolidatedSuggestions += "ROADMAP DI IMPLEMENTAZIONE:\n\n";
      
      if (suggestionAnalysis.implementationRoadmap.immediate?.length) {
        consolidatedSuggestions += "🔴 AZIONI IMMEDIATE:\n";
        suggestionAnalysis.implementationRoadmap.immediate.forEach((action: string) => {
          consolidatedSuggestions += `• ${action}\n`;
        });
        consolidatedSuggestions += "\n";
      }
      
      if (suggestionAnalysis.implementationRoadmap.shortTerm?.length) {
        consolidatedSuggestions += "🟡 AZIONI BREVE TERMINE:\n";
        suggestionAnalysis.implementationRoadmap.shortTerm.forEach((action: string) => {
          consolidatedSuggestions += `• ${action}\n`;
        });
        consolidatedSuggestions += "\n";
      }
      
      if (suggestionAnalysis.implementationRoadmap.longTerm?.length) {
        consolidatedSuggestions += "🟢 AZIONI LUNGO TERMINE:\n";
        suggestionAnalysis.implementationRoadmap.longTerm.forEach((action: string) => {
          consolidatedSuggestions += `• ${action}\n`;
        });
      }
    }

    // Aggiungi note critiche se presenti
    if (detailedAnalysis.criticalIssues?.length) {
      consolidatedSuggestions += "\n⚠️ PROBLEMI CRITICI IDENTIFICATI:\n\n";
      detailedAnalysis.criticalIssues.forEach((issue: any, index: number) => {
        consolidatedSuggestions += `${index + 1}. ${issue.issue}\n`;
        consolidatedSuggestions += `   Categoria: ${issue.category}\n`;
        if (issue.evidence) {
          consolidatedSuggestions += `   Evidenza: "${issue.evidence}"\n`;
        }
        consolidatedSuggestions += `   Impatto: ${issue.impact}\n`;
        consolidatedSuggestions += `   Raccomandazione: ${issue.recommendation}\n\n`;
      });
    }

    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const classification = getClassification(overallScore);
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`[PEER-REVIEW] Analisi multi-step completata: Score ${overallScore}, Classificazione: ${classification}`);

    return {
      overallScore,
      classification,
      criteriaResults,
      suggestions: consolidatedSuggestions,
      processingTime,
      detailedAnalysis: {
        structural: structuralAnalysis,
        detailed: detailedAnalysis,
        suggestions: suggestionAnalysis
      }
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
  const framework = language === 'en' ? ENFSI_FRAMEWORK_EN : ENFSI_DETAILED_FRAMEWORK_IT;
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