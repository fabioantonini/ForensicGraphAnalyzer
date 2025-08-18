import { QuizSession, QuizQuestion, CreateQuizRequest, InsertQuizQuestion, InsertQuizSession } from "@shared/schema";
import { createOpenAIClient } from "./openai";

export interface GeneratedQuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

/**
 * Genera domande di quiz usando OpenAI API
 */
export async function generateQuizQuestions(
  category: "grafologia" | "cultura" | "mista",
  totalQuestions: number,
  userApiKey?: string,
  language: string = "it",
  userId?: number,
  model: string = "gpt-4o"
): Promise<GeneratedQuizQuestion[]> {
  const categoryPrompts = {
    it: {
      grafologia: `domande di grafologia forense, analisi delle firme, autenticazione di documenti, perizia calligrafica, e tecniche di verifica della scrittura`,
      cultura: `domande di cultura generale su arte, storia, scienza, letteratura, geografia e conoscenze generali`,
      mista: `domande miste che combinano grafologia forense e cultura generale`
    },
    en: {
      grafologia: `forensic graphology questions, signature analysis, document authentication, handwriting examination, and writing verification techniques`,
      cultura: `general knowledge questions about art, history, science, literature, geography and general knowledge`,
      mista: `mixed questions combining forensic graphology and general culture`
    }
  };

  const instructions = {
    it: {
      rules: `REGOLE IMPORTANTI:
- Ogni domanda deve avere esattamente 4 opzioni di risposta (A, B, C, D)
- Solo una risposta deve essere corretta
- Fornisci sempre una spiegazione dettagliata della risposta corretta
- Le domande devono essere di livello professionale ma comprensibili
- Varia la difficoltà: alcune facili, alcune medie, alcune difficili
- Per grafologia: usa terminologia tecnica accurata
- Per cultura generale: copri diverse aree tematiche`,
      format: `Rispondi SOLO con un oggetto JSON valido in questo formato:
{
  "questions": [
    {
      "question": "Testo della domanda?",
      "options": ["Opzione A", "Opzione B", "Opzione C", "Opzione D"],
      "correct": 2,
      "explanation": "Spiegazione dettagliata del perché la risposta C è corretta...",
      "category": "${category}",
      "difficulty": "medium"
    }
  ]
}

NON aggiungere altro testo oltre al JSON.`
    },
    en: {
      rules: `IMPORTANT RULES:
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one answer must be correct
- Always provide a detailed explanation of the correct answer
- Questions should be professional level but understandable
- Vary difficulty: some easy, some medium, some hard
- For graphology: use accurate technical terminology
- For general knowledge: cover different thematic areas`,
      format: `Respond ONLY with a valid JSON object in this format:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 2,
      "explanation": "Detailed explanation of why option C is correct...",
      "category": "${category}",
      "difficulty": "medium"
    }
  ]
}

DO NOT add any other text besides the JSON.`
    }
  };

  const lang = language === 'en' ? 'en' : 'it';
  
  // Sistema anti-ripetizione con istruzioni specifiche
  const antiRepetitionInstructions = {
    it: [
      "EVITA domande ripetitive o troppo simili tra loro",
      "INCLUDI diverse tipologie: definizioni, applicazioni, confronti, analisi di casi",
      "VARIA la complessità linguistica e la lunghezza delle domande", 
      "DIVERSIFICA gli argomenti specifici all'interno della categoria scelta",
      "BILANCIA domande teoriche e pratiche per mantenere varietà"
    ],
    en: [
      "AVOID repetitive or too similar questions",
      "INCLUDE different types: definitions, applications, comparisons, case analyses", 
      "VARY linguistic complexity and question length",
      "DIVERSIFY specific topics within the chosen category",
      "BALANCE theoretical and practical questions to maintain variety"
    ]
  };

  const antiRepetitionText = antiRepetitionInstructions[lang].join('\n- ');

  const prompt = `Generate exactly ${totalQuestions} multiple choice quiz questions about ${categoryPrompts[lang][category]}.

ANTI-REPETITION REQUIREMENTS:
- ${antiRepetitionText}

${instructions[lang].rules}

${instructions[lang].format}`;

  try {
    const openai = await createOpenAIClient(userApiKey, userId);
    const systemPrompt = lang === 'en' 
      ? "You are a forensic graphology expert and general knowledge specialist. Generate accurate and educational quiz questions."
      : "Sei un esperto di grafologia forense e cultura generale. Genera domande di quiz accurate e educative.";

    console.log(`[WAKE-UP] Generating quiz with model: ${model}`);
    
    // Import helper function
    const { createOpenAIRequestConfig } = await import("./openai");
    
    const requestConfig = createOpenAIRequestConfig(
      model, // User-selected model (GPT-4o default, GPT-5 available)
      [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      {
        response_format: { type: "json_object" },
        temperature: 0.8,
        maxTokens: 4000
      }
    );
    
    console.log(`[WAKE-UP] Request config:`, JSON.stringify(requestConfig, null, 2));
    
    const response = await openai.chat.completions.create(requestConfig);

    console.log(`[WAKE-UP] OpenAI response status:`, response);
    console.log(`[WAKE-UP] Response choices:`, response.choices);
    console.log(`[WAKE-UP] First choice:`, response.choices[0]);
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error("No choices received from OpenAI");
    }
    
    const content = response.choices[0].message.content;
    console.log(`[WAKE-UP] Message content:`, content);
    
    if (!content) {
      console.log(`[WAKE-UP] Full response object:`, JSON.stringify(response, null, 2));
      throw new Error("No content received from OpenAI");
    }

    const parsed = JSON.parse(content);
    console.log(`[WAKE-UP] Parsed JSON:`, parsed);
    
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.log(`[WAKE-UP] Invalid format - questions:`, parsed.questions);
      throw new Error("Invalid response format from OpenAI");
    }

    const questions = parsed.questions.map((q: any) => ({
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
      category: q.category,
      difficulty: q.difficulty || "medium"
    }));
    
    console.log(`[WAKE-UP] Returning ${questions.length} questions`);
    return questions;

  } catch (error) {
    console.error("Error generating quiz questions:", error);
    
    // Log dettagliato per debug
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        userApiKey: userApiKey ? "provided" : "not provided",
        systemKey: process.env.OPENAI_API_KEY ? "available" : "missing"
      });
    }
    
    throw new Error(`Failed to generate quiz questions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calcola il punteggio per una risposta
 */
export function calculateScore(isCorrect: boolean, answerTimeMs: number, difficulty: string): number {
  if (!isCorrect) return 0;
  
  const basePoints = {
    easy: 5,
    medium: 10,
    hard: 15
  };
  
  const points = basePoints[difficulty as keyof typeof basePoints] || 10;
  
  // Bonus velocità: se risponde in meno di 10 secondi
  const speedBonusThreshold = 10000; // 10 secondi
  const speedBonus = answerTimeMs && answerTimeMs < speedBonusThreshold ? 2 : 0;
  
  return points + speedBonus;
}

/**
 * Determina il livello di performance basato sul punteggio percentuale
 */
export function getPerformanceLevel(scorePercentage: number): {
  level: string;
  message: string;
  color: string;
} {
  if (scorePercentage >= 90) {
    return {
      level: "Eccellente",
      message: "Prestazione straordinaria! Hai una conoscenza approfondita della materia.",
      color: "text-green-600"
    };
  } else if (scorePercentage >= 75) {
    return {
      level: "Ottimo",
      message: "Ottima prestazione! Dimostri una buona padronanza degli argomenti.",
      color: "text-blue-600"
    };
  } else if (scorePercentage >= 60) {
    return {
      level: "Buono",
      message: "Buona prestazione! Continua a studiare per migliorare ulteriormente.",
      color: "text-yellow-600"
    };
  } else if (scorePercentage >= 40) {
    return {
      level: "Sufficiente",
      message: "Prestazione sufficiente. Ti consiglio di approfondire gli argomenti.",
      color: "text-orange-600"
    };
  } else {
    return {
      level: "Insufficiente",
      message: "È necessario studiare di più per migliorare le tue conoscenze.",
      color: "text-red-600"
    };
  }
}

/**
 * Genera consigli personalizzati basati sulle prestazioni
 */
export function generatePersonalizedTips(
  category: string,
  correctAnswers: number,
  totalQuestions: number,
  averageTime: number
): string[] {
  const tips: string[] = [];
  const accuracy = (correctAnswers / totalQuestions) * 100;
  
  // Consigli basati sull'accuratezza
  if (accuracy < 50) {
    if (category === "grafologia") {
      tips.push("📚 Approfondisci i fondamenti della grafologia forense");
      tips.push("🔍 Studia le tecniche di analisi delle firme e dei tratti");
    } else {
      tips.push("📖 Amplia le tue conoscenze di cultura generale");
      tips.push("🌐 Leggi di più su arte, storia e scienza");
    }
  } else if (accuracy < 75) {
    if (category === "grafologia") {
      tips.push("⚖️ Concentrati sugli aspetti legali della perizia calligrafica");
      tips.push("🔬 Studia le tecnologie moderne per l'analisi documentale");
    } else {
      tips.push("🎯 Focalizzati sulle aree tematiche più deboli");
      tips.push("📚 Approfondisci gli argomenti dove hai sbagliato");
    }
  } else {
    tips.push("🎉 Eccellente! Continua a mantenerti aggiornato");
    tips.push("🏆 Prova quiz più difficili per sfidare te stesso");
  }
  
  // Consigli basati sulla velocità
  if (averageTime > 30000) { // più di 30 secondi per domanda
    tips.push("⏱️ Prova a rispondere più velocemente alle domande facili");
    tips.push("🧠 Esercitati a riconoscere i pattern nelle domande");
  }
  
  return tips;
}

/**
 * Genera una singola domanda di quiz usando OpenAI API
 */
export async function generateQuizQuestion(
  category: "grafologia" | "cultura" | "mista",
  userApiKey?: string
): Promise<GeneratedQuizQuestion> {
  const questions = await generateQuizQuestions(category, 1, userApiKey);
  return questions[0];
}