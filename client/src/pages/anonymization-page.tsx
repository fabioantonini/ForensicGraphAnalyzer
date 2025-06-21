import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileText, 
  Eye, 
  Download, 
  Settings, 
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EntityType {
  key: string;
  label: string;
  description: string;
  defaultTag: string;
}

interface DetectedEntity {
  text: string;
  type: string;
  position: { start: number; end: number };
  confidence: number;
}

interface AnonymizationPreview {
  success: boolean;
  preview: boolean;
  originalText: string;
  anonymizedText: string;
  detectedEntities: DetectedEntity[];
  totalEntities: number;
  originalFilename: string;
}

interface AnonymizationResult {
  success: boolean;
  anonymizedText?: string;
  detectedEntities?: DetectedEntity[];
  downloadUrl?: string;
  filename?: string;
  originalFilename?: string;
}

export default function AnonymizationPage() {
  const { t } = useTranslation(['common', 'anonymization']);
  const queryClient = useQueryClient();

  // Stati del componente
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [entityReplacements, setEntityReplacements] = useState<Record<string, string>>({});
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<AnonymizationPreview | null>(null);
  const [processingResult, setProcessingResult] = useState<AnonymizationResult | null>(null);

  // Query per recuperare i tipi di entità disponibili
  const { data: entityTypesData, isLoading: entityTypesLoading } = useQuery({
    queryKey: ['/api/anonymize/entity-types'],
    queryFn: async () => {
      const response = await fetch('/api/anonymize/entity-types');
      if (!response.ok) throw new Error('Failed to fetch entity types');
      const data = await response.json();
      return data as { entityTypes: EntityType[], defaultReplacements: Record<string, string> };
    }
  });

  const entityTypes: EntityType[] = entityTypesData?.entityTypes || [];
  const defaultReplacements = entityTypesData?.defaultReplacements || {};

  // Inizializza le selezioni quando i dati sono caricati
  useState(() => {
    if (entityTypes.length > 0 && selectedEntityTypes.length === 0) {
      setSelectedEntityTypes(entityTypes.map(et => et.key));
      setEntityReplacements(defaultReplacements);
    }
  });

  // Mutation per l'anteprima
  const previewMutation = useMutation({
    mutationFn: async (formData: FormData): Promise<AnonymizationPreview> => {
      const response = await fetch('/api/anonymize/preview', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Preview failed');
      return response.json();
    },
    onSuccess: (data: AnonymizationPreview) => {
      setPreviewData(data);
      setActiveTab("preview");
    },
    onError: (error: any) => {
      console.error('Preview error:', error);
      // Gestione specifica per errori PDF
      let errorMessage = 'Errore durante l\'anteprima';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage += ': ' + error.message;
      }
      alert(errorMessage);
    }
  });

  // Mutation per l'anonimizzazione completa
  const anonymizeMutation = useMutation({
    mutationFn: async (formData: FormData): Promise<AnonymizationResult> => {
      const response = await fetch('/api/anonymize/upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Anonymization failed');
      return response.json();
    },
    onSuccess: (data: AnonymizationResult) => {
      setProcessingResult(data);
      setActiveTab("result");
    },
    onError: (error: any) => {
      console.error('Anonymization error:', error);
      // Gestione specifica per errori PDF
      let errorMessage = 'Errore durante l\'anonimizzazione';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage += ': ' + error.message;
      }
      alert(errorMessage);
    }
  });

  // Configurazione dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setPreviewData(null);
      setProcessingResult(null);
      setActiveTab("settings");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  // Gestione selezione tipi di entità
  const handleEntityTypeToggle = (entityKey: string) => {
    setSelectedEntityTypes(prev => 
      prev.includes(entityKey) 
        ? prev.filter(k => k !== entityKey)
        : [...prev, entityKey]
    );
  };

  // Gestione modifica tag sostituzione
  const handleReplacementChange = (entityKey: string, value: string) => {
    setEntityReplacements(prev => ({
      ...prev,
      [entityKey]: value
    }));
  };

  // Anteprima anonimizzazione
  const handlePreview = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('entityTypes', JSON.stringify(selectedEntityTypes));
    formData.append('entityReplacements', JSON.stringify(entityReplacements));

    previewMutation.mutate(formData);
  };

  // Anonimizzazione completa
  const handleAnonymize = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('entityTypes', JSON.stringify(selectedEntityTypes));
    formData.append('entityReplacements', JSON.stringify(entityReplacements));

    anonymizeMutation.mutate(formData);
  };

  // Reset stato
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setProcessingResult(null);
    setActiveTab("upload");
  };

  // Download file anonimizzato
  const handleDownload = () => {
    if (processingResult?.downloadUrl) {
      window.open(processingResult.downloadUrl, '_blank');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t('anonymization:title', 'Anonimizzazione Documenti')}</h1>
        <p className="text-muted-foreground">
          {t('anonymization:description', 'Proteggi la privacy rimuovendo informazioni sensibili dai tuoi documenti')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!selectedFile} className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Impostazioni
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!previewData} className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Anteprima
          </TabsTrigger>
          <TabsTrigger value="result" disabled={!processingResult} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Risultato
          </TabsTrigger>
        </TabsList>

        {/* Tab Upload */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Carica Documento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                  </div>
                  {isDragActive ? (
                    <p className="text-lg">Rilascia il file qui...</p>
                  ) : (
                    <>
                      <p className="text-lg">
                        Trascina un documento qui o clicca per selezionare
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Formati supportati: PDF, DOCX, TXT (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {selectedFile && (
                <div className="mt-4 p-4 bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6" />
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Settings */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurazione Anonimizzazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {entityTypesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-medium mb-3">Tipi di Informazioni da Anonimizzare</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {entityTypes.map((entityType) => (
                        <div key={entityType.key} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`entity-${entityType.key}`}
                              checked={selectedEntityTypes.includes(entityType.key)}
                              onCheckedChange={() => handleEntityTypeToggle(entityType.key)}
                            />
                            <Label htmlFor={`entity-${entityType.key}`} className="font-medium">
                              {entityType.label}
                            </Label>
                          </div>
                          <p className="text-sm text-muted-foreground ml-6">
                            {entityType.description}
                          </p>
                          {selectedEntityTypes.includes(entityType.key) && (
                            <div className="ml-6">
                              <Label htmlFor={`tag-${entityType.key}`} className="text-xs">
                                Tag sostituzione:
                              </Label>
                              <Input
                                id={`tag-${entityType.key}`}
                                value={entityReplacements[entityType.key] || entityType.defaultTag}
                                onChange={(e) => handleReplacementChange(entityType.key, e.target.value)}
                                className="mt-1"
                                placeholder={entityType.defaultTag}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-3">
                    <Button 
                      onClick={handlePreview}
                      disabled={previewMutation.isPending || selectedEntityTypes.length === 0}
                      variant="outline"
                    >
                      {previewMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Anteprima
                    </Button>
                    <Button 
                      onClick={handleAnonymize}
                      disabled={anonymizeMutation.isPending || selectedEntityTypes.length === 0}
                    >
                      {anonymizeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      Anonimizza
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Preview */}
        <TabsContent value="preview" className="space-y-4">
          {previewData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Anteprima Anonimizzazione
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-4">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      Trovate {previewData.totalEntities} informazioni sensibili in "{previewData.originalFilename}"
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium mb-2">Testo Originale (anteprima)</h3>
                      <Textarea
                        value={previewData.originalText}
                        readOnly
                        className="h-48 resize-none"
                      />
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Testo Anonimizzato (anteprima)</h3>
                      <Textarea
                        value={previewData.anonymizedText}
                        readOnly
                        className="h-48 resize-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-medium mb-3">Entità Rilevate</h3>
                    <div className="flex flex-wrap gap-2">
                      {previewData.detectedEntities.map((entity, index) => (
                        <Badge key={index} variant="secondary">
                          {entity.text} ({entity.type})
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button onClick={() => setActiveTab("settings")} variant="outline">
                      Modifica Impostazioni
                    </Button>
                    <Button 
                      onClick={handleAnonymize}
                      disabled={anonymizeMutation.isPending}
                    >
                      {anonymizeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      Procedi con l'Anonimizzazione
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Tab Result */}
        <TabsContent value="result" className="space-y-4">
          {processingResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Anonimizzazione Completata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    Il documento "{processingResult.originalFilename}" è stato anonimizzato con successo.
                    {processingResult.detectedEntities && (
                      <> Sono state protette {processingResult.detectedEntities.length} informazioni sensibili.</>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button onClick={handleDownload} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Scarica Documento Anonimizzato
                  </Button>
                  <Button onClick={handleReset} variant="outline">
                    Nuovo Documento
                  </Button>
                </div>

                {processingResult.detectedEntities && processingResult.detectedEntities.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Entità Protette</h3>
                    <div className="flex flex-wrap gap-2">
                      {processingResult.detectedEntities.map((entity, index) => (
                        <Badge key={index} variant="secondary">
                          {entity.text} → {entityReplacements[entity.type] || `[${entity.type}]`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}