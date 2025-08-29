import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Settings, Trash2, ZoomIn, ZoomOut, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { SignatureImage } from "./signature-image";
import CropCalibrationDialog from "./crop-calibration-dialog";

interface SignatureCardProps {
  signature: {
    id: number;
    filename: string;
    originalFilename: string;
    realWidth?: number;
    realHeight?: number;
    realWidthMm?: number;
    realHeightMm?: number;
    dpi?: number;
    processingStatus?: string;
    parameters?: any;
    comparisonResult?: number;
    comparisonChart?: string;
    naturalnessScore?: number;
    verdict?: string;
    confidenceLevel?: number;
    verdictExplanation?: string;
    reportPath?: string;
    isReference?: boolean;
    referenceSignatureFilename?: string;
    referenceSignatureOriginalFilename?: string;
    referenceDpi?: number;
  };
  projectId?: string;
  showSimilarity?: boolean;
  onDelete?: (id: number) => void;
}

export function SignatureCard({ 
  signature, 
  projectId, 
  showSimilarity = false, 
  onDelete 
}: SignatureCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  // Calcola il punteggio di similarità
  const similarity = signature.comparisonResult;
  
  // Verifica se dobbiamo mostrare il pulsante per i parametri dettagliati
  const hasAdvancedDetails = signature.parameters && Object.keys(signature.parameters).length > 0;

  // Rendering del punteggio di similarità
  const renderSimilarityScore = ({ similarity, naturalness, verdict, confidence, explanation }: {
    similarity: number | null | undefined;
    naturalness?: number | null;
    verdict?: string | null;
    confidence?: number | null;
    explanation?: string | null;
  }) => {
    if (similarity === null || similarity === undefined || isNaN(similarity)) return null;

    const score = Math.round(similarity * 100);
    
    let verdictText = '';
    let verdictColor = '';
    let bgColor = '';
    
    if (verdict) {
      verdictText = verdict;
      switch (verdict.toLowerCase()) {
        case 'autentica':
        case 'authentic':
          verdictColor = 'text-green-700';
          bgColor = 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400';
          break;
        case 'probabilmente autentica':
        case 'probably authentic':
          verdictColor = 'text-blue-700';
          bgColor = 'bg-gradient-to-r from-blue-50 to-sky-50 border-l-4 border-blue-400';
          break;
        case 'sospetta':
        case 'suspicious':
          verdictColor = 'text-red-700';
          bgColor = 'bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-400';
          break;
        default:
          verdictColor = 'text-gray-700';
          bgColor = 'bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-400';
      }
    } else {
      if (score >= 85) {
        verdictText = t('signatures.verdicts.authentic', 'Autentica');
        verdictColor = 'text-green-700';
        bgColor = 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400';
      } else if (score >= 65) {
        verdictText = t('signatures.verdicts.probablyAuthentic', 'Probabilmente autentica');
        verdictColor = 'text-blue-700';
        bgColor = 'bg-gradient-to-r from-blue-50 to-sky-50 border-l-4 border-blue-400';
      } else {
        verdictText = t('signatures.verdicts.suspicious', 'Sospetta');
        verdictColor = 'text-red-700';
        bgColor = 'bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-400';
      }
    }

    return (
      <div className={`mt-3 p-3 rounded-lg ${bgColor}`}>
        <div className="flex justify-between items-center mb-2">
          <span className={`font-medium text-sm ${verdictColor}`}>
            {verdictText}
          </span>
          <Badge variant="outline" className="text-xs">
            {t('signatures.similarity', 'Similarità')}: {score}%
          </Badge>
        </div>
        <Progress value={score} className="h-2" />
        
        {naturalness && (
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-gray-600">
              {t('signatures.naturalness', 'Naturalezza')}:
            </span>
            <span className="text-xs font-medium">
              {(naturalness * 100).toFixed(1)}%
            </span>
          </div>
        )}
        
        {confidence !== null && (
          <Badge variant="outline" className="text-xs">
            {t('signatures.confidence', 'Confidenza')}: {confidence}%
          </Badge>
        )}
        
        {/* Interpretazione AI (se disponibile) */}
        {explanation && (
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-400">
            <div className="font-medium text-xs text-blue-800 mb-2 flex items-center gap-1">
              🤖 <span>Interpretazione dell'Analisi</span>
            </div>
            <div className="text-xs text-blue-900 leading-relaxed">
              {explanation.split('\n\n').map((paragraph: string, index: number) => (
                <p key={index} className="mb-2 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="relative h-96 bg-gray-100">
          <SignatureImage 
            filename={signature.filename}
            originalFilename={signature.originalFilename}
            processingStatus={signature.processingStatus || 'processing'}
            className="w-full h-full"
            dpi={signature.dpi || 300}
            onLineLengthChange={(length) => {
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
            {signature.parameters && Object.keys(signature.parameters).length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 opacity-80 hover:opacity-100 bg-white"
                onClick={() => setCropDialogOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="icon"
                className="h-7 w-7 opacity-80 hover:opacity-100"
                onClick={() => onDelete(signature.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-medium text-sm truncate" title={signature.originalFilename}>
                {signature.originalFilename}
              </h3>
              
              <div className="flex flex-col gap-1 ml-1">
                {/* Dimensioni reali inserite dall'utente */}
                {(signature.realWidth || signature.realWidthMm) && (signature.realHeight || signature.realHeightMm) && (
                  <span className="text-xs text-gray-600">
                    <span title={t('signatures.dimensionsInfo', 'Dimensioni reali della firma (inserite dall\'utente)')}>
                      📏 {((signature.realWidth || signature.realWidthMm || 0) / 10).toFixed(1)} × {((signature.realHeight || signature.realHeightMm || 0) / 10).toFixed(1)} cm
                    </span>
                  </span>
                )}
                
                {/* Dimensioni in pixel dell'immagine processata */}
                {signature.parameters?.original_width && signature.parameters?.original_height && (
                  <span className="text-xs text-blue-600">
                    <span title={t('signatures.pixelDimensionsInfo', 'Dimensioni in pixel dell\'immagine processata (post auto-crop se applicato)')}>
                      🖼️ {signature.parameters.original_width} × {signature.parameters.original_height} px
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
            
          </div>
        </CardContent>
      </Card>

      {/* Dialog per visualizzazione parametri dettagliati */}
      {hasAdvancedDetails && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {t('signatures.parametersView.title', 'Parametri firma')} - {signature.originalFilename}
              </DialogTitle>
              <DialogDescription>
                {t('signatures.parametersView.subtitle', 'Visualizzazione dettagliata dei parametri calcolati per questa firma')}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
              <div className="grid grid-cols-1 gap-6">
              
                {/* Immagine della firma corrente con zoom */}
                <div>
                  <h3 className="font-medium mb-2 text-lg">{signature.isReference ? 'Firma di riferimento' : 'Firma da verificare'}</h3>
                  <div className="bg-muted rounded h-96 relative group">
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
                            <SignatureImage 
                              filename={signature.filename}
                              originalFilename={signature.originalFilename}
                              className="w-full h-full"
                              dpi={signature.dpi || 300}
                            />
                          </TransformComponent>
                          
                          {/* Controlli zoom */}
                          <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => zoomIn()}
                                  >
                                    <ZoomIn className="h-3 w-3" />
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
                                    className="h-6 w-6"
                                    onClick={() => zoomOut()}
                                  >
                                    <ZoomOut className="h-3 w-3" />
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
                                    className="h-6 w-6"
                                    onClick={() => resetTransform()}
                                  >
                                    <RotateCcw className="h-3 w-3" />
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
                
                {/* Visualizzazione dettagliata dei parametri */}
                {signature.parameters && (
                  <div>
                    <h3 className="font-medium mb-2 text-lg">{t('signatures.analysisReport.detailedParams', 'Parametri dettagliati')}</h3>
                    <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded">
                      {/* Dimensioni e proporzioni */}
                      <div>
                        <h4 className="font-medium">{t('signatures.parameters.dimensions', 'Dimensioni e proporzioni')}</h4>
                        <div className="space-y-2 mt-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.width', 'Larghezza')}:</span>
                            <span>{((signature.realWidthMm || signature.parameters.realWidthMm || 0) / 10).toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.height', 'Altezza')}:</span>
                            <span>{((signature.realHeightMm || signature.parameters.realHeightMm || 0) / 10).toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.aspectRatio', 'Proporzione')}:</span>
                            <span>{signature.parameters.proportion?.toFixed(2) || signature.parameters.aspectRatio?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Inclinazione:</span>
                            <span>{signature.parameters.inclination ? signature.parameters.inclination.toFixed(1) + '°' : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tratti */}
                      <div>
                        <h4 className="font-medium">{t('signatures.parameters.strokes', 'Caratteristiche dei tratti')}</h4>
                        <div className="space-y-2 mt-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.minWidth', 'Spessore min')}:</span>
                            <span>{signature.parameters.strokeWidth?.minMm?.toFixed(2) || 'N/A'} mm</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.maxWidth', 'Spessore max')}:</span>
                            <span>{signature.parameters.strokeWidth?.maxMm?.toFixed(2) || 'N/A'} mm</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.meanWidth', 'Spessore medio')}:</span>
                            <span>{signature.parameters.strokeWidth?.meanMm?.toFixed(2) || 'N/A'} mm</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Connettività */}
                      <div>
                        <h4 className="font-medium">{t('signatures.parameters.connectivity', 'Connettività')}</h4>
                        <div className="space-y-2 mt-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.components', 'Componenti')}:</span>
                            <span>{signature.parameters.connectedComponents || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.gaps', 'Interruzioni')}:</span>
                            <span>{signature.parameters.letterConnections || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Curvatura */}
                      <div>
                        <h4 className="font-medium">{t('signatures.parameters.curvature', 'Curvatura')}</h4>
                        <div className="space-y-2 mt-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.sharpCorners', 'Angoli netti')}:</span>
                            <span>N/A</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.smoothCurves', 'Curve fluide')}:</span>
                            <span>{signature.parameters.avgCurvature?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.angleChanges', 'Variazioni angolari')}:</span>
                            <span>{signature.parameters.baselineStdMm?.toFixed(2) || 'N/A'}°</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Distribuzione spaziale */}
                      <div className="col-span-2">
                        <h4 className="font-medium">{t('signatures.parameters.spatialDistribution', 'Distribuzione spaziale')}</h4>
                        <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.density', 'Densità')}:</span>
                            <span>{signature.parameters.overlapRatio ? (signature.parameters.overlapRatio * 100).toFixed(1) : 'N/A'}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.centerX', 'Centro X')}:</span>
                            <span>N/A</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.centerY', 'Centro Y')}:</span>
                            <span>N/A</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Punti caratteristici */}
                      <div className="col-span-2">
                        <h4 className="font-medium">{t('signatures.parameters.featurePoints', 'Punti caratteristici')}</h4>
                        <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.loopPoints', 'Asole')}:</span>
                            <span>{signature.parameters.avgAsolaSize > 0 ? signature.parameters.avgAsolaSize.toFixed(2) + 'mm²' : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('signatures.parameters.crossPoints', 'Incroci')}:</span>
                            <span>{signature.parameters.overlapRatio ? (signature.parameters.overlapRatio * 100).toFixed(1) + '%' : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Parametri avanzati aggiuntivi dal Python analyzer */}
                      {(signature.parameters.avgSpacing || signature.parameters.pressureStd || signature.parameters.pressureMean || 
                        signature.parameters.velocity || signature.parameters.writingStyle || signature.parameters.readability) && (
                        <div className="col-span-2 border-t pt-3">
                          <h4 className="font-medium text-green-700">Parametri Avanzati (Python/OpenCV)</h4>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                            {signature.parameters.avgSpacing && (
                              <div className="flex justify-between">
                                <span>Spaziatura media:</span>
                                <span>{signature.parameters.avgSpacing.toFixed(1)}mm</span>
                              </div>
                            )}
                            {signature.parameters.pressureStd && (
                              <div className="flex justify-between">
                                <span>Dev. pressione:</span>
                                <span>{signature.parameters.pressureStd.toFixed(1)}</span>
                              </div>
                            )}
                            {signature.parameters.pressureMean && (
                              <div className="flex justify-between">
                                <span>Pressione media:</span>
                                <span>{signature.parameters.pressureMean.toFixed(0)}</span>
                              </div>
                            )}
                            {signature.parameters.velocity && (
                              <div className="flex justify-between">
                                <span>Velocità:</span>
                                <span>{signature.parameters.velocity.toFixed(1)}/5</span>
                              </div>
                            )}
                            {signature.parameters.writingStyle && (
                              <div className="flex justify-between">
                                <span>Stile scrittura:</span>
                                <span>{signature.parameters.writingStyle}</span>
                              </div>
                            )}
                            {signature.parameters.readability && (
                              <div className="flex justify-between">
                                <span>Leggibilità:</span>
                                <span>{signature.parameters.readability}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog per crop manuale */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Modifica Crop Manuale</DialogTitle>
            <DialogDescription>
              Seleziona l'area della firma da analizzare trascinando i bordi dell'area evidenziata.
            </DialogDescription>
          </DialogHeader>
          <CropCalibrationDialog
            signatureId={signature.id}
            originalFilename={signature.originalFilename}
            onClose={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/signature-projects', projectId, 'signatures'] });
              setCropDialogOpen(false);
            }}
            onUpdate={() => {
              toast({
                title: "Crop aggiornato",
                description: "L'area di crop è stata aggiornata con successo",
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}