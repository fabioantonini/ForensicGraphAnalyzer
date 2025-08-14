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
  userApiKey?: string
): Promise<GeneratedQuizQuestion[]> {
  const categoryPrompts = {
    grafologia: `domande di grafologia forense, analisi delle firme, autenticazione di documenti, perizia calligrafica, e tecniche di verifica della scrittura`,
    cultura: `domande di cultura generale su arte, storia, scienza, letteratura, geografia e conoscenze generali`,
    mista: `domande miste che combinano grafologia forense e cultura generale`
  };

  const prompt = `Genera esattamente ${totalQuestions} domande a scelta multipla di tipo quiz su ${categoryPrompts[category]}.

REGOLE IMPORTANTI:
- Ogni domanda deve avere esattamente 4 opzioni di risposta (A, B, C, D)
- Solo una risposta deve essere corretta
- Fornisci sempre una spiegazione dettagliata della risposta corretta
- Le domande devono essere di livello professionale ma comprensibili
- Varia la difficoltà: alcune facili, alcune medie, alcune difficili
- Per grafologia: usa terminologia tecnica accurata
- Per cultura generale: copri diverse aree tematiche

Rispondi SOLO con un oggetto JSON valido in questo formato:
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

NON aggiungere altro testo oltre al JSON.`;

  try {
    const openai = createOpenAIClient(userApiKey);
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "Sei un esperto di grafologia forense e cultura generale. Genera domande di quiz accurate e educative."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 4000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    const parsed = JSON.parse(content);
    
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid response format from OpenAI");
    }

    return parsed.questions.map((q: any) => ({
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
      category: q.category,
      difficulty: q.difficulty || "medium"
    }));

  } catch (error) {
    console.error("Error generating quiz questions:", error);
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