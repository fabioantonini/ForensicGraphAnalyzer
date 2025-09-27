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
import { useToast } from "@/hooks/use-toast";

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

interface StatsData {
  totalReviews: number;
  averageScore: number;
  averageProcessingTime: number;
  classificationCounts: {
    eccellente?: number;
    buono?: number;
    sufficiente?: number;
    insufficiente?: number;
  };
  recentReviews: ReviewHistory[];
}

const PeerReviewPage = () => {
  const { t: tCommon, i18n } = useTranslation('common');
  const { t } = useTranslation('peerReview');
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<PeerReviewResult | null>(null);

  // Caricamento storico analisi
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/peer-review/history"],
    enabled: true
  });

  // Caricamento statistiche
  const { data: statsData } = useQuery<StatsData>({
    queryKey: ["/api/peer-review/stats/summary"],
    enabled: true
  });
  


  // Caricamento framework ENFSI
  const { data: frameworkData } = useQuery({
    queryKey: [`/api/peer-review/framework/criteria?lang=${i18n.language}`],
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

  // Funzione per scaricare il report PDF
  const handleDownloadReport = async (reviewId: number) => {
    try {
      console.log('🔍 Inizio download report per ID:', reviewId);
      
      const response = await fetch(`/api/peer-review/${reviewId}/report`, {
        method: 'GET',
        credentials: 'include',
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`Errore HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('📄 Blob ricevuto:', blob.size, 'bytes, tipo:', blob.type);
      
      if (blob.size === 0) {
        throw new Error('Il file PDF ricevuto è vuoto');
      }
      
      // Estrai il nome del file dall'header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report-peer-review-${reviewId}.pdf`; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      console.log('💾 Filename estratto:', filename);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      console.log('⬇️ Triggering download...');
      link.click();
      
      // Cleanup dopo un breve delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        console.log('✅ Download cleanup completato');
      }, 1000);
      
      // Notifica successo
      toast({
        title: "Download completato",
        description: `Report PDF scaricato: ${filename}`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('❌ Errore download report:', error);
      toast({
        title: "Errore download",
        description: error instanceof Error ? error.message : "Errore sconosciuto durante il download",
        variant: "destructive",
      });
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
                  {t('title')}
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  {t('subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('tabs.upload')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              {t('tabs.history')}
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('tabs.statistics')}
            </TabsTrigger>
            <TabsTrigger value="framework" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              {t('tabs.framework')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            {/* Upload Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  {t('upload.title')}
                </CardTitle>
                <p className="text-gray-600 text-sm">
                  {t('upload.description')}
                </p>
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
                        {formatBytes(selectedFile.size)} • {t('upload.analyzing')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <p className="text-lg font-medium">
                        {isDragActive 
                          ? t('upload.dragDrop').split(' o ')[0] + '...'
                          : t('upload.dragDrop')
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('upload.formats')}
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
                          {t('upload.analyzing')}
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
                      <strong>{t('analysis.suggestions')}:</strong><br />
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
                  {t('history.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p>{t('common.loading')}</p>
                  </div>
                ) : (historyData as any)?.reviews?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p>{t('history.noAnalyses')}</p>
                    <p className="text-sm">{t('history.uploadFirst')}</p>
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
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadReport(review.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="text-xs">Report PDF</span>
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

          </TabsContent>

          <TabsContent value="statistics" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('statistics.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Stats Summary */}
                {statsData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            {statsData?.totalReviews || 0}
                          </div>
                          <div className="text-sm text-blue-600">{t('statistics.totalAnalyses')}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {statsData?.averageScore || 0}
                          </div>
                          <div className="text-sm text-green-600">{t('statistics.averageScore')}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {Math.round(statsData?.averageProcessingTime || 0)}s
                          </div>
                          <div className="text-sm text-purple-600">{t('statistics.averageTime')}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-700">
                            {(statsData?.classificationCounts?.eccellente || 0) + (statsData?.classificationCounts?.buono || 0)}
                          </div>
                          <div className="text-sm text-orange-600">{t('statistics.conformCompliant')}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="framework" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  {t('framework.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    {t('framework.description')}
                  </AlertDescription>
                </Alert>

                {(frameworkData as any)?.framework && (
                  <div className="grid gap-6">
                    {Object.entries((frameworkData as any).framework).map(([key, category]: [string, any]) => (
                      <Card key={key} className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{category.name}</CardTitle>
                            <Badge variant="outline">{t('common.weight')}: {category.weight}%</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {/* Gestione sia della vecchia struttura criteria che della nuova subcriteria */}
                            {category.criteria ? (
                              // Vecchia struttura con array di criteri
                              category.criteria.map((criterion: string, index: number) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  <span>{criterion}</span>
                                </div>
                              ))
                            ) : category.subcriteria ? (
                              // Nuova struttura con sub-criteri dettagliati
                              Object.entries(category.subcriteria).map(([key, subcriterion]: [string, any]) => (
                                <div key={key} className="bg-white rounded-lg p-3 border">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                    <span className="font-medium text-sm">{subcriterion.name}</span>
                                    <Badge variant="secondary" className="text-xs">Peso: {subcriterion.weight}%</Badge>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-2">{subcriterion.description}</p>
                                  {subcriterion.indicators && (
                                    <div className="flex flex-wrap gap-1">
                                      {subcriterion.indicators.map((indicator: string, idx: number) => (
                                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                                          {indicator}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">
                                Nessun criterio disponibile
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-600" />
                    {t('framework.conformityCriteria')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span><strong>{t('framework.excellent')}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                      <span><strong>{t('framework.good')}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                      <span><strong>{t('framework.sufficient')}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <span><strong>{t('framework.insufficient')}</strong></span>
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