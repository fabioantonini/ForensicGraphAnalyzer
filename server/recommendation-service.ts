/**
 * Servizio di raccomandazione AI per insights di grafologia
 * Questo servizio genera consigli personalizzati per gli utenti basati sui loro dati e attività
 */

import { db } from './db';
import { User, Recommendation, insertRecommendationSchema, recommendations, queries, signatures, signatureProjects, documents, users, insertRecommendationSchema as insertSchema } from '@shared/schema';
import { chatWithRAG } from './openai';
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
  count: number = 3
): Promise<Recommendation[]> {
  try {
    // Recupera i dati dell'utente necessari per generare raccomandazioni
    const userData = await collectUserData(userId);
    if (!userData) {
      log(`Impossibile generare raccomandazioni: dati utente non disponibili per userId ${userId}`, "recommendations");
      return generateFallbackRecommendations(userId, count);
    }

    const apiKey = userData.user.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log(`Impossibile generare raccomandazioni: API key non disponibile`, "recommendations");
      return generateFallbackRecommendations(userId, count);
    }

    // Genera nuove raccomandazioni tramite AI
    const generatedRecommendations = await createAIRecommendations(userData, count, apiKey);
    
    // Se non ci sono raccomandazioni generate, usa quelle di fallback
    if (!generatedRecommendations || generatedRecommendations.length === 0) {
      log(`Nessuna raccomandazione generata dall'AI, uso fallback`, "recommendations");
      return generateFallbackRecommendations(userId, count);
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
      return generateFallbackRecommendations(userId, count);
    }

    return savedRecommendations;
  } catch (error) {
    log(`Errore nella generazione delle raccomandazioni: ${error}`, "recommendations");
    return generateFallbackRecommendations(userId, count);
  }
}

/**
 * Genera raccomandazioni predefinite quando non è possibile generarle con l'AI
 * @param userId ID dell'utente
 * @param count Numero di raccomandazioni da generare
 * @returns Array di raccomandazioni predefinite
 */
async function generateFallbackRecommendations(userId: number, count: number = 3): Promise<Recommendation[]> {
  const fallbackRecs = [
    {
      userId,
      title: "Analizza le firme contestate con confronto avanzato",
      content: "Utilizza il tool di confronto firme per analizzare differenze tra firme contestate e campioni di riferimento.",
      category: "signature",
      relevanceScore: 0.9,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback' }
    },
    {
      userId,
      title: "Ottimizza l'estrazione del testo dai documenti",
      content: "Migliora la qualità dell'estrazione testuale configurando le opzioni avanzate OCR per documenti poco leggibili.",
      category: "document",
      relevanceScore: 0.85,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback' }
    },
    {
      userId,
      title: "Esplora l'analisi approfondita dei documenti",
      content: "Utilizza la ricerca semantica per trovare informazioni nascoste nei tuoi documenti analizzati.",
      category: "learning",
      relevanceScore: 0.8,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback' }
    },
    {
      userId,
      title: "Crea report personalizzati per casi forensi",
      content: "Utilizza i modelli di report avanzati per creare documentazione professionale delle tue analisi.",
      category: "workflow",
      relevanceScore: 0.75,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback' }
    },
    {
      userId,
      title: "Migliora l'accuratezza con il training AI",
      content: "Allena l'AI con i tuoi dati specifici per ottenere analisi più accurate per il tuo tipo di documenti.",
      category: "tool",
      relevanceScore: 0.7,
      viewed: false,
      dismissed: false,
      relatedDocumentIds: [],
      relatedSignatureIds: [],
      relatedQueryIds: [],
      metadata: { generatedBy: 'fallback' }
    }
  ];

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
    
    const recentSignatures = projectIds.length > 0 
      ? await db
          .select()
          .from(signatures)
          .where(sql`${signatures.projectId} IN (${projectIds.join(',')})`)
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

    // Preparazione del prompt per l'AI
    const prompt = `
Sei un assistente esperto di grafologia forense che fornisce consigli personalizzati agli utenti di Grapholex Insight.
In base ai dati dell'utente, genera ${count} raccomandazioni personalizzate che possano migliorare la sua esperienza e produttività.

Dati dell'utente:
${JSON.stringify(existingData, null, 2)}

Ogni raccomandazione deve essere strutturata come segue:
1. Un titolo breve e incisivo (massimo 60 caratteri)
2. Un contenuto dettagliato (massimo 200 caratteri) che spiega il consiglio
3. Una categoria tra: 'document', 'signature', 'workflow', 'learning' o 'tool'
4. Un punteggio di rilevanza da 0.1 a 1.0 basato sulla probabilità che la raccomandazione sia utile per l'utente

Rispondi solo con un array JSON di raccomandazioni, senza testo aggiuntivo. Esempio:
[
  {
    "title": "Titolo della raccomandazione 1",
    "content": "Contenuto dettagliato della raccomandazione 1",
    "category": "categoria",
    "relevanceScore": 0.85
  },
  ...
]
`;

    // Chiamata all'API di OpenAI per generare le raccomandazioni
    const aiResponse = await chatWithRAG(prompt, [], apiKey, "gpt-4o", 0.7);
    
    try {
      // Parsing della risposta dell'AI (che deve essere in formato JSON)
      const startJson = aiResponse.indexOf('[');
      const endJson = aiResponse.lastIndexOf(']') + 1;
      
      if (startJson >= 0 && endJson > startJson) {
        const jsonStr = aiResponse.substring(startJson, endJson);
        const recommendations = JSON.parse(jsonStr);
        
        // Formattazione e validazione delle raccomandazioni
        return recommendations.map((rec: any) => ({
          userId: user.id,
          title: rec.title,
          content: rec.content,
          category: rec.category,
          relevanceScore: Math.min(1.0, Math.max(0.1, rec.relevanceScore)),
          relatedDocumentIds: [],
          relatedSignatureIds: [],
          relatedQueryIds: [],
          metadata: { generatedBy: 'ai', model: 'gpt-4o' }
        }));
      } else {
        log(`Formato di risposta AI non valido: ${aiResponse}`, "recommendations");
        return [];
      }
    } catch (parseError) {
      log(`Errore nel parsing della risposta AI: ${parseError}. Risposta: ${aiResponse}`, "recommendations");
      return [];
    }
  } catch (error) {
    log(`Errore nella creazione delle raccomandazioni AI: ${error}`, "recommendations");
    return [];
  }
}