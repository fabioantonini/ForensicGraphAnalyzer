import { useState, useEffect } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  BookOpen, 
  Globe,
  Play,
  Eye,
  EyeOff,
  ChevronRight,
  BarChart3,
  Trash2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface QuizSession {
  id: number;
  userId: number;
  category: string;
  totalQuestions: number;
  currentQuestion: number;
  score: number;
  status: string;
  startedAt: string;
  completedAt?: string;
}

interface QuizQuestion {
  id: number;
  sessionId: number;
  questionNumber: number;
  question: string;
  options: string[];
  correctAnswer?: number;
  explanation?: string;
  category: string;
  difficulty: string;
  answer?: {
    id: number;
    userAnswer: number | null;
    isCorrect: boolean | null;
    points: number;
    answeredAt: string | null;
    revealedAt: string | null;
  };
}

interface QuizStats {
  totalSessions: number;
  completedSessions: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  performance: {
    level: string;
    message: string;
    color: string;
  };
  tips: string[];
}

export default function WakeUpPage() {
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set());
  const [isAnswering, setIsAnswering] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [hasAbandonedSession, setHasAbandonedSession] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  // Fetch active sessions
  const { data: sessions } = useQuery({
    queryKey: ["/api/wake-up/sessions"],
  });

  // Fetch quiz stats
  const { data: stats } = useQuery<QuizStats>({
    queryKey: ["/api/wake-up/stats"],
  });

  // No longer auto-load active sessions - user must explicitly click to resume

  // Start new quiz mutation
  const startQuizMutation = useMutation({
    mutationFn: async (data: { category: string; totalQuestions: number }) => {
      const response = await fetch("/api/wake-up/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to start quiz");
      return response.json();
    },
    onSuccess: (data) => {
      setActiveSession(data.session);
      setCurrentQuestions(data.questions);
      setSelectedAnswers({});
      setRevealedQuestions(new Set());
      setHasAbandonedSession(false); // Reset abandoned flag when starting new quiz
      queryClient.invalidateQueries({ queryKey: ["/api/wake-up/sessions"] });
      toast({
        title: "Quiz avviato!",
        description: `Nuova sessione ${data.session.category} con ${data.session.totalQuestions} domande.`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile avviare il quiz",
        variant: "destructive"
      });
    }
  });

  // Answer question mutation
  const answerQuestionMutation = useMutation({
    mutationFn: async (data: { 
      sessionId: number; 
      questionId: number; 
      userAnswer: number; 
      answerTimeMs: number;
    }) => {
      const response = await fetch(`/api/wake-up/answer/${data.sessionId}/${data.questionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAnswer: data.userAnswer, answerTimeMs: data.answerTimeMs }),
      });
      if (!response.ok) throw new Error("Failed to answer question");
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update the current session
      if (activeSession) {
        setActiveSession({
          ...activeSession,
          score: data.newScore,
          currentQuestion: data.currentQuestion,
          status: data.isCompleted ? 'completed' : 'active',
          completedAt: data.isCompleted ? new Date().toISOString() : activeSession.completedAt
        });
      }

      // Update the question with the answer
      setCurrentQuestions(prev => prev.map(q => 
        q.id === variables.questionId 
          ? {
              ...q,
              correctAnswer: data.correctAnswer,
              explanation: data.explanation,
              answer: {
                id: q.answer?.id || 0,
                userAnswer: variables.userAnswer,
                isCorrect: data.correct,
                points: data.points,
                answeredAt: new Date().toISOString(),
                revealedAt: null
              }
            }
          : q
      ));

      queryClient.invalidateQueries({ queryKey: ["/api/wake-up/stats"] });
      
      if (data.isCompleted) {
        // Invalida anche la cache delle sessioni quando il quiz è completato
        queryClient.invalidateQueries({ queryKey: ["/api/wake-up/sessions"] });
        
        toast({
          title: "Quiz completato! 🎉",
          description: `Hai ottenuto ${data.newScore} punti!`
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare la risposta",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsAnswering(false);
    }
  });

  // Reveal explanation mutation
  const revealMutation = useMutation({
    mutationFn: async (data: { sessionId: number; questionId: number }) => {
      const response = await fetch(`/api/wake-up/reveal/${data.sessionId}/${data.questionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to reveal explanation");
      return response.json();
    },
    onSuccess: (data, variables) => {
      setRevealedQuestions(prev => new Set(prev.add(variables.questionId)));
      
      // Update the question with revealed data
      setCurrentQuestions(prev => prev.map(q => 
        q.id === variables.questionId 
          ? {
              ...q,
              correctAnswer: data.correctAnswer,
              explanation: data.explanation,
              answer: q.answer ? {
                ...q.answer,
                revealedAt: new Date().toISOString()
              } : undefined
            }
          : q
      ));
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile rivelare la spiegazione",
        variant: "destructive"
      });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/wake-up/session/${sessionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Failed to delete session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wake-up/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wake-up/stats'] });
      toast({
        title: "Sessione eliminata",
        description: "La sessione quiz è stata eliminata con successo"
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la sessione",
        variant: "destructive"
      });
    }
  });

  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/wake-up/stats', {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Failed to reset stats");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wake-up/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wake-up/stats'] });
      toast({
        title: "Statistiche resettate",
        description: `${data.deletedSessions} sessioni eliminate. Tutte le statistiche sono state azzerate.`
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Impossibile resettare le statistiche",
        variant: "destructive"
      });
    }
  });

  const handleStartQuiz = (category: "grafologia" | "cultura" | "mista", totalQuestions: number = 5) => {
    const currentLanguage = i18n.language || 'it';
    
    // Check if there's an active session first
    if ((sessions as any)?.activeSessions && (sessions as any).activeSessions.length > 0) {
      const activeSessionsCount = (sessions as any).activeSessions.length;
      const confirmed = confirm(
        `Attenzione: hai ${activeSessionsCount} sessione/i quiz attiva/e in corso.\n\nSe procedi con un nuovo quiz, la sessione esistente verrà abbandonata e perderai i progressi non salvati.\n\nVuoi davvero creare un nuovo quiz? (consigliamo di completare prima le sessioni attive)`
      );
      if (!confirmed) {
        return;
      }
    }
    
    startQuizMutation.mutate({ category, totalQuestions, language: currentLanguage });
  };

  const handleResumeSession = (session: any) => {
    // Fetch questions for this session
    fetch(`/api/wake-up/session/${session.id}`)
      .then(response => response.json())
      .then(data => {
        setActiveSession(session);
        setCurrentQuestions(data.questions || []);
      })
      .catch(error => {
        console.error("Error loading session questions:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare la sessione",
          variant: "destructive"
        });
      });
  };

  const handleAnswerQuestion = (questionId: number, userAnswer: number) => {
    if (!activeSession || isAnswering) return;
    
    setIsAnswering(true);
    setSelectedAnswers(prev => ({ ...prev, [questionId]: userAnswer }));

    const answerTimeMs = 15000; // Mock answer time for now
    
    answerQuestionMutation.mutate({
      sessionId: activeSession.id,
      questionId,
      userAnswer,
      answerTimeMs
    });
  };

  const handleRevealExplanation = (questionId: number) => {
    if (!activeSession) return;
    
    revealMutation.mutate({
      sessionId: activeSession.id,
      questionId
    });
  };

  const handleContinueSession = async (sessionId: number) => {
    try {
      const response = await fetch(`/api/wake-up/session/${sessionId}`);
      if (!response.ok) throw new Error("Failed to load session");
      const data = await response.json();
      

      
      setActiveSession(data.session);
      setCurrentQuestions(data.questions || []);
      setSelectedAnswers({});
      setRevealedQuestions(new Set());
      setHasAbandonedSession(false); // Reset abandoned flag
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la sessione.",
        variant: "destructive"
      });
    }
  };

  const handleNextQuestion = async () => {
    if (!activeSession || !currentQuestions.length) return;
    
    const nextQuestionNumber = activeSession.currentQuestion + 1;
    
    try {
      // Update session in database
      const response = await fetch(`/api/wake-up/session/${activeSession.id}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      if (!response.ok) throw new Error("Failed to update session");
      
      const updatedSession = {
        ...activeSession,
        currentQuestion: nextQuestionNumber
      };
      
      // Se abbiamo raggiunto l'ultima domanda, completa la sessione
      if (nextQuestionNumber >= activeSession.totalQuestions) {
        updatedSession.status = 'completed';
      }
      
      setActiveSession(updatedSession);
      
      toast({
        title: "Avanzamento salvato",
        description: `Passato alla domanda ${nextQuestionNumber + 1}`
      });
    } catch (error) {
      console.error("Error updating session:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare l'avanzamento",
        variant: "destructive"
      });
    }
  };

  const canProceedToNext = () => {
    const currentQ = getCurrentQuestion();
    if (!currentQ || !currentQ.answer?.answeredAt || !activeSession) {
      return false;
    }
    
    // Verifica se ci sono ancora domande dopo quella corrente
    const currentQuestionNumber = currentQ.questionNumber;
    return currentQuestionNumber < activeSession.totalQuestions;
  };

  const getCurrentQuestion = () => {
    if (!activeSession || !currentQuestions.length) return null;
    // currentQuestion in DB is 0-based for internal tracking, but questionNumber is 1-based
    const targetQuestionNumber = activeSession.currentQuestion + 1;
    return currentQuestions.find(q => q.questionNumber === targetQuestionNumber);
  };

  const getAnsweredQuestions = () => {
    return currentQuestions.filter(q => q.answer?.answeredAt);
  };

  const categoryIcons = {
    grafologia: BookOpen,
    cultura: Globe,
    mista: Brain
  };

  const categoryLabels = {
    grafologia: t('wakeUpQuiz.categories.graphology'),
    cultura: t('wakeUpQuiz.categories.cultura'),
    mista: t('wakeUpQuiz.categories.misto')
  };

  const difficultyColors = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800", 
    hard: "bg-red-100 text-red-800"
  };

  const getDifficultyLabel = (difficulty: string) => {
    const mapping: Record<string, string> = {
      "easy": t('wakeUpQuiz.difficulty.easy'),
      "medium": t('wakeUpQuiz.difficulty.medium'), 
      "hard": t('wakeUpQuiz.difficulty.hard')
    };
    return mapping[difficulty] || difficulty;
  };

  const getPerformanceLevelTranslation = (level: string) => {
    const mapping: Record<string, string> = {
      "Eccellente": t('wakeUpQuiz.statisticsDialog.performanceLevels.excellent'),
      "Buono": t('wakeUpQuiz.statisticsDialog.performanceLevels.good'),
      "Medio": t('wakeUpQuiz.statisticsDialog.performanceLevels.average'),
      "Sotto la Media": t('wakeUpQuiz.statisticsDialog.performanceLevels.belowAverage'),
      "Insufficiente": t('wakeUpQuiz.statisticsDialog.performanceLevels.poor'),
      "Excellent": t('wakeUpQuiz.statisticsDialog.performanceLevels.excellent'),
      "Good": t('wakeUpQuiz.statisticsDialog.performanceLevels.good'),
      "Average": t('wakeUpQuiz.statisticsDialog.performanceLevels.average'),
      "Below Average": t('wakeUpQuiz.statisticsDialog.performanceLevels.belowAverage'),
      "Poor": t('wakeUpQuiz.statisticsDialog.performanceLevels.poor')
    };
    return mapping[level] || level;
  };

  const getPerformanceMessageTranslation = (message: string) => {
    const mapping: Record<string, string> = {
      "È necessario studiare di più per migliorare le tue conoscenze.": t('wakeUpQuiz.statisticsDialog.studyMoreMessage'),
      "You need to study more to improve your knowledge.": t('wakeUpQuiz.statisticsDialog.studyMoreMessage')
    };
    return mapping[message] || message;
  };

  const getTipTranslation = (tip: string) => {
    // Check for partial matches to handle backend-generated text
    if (tip.includes("Focalizzati sulle aree") || tip.includes("Focus on weaker")) {
      return t('wakeUpQuiz.statisticsDialog.suggestions.focusWeakAreas');
    }
    if (tip.includes("Approfondisci gli argomenti") || tip.includes("Study topics where")) {
      return t('wakeUpQuiz.statisticsDialog.suggestions.studyMistakes');
    }
    
    // Exact mappings as fallback
    const mapping: Record<string, string> = {
      "Focalizzati sulle aree tematiche più deboli": t('wakeUpQuiz.statisticsDialog.suggestions.focusWeakAreas'),
      "Approfondisci gli argomenti dove hai sbagliato": t('wakeUpQuiz.statisticsDialog.suggestions.studyMistakes'),
      "Focus on weaker thematic areas": t('wakeUpQuiz.statisticsDialog.suggestions.focusWeakAreas'),
      "Study topics where you made mistakes": t('wakeUpQuiz.statisticsDialog.suggestions.studyMistakes')
    };
    return mapping[tip] || tip;
  };

  if (showStats && stats) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('wakeUpQuiz.statisticsDialog.title')}</h1>
            <p className="text-gray-600 mt-2">{t('wakeUpQuiz.statisticsDialog.subtitle')}</p>
          </div>
          <Button onClick={() => setShowStats(false)} variant="outline">
            <ChevronRight className="h-4 w-4 mr-2" />
            {t('wakeUpQuiz.statisticsDialog.backToQuiz')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('wakeUpQuiz.stats.completedSessions')}</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedSessions}</div>
              <p className="text-xs text-gray-600">
                {t('wakeUpQuiz.statisticsDialog.totalSessions', { total: stats.totalSessions })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('wakeUpQuiz.stats.averageScore')}</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.averageScore)}</div>
              <p className="text-xs text-gray-600">
                {t('wakeUpQuiz.statisticsDialog.bestScore', { score: stats.bestScore })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Precisione</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.accuracy)}%</div>
              <p className="text-xs text-gray-600">
                {stats.correctAnswers} di {stats.totalQuestions}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('wakeUpQuiz.stats.currentLevel')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.performance.color}`}>
                {getPerformanceLevelTranslation(stats.performance.level)}
              </div>
              <p className="text-xs text-gray-600">
{t('wakeUpQuiz.statisticsDialog.currentPerformance')}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('wakeUpQuiz.statisticsDialog.performanceEvaluation')}</CardTitle>
              <CardDescription>{getPerformanceMessageTranslation(stats.performance.message)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>{t('wakeUpQuiz.stats.precision')}</span>
                    <span>{Math.round(stats.accuracy)}%</span>
                  </div>
                  <Progress value={stats.accuracy} className="mt-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>{t('wakeUpQuiz.stats.completedSessions')}</span>
                    <span>{Math.round((stats.completedSessions / Math.max(stats.totalSessions, 1)) * 100)}%</span>
                  </div>
                  <Progress value={(stats.completedSessions / Math.max(stats.totalSessions, 1)) * 100} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('wakeUpQuiz.statisticsDialog.personalizedAdvice')}</CardTitle>
              <CardDescription>{t('wakeUpQuiz.statisticsDialog.performanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {stats.tips.map((tip, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span className="text-sm">{getTipTranslation(tip)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activeSession) {
    const currentQuestion = getCurrentQuestion();
    const answeredQuestions = getAnsweredQuestions();
    const progress = ((activeSession.currentQuestion) / activeSession.totalQuestions) * 100;
    
    // Check if quiz is completed
    const isCompleted = activeSession.status === 'completed' || activeSession.currentQuestion >= activeSession.totalQuestions;

    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Session Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline">
                    {categoryLabels[activeSession.category as keyof typeof categoryLabels]}
                  </Badge>
                  <Badge variant={activeSession.status === 'completed' ? 'default' : 'secondary'}>
                    {activeSession.status === 'completed' ? t('wakeUpQuiz.quiz.completed') : t('wakeUpQuiz.quiz.inProgress')}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Quiz Wake Up - {categoryLabels[activeSession.category as keyof typeof categoryLabels]}
                </h1>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{activeSession.score}</div>
                <div className="text-sm text-gray-600">{t('wakeUpQuiz.quiz.points')}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setActiveSession(null);
                    setCurrentQuestions([]);
                    setHasAbandonedSession(true);
                    setSelectedAnswers({});
                    setRevealedQuestions(new Set());
                  }}
                  className="mt-2"
                >
                  {t('wakeUpQuiz.quiz.abandonQuiz')}
                </Button>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{t('wakeUpQuiz.quiz.progress')}: {activeSession.currentQuestion} {t('wakeUpQuiz.quiz.of')} {activeSession.totalQuestions}</span>
                <span>{t('wakeUpQuiz.quiz.percentCompleted', { percent: Math.round(progress) })}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>

          {/* Only show loading for active sessions that need questions */}
          {activeSession.status !== 'completed' && (!currentQuestion || currentQuestions.length === 0) && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="text-center text-gray-600">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <span>{t('wakeUpQuiz.quiz.loadingQuestions')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz Completed State */}
          {isCompleted && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('wakeUpQuiz.quiz.quizCompleted')}</h2>
                  <p className="text-gray-600 mb-4">
                    {t('wakeUpQuiz.quiz.completedAllQuestions', { score: activeSession.score || 0 })}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={() => {
                        setActiveSession(null);
                        setCurrentQuestions([]);
                        setSelectedAnswers({});
                        setRevealedQuestions(new Set());
                      }}
                      variant="default"
                    >
                      {t('wakeUpQuiz.quiz.backToDashboard')}
                    </Button>
                    <Button 
                      onClick={() => setShowStats(true)}
                      variant="outline"
                    >
                      {t('wakeUpQuiz.quiz.viewStatistics')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Question */}
          {!isCompleted && currentQuestion && activeSession.status === 'active' && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {t('wakeUpQuiz.quiz.question')} {currentQuestion.questionNumber}
                  </CardTitle>
                  <Badge className={difficultyColors[currentQuestion.difficulty as keyof typeof difficultyColors]}>
                    {getDifficultyLabel(currentQuestion.difficulty)}
                  </Badge>
                </div>
                <CardDescription>{currentQuestion.question}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={selectedAnswers[currentQuestion.id] === index ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      disabled={isAnswering}
                      onClick={() => handleAnswerQuestion(currentQuestion.id, index)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0">
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span>{option}</span>
                      </div>
                    </Button>
                  ))}
                </div>

                {/* Skip navigation for unanswered questions */}
                {(!currentQuestion.answer?.answeredAt || currentQuestion.answer?.answeredAt === null) && currentQuestion.questionNumber < activeSession.totalQuestions && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">{t('wakeUpQuiz.quiz.notAnsweredYet')}</p>
                    <Button 
                      onClick={handleNextQuestion}
                      variant="outline" 
                      size="sm"
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      {t('wakeUpQuiz.quiz.skipToNext')}
                    </Button>
                  </div>
                )}



                {/* Show result after answering */}
                {currentQuestion.answer?.answeredAt && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-3">
                      {currentQuestion.answer.isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        currentQuestion.answer.isCorrect ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {currentQuestion.answer.isCorrect ? t('wakeUpQuiz.quiz.correctAnswer') : t('wakeUpQuiz.quiz.wrongAnswer')}
                      </span>
                      <Badge variant="secondary">+{currentQuestion.answer.points} {t('wakeUpQuiz.quiz.points')}</Badge>
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-3">
                      <strong>{t('wakeUpQuiz.quiz.correctAnswerLabel')}</strong> {String.fromCharCode(65 + (currentQuestion.correctAnswer || 0))}. {currentQuestion.options[currentQuestion.correctAnswer || 0]}
                    </div>

                    {currentQuestion.explanation && revealedQuestions.has(currentQuestion.id) ? (
                      <div className="text-sm text-gray-700">
                        <strong>Spiegazione:</strong> {currentQuestion.explanation}
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevealExplanation(currentQuestion.id)}
                        disabled={revealMutation.isPending}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Mostra spiegazione
                      </Button>
                    )}
                    
                    {/* Debug: Show navigation state */}
                    <div className="mt-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <p>Debug Nav: canProceed={canProceedToNext().toString()}, questionNum={currentQuestion.questionNumber}, total={activeSession.totalQuestions}, hasAnswer={!!currentQuestion.answer?.answeredAt}</p>
                    </div>
                    
                    {/* Next Question Button - solo se ha risposto e non è l'ultima domanda */}
                    {currentQuestion.answer?.answeredAt && currentQuestion.questionNumber < activeSession.totalQuestions && (
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          onClick={handleNextQuestion}
                          className="w-full"
                        >
                          <ChevronRight className="h-4 w-4 mr-2" />
                          {t('wakeUpQuiz.quiz.nextQuestion')}
                        </Button>
                      </div>
                    )}
                    
                    {/* Complete Quiz Button */}
                    {currentQuestion.answer?.answeredAt && currentQuestion.questionNumber === activeSession?.totalQuestions && (
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          onClick={() => setActiveSession({...activeSession, status: 'completed'})}
                          className="w-full"
                          variant="default"
                        >
                          <Trophy className="h-4 w-4 mr-2" />
                          {t('wakeUpQuiz.quiz.completeQuiz')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Answered Questions Summary */}
          {answeredQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('wakeUpQuiz.completedQuestions.title')}</CardTitle>
                <CardDescription>{t('wakeUpQuiz.completedQuestions.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4 pr-4">
                    {answeredQuestions.map((question) => (
                      <div key={question.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <Badge variant="outline">Q{question.questionNumber}</Badge>
                              <Badge className={difficultyColors[question.difficulty as keyof typeof difficultyColors]}>
                                {getDifficultyLabel(question.difficulty)}
                              </Badge>
                              {question.answer?.isCorrect ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <p className="text-sm font-medium break-words">{question.question}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2 flex-shrink-0">+{question.answer?.points || 0}</Badge>
                        </div>
                        
                        {/* Show answer details */}
                        {question.answer?.answeredAt && question.options && question.answer.userAnswer !== null && (
                          <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center">
                                <span className="font-medium text-gray-700">{t('wakeUpQuiz.completedQuestions.yourAnswer')}</span>
                                <span className={question.answer.isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                                  {question.options[question.answer.userAnswer]}
                                </span>
                              </div>
                              {!question.answer.isCorrect && question.correctAnswer !== undefined && question.correctAnswer !== null && (
                                <div className="flex items-center">
                                  <span className="font-medium text-gray-700">{t('wakeUpQuiz.completedQuestions.correctAnswer')}</span>
                                  <span className="text-green-700 font-medium">
                                    {question.options[question.correctAnswer]}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {question.explanation && revealedQuestions.has(question.id) ? (
                          <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
                            <strong>{t('wakeUpQuiz.completedQuestions.explanation')}</strong> <span className="break-words">{question.explanation}</span>
                          </div>
                        ) : question.answer?.answeredAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevealExplanation(question.id)}
                            disabled={revealMutation.isPending}
                            className="mt-2"
                          >
                            {revealedQuestions.has(question.id) ? (
                              <EyeOff className="h-4 w-4 mr-2" />
                            ) : (
                              <Eye className="h-4 w-4 mr-2" />
                            )}
                            {revealedQuestions.has(question.id) ? t('wakeUpQuiz.completedQuestions.hideExplanation') : t('wakeUpQuiz.completedQuestions.showExplanation')}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Session completed */}
          {activeSession.status === 'completed' && (
            <div className="mt-6 text-center">
              <Button onClick={() => setActiveSession(null)} size="lg">
                {t('wakeUpQuiz.sessionCompleted.backToHome')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('wakeUpQuiz.title')}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('wakeUpQuiz.subtitle')}
          </p>
        </div>

        {/* Active Sessions */}
        {(sessions as any)?.activeSessions && (sessions as any).activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📚 {t('wakeUpQuiz.activeSessionsTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(sessions as any).activeSessions.map((session: any) => (
                <Card key={session.id} className="border-orange-200 bg-orange-50 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="border-orange-300 text-orange-700">
                          {categoryLabels[session.category as keyof typeof categoryLabels]}
                        </Badge>
                        <Badge className="bg-orange-200 text-orange-800">In corso</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progresso:</span>
                        <span className="font-medium">{session.currentQuestion} {t('wakeUpQuiz.quiz.of')} {session.totalQuestions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('wakeUpQuiz.quiz.score')}:</span>
                        <span className="font-medium text-blue-600">{session.score} {t('wakeUpQuiz.quiz.points')}</span>
                      </div>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => handleContinueSession(session.id)}
                          className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {t('wakeUpQuiz.resumeSession')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => deleteSessionMutation.mutate(session.id)}
                          disabled={deleteSessionMutation.isPending}
                          className="w-full text-red-600 border-red-200 hover:bg-red-50"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('wakeUpQuiz.deleteSession')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Trophy className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                <div className="text-2xl font-bold">{stats.completedSessions}</div>
                <div className="text-sm text-gray-600">{t('wakeUpQuiz.stats.completedSessions')}</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Target className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{Math.round(stats.averageScore)}</div>
                <div className="text-sm text-gray-600">{t('wakeUpQuiz.stats.averageScore')}</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <div className="text-2xl font-bold">{Math.round(stats.accuracy)}%</div>
                <div className="text-sm text-gray-600">{t('wakeUpQuiz.stats.precision')}</div>
              </CardContent>
            </Card>
            <Card className="text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowStats(true)}>
              <CardContent className="pt-6">
                <BarChart3 className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                <div className={`text-2xl font-bold ${stats.performance.color}`}>{getPerformanceLevelTranslation(stats.performance.level)}</div>
                <div className="text-sm text-gray-600">{t('wakeUpQuiz.stats.currentLevel')}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Management */}
        {stats && stats.completedSessions > 0 && (
          <div className="mb-8 text-center">
            <Button 
              variant="outline" 
              onClick={() => {
                if (confirm("Sei sicuro di voler resettare tutte le statistiche? Questa azione eliminerà definitivamente tutti i quiz completati e i relativi dati. L'azione non può essere annullata.")) {
                  resetStatsMutation.mutate();
                }
              }}
              disabled={resetStatsMutation.isPending}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {resetStatsMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                  Resettando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.stats.resetAll')}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Category Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>{t('wakeUpQuiz.categories.graphology')}</CardTitle>
                  <CardDescription>Analisi firme e perizia calligrafica</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {t('wakeUpQuiz.categories.graphologyDesc')}
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => handleStartQuiz("grafologia", 5)}
                  disabled={startQuizMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.quiz.quickQuiz')} (5 domande)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleStartQuiz("grafologia", 10)}
                  disabled={startQuizMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.quiz.fullQuiz')} (10 domande)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Globe className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>{t('wakeUpQuiz.categories.cultura')}</CardTitle>
                  <CardDescription>Arte, storia, scienza e letteratura</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {t('wakeUpQuiz.categories.cultureDesc')}
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => handleStartQuiz("cultura", 5)}
                  disabled={startQuizMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.quiz.quickQuiz')} (5 domande)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleStartQuiz("cultura", 10)}
                  disabled={startQuizMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.quiz.fullQuiz')} (10 domande)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>{t('wakeUpQuiz.categories.misto')}</CardTitle>
                  <CardDescription>Grafologia e cultura generale</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {t('wakeUpQuiz.categories.mixedDesc')}
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => handleStartQuiz("mista", 5)}
                  disabled={startQuizMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.quiz.quickQuiz')} (5 domande)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleStartQuiz("mista", 10)}
                  disabled={startQuizMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('wakeUpQuiz.quiz.fullQuiz')} (10 domande)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions */}
        {(sessions as any)?.activeSessions && (sessions as any).activeSessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sessioni Attive</CardTitle>
              <CardDescription>Continua i quiz iniziati in precedenza</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(sessions as any).activeSessions.map((session: QuizSession) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded">
                        {React.createElement(categoryIcons[session.category as keyof typeof categoryIcons], { 
                          className: "h-5 w-5 text-blue-600" 
                        })}
                      </div>
                      <div>
                        <div className="font-medium">
                          {categoryLabels[session.category as keyof typeof categoryLabels]}
                        </div>
                        <div className="text-sm text-gray-600">
                          {session.currentQuestion} di {session.totalQuestions} domande - {session.score} punti
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleContinueSession(session.id)}>
                        Continua
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm("Sei sicuro di voler eliminare questa sessione? L'azione non può essere annullata.")) {
                            deleteSessionMutation.mutate(session.id);
                          }
                        }}
                        disabled={deleteSessionMutation.isPending}
                        title="Elimina sessione"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}