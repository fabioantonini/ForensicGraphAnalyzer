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
  CheckCircle,
  AlertCircle,
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
  const [documentTitle, setDocumentTitle] = useState("");

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
    setProgress(10);

    // Simula progresso
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

    ocrMutation.mutate();
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
                <Label>{t('settings.preprocessing.label')}</Label>
                <Select 
                  value={ocrSettings.preprocessingMode} 
                  onValueChange={(value) => setOcrSettings(prev => ({...prev, preprocessingMode: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t('settings.preprocessing.options.auto')}</SelectItem>
                    <SelectItem value="enhance">{t('settings.preprocessing.options.enhance')}</SelectItem>
                    <SelectItem value="denoise">{t('settings.preprocessing.options.denoise')}</SelectItem>
                    <SelectItem value="sharpen">{t('settings.preprocessing.options.sharpen')}</SelectItem>
                  </SelectContent>
                </Select>
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

          {/* Barra di progresso */}
          {isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('processing.analyzing')}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
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
                  <span>Testo Estratto</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={ocrResult.confidence > 80 ? "default" : "secondary"}>
                      {ocrResult.confidence}% confidenza
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
                    <TabsTrigger value="text">Testo</TabsTrigger>
                    <TabsTrigger value="info">Informazioni</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="text" className="space-y-4">
                    <Textarea
                      value={ocrResult.extractedText}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                      placeholder="Il testo estratto apparirà qui..."
                    />
                    
                    <div className="flex gap-2">
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
                        Salva nella Base di Conoscenza
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(ocrResult.extractedText);
                          toast({
                            title: "Copiato",
                            description: "Testo copiato negli appunti",
                          });
                        }}
                      >
                        <Download className="h-4 w-4" />
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