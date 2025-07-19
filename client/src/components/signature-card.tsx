import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, Edit2, ZoomIn, ZoomOut, RotateCw, Search } from "lucide-react";
import { SignatureImage } from "./signature-image";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Schema per la modifica del DPI rimosso - ora utilizziamo solo dimensioni reali inserite dall'utente

interface SignatureCardProps {
  signature: any; 
  onDelete: (id: number) => void;
  showSimilarity?: boolean;
  projectId?: number;
}

export function SignatureCard({ 
  signature, 
  onDelete,
  showSimilarity = false,
  projectId
}: SignatureCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Mutation per riprocessare firma fallita
  const reprocessSignature = useMutation({
    mutationFn: (signatureId: number) => 
      apiRequest(`/api/signatures/${signatureId}/reprocess`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: t('signatures.reprocessStarted', 'Riprocessamento avviato') });
      queryClient.invalidateQueries({ queryKey: ['signatures', projectId] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('signatures.reprocessFailed', 'Riprocessamento fallito'), 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleReprocess = () => {
    reprocessSignature.mutate(signature.id);
  };
  
  // Rimosso tutto il codice per la gestione del DPI - ora utilizziamo solo dimensioni reali
  
  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Funzione per tradurre lo stato di elaborazione
  const getStatusTranslation = (status: string) => {
    switch(status) {
      case 'pending': return t('signatures.status.pending', 'In attesa');
      case 'processing': return t('signatures.status.processing', 'In elaborazione');
      case 'completed': return t('signatures.status.completed', 'Completato');
      case 'failed': return t('signatures.status.failed', 'Fallito');
      default: return status;
    }
  };
  
  // Function to render similarity score
  const renderSimilarityScore = (score: number | null) => {
    if (score === null) return null;
    
    let color = 'bg-red-500';
    let textKey = 'signatures.verification.notAuthentic';
    let defaultText = 'Firma non autentica';
    
    if (score >= 0.8) {
      color = 'bg-green-500';
      textKey = 'signatures.verification.authentic';
      defaultText = 'Firma autentica';
    } else if (score >= 0.6) {
      color = 'bg-yellow-500';
      textKey = 'signatures.verification.suspicious';
      defaultText = 'Firma sospetta';
    }
    
    return (
      <div className="mt-2">
        <p className="text-sm font-medium">
          {t('signatures.verification.similarityScore', 'Punteggio di somiglianza')}: {(score * 100).toFixed(1)}%
        </p>
        <Progress value={score * 100} className="h-2 mt-1" />
        <Badge className={`mt-2 ${color}`}>{t(textKey, defaultText)}</Badge>
      </div>
    );
  };
  
  // Verifica se dobbiamo mostrare il pulsante per il rapporto di analisi dettagliato
  const hasAdvancedDetails = showSimilarity && 
    signature.processingStatus === 'completed' && 
    signature.comparisonResult !== null && 
    (signature.comparisonChart || signature.analysisReport || signature.parameters);
    

  
  return (
    <>
      <Card className="overflow-hidden">
        <div className="relative h-96 bg-gray-100">
          <SignatureImage 
            filename={signature.filename}
            originalFilename={signature.originalFilename}
            processingStatus={signature.processingStatus}
            className="w-full h-full"
            dpi={signature.dpi || 300}
            onLineLengthChange={(length) => {
              // In futuro puoi implementare qui il salvataggio della lunghezza
              console.log("Lunghezza della linea:", length, "cm");
            }}
          />
          <div className="absolute top-2 right-2 flex space-x-2">
            {hasAdvancedDetails && (
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 opacity-80 hover:opacity-100"
                onClick={() => setOpen(true)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="destructive"
              size="icon"
              className="h-7 w-7 opacity-80 hover:opacity-100"
              onClick={() => onDelete(signature.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent className="p-3">
          <p className="text-sm truncate" title={signature.originalFilename}>
            {signature.originalFilename || 'Unknown File'}
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <Badge className={getStatusColor(signature.processingStatus)}>
              {getStatusTranslation(signature.processingStatus)}
            </Badge>
            
            {/* Pulsante per riprocessare firme fallite */}
            {signature.processingStatus === 'failed' && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleReprocess}
                disabled={reprocessSignature.isPending}
                className="h-6 px-2 text-xs ml-1"
              >
                {reprocessSignature.isPending ? t('signatures.reprocessing', 'Riprocessando...') : t('signatures.retry', 'Riprova')}
              </Button>
            )}
            
            <div className="flex flex-col gap-1 ml-1">
              {/* Rimosso il controllo DPI - ora utilizziamo solo le dimensioni reali inserite dall'utente */}
              
              {signature.realWidth && signature.realHeight && (
                <span className="text-xs text-gray-600">
                  <span title={t('signatures.dimensionsInfo', 'Dimensioni reali della firma (inserite dall\'utente)')}>
                    {/* Mostra le dimensioni reali inserite dall'utente */}
                    {(signature.realWidth / 10).toFixed(1)} × {(signature.realHeight / 10).toFixed(1)} cm
                  </span>
                </span>
              )}
            </div>
            
            <Badge className={signature.isReference ? "bg-blue-500 ml-auto" : "bg-purple-500 ml-auto"}>
              {signature.isReference 
                ? t('signatures.referenceSignature', 'Firma di riferimento')
                : t('signatures.verificationSignature', 'Firma da verificare')
              }
            </Badge>
          </div>
          
          {/* Mostra il punteggio di similarità solo per le firme da verificare */}
          {showSimilarity && signature.processingStatus === 'completed' && renderSimilarityScore(signature.comparisonResult)}
        </CardContent>
      </Card>

      {/* Dialog per la modifica del DPI rimosso - ora utilizziamo solo le dimensioni reali inserite dall'utente */}

      {hasAdvancedDetails && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {t('signatures.analysisReport.title', 'Rapporto di analisi firma')} - {signature.originalFilename}
              </DialogTitle>
              <DialogDescription>
                {t('signatures.analysisReport.subtitle', 'Dettagli del confronto con la firma di riferimento')}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
              <div className="grid grid-cols-1 gap-6">
              {/* Punteggio di similarità */}
              {signature.comparisonResult !== null && (
                <div className="bg-muted rounded p-4">
                  <h3 className="font-medium text-lg mb-2">
                    {t('signatures.verification.similarityScore', 'Punteggio di somiglianza')}: {(signature.comparisonResult * 100).toFixed(1)}%
                  </h3>
                  <Progress value={signature.comparisonResult * 100} className="h-3" />
                </div>
              )}
              
              {/* Visualizza entrambe le firme con zoom */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">{t('signatures.verification.verifiedSignature', 'Firma da verificare')}</h3>
                  <div className="bg-muted rounded h-96 relative">
                    <SignatureImage 
                      filename={signature.filename}
                      originalFilename={signature.originalFilename}
                      className="w-full h-full"
                      dpi={signature.dpi || 300}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">{t('signatures.verification.referenceSignature', 'Firma di riferimento')}</h3>
                  <div className="bg-muted rounded h-96 relative">
                    <SignatureImage 
                      filename={signature.referenceSignatureFilename || ''}
                      originalFilename={signature.referenceSignatureOriginalFilename || ''}
                      className="w-full h-full"
                      dpi={signature.referenceDpi || 300}
                    />
                  </div>
                </div>
              </div>
              
              {/* Metodologia di analisi */}
              <div className="bg-muted rounded p-4 border-l-4 border-primary">
                <h3 className="font-medium text-lg mb-2">
                  {t('signatures.methodology.title', 'Metodologia di analisi')}
                </h3>
                <div className="text-sm space-y-3">
                  <p>
                    {t('signatures.methodology.description', 'L\'analisi delle firme utilizza un approccio multi-parametro che considera diversi aspetti grafologici e metrici delle firme confrontate. Il sistema estrae e confronta i seguenti parametri:')}
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <span className="font-medium">{t('signatures.methodology.aspectRatio', 'Proporzioni (15%)')}</span>: {t('signatures.methodology.aspectRatioDesc', 'Larghezza, altezza e rapporto proporzionale della firma')}
                    </li>
                    <li>
                      <span className="font-medium">{t('signatures.methodology.strokes', 'Caratteristiche dei tratti (25%)')}</span>: {t('signatures.methodology.strokesDesc', 'Spessore, pressione e variabilità dei tratti')}
                    </li>
                    <li>
                      <span className="font-medium">{t('signatures.methodology.curvature', 'Curvatura (20%)')}</span>: {t('signatures.methodology.curvatureDesc', 'Angoli, curve e fluidità del tratto')}
                    </li>
                    <li>
                      <span className="font-medium">{t('signatures.methodology.spatial', 'Distribuzione spaziale (20%)')}</span>: {t('signatures.methodology.spatialDesc', 'Densità e posizionamento dei tratti nell\'area della firma')}
                    </li>
                    <li>
                      <span className="font-medium">{t('signatures.methodology.connectivity', 'Connettività (20%)')}</span>: {t('signatures.methodology.connectivityDesc', 'Continuità e frammentazione dei tratti')}
                    </li>
                  </ul>
                  <p>
                    {t('signatures.methodology.conclusion', 'Il punteggio di somiglianza combinato deriva dalla media ponderata di questi parametri, con un\'accuratezza stimata dell\'85% rispetto all\'analisi manuale di un esperto grafologo. Punteggi superiori all\'80% indicano un\'alta probabilità di autenticità.')}
                  </p>
                </div>
              </div>
              
              {/* Visualizza il grafico di confronto se disponibile */}
              {signature.comparisonChart && (
                <div>
                  <h3 className="font-medium mb-2 text-lg">{t('signatures.analysisReport.comparisonChart', 'Grafico di confronto')}</h3>
                  <div className="bg-white rounded border p-2 relative h-64 group">
                    <TransformWrapper
                      initialScale={1}
                      minScale={0.5}
                      maxScale={4}
                      centerOnInit
                      limitToBounds
                    >
                      {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                          <TransformComponent wrapperClass="!w-full !h-full">
                            <img 
                              src={`data:image/png;base64,${signature.comparisonChart}`} 
                              alt="Comparison Chart" 
                              className="max-w-full h-auto"
                            />
                          </TransformComponent>
                          
                          {/* Zoom controls */}
                          <div className="absolute bottom-2 right-2 flex-col gap-1 hidden group-hover:flex">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="h-7 w-7 opacity-90 hover:opacity-100 shadow" 
                                    onClick={() => zoomIn()}
                                  >
                                    <ZoomIn className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t('common.zoomIn', 'Zoom in')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="h-7 w-7 opacity-90 hover:opacity-100 shadow" 
                                    onClick={() => zoomOut()}
                                  >
                                    <ZoomOut className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t('common.zoomOut', 'Zoom out')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="h-7 w-7 opacity-90 hover:opacity-100 shadow" 
                                    onClick={() => resetTransform()}
                                  >
                                    <RotateCw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t('common.resetZoom', 'Reset')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          {/* Zoom instruction hint */}
                          <div className="absolute top-2 left-2 text-xs text-gray-600 bg-white/70 px-1.5 py-0.5 rounded hidden group-hover:flex items-center gap-1">
                            <Search className="h-3 w-3" />
                            <span>{t('common.dragToMove', 'Trascina per muovere')}</span>
                          </div>
                        </>
                      )}
                    </TransformWrapper>
                  </div>
                </div>
              )}
              
              {/* Visualizza il report di analisi se disponibile */}
              {signature.analysisReport && (
                <div>
                  <h3 className="font-medium mb-2 text-lg">{t('signatures.analysisReport.technicalDescription', 'Descrizione tecnica')}</h3>
                  <ScrollArea className="max-h-[400px] h-auto rounded bg-muted p-4 border border-border">
                    <div className="whitespace-pre-line text-sm">
                      {signature.analysisReport}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Visualizzazione dettagliata dei parametri di confronto */}
              {signature.parameters && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2 text-lg">{t('signatures.analysisReport.detailedParams', 'Parametri dettagliati')}</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded">
                    {/* Dimensioni e proporzioni */}
                    <div>
                      <h4 className="font-medium">{t('signatures.parameters.dimensions', 'Dimensioni e proporzioni')}</h4>
                      <div className="space-y-2 mt-1 text-sm">
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.width', 'Larghezza')}:</span>
                          <span>{signature.parameters.width.toFixed(1)} cm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.height', 'Altezza')}:</span>
                          <span>{signature.parameters.height.toFixed(1)} cm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.aspectRatio', 'Proporzione')}:</span>
                          <span>{signature.parameters.aspectRatio.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tratti */}
                    <div>
                      <h4 className="font-medium">{t('signatures.parameters.strokes', 'Caratteristiche dei tratti')}</h4>
                      <div className="space-y-2 mt-1 text-sm">
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.minWidth', 'Spessore min')}:</span>
                          <span>{signature.parameters.strokeWidth.min} px</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.maxWidth', 'Spessore max')}:</span>
                          <span>{signature.parameters.strokeWidth.max} px</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.meanWidth', 'Spessore medio')}:</span>
                          <span>{signature.parameters.strokeWidth.mean.toFixed(2)} px</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Connettività */}
                    <div>
                      <h4 className="font-medium">{t('signatures.parameters.connectivity', 'Connettività')}</h4>
                      <div className="space-y-2 mt-1 text-sm">
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.components', 'Componenti')}:</span>
                          <span>{signature.parameters.connectivity.connectedComponents}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.gaps', 'Interruzioni')}:</span>
                          <span>{signature.parameters.connectivity.gaps}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Curvatura */}
                    <div>
                      <h4 className="font-medium">{t('signatures.parameters.curvature', 'Curvatura')}</h4>
                      <div className="space-y-2 mt-1 text-sm">
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.sharpCorners', 'Angoli netti')}:</span>
                          <span>{signature.parameters.curvatureMetrics.sharpCorners}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.smoothCurves', 'Curve fluide')}:</span>
                          <span>{signature.parameters.curvatureMetrics.smoothCurves}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.angleChanges', 'Variazioni angolari')}:</span>
                          <span>{signature.parameters.curvatureMetrics.totalAngleChanges.toFixed(2)}°</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Distribuzione spaziale */}
                    <div className="col-span-2">
                      <h4 className="font-medium">{t('signatures.parameters.spatialDistribution', 'Distribuzione spaziale')}</h4>
                      <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.density', 'Densità')}:</span>
                          <span>{(signature.parameters.spatialDistribution.density * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.centerX', 'Centro X')}:</span>
                          <span>{(signature.parameters.spatialDistribution.centerOfMassX * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.centerY', 'Centro Y')}:</span>
                          <span>{(signature.parameters.spatialDistribution.centerOfMassY * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Punti caratteristici */}
                    <div className="col-span-2">
                      <h4 className="font-medium">{t('signatures.parameters.featurePoints', 'Punti caratteristici')}</h4>
                      <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.loopPoints', 'Asole')}:</span>
                          <span>{signature.parameters.featurePoints.loopPoints}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('signatures.parameters.crossPoints', 'Incroci')}:</span>
                          <span>{signature.parameters.featurePoints.crossPoints}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Generazione report PDF */}
              <div className="mt-6 flex justify-between space-x-4">
                {signature.reportPath ? (
                  <Button asChild className="flex-1">
                    <a 
                      href={`/api/signatures/${signature.id}/report`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {t('signatures.analysisReport.downloadPdf', 'Scarica report PDF')}
                    </a>
                  </Button>
                ) : (
                  !signature.isReference && signature.processingStatus === 'completed' && (
                    <Button 
                      className="flex-1"
                      onClick={async () => {
                        try {
                          // Mostra un toast di avvio processo
                          toast({
                            title: t('signatures.analysisReport.generating', 'Generazione report in corso...'),
                            description: t('signatures.analysisReport.pleaseWait', 'Potrebbero essere necessari alcuni secondi'),
                            duration: 2000
                          });
                          
                          const response = await fetch(`/api/signatures/${signature.id}/generate-report`);
                          
                          if (response.ok) {
                            const data = await response.json();
                            console.log('Report generato:', data);
                                
                            // Aggiorna la firma corrente con il nuovo percorso del report
                            if (data.reportPath && onDelete) {
                              // Qui utilizziamo onDelete come hack per forzare il ricaricamento delle firme
                              // Non sta realmente eliminando nulla, ma fa in modo che il parent ricarichi
                              setTimeout(() => {
                                onDelete(-1); // Un ID impossibile per segnalare che non è una cancellazione ma un aggiornamento
                              }, 500);
                            }
                            
                            // Avvisare l'utente che il report è stato generato
                            toast({
                              title: t('signatures.analysisReport.generationSuccess', 'Report generato con successo'),
                              description: t('signatures.analysisReport.downloadStarting', 'Il download inizierà a breve...'),
                              duration: 3000
                            });
                            
                            // Attendere un attimo e poi richiedere il download
                            setTimeout(() => {
                              window.location.href = `/api/signatures/${signature.id}/report`;
                            }, 1500);
                          } else {
                            // Mostrare messaggio di errore
                            const errorData = await response.json();
                            const errorMessage = errorData.details || errorData.error || t('signatures.analysisReport.unknownError', 'Si è verificato un errore inaspettato');
                            
                            toast({
                              title: t('signatures.analysisReport.generationFailed', 'Errore nella generazione del report'),
                              description: errorMessage,
                              duration: 5000,
                              variant: "destructive"
                            });
                          }
                        } catch (error) {
                          console.error('Errore nella generazione del report:', error);
                          toast({
                            title: t('signatures.analysisReport.generationFailed', 'Errore nella generazione del report'),
                            description: t('signatures.analysisReport.connectionError', 'Errore di connessione al server'),
                            duration: 5000,
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      {t('signatures.analysisReport.generatePdf', 'Genera report PDF')}
                    </Button>
                  )
                )}
              </div>
            </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}