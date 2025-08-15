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

  // Fetch active sessions
  const { data: sessions } = useQuery({
    queryKey: ["/api/wake-up/sessions"],
  });

  // Fetch quiz stats
  const { data: stats } = useQuery<QuizStats>({
    queryKey: ["/api/wake-up/stats"],
  });

  // Load active session automatically when available (but not if user abandoned it)
  useEffect(() => {
    console.log("useEffect triggered:", { sessions, activeSession, hasAbandonedSession });
    if ((sessions as any)?.activeSessions && (sessions as any).activeSessions.length > 0 && !activeSession && !hasAbandonedSession) {
      const activeSessionFromServer = (sessions as any).activeSessions[0];
      console.log("Loading session:", activeSessionFromServer);
      
      // Fetch questions for this session
      fetch(`/api/wake-up/session/${activeSessionFromServer.id}`)
        .then(response => {
          console.log("Session response status:", response.status);
          return response.json();
        })
        .then(data => {
          console.log("Session data received:", data);
          setActiveSession(activeSessionFromServer);
          setCurrentQuestions(data.questions || []);
        })
        .catch(error => {
          console.error("Error loading session questions:", error);
        });
    }
  }, [sessions, activeSession, hasAbandonedSession]);

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
    startQuizMutation.mutate({ category, totalQuestions });
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
      
      console.log("Loading session data:", data); // Debug
      
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
    // currentQuestion in DB is 0-based for internal tracking, but we want 1-based for display
    return currentQuestions.find(q => q.questionNumber === activeSession.currentQuestion);
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
    grafologia: "Grafologia Forense",
    cultura: "Cultura Generale",
    mista: "Misto"
  };

  const difficultyColors = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800", 
    hard: "bg-red-100 text-red-800"
  };

  if (showStats && stats) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Statistiche Quiz</h1>
            <p className="text-gray-600 mt-2">Le tue prestazioni nel sistema Wake Up</p>
          </div>
          <Button onClick={() => setShowStats(false)} variant="outline">
            <ChevronRight className="h-4 w-4 mr-2" />
            Torna ai Quiz
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quiz Completati</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedSessions}</div>
              <p className="text-xs text-gray-600">
                di {stats.totalSessions} totali
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Punteggio Medio</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.averageScore)}</div>
              <p className="text-xs text-gray-600">
                miglior: {stats.bestScore}
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
              <CardTitle className="text-sm font-medium">Livello</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.performance.color}`}>
                {stats.performance.level}
              </div>
              <p className="text-xs text-gray-600">
                performance attuale
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Valutazione Performance</CardTitle>
              <CardDescription>{stats.performance.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Precisione</span>
                    <span>{Math.round(stats.accuracy)}%</span>
                  </div>
                  <Progress value={stats.accuracy} className="mt-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Quiz Completati</span>
                    <span>{Math.round((stats.completedSessions / Math.max(stats.totalSessions, 1)) * 100)}%</span>
                  </div>
                  <Progress value={(stats.completedSessions / Math.max(stats.totalSessions, 1)) * 100} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consigli Personalizzati</CardTitle>
              <CardDescription>Suggerimenti per migliorare le tue performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {stats.tips.map((tip, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span className="text-sm">{tip}</span>
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
                    {activeSession.status === 'completed' ? 'Completato' : 'In corso'}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Quiz Wake Up - {categoryLabels[activeSession.category as keyof typeof categoryLabels]}
                </h1>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{activeSession.score}</div>
                <div className="text-sm text-gray-600">punti</div>
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
                  Abbandona quiz
                </Button>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progresso: {activeSession.currentQuestion} di {activeSession.totalQuestions}</span>
                <span>{Math.round(progress)}% completato</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>

          {/* Debug info */}
          {(!currentQuestion || currentQuestions.length === 0) && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="text-center text-gray-600">
                  <p>Caricamento domande...</p>
                  <p className="text-sm">Domande caricate: {currentQuestions.length}</p>
                  <p className="text-sm">Status sessione: {activeSession.status}</p>
                  <p className="text-sm">Domanda corrente: {activeSession.currentQuestion}</p>
                  <Button 
                    onClick={() => {
                      console.log("Forcing question reload for session:", activeSession.id);
                      fetch(`/api/wake-up/session/${activeSession.id}`)
                        .then(response => {
                          console.log("Response status:", response.status);
                          return response.json();
                        })
                        .then(data => {
                          console.log("Session data received:", data);
                          setCurrentQuestions(data.questions || []);
                          if (data.questions && data.questions.length > 0) {
                            toast({
                              title: "Domande caricate!",
                              description: `${data.questions.length} domande caricate con successo`
                            });
                          }
                        })
                        .catch(error => {
                          console.error("Error loading questions:", error);
                          toast({
                            title: "Errore",
                            description: "Impossibile caricare le domande",
                            variant: "destructive"
                          });
                        });
                    }}
                    className="mt-4"
                  >
                    Ricarica domande manualmente
                  </Button>
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Completato! 🎉</h2>
                  <p className="text-gray-600 mb-4">
                    Hai risposto a tutte le domande. Punteggio finale: {activeSession.score || 0} punti
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
                      Torna alla Dashboard
                    </Button>
                    <Button 
                      onClick={() => setShowStats(true)}
                      variant="outline"
                    >
                      Vedi Statistiche
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
                    Domanda {currentQuestion.questionNumber}
                  </CardTitle>
                  <Badge className={difficultyColors[currentQuestion.difficulty as keyof typeof difficultyColors]}>
                    {currentQuestion.difficulty}
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
                    <p className="text-sm text-blue-800 mb-2">Non hai ancora risposto a questa domanda.</p>
                    <Button 
                      onClick={handleNextQuestion}
                      variant="outline" 
                      size="sm"
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Salta alla prossima domanda
                    </Button>
                  </div>
                )}

                {/* Debug current question state */}
                <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded text-xs">
                  <p>Debug: questionId={currentQuestion.id}, hasAnswer={!!currentQuestion.answer}, answeredAt={currentQuestion.answer?.answeredAt || 'none'}</p>
                  <p>Answer object: {JSON.stringify(currentQuestion.answer)}</p>
                  <p>Buttons enabled: {!isAnswering}</p>
                </div>

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
                        {currentQuestion.answer.isCorrect ? 'Risposta Corretta!' : 'Risposta Errata'}
                      </span>
                      <Badge variant="secondary">+{currentQuestion.answer.points} punti</Badge>
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-3">
                      <strong>Risposta corretta:</strong> {String.fromCharCode(65 + (currentQuestion.correctAnswer || 0))}. {currentQuestion.options[currentQuestion.correctAnswer || 0]}
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
                          Prossima domanda
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
                          Completa quiz
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
                <CardTitle>Domande Completate</CardTitle>
                <CardDescription>Riepilogo delle tue risposte</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-4">
                    {answeredQuestions.map((question) => (
                      <div key={question.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge variant="outline">Q{question.questionNumber}</Badge>
                              <Badge className={difficultyColors[question.difficulty as keyof typeof difficultyColors]}>
                                {question.difficulty}
                              </Badge>
                              {question.answer?.isCorrect ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <p className="text-sm font-medium">{question.question}</p>
                          </div>
                          <Badge variant="secondary">+{question.answer?.points || 0}</Badge>
                        </div>
                        
                        {question.explanation && revealedQuestions.has(question.id) ? (
                          <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
                            <strong>Spiegazione:</strong> {question.explanation}
                          </div>
                        ) : question.answer?.answeredAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevealExplanation(question.id)}
                            disabled={revealMutation.isPending}
                          >
                            {revealedQuestions.has(question.id) ? (
                              <EyeOff className="h-4 w-4 mr-2" />
                            ) : (
                              <Eye className="h-4 w-4 mr-2" />
                            )}
                            {revealedQuestions.has(question.id) ? 'Nascondi' : 'Mostra'} spiegazione
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
                Torna alla home
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Wake Up Quiz</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Testa le tue conoscenze di grafologia forense e cultura generale con il nostro sistema di quiz interattivo alimentato da AI
          </p>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Trophy className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                <div className="text-2xl font-bold">{stats.completedSessions}</div>
                <div className="text-sm text-gray-600">Quiz Completati</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Target className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{Math.round(stats.averageScore)}</div>
                <div className="text-sm text-gray-600">Punteggio Medio</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <div className="text-2xl font-bold">{Math.round(stats.accuracy)}%</div>
                <div className="text-sm text-gray-600">Precisione</div>
              </CardContent>
            </Card>
            <Card className="text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowStats(true)}>
              <CardContent className="pt-6">
                <BarChart3 className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                <div className={`text-2xl font-bold ${stats.performance.color}`}>{stats.performance.level}</div>
                <div className="text-sm text-gray-600">Livello Attuale</div>
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
                  Resetta tutte le statistiche
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
                  <CardTitle>Grafologia Forense</CardTitle>
                  <CardDescription>Analisi firme e perizia calligrafica</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Domande specialistiche su tecniche di autenticazione, analisi parametrica, e metodologie forensi.
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => handleStartQuiz("grafologia", 5)}
                  disabled={startQuizMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Quiz Rapido (5 domande)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleStartQuiz("grafologia", 10)}
                  disabled={startQuizMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Quiz Completo (10 domande)
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
                  <CardTitle>Cultura Generale</CardTitle>
                  <CardDescription>Arte, storia, scienza e letteratura</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Testa le tue conoscenze su vari argomenti per mantenere la mente allenata e curiosa.
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => handleStartQuiz("cultura", 5)}
                  disabled={startQuizMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Quiz Rapido (5 domande)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleStartQuiz("cultura", 10)}
                  disabled={startQuizMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Quiz Completo (10 domande)
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
                  <CardTitle>Misto</CardTitle>
                  <CardDescription>Grafologia e cultura generale</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Una sfida completa che combina domande specialistiche e di cultura generale per un allenamento completo.
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => handleStartQuiz("mista", 5)}
                  disabled={startQuizMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Quiz Rapido (5 domande)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleStartQuiz("mista", 10)}
                  disabled={startQuizMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Quiz Completo (10 domande)
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