/**
 * Servizio di raccomandazione AI per insights di grafologia
 * Questo servizio genera consigli personalizzati per gli utenti basati sui loro dati e attività
 */

import { db } from './db';
import { User, Recommendation, insertRecommendationSchema, recommendations, queries, signatures, signatureProjects, documents, users, insertRecommendationSchema as insertSchema } from '@shared/schema';
import { chatWithRAG, createOpenAIClient } from './openai';
import { eq, desc, and, sql, isNull, not, lt } from 'drizzle-orm';
import { log } from './vite';

interface UserData {
  user: User;
  recentQueries: any[];
  recentSignatures: any[];
  recentDocuments: any[];
  interests: string[];
}

/**
 * Genera raccomandazioni per un utente specifico
 * @param userId ID dell'utente per cui generare raccomandazioni
 * @param count Numero di raccomandazioni da generare
 * @returns Array di raccomandazioni generate
 */
export async function generateRecommendations(
  userId: number,
  count: number = 3,
  locale: string = 'it'
): Promise<Recommendation[]> {
  try {
    // Recupera i dati dell'utente necessari per generare raccomandazioni
    const userData = await collectUserData(userId);
    if (!userData) {
      log(`Impossibile generare raccomandazioni: dati utente non disponibili per userId ${userId}`, "recommendations");
      return generateFallbackRecommendations(userId, count, locale);
    }

    const apiKey = userData.user.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log(`Impossibile generare raccomandazioni: API key non disponibile`, "recommendations");
      return generateFallbackRecommendations(userId, count, locale);
    }

    // Genera nuove raccomandazioni tramite AI
    const generatedRecommendations = await createAIRecommendations(userData, count, apiKey);
    
    // Se non ci sono raccomandazioni generate, usa quelle di fallback
    if (!generatedRecommendations || generatedRecommendations.length === 0) {
      log(`Nessuna raccomandazione generata dall'AI, uso fallback`, "recommendations");
      return generateFallbackRecommendations(userId, count, locale);
    }
    
    // Salva le raccomandazioni nel database
    const savedRecommendations: Recommendation[] = [];
    for (const rec of generatedRecommendations) {
      try {
        const result = await db.insert(recommendations).values(rec).returning();
        if (result.length > 0) {
          savedRecommendations.push(result[0]);
        }
      } catch (err) {
        log(`Errore nel salvare la raccomandazione: ${err}`, "recommendations");
      }
    }

    // Se non ci sono raccomandazioni salvate, usa quelle di fallback
    if (savedRecommendations.length === 0) {
      return generateFallbackRecommendations(userId, count, locale);
    }

    return savedRecommendations;
  } catch (error) {
    log(`Errore nella generazione delle raccomandazioni: ${error}`, "recommendations");
    return generateFallbackRecommendations(userId, count, locale);
  }
}

/**
 * Genera raccomandazioni predefinite quando non è possibile generarle con l'AI
 * @param userId ID dell'utente
 * @param count Numero di raccomandazioni da generare
 * @param locale Lingua da utilizzare per i suggerimenti (default: 'it')
 * @returns Array di raccomandazioni predefinite
 */
async function generateFallbackRecommendations(userId: number, count: number = 3, locale: string = 'it'): Promise<Recommendation[]> {
  // Ottieni la lingua dell'utente dalle richieste HTTP o usa quella predefinita
  const isItalian = locale === 'it';

  // Definisci i suggerimenti predefiniti in base alla lingua
  const fallbackRecs = isItalian ? [
    // Suggerimenti in italiano - solo funzionalità implementate
    {
      userId,
      title: "Analizza firme con confronto avanzato 16+ parametri",
      content: "Utilizza il sistema di verifica firme con 16+ parametri OpenCV per analisi forensi accurate al 92%. Carica firme di riferimento e da verificare per confronti dettagliati.",
      category: "signature",
      relevanceScore: 0.9,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'it' }
    },
    {
      userId,
      title: "Estrai testo con OCR avanzato multilingue",
      content: "Utilizza il sistema OCR con Tesseract.js e 4 modalità di preprocessing (Auto, Enhance, Sharpen, Denoise) per documenti in italiano, inglese, francese, tedesco e spagnolo.",
      category: "document",
      relevanceScore: 0.85,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'it' }
    },
    {
      userId,
      title: "Ricerca semantica nei documenti con RAG",
      content: "Carica documenti nella base di conoscenza e usa la ricerca semantica con embedding OpenAI per trovare informazioni specifiche nei tuoi testi analizzati.",
      category: "learning",
      relevanceScore: 0.8,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'it' }
    },
    {
      userId,
      title: "Genera report PDF forensi con analisi AI",
      content: "Crea report PDF professionali con parametri tecnici, analisi grafologica AI via ChatGPT e immagini delle firme per documentazione forense completa.",
      category: "workflow",
      relevanceScore: 0.75,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'it' }
    },
    {
      userId,
      title: "Anonimizza documenti con 13 tipi di entità",
      content: "Utilizza il sistema di anonimizzazione AI per rimuovere nomi, indirizzi, telefoni, email, codici fiscali e altri dati sensibili da documenti PDF, DOCX e TXT.",
      category: "tool",
      relevanceScore: 0.7,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'it' }
    },
    {
      userId,
      title: "Valuta qualità firme con confidence meter",
      content: "Usa il sistema di valutazione qualità firme per analizzare risoluzione, contrasto, nitidezza e completezza delle immagini caricate prima dell'analisi.",
      category: "signature",
      relevanceScore: 0.65,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'it' }
    }
  ] : [
    // English suggestions - only implemented features
    {
      userId,
      title: "Analyze signatures with advanced 16+ parameters comparison",
      content: "Use the signature verification system with 16+ OpenCV parameters for 92% accurate forensic analysis. Upload reference and verification signatures for detailed comparisons.",
      category: "signature",
      relevanceScore: 0.9,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'en' }
    },
    {
      userId,
      title: "Extract text with advanced multilingual OCR",
      content: "Use the OCR system with Tesseract.js and 4 preprocessing modes (Auto, Enhance, Sharpen, Denoise) for documents in Italian, English, French, German, and Spanish.",
      category: "document",
      relevanceScore: 0.85,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'en' }
    },
    {
      userId,
      title: "Semantic search in documents with RAG",
      content: "Upload documents to the knowledge base and use semantic search with OpenAI embeddings to find specific information in your analyzed texts.",
      category: "learning",
      relevanceScore: 0.8,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'en' }
    },
    {
      userId,
      title: "Generate forensic PDF reports with AI analysis",
      content: "Create professional PDF reports with technical parameters, AI graphology analysis via ChatGPT, and signature images for complete forensic documentation.",
      category: "workflow",
      relevanceScore: 0.75,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'en' }
    },
    {
      userId,
      title: "Anonymize documents with 13 entity types",
      content: "Use the AI anonymization system to remove names, addresses, phones, emails, fiscal codes, and other sensitive data from PDF, DOCX, and TXT documents.",
      category: "tool",
      relevanceScore: 0.7,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'en' }
    },
    {
      userId,
      title: "Evaluate signature quality with confidence meter",
      content: "Use the signature quality assessment system to analyze resolution, contrast, sharpness, and completeness of uploaded images before analysis.",
      category: "signature",
      relevanceScore: 0.65,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback', locale: 'en' }
    }
  ];

  // Prima elimina tutte le raccomandazioni non visualizzate dell'utente
  // Questo evita l'accumulo di suggerimenti ogni volta che si preme "Aggiorna"
  try {
    await db.delete(recommendations)
      .where(
        and(
          eq(recommendations.userId, userId),
          eq(recommendations.viewed, false),
          eq(recommendations.dismissed, false)
        )
      );
    log(`Raccomandazioni precedenti eliminate per l'utente ${userId}`, "recommendations");
  } catch (err) {
    log(`Errore nell'eliminare le vecchie raccomandazioni: ${err}`, "recommendations");
  }

  // Salva le raccomandazioni di fallback nel database
  const savedRecommendations: Recommendation[] = [];
  
  // Prendi solo il numero richiesto di raccomandazioni
  const recsToSave = fallbackRecs.slice(0, count);
  
  for (const rec of recsToSave) {
    try {
      const result = await db.insert(recommendations).values(rec).returning();
      if (result.length > 0) {
        savedRecommendations.push(result[0]);
      }
    } catch (err) {
      log(`Errore nel salvare la raccomandazione di fallback: ${err}`, "recommendations");
    }
  }

  return savedRecommendations;
}

/**
 * Recupera le raccomandazioni per un utente specifico
 * @param userId ID dell'utente
 * @param limit Numero massimo di raccomandazioni da recuperare
 * @param includeViewed Includere raccomandazioni già visualizzate
 * @param includeDismissed Includere raccomandazioni rifiutate
 * @returns Array di raccomandazioni
 */
export async function getUserRecommendations(
  userId: number,
  limit: number = 5,
  includeViewed: boolean = false,
  includeDismissed: boolean = false
): Promise<Recommendation[]> {
  try {
    // Costruire la query con le condizioni
    const conditions = [eq(recommendations.userId, userId)];
    
    if (!includeViewed) {
      conditions.push(eq(recommendations.viewed, false));
    }
    
    if (!includeDismissed) {
      conditions.push(eq(recommendations.dismissed, false));
    }
    
    // Esegui la query con tutte le condizioni
    const result = await db
      .select()
      .from(recommendations)
      .where(and(...conditions))
      .orderBy(desc(recommendations.relevanceScore), desc(recommendations.createdAt))
      .limit(limit);

    return result;
  } catch (error) {
    log(`Errore nel recupero delle raccomandazioni: ${error}`, "recommendations");
    return [];
  }
}

/**
 * Aggiorna lo stato di una raccomandazione (visualizzata o rifiutata)
 * @param recommendationId ID della raccomandazione
 * @param userId ID dell'utente proprietario della raccomandazione
 * @param viewed Imposta come visualizzata
 * @param dismissed Imposta come rifiutata
 * @returns true se l'aggiornamento è avvenuto con successo
 */
export async function updateRecommendationStatus(
  recommendationId: number,
  userId: number,
  viewed?: boolean,
  dismissed?: boolean
): Promise<boolean> {
  try {
    const updateValues: any = {};
    
    if (viewed !== undefined) updateValues.viewed = viewed;
    if (dismissed !== undefined) updateValues.dismissed = dismissed;
    if (Object.keys(updateValues).length === 0) return false;
    
    updateValues.updatedAt = new Date();

    const result = await db
      .update(recommendations)
      .set(updateValues)
      .where(
        and(
          eq(recommendations.id, recommendationId),
          eq(recommendations.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  } catch (error) {
    log(`Errore nell'aggiornamento dello stato della raccomandazione: ${error}`, "recommendations");
    return false;
  }
}

/**
 * Raccoglie i dati dell'utente necessari per generare raccomandazioni personalizzate
 * @param userId ID dell'utente
 * @returns Dati dell'utente
 */
async function collectUserData(userId: number): Promise<UserData | null> {
  try {
    // Recupera le informazioni dell'utente
    const userResults = await db.select().from(users).where(eq(users.id, userId));
    if (userResults.length === 0) {
      log(`Utente con ID ${userId} non trovato`, "recommendations");
      return null;
    }
    const user = userResults[0];

    // Recupera le query recenti
    const recentQueries = await db
      .select()
      .from(queries)
      .where(eq(queries.userId, userId))
      .orderBy(desc(queries.createdAt))
      .limit(10);

    // Recupera i progetti di firme e le firme recenti
    const signatureProjs = await db
      .select()
      .from(signatureProjects)
      .where(eq(signatureProjects.userId, userId))
      .orderBy(desc(signatureProjects.createdAt))
      .limit(5);

    const projectIds = signatureProjs.map(p => p.id);
    
    // Utilizza la clausola IN con il formato corretto per SQL
    const recentSignatures = projectIds.length > 0 
      ? await db
          .select()
          .from(signatures)
          .where(
            sql`${signatures.projectId} IN (${sql.join(projectIds, sql`, `)})`
          )
          .orderBy(desc(signatures.createdAt))
          .limit(20)
      : [];

    // Recupera i documenti recenti
    const recentDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))
      .limit(10);

    // Deduce gli interessi dell'utente in base ai dati
    const interests = deduceUserInterests(user, recentQueries, recentSignatures, recentDocuments);

    return {
      user,
      recentQueries,
      recentSignatures,
      recentDocuments,
      interests
    };
  } catch (error) {
    log(`Errore nella raccolta dei dati dell'utente: ${error}`, "recommendations");
    return null;
  }
}

/**
 * Deduce gli interessi dell'utente in base ai suoi dati
 */
function deduceUserInterests(user: User, recentQueries: any[], recentSignatures: any[], recentDocuments: any[]): string[] {
  const interests: Set<string> = new Set();

  // Add interests based on profession
  if (user.profession) {
    // Se l'utente è un grafologo, aggiungi interessi specifici
    if (/grafo(logo|logia)|handwriting|graphology/i.test(user.profession)) {
      interests.add('forensic graphology');
      interests.add('signature verification');
    }
    // Se l'utente è un avvocato o lavora in campo legale
    if (/lawyer|attorney|legal|avvocato|legale|forense/i.test(user.profession)) {
      interests.add('document verification');
      interests.add('legal compliance');
      interests.add('court evidence');
    }
  }

  // Add interests based on queries
  for (const query of recentQueries) {
    if (query.query.toLowerCase().includes('firma') || query.query.toLowerCase().includes('signature')) {
      interests.add('signature analysis');
    }
    if (query.query.toLowerCase().includes('report') || query.query.toLowerCase().includes('documento') || query.query.toLowerCase().includes('document')) {
      interests.add('document analysis');
    }
  }

  // Add interest if user has signature projects
  if (recentSignatures.length > 0) {
    interests.add('signature verification');
  }

  // Add interest if user has documents
  if (recentDocuments.length > 0) {
    interests.add('document analysis');
  }

  return Array.from(interests);
}

/**
 * Genera raccomandazioni utilizzando l'AI in base ai dati dell'utente
 * @param userData Dati dell'utente
 * @param count Numero di raccomandazioni da generare
 * @param apiKey API key di OpenAI
 * @returns Array di raccomandazioni generate
 */
async function createAIRecommendations(userData: UserData, count: number, apiKey: string): Promise<any[]> {
  try {
    const { user, recentQueries, recentSignatures, recentDocuments, interests } = userData;
    
    // Preparazione delle raccomandazioni basate sui dati raccolti
    const existingData = {
      userProfile: {
        profession: user.profession || "Unknown",
        interests: interests
      },
      recentActivity: {
        queries: recentQueries.length,
        queryTopics: recentQueries.slice(0, 3).map(q => q.query),
        documents: recentDocuments.length,
        documentTypes: Array.from(new Set(recentDocuments.map(d => d.fileType))),
        signatures: recentSignatures.length
      }
    };

    // Preparazione del prompt per l'AI con i dati dell'utente
    const prompt = `
Sei un assistente esperto di grafologia forense che fornisce consigli personalizzati agli utenti di GrapholexInsight.
In base ai dati dell'utente, genera ${count} raccomandazioni personalizzate che possano migliorare la sua esperienza e produttività.

FUNZIONALITÀ IMPLEMENTATE NELL'APPLICAZIONE (suggerisci SOLO queste):
1. Sistema verifica firme con 16+ parametri OpenCV (accuratezza 92%)
2. OCR avanzato con Tesseract.js e 4 modalità preprocessing (Auto, Enhance, Sharpen, Denoise)
3. Supporto lingue: italiano, inglese, francese, tedesco, spagnolo
4. Ricerca semantica documenti con RAG e embedding OpenAI
5. Generazione report PDF forensi con analisi AI ChatGPT
6. Sistema anonimizzazione documenti con 13 tipi entità
7. Confidence meter per valutazione qualità firme
8. Database vettoriale pgvector per knowledge base
9. Upload documenti PDF, DOCX, TXT per analisi testuale
10. Confronto firme con calibrazione dimensioni reali (mm)

Dati dell'utente:
${JSON.stringify(existingData, null, 2)}

Genera raccomandazioni che:
- Suggeriscono come usare meglio le funzionalità già implementate
- Sono specifiche e actionable
- Si basano sull'attività dell'utente
- Non menzionano funzionalità non esistenti

Formato richiesto:
[
  {
    "title": "Titolo breve (max 60 caratteri)",
    "content": "Contenuto specifico e pratico (max 200 caratteri)",
    "category": "signature|document|workflow|learning|tool",
    "relevanceScore": 0.1-1.0
  }
]

IMPORTANTE: Rispondi SOLO con JSON array. Nessun testo aggiuntivo.
`;

    log(`Richiesta raccomandazioni AI per utente ${user.id}`, "recommendations");
    
    // Crea un client OpenAI utilizzando la funzione helper
    const openai = createOpenAIClient(apiKey);
    
    // Chiamata diretta all'API di OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: "Sei un assistente esperto di grafologia forense che fornisce consigli personalizzati."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const aiResponse = response.choices[0].message.content || "";
    
    // Parsing della risposta dell'AI (che deve essere in formato JSON)
    try {
      log(`Risposta AI ricevuta: ${aiResponse}`, "recommendations");
      
      // Prima tentare il parsing diretto (che dovrebbe funzionare grazie a response_format)
      const parsed = JSON.parse(aiResponse);
      
      // Estrai l'array di raccomandazioni
      let recommendations = [];
      
      if (Array.isArray(parsed)) {
        // Se è già un array, usalo direttamente
        recommendations = parsed;
      } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        // Se contiene una proprietà "recommendations" che è un array
        recommendations = parsed.recommendations;
      } else if (parsed.title && parsed.content && parsed.category) {
        // Se è un singolo oggetto con le proprietà richieste, lo trattiamo come una singola raccomandazione
        recommendations = [parsed];
      } else {
        // Cerca qualsiasi proprietà che contenga un array
        for (const key in parsed) {
          if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
            recommendations = parsed[key];
            break;
          }
        }
      }
      
      // Se non abbiamo trovato un array, proviamo a cercare manualmente le parentesi quadre
      if (recommendations.length === 0) {
        const startJson = aiResponse.indexOf('[');
        const endJson = aiResponse.lastIndexOf(']') + 1;
        
        if (startJson >= 0 && endJson > startJson) {
          const jsonStr = aiResponse.substring(startJson, endJson);
          recommendations = JSON.parse(jsonStr);
        }
      }
      
      // Verifica che abbiamo effettivamente delle raccomandazioni
      if (Array.isArray(recommendations) && recommendations.length > 0) {
        log(`Generate ${recommendations.length} raccomandazioni AI`, "recommendations");
        
        // Formattazione e validazione delle raccomandazioni
        const formattedRecs = recommendations.map((rec: any) => ({
          userId: user.id,
          title: rec.title || "Suggerimento personalizzato",
          content: rec.content || "Suggerimento basato sulla tua attività recente.",
          category: rec.category || "learning",
          relevanceScore: Math.min(1.0, Math.max(0.1, rec.relevanceScore || 0.7)),
          relatedDocumentIds: [],
          relatedSignatureIds: [],
          relatedQueryIds: [],
          metadata: { generatedBy: 'ai', model: 'gpt-4o' }
        })).slice(0, count);
        
        return formattedRecs;
      }
      
      log(`Nessuna raccomandazione trovata nella risposta: ${aiResponse}`, "recommendations");
      return [];
    } catch (parseError) {
      log(`Errore nel parsing della risposta AI: ${parseError}. Risposta: ${aiResponse}`, "recommendations");
      return [];
    }
  } catch (error) {
    log(`Errore nella creazione delle raccomandazioni AI: ${error}`, "recommendations");
    return [];
  }
}