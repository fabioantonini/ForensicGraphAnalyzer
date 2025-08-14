import express from "express";
import { storage } from "./storage";
import { generateQuizQuestions, calculateScore, getPerformanceLevel, generatePersonalizedTips } from "./wake-up-service";
import { insertQuizSessionSchema, createQuizRequestSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

/**
 * POST /api/wake-up/start
 * Inizia una nuova sessione quiz
 */
router.post("/start", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const validation = createQuizRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Dati non validi", 
        details: validation.error.issues 
      });
    }

    const { category, totalQuestions } = validation.data;

    // Genera domande usando OpenAI (usa la chiave API dell'utente se disponibile)
    const generatedQuestions = await generateQuizQuestions(category, totalQuestions, req.user.openaiApiKey);

    // Crea sessione quiz
    const session = await storage.createQuizSession({
      userId: req.user.id,
      category,
      totalQuestions
    });

    // Salva le domande nel database
    const questions = [];
    const answers = [];

    for (let i = 0; i < generatedQuestions.length; i++) {
      const gq = generatedQuestions[i];
      
      const question = await storage.createQuizQuestion({
        sessionId: session.id,
        questionNumber: i + 1,
        question: gq.question,
        options: gq.options,
        correctAnswer: gq.correct,
        explanation: gq.explanation,
        category: gq.category,
        difficulty: gq.difficulty
      });
      
      const answer = await storage.createQuizAnswer({
        questionId: question.id
      });
      
      questions.push(question);
      answers.push(answer);
    }

    res.json({
      session,
      questions: questions.map(q => ({
        ...q,
        // Non inviare la risposta corretta al frontend
        correctAnswer: undefined,
        explanation: undefined
      }))
    });

  } catch (error) {
    console.error("Errore avvio quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wake-up/answer/:sessionId/:questionId
 * Risponde a una domanda
 */
router.post("/answer/:sessionId/:questionId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const sessionId = parseInt(req.params.sessionId);
    const questionId = parseInt(req.params.questionId);
    const { userAnswer, answerTimeMs } = req.body;

    if (isNaN(sessionId) || isNaN(questionId)) {
      return res.status(400).json({ error: "ID sessione o domanda non validi" });
    }

    if (userAnswer === undefined || userAnswer === null) {
      return res.status(400).json({ error: "Risposta utente richiesta" });
    }

    // Verifica ownership della sessione
    const session = await storage.getQuizSession(sessionId);
    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Sessione quiz non trovata" });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: "Sessione quiz non attiva" });
    }

    // Ottieni domanda
    const question = await storage.getQuizQuestion(questionId);
    if (!question || question.sessionId !== sessionId) {
      return res.status(404).json({ error: "Domanda non trovata" });
    }

    // Calcola se la risposta è corretta
    const isCorrect = userAnswer === question.correctAnswer;
    const points = calculateScore(isCorrect, answerTimeMs, question.difficulty);

    // Aggiorna la risposta
    const answer = await storage.getQuestionAnswer(questionId);
    if (!answer) {
      return res.status(404).json({ error: "Risposta non trovata" });
    }

    await storage.updateQuizAnswer(answer.id, {
      userAnswer,
      isCorrect,
      answerTimeMs,
      points,
      answeredAt: new Date()
    });

    // Aggiorna punteggio sessione
    const newScore = session.score + points;
    const newCurrentQuestion = session.currentQuestion + 1;

    // Controlla se il quiz è completato
    const isCompleted = newCurrentQuestion >= session.totalQuestions;
    
    await storage.updateQuizSession(sessionId, {
      score: newScore,
      currentQuestion: newCurrentQuestion,
      status: isCompleted ? 'completed' : 'active',
      completedAt: isCompleted ? new Date() : undefined
    });

    res.json({
      correct: isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      points,
      newScore,
      isCompleted,
      currentQuestion: newCurrentQuestion
    });

  } catch (error) {
    console.error("Errore risposta quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wake-up/reveal/:sessionId/:questionId
 * Rivela la spiegazione di una domanda
 */
router.post("/reveal/:sessionId/:questionId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const sessionId = parseInt(req.params.sessionId);
    const questionId = parseInt(req.params.questionId);

    if (isNaN(sessionId) || isNaN(questionId)) {
      return res.status(400).json({ error: "ID sessione o domanda non validi" });
    }

    // Verifica ownership della sessione
    const session = await storage.getQuizSession(sessionId);
    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Sessione quiz non trovata" });
    }

    // Ottieni domanda e risposta
    const question = await storage.getQuizQuestion(questionId);
    if (!question || question.sessionId !== sessionId) {
      return res.status(404).json({ error: "Domanda non trovata" });
    }

    const answer = await storage.getQuestionAnswer(questionId);
    if (!answer) {
      return res.status(404).json({ error: "Risposta non trovata" });
    }

    // Aggiorna timestamp reveal
    await storage.updateQuizAnswer(answer.id, {
      revealedAt: new Date()
    });

    res.json({
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      userAnswer: answer.userAnswer,
      isCorrect: answer.isCorrect,
      points: answer.points
    });

  } catch (error) {
    console.error("Errore reveal quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/wake-up/session/:sessionId
 * Ottieni dettagli di una sessione quiz
 */
router.get("/session/:sessionId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const sessionId = parseInt(req.params.sessionId);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "ID sessione non valido" });
    }

    // Verifica ownership della sessione
    const session = await storage.getQuizSession(sessionId);
    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Sessione quiz non trovata" });
    }

    // Ottieni domande e risposte
    const questions = await storage.getSessionQuestions(sessionId);
    const questionsWithAnswers = [];

    for (const question of questions) {
      const answer = await storage.getQuestionAnswer(question.id);
      questionsWithAnswers.push({
        ...question,
        answer: answer ? {
          id: answer.id,
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          points: answer.points,
          answeredAt: answer.answeredAt,
          revealedAt: answer.revealedAt
        } : null,
        // Nascondere i dettagli se non è stata ancora risposta o rivelata
        correctAnswer: answer?.answeredAt || answer?.revealedAt ? question.correctAnswer : undefined,
        explanation: answer?.revealedAt ? question.explanation : undefined
      });
    }

    res.json({
      session,
      questions: questionsWithAnswers
    });

  } catch (error) {
    console.error("Errore ottieni sessione quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wake-up/session/:sessionId/next
 * Avanza alla prossima domanda
 */
router.post("/session/:sessionId/next", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const sessionId = parseInt(req.params.sessionId);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "ID sessione non valido" });
    }

    // Verifica ownership della sessione
    const session = await storage.getQuizSession(sessionId);
    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Sessione quiz non trovata" });
    }

    // Avanza alla domanda successiva
    const nextQuestionNumber = session.currentQuestion + 1;
    
    // Verifica che non stiamo andando oltre il numero totale di domande
    if (nextQuestionNumber > session.totalQuestions) {
      return res.status(400).json({ error: "Quiz già completato" });
    }
    
    await storage.updateQuizSession(sessionId, {
      currentQuestion: nextQuestionNumber
    });

    // Verifica se esiste già una domanda per questo numero
    const existingQuestion = await storage.getQuizQuestionBySessionAndNumber(sessionId, nextQuestionNumber);
    
    if (!existingQuestion) {
      // Crea una nuova domanda usando il servizio Wake Up
      const { generateQuizQuestion } = await import('./wake-up-service');
      const newQuestion = await generateQuizQuestion(session.category);
      
      // Salva la domanda nel database
      const savedQuestion = await storage.createQuizQuestion({
        sessionId: sessionId,
        questionNumber: nextQuestionNumber,
        question: newQuestion.question,
        options: newQuestion.options,
        correctAnswer: newQuestion.correctAnswer,
        explanation: newQuestion.explanation
      });

      // Crea anche una risposta vuota per questa domanda
      await storage.createQuizAnswer({
        questionId: savedQuestion.id,
        userAnswer: null,
        answeredAt: null
      });
    }

    res.json({ success: true, currentQuestion: nextQuestionNumber });

  } catch (error) {
    console.error("Errore avanza domanda quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/wake-up/sessions
 * Ottieni tutte le sessioni quiz dell'utente
 */
router.get("/sessions", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    // Ottieni sessioni attive
    const activeSessions = await storage.getUserActiveQuizSessions(req.user.id);

    res.json({
      activeSessions
    });

  } catch (error) {
    console.error("Errore ottieni sessioni quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/wake-up/stats
 * Ottieni statistiche quiz dell'utente
 */
router.get("/stats", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const stats = await storage.getUserQuizStats(req.user.id);
    
    // Calcola performance level
    const scorePercentage = stats.averageScore > 0 ? (stats.averageScore / (stats.averageScore + 100)) * 100 : 0;
    const performance = getPerformanceLevel(scorePercentage);
    
    // Genera consigli personalizzati
    const tips = generatePersonalizedTips(
      'mista', // Default category for general tips
      stats.correctAnswers,
      stats.totalQuestions,
      15000 // Average time assumption
    );

    res.json({
      ...stats,
      performance,
      tips
    });

  } catch (error) {
    console.error("Errore statistiche quiz:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;