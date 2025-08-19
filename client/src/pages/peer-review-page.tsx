/**
 * Pagina Peer Review - Sistema di validazione perizie grafologiche secondo standard ENFSI
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDropzone } from "react-dropzone";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
  BarChart3,
  Trash2,
  Download,
  Shield,
  Award,
  TrendingUp,
  FileCheck,
  Info,
  Calendar,
  Weight
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { it, enUS } from "date-fns/locale";

interface PeerReviewResult {
  id: number;
  overallScore: number;
  classification: string;
  criteriaResults: {
    structureInfo: { score: number; details: string; weight: number };
    materialDocumentation: { score: number; details: string; weight: number };
    methodology: { score: number; details: string; weight: number };
    technicalAnalysis: { score: number; details: string; weight: number };
    validation: { score: number; details: string; weight: number };
    presentation: { score: number; details: string; weight: number };
  };
  suggestions: string;
  processingTime: number;
  filename: string;
  createdAt?: string;
  originalFilename?: string;
}

interface ReviewHistory {
  id: number;
  originalFilename: string;
  fileSize: number;
  overallScore: number;
  classification: string;
  status: string;
  processingTime: number;
  createdAt: string;
}

const PeerReviewPage = () => {
  const { t, i18n } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<PeerReviewResult | null>(null);

  // Caricamento storico analisi
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/peer-review/history"],
    enabled: true
  });

  // Caricamento statistiche
  const { data: statsData } = useQuery({
    queryKey: ["/api/peer-review/stats/summary"],
    enabled: true
  });

  // Caricamento framework ENFSI
  const { data: frameworkData } = useQuery({
    queryKey: ["/api/peer-review/framework/criteria"],
    enabled: true
  });

  // Mutazione per l'upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('perizia', file);

      const response = await fetch('/api/peer-review/submit', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    },
    onSuccess: (data: PeerReviewResult) => {
      setCurrentResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/stats/summary"] });
      setUploadProgress(100);
    },
    onError: (error) => {
      console.error('Errore upload perizia:', error);
      setUploadProgress(0);
    }
  });

  // Mutazione per eliminazione
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const response = await fetch(`/api/peer-review/${reviewId}`, { 
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/stats/summary"] });
    }
  });

  // Configurazione dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setCurrentResult(null);
      setUploadProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: false
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadProgress(10);
    try {
      await uploadMutation.mutateAsync(selectedFile);
    } catch (error) {
      setUploadProgress(0);
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'eccellente': return 'bg-green-100 text-green-800 border-green-200';
      case 'buono': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'sufficiente': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'insufficiente': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'eccellente': return <Award className="h-4 w-4" />;
      case 'buono': return <CheckCircle className="h-4 w-4" />;
      case 'sufficiente': return <AlertCircle className="h-4 w-4" />;
      case 'insufficiente': return <AlertCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const locale = i18n.language === 'it' ? it : enUS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Peer Review - Validazione Perizie ENFSI
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  Sistema di validazione automatica delle perizie grafologiche secondo gli standard forensi ENFSI
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Analisi Perizia
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Storico Analisi
            </TabsTrigger>
            <TabsTrigger value="framework" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Framework ENFSI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            {/* Upload Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Carica Perizia Grafica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <FileText className="h-12 w-12 text-blue-600 mx-auto" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatBytes(selectedFile.size)} • Pronto per l'analisi
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <p className="text-lg font-medium">
                        {isDragActive 
                          ? 'Rilascia il file qui...' 
                          : 'Trascina qui la tua perizia grafica'
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        Formati supportati: PDF, DOCX, TXT (max 25MB)
                      </p>
                    </div>
                  )}
                </div>

                {selectedFile && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      className="px-8 py-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Analisi in corso...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Avvia Analisi ENFSI
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress Bar */}
            {uploadMutation.isPending && (
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Analisi framework ENFSI in corso...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {currentResult && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Risultati Analisi ENFSI
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getClassificationColor(currentResult.classification)}>
                        {getClassificationIcon(currentResult.classification)}
                        {currentResult.classification.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        Score: {currentResult.overallScore}/100
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Score Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-700">
                            {currentResult.overallScore}
                          </div>
                          <div className="text-sm text-blue-600">Score Complessivo</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700 capitalize">
                            {currentResult.classification}
                          </div>
                          <div className="text-sm text-green-600">Classificazione ENFSI</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {currentResult.processingTime}s
                          </div>
                          <div className="text-sm text-purple-600">Tempo Analisi</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Criteria Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Weight className="h-5 w-5" />
                      Valutazione per Criteri ENFSI
                    </h3>
                    
                    <div className="grid gap-4">
                      {Object.entries(currentResult.criteriaResults).map(([key, criteria]) => {
                        const categoryNames: Record<string, string> = {
                          structureInfo: "Struttura Obbligatoria",
                          materialDocumentation: "Documentazione Materiale", 
                          methodology: "Metodologia e Procedure",
                          technicalAnalysis: "Analisi Tecnica Specialistica",
                          validation: "Validazione e Controlli Qualità",
                          presentation: "Presentazione e Valutazione"
                        };

                        return (
                          <Card key={key} className="bg-gray-50">
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-medium">
                                  {categoryNames[key]} (Peso: {criteria.weight}%)
                                </h4>
                                <Badge variant={criteria.score >= 75 ? "default" : "destructive"}>
                                  {criteria.score}/100
                                </Badge>
                              </div>
                              <Progress value={criteria.score} className="h-2 mb-3" />
                              <p className="text-sm text-gray-600">{criteria.details}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Suggerimenti per il Miglioramento:</strong><br />
                      {currentResult.suggestions}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Storico Analisi Peer Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p>Caricamento storico...</p>
                  </div>
                ) : (historyData as any)?.reviews?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p>Nessuna analisi disponibile</p>
                    <p className="text-sm">Carica la tua prima perizia per iniziare</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {((historyData as any)?.reviews || []).map((review: ReviewHistory) => (
                        <Card key={review.id} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <FileText className="h-4 w-4 text-gray-500" />
                                  <span className="font-medium">{review.originalFilename}</span>
                                  <Badge className={getClassificationColor(review.classification)}>
                                    {getClassificationIcon(review.classification)}
                                    {review.classification}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    {review.overallScore}/100
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {review.processingTime}s
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(review.createdAt), { 
                                      addSuffix: true,
                                      locale 
                                    })}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {/* Implementare download report */}}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(review.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Stats Summary */}
            {statsData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {(statsData as any)?.totalReviews || 0}
                      </div>
                      <div className="text-sm text-blue-600">Analisi Totali</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {(statsData as any)?.averageScore || 0}
                      </div>
                      <div className="text-sm text-green-600">Score Medio</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-700">
                        {(statsData as any)?.averageProcessingTime || 0}s
                      </div>
                      <div className="text-sm text-purple-600">Tempo Medio</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-700">
                        {((statsData as any)?.classificationCounts?.eccellente || 0) + ((statsData as any)?.classificationCounts?.buono || 0)}
                      </div>
                      <div className="text-sm text-orange-600">Conformi ENFSI</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="framework" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Framework ENFSI per Perizie Grafologiche
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Il framework ENFSI (European Network of Forensic Science Institutes) definisce 
                    gli standard professionali per l'esame forense delle manoscritture e la validazione 
                    delle perizie grafologiche.
                  </AlertDescription>
                </Alert>

                {(frameworkData as any)?.framework && (
                  <div className="grid gap-6">
                    {Object.entries((frameworkData as any).framework).map(([key, category]: [string, any]) => (
                      <Card key={key} className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{category.name}</CardTitle>
                            <Badge variant="outline">Peso: {category.weight}%</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {category.criteria.map((criterion: string, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                <span>{criterion}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-600" />
                    Criteri di Conformità
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span><strong>Eccellente (90-100%):</strong> Conformità completa ENFSI</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                      <span><strong>Buono (75-89%):</strong> Standard rispettati, dettagli minori</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                      <span><strong>Sufficiente (60-74%):</strong> Base accettabile, alcune lacune</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <span><strong>Insufficiente (&lt;60%):</strong> Criteri fondamentali mancanti</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
};

export default PeerReviewPage;