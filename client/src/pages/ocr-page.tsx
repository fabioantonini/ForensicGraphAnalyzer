import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  FileImage, 
  Eye, 
  Download, 
  Copy,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Save,
  Settings
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HelpCircle,
  Info
} from "lucide-react";

interface OCRResult {
  extractedText: string;
  confidence: number;
  language: string;
  processingTime: number;
  pageCount?: number;
}

interface OCRSettings {
  language: string;
  dpi: number;
  preprocessingMode: string;
  outputFormat: string;
}

export default function OCRPage() {
  const { t } = useTranslation(['ocr', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Stati per la gestione dell'OCR
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [saveToKnowledgeBase, setSaveToKnowledgeBase] = useState(true);

  // Impostazioni OCR
  const [ocrSettings, setOcrSettings] = useState<OCRSettings>({
    language: "ita+eng", // Italiano + Inglese
    dpi: 300,
    preprocessingMode: "auto",
    outputFormat: "text"
  });

  // Gestione selezione file
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verifica tipo file supportato
      const supportedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'application/pdf'];
      if (!supportedTypes.includes(file.type)) {
        toast({
          title: t('errors.unsupportedFormat'),
          description: t('uploadArea.supportedFormats'),
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setDocumentTitle(file.name.replace(/\.[^/.]+$/, "")); // Rimuove estensione

      // Crea preview per immagini
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
    }
  };

  // Mutazione per processare OCR
  const ocrMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error(t('errors.noFile'));

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('settings', JSON.stringify(ocrSettings));

      const response = await apiRequest("POST", "/api/ocr/process", formData);
      return await response.json();
    },
    onSuccess: (result: OCRResult) => {
      setOcrResult(result);
      setProgress(100);
      toast({
        title: t('processing.completed'),
        description: `${t('results.confidence')}: ${result.confidence}%`,
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('errors.processingFailed'),
        description: error.message,
        variant: "destructive",
      });
      setProgress(0);
    },
  });

  // Mutazione per salvare come documento
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!ocrResult || !documentTitle) {
        throw new Error(t('errors.invalidTitle'));
      }

      const documentData = {
        title: documentTitle,
        content: ocrResult.extractedText,
        originalFilename: selectedFile?.name || "ocr_document.txt",
        fileType: "text/plain",
        source: "ocr",
        metadata: {
          confidence: ocrResult.confidence,
          language: ocrResult.language,
          processingTime: ocrResult.processingTime,
          ocrSettings: ocrSettings
        }
      };

      const response = await apiRequest("POST", "/api/documents/from-ocr", documentData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: t('save.success'),
        description: t('save.success'),
        variant: "default",
      });
      // Reset del form
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: t('save.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setOcrResult(null);
    setProgress(0);
    setDocumentTitle("");
  };

  const handleProcessOCR = () => {
    if (!selectedFile) {
      toast({
        title: t('errors.noFile'),
        description: t('errors.noFile'),
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressStage("Inizializzazione processamento OCR...");
    setProcessingStartTime(Date.now());
    
    // Stima tempo realistico basato su dimensione file e complessità
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    const baseTime = Math.max(3, Math.ceil(fileSizeMB * 2)); // Minimo 3 secondi, 2 sec per MB
    
    // Fattore complessità basato su preprocessing
    const complexityFactor = {
      'auto': 1.0,
      'enhance': 1.3,
      'sharpen': 1.2,
      'denoise': 1.5
    }[ocrSettings.preprocessingMode] || 1.0;
    
    const estimatedSeconds = Math.ceil(baseTime * complexityFactor);
    setEstimatedTimeRemaining(estimatedSeconds);

    // Progresso realistico che riflette il processamento reale
    const progressStages = [
      { progress: 5, stage: "Caricamento e validazione file...", duration: 300 },
      { progress: 15, stage: "Inizializzazione Tesseract.js...", duration: 800 },
      { progress: 25, stage: "Preprocessing immagine...", duration: Math.ceil(1000 * complexityFactor) },
      { progress: 40, stage: "Caricamento modelli linguistici...", duration: 1200 },
      { progress: 60, stage: "Analisi testo in corso...", duration: Math.ceil(2000 * complexityFactor) },
      { progress: 85, stage: "Ottimizzazione risultati...", duration: 800 },
      { progress: 95, stage: "Finalizzazione...", duration: 400 }
    ];

    let stageIndex = 0;
    const progressInterval = setInterval(() => {
      if (stageIndex < progressStages.length && isProcessing) {
        const stage = progressStages[stageIndex];
        setProgress(stage.progress);
        setProgressStage(stage.stage);
        
        // Aggiorna tempo rimanente in modo più accurato
        const elapsed = (Date.now() - (processingStartTime || Date.now())) / 1000;
        const remaining = Math.max(0, estimatedSeconds - elapsed);
        setEstimatedTimeRemaining(Math.ceil(remaining));
        
        stageIndex++;
      }
    }, 600);

    ocrMutation.mutate(undefined, {
      onSettled: () => {
        clearInterval(progressInterval);
        setIsProcessing(false);
        setProgress(100);
        setProgressStage("Completato!");
        setEstimatedTimeRemaining(0);
      }
    });
  };

  return (
    <div className="container mx-auto py-6" data-tour="ocr-page">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-primary">{t('title')}</h2>
        <Badge variant="secondary">
          <FileImage className="h-4 w-4 mr-1" />
          {t('subtitle')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sezione Upload e Impostazioni */}
        <div className="space-y-6">
          {/* Upload File */}
          <Card data-tour="ocr-upload">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                {t('uploadArea.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">{t('uploadArea.supportedFormats')}</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.tiff,.tif,.bmp,.pdf"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
              </div>

              {selectedFile && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Badge variant="outline">{selectedFile.type}</Badge>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="document-title">{t('save.documentTitle')}</Label>
                <Input
                  id="document-title"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder={t('save.titlePlaceholder')}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="save-to-kb"
                  checked={saveToKnowledgeBase}
                  onChange={(e) => setSaveToKnowledgeBase(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="save-to-kb" className="text-sm">
                  Salva nella base di conoscenza per query future
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Impostazioni OCR */}
          <Card data-tour="ocr-settings">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                {t('settings.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('settings.language.label')}</Label>
                <Select 
                  value={ocrSettings.language} 
                  onValueChange={(value) => setOcrSettings(prev => ({...prev, language: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ita">{t('settings.language.options.ita')}</SelectItem>
                    <SelectItem value="eng">{t('settings.language.options.eng')}</SelectItem>
                    <SelectItem value="ita+eng">{t('settings.language.options.ita+eng')}</SelectItem>
                    <SelectItem value="fra">{t('settings.language.options.fra')}</SelectItem>
                    <SelectItem value="deu">{t('settings.language.options.deu')}</SelectItem>
                    <SelectItem value="spa">{t('settings.language.options.spa')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('settings.dpi.label')}</Label>
                <Select 
                  value={ocrSettings.dpi.toString()} 
                  onValueChange={(value) => setOcrSettings(prev => ({...prev, dpi: parseInt(value)}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="150">150 DPI (Fast)</SelectItem>
                    <SelectItem value="300">300 DPI (Standard)</SelectItem>
                    <SelectItem value="600">600 DPI (High Quality)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label>{t('settings.preprocessing.label')}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">{t('settings.preprocessing.description')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <Select 
                  value={ocrSettings.preprocessingMode} 
                  onValueChange={(value) => setOcrSettings(prev => ({...prev, preprocessingMode: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-2">
                        <span>{t('settings.preprocessing.options.auto')}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-medium">{t('settings.preprocessing.explanations.auto')}</p>
                                <div className="text-xs text-gray-600">
                                  <strong>Quando usarlo:</strong>
                                  <pre className="whitespace-pre-wrap mt-1">{t('settings.preprocessing.whenToUse.auto')}</pre>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </SelectItem>
                    
                    <SelectItem value="enhance">
                      <div className="flex items-center gap-2">
                        <span>{t('settings.preprocessing.options.enhance')}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-medium">{t('settings.preprocessing.explanations.enhance')}</p>
                                <div className="text-xs text-gray-600">
                                  <strong>Quando usarlo:</strong>
                                  <pre className="whitespace-pre-wrap mt-1">{t('settings.preprocessing.whenToUse.enhance')}</pre>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </SelectItem>
                    
                    <SelectItem value="denoise">
                      <div className="flex items-center gap-2">
                        <span>{t('settings.preprocessing.options.denoise')}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-purple-500" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-medium">{t('settings.preprocessing.explanations.denoise')}</p>
                                <div className="text-xs text-gray-600">
                                  <strong>Quando usarlo:</strong>
                                  <pre className="whitespace-pre-wrap mt-1">{t('settings.preprocessing.whenToUse.denoise')}</pre>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </SelectItem>
                    
                    <SelectItem value="sharpen">
                      <div className="flex items-center gap-2">
                        <span>{t('settings.preprocessing.options.sharpen')}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-orange-500" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-medium">{t('settings.preprocessing.explanations.sharpen')}</p>
                                <div className="text-xs text-gray-600">
                                  <strong>Quando usarlo:</strong>
                                  <pre className="whitespace-pre-wrap mt-1">{t('settings.preprocessing.whenToUse.sharpen')}</pre>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Guida alle opzioni di processamento */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <HelpCircle className="h-5 w-5" />
                {t('guide.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                
                {/* Automatico */}
                <div className="p-3 bg-blue-100 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="font-semibold text-blue-800">{t('guide.options.auto.title')}</span>
                  </div>
                  <p className="text-blue-700 mb-2">
                    {t('guide.options.auto.description')}
                  </p>
                  <div className="text-xs text-blue-600">
                    <strong>{t('guide.options.auto.useFor')}</strong>
                  </div>
                </div>

                {/* Migliora Contrasto */}
                <div className="p-3 bg-green-100 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-semibold text-green-800">{t('guide.options.enhance.title')}</span>
                  </div>
                  <p className="text-green-700 mb-2">
                    {t('guide.options.enhance.description')}
                  </p>
                  <div className="text-xs text-green-600">
                    <strong>{t('guide.options.enhance.useFor')}</strong>
                  </div>
                </div>

                {/* Riduci Rumore */}
                <div className="p-3 bg-purple-100 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="font-semibold text-purple-800">{t('guide.options.denoise.title')}</span>
                  </div>
                  <p className="text-purple-700 mb-2">
                    {t('guide.options.denoise.description')}
                  </p>
                  <div className="text-xs text-purple-600">
                    <strong>{t('guide.options.denoise.useFor')}</strong>
                  </div>
                </div>

                {/* Aumenta Nitidezza */}
                <div className="p-3 bg-orange-100 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="font-semibold text-orange-800">{t('guide.options.sharpen.title')}</span>
                  </div>
                  <p className="text-orange-700 mb-2">
                    {t('guide.options.sharpen.description')}
                  </p>
                  <div className="text-xs text-orange-600">
                    <strong>{t('guide.options.sharpen.useFor')}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-800">
                    <strong>{t('guide.tip.title')}</strong> {t('guide.tip.text')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pulsanti di azione */}
          <div className="flex gap-3">
            <Button
              onClick={handleProcessOCR}
              disabled={!selectedFile || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {isProcessing ? t('actions.processing') : t('actions.processFile')}
            </Button>

            <Button
              variant="outline"
              onClick={resetForm}
              disabled={isProcessing}
            >
              {t('actions.clear')}
            </Button>
          </div>

          {/* Indicatore di progresso avanzato */}
          {isProcessing && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  {t('processing.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Barra di progresso principale */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{progressStage}</span>
                    <span className="text-primary font-semibold">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                {/* Informazioni dettagliate */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">File</div>
                      <div className="text-gray-600 truncate">
                        {selectedFile?.name || "N/A"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">Tempo rimanente</div>
                      <div className="text-gray-600">
                        {estimatedTimeRemaining !== null 
                          ? `~${estimatedTimeRemaining}s` 
                          : "Calcolando..."}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">Preprocessing</div>
                      <div className="text-gray-600 capitalize">
                        {ocrSettings.preprocessingMode}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline delle fasi */}
                <div className="space-y-1 text-xs">
                  <div className="font-medium text-gray-700">Fasi di processamento:</div>
                  <div className="grid grid-cols-2 gap-1 text-gray-500">
                    <div className={progress >= 15 ? "text-green-600 font-medium" : ""}>
                      {progress >= 15 ? "✓" : "⏳"} Inizializzazione
                    </div>
                    <div className={progress >= 40 ? "text-green-600 font-medium" : ""}>
                      {progress >= 40 ? "✓" : "⏳"} Preprocessing
                    </div>
                    <div className={progress >= 70 ? "text-green-600 font-medium" : ""}>
                      {progress >= 70 ? "✓" : "⏳"} Riconoscimento
                    </div>
                    <div className={progress >= 100 ? "text-green-600 font-medium" : ""}>
                      {progress >= 100 ? "✓" : "⏳"} Finalizzazione
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sezione Preview e Risultati */}
        <div className="space-y-6">
          {/* Preview Immagine */}
          {previewUrl && (
            <Card data-tour="ocr-preview">
              <CardHeader>
                <CardTitle>{t('results.preview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={previewUrl} 
                    alt="Preview"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risultati OCR */}
          {ocrResult && (
            <Card data-tour="ocr-results">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t('results.extractedText')}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={ocrResult.confidence > 80 ? "default" : "secondary"}>
                      {ocrResult.confidence}% {t('results.confidence')}
                    </Badge>
                    {ocrResult.confidence > 80 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="text">
                  <TabsList>
                    <TabsTrigger value="text">{t('results.extractedText')}</TabsTrigger>
                    <TabsTrigger value="info">Info</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="text" className="space-y-4">
                    <Textarea
                      value={ocrResult.extractedText}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                      placeholder="Il testo estratto apparirà qui..."
                    />
                    
                    <div className="flex gap-2">
                      {saveToKnowledgeBase && (
                        <Button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending}
                          className="flex-1"
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {t('save.saveButton')}
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(ocrResult.extractedText);
                          toast({
                            title: "Copiato",
                            description: "Testo copiato negli appunti",
                          });
                        }}
                        className={saveToKnowledgeBase ? "" : "flex-1"}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Crea e scarica il file di testo
                          const blob = new Blob([ocrResult.extractedText], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `${documentTitle || 'documento-ocr'}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          
                          toast({
                            title: "Download avviato",
                            description: "Il documento è stato scaricato",
                          });
                        }}
                        className={saveToKnowledgeBase ? "" : "flex-1"}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Scarica
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="info">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Lingua rilevata:</span>
                          <p className="text-gray-600">{ocrResult.language}</p>
                        </div>
                        <div>
                          <span className="font-medium">Tempo di elaborazione:</span>
                          <p className="text-gray-600">{ocrResult.processingTime}s</p>
                        </div>
                        <div>
                          <span className="font-medium">Parole estratte:</span>
                          <p className="text-gray-600">
                            {ocrResult.extractedText.split(/\s+/).length}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Caratteri:</span>
                          <p className="text-gray-600">{ocrResult.extractedText.length}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}