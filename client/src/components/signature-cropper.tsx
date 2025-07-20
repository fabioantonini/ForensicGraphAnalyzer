import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Crop, Scissors, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CropResult {
  success: boolean;
  croppedPath?: string;
  originalDimensions: { width: number; height: number };
  croppedDimensions: { width: number; height: number };
  cropBox: { left: number; top: number; width: number; height: number };
  confidence: number;
  needsManualAdjustment: boolean;
  message: string;
}

interface SignatureCropperProps {
  signatureId: number;
  imagePath: string;
  onCropComplete?: (result: CropResult) => void;
}

export function SignatureCropper({ signatureId, imagePath, onCropComplete }: SignatureCropperProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropResult, setCropResult] = useState<CropResult | null>(null);
  const [previewMode, setPreviewMode] = useState(true);
  const [targetWidth, setTargetWidth] = useState([800]);
  const [targetHeight, setTargetHeight] = useState([400]);
  const { toast } = useToast();

  const handleAutoCrop = async () => {
    setIsProcessing(true);
    try {
      const response = await apiRequest("POST", `/api/signatures/${signatureId}/crop`, {
        autoCrop: true,
        targetSize: { width: targetWidth[0], height: targetHeight[0] },
        applyToOriginal: !previewMode
      });

      if (response.success) {
        setCropResult(response.cropResult);
        onCropComplete?.(response.cropResult);
        
        toast({
          title: "Ritaglio completato",
          description: response.message,
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore nel ritaglio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCrop = async (cropBox: { left: number; top: number; width: number; height: number }) => {
    setIsProcessing(true);
    try {
      const response = await apiRequest("POST", `/api/signatures/${signatureId}/crop`, {
        autoCrop: false,
        cropBox,
        targetSize: { width: targetWidth[0], height: targetHeight[0] },
        applyToOriginal: !previewMode
      });

      if (response.success) {
        setCropResult(response.cropResult);
        onCropComplete?.(response.cropResult);
        
        toast({
          title: "Ritaglio manuale completato",
          description: response.message,
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore nel ritaglio manuale",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return "Alta confidenza";
    if (confidence >= 0.6) return "Media confidenza";
    return "Bassa confidenza";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crop className="h-5 w-5" />
          Ritaglio Automatico Firma
        </CardTitle>
        <CardDescription>
          Sistema intelligente per ritagliare automaticamente le firme e normalizzare le dimensioni per un confronto più accurato.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Immagine originale */}
        <div className="space-y-2">
          <Label>Immagine Originale</Label>
          <div className="border rounded-lg p-4 bg-gray-50">
            <img 
              src={`/uploads/${imagePath}`} 
              alt="Firma originale"
              className="max-w-full h-auto max-h-48 mx-auto"
            />
          </div>
        </div>

        {/* Controlli */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Larghezza target (px)</Label>
              <Slider
                value={targetWidth}
                onValueChange={setTargetWidth}
                max={1200}
                min={400}
                step={50}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{targetWidth[0]}px</span>
            </div>
            
            <div className="space-y-2">
              <Label>Altezza target (px)</Label>
              <Slider
                value={targetHeight}
                onValueChange={setTargetHeight}
                max={800}
                min={200}
                step={25}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{targetHeight[0]}px</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="preview-mode"
                checked={previewMode}
                onCheckedChange={setPreviewMode}
              />
              <Label htmlFor="preview-mode">
                Solo anteprima (non modificare originale)
              </Label>
            </div>

            <Button 
              onClick={handleAutoCrop}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Elaborazione...
                </>
              ) : (
                <>
                  <Scissors className="mr-2 h-4 w-4" />
                  Ritaglio Automatico
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Risultato del ritaglio */}
        {cropResult && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Risultato Ritaglio</h3>
              <Badge 
                className={`${getConfidenceColor(cropResult.confidence)} text-white`}
              >
                {getConfidenceText(cropResult.confidence)} ({(cropResult.confidence * 100).toFixed(1)}%)
              </Badge>
            </div>

            {cropResult.needsManualAdjustment && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Ritaglio automatico con bassa confidenza. Potrebbe essere necessario un aggiustamento manuale.
                </span>
              </div>
            )}

            {/* Anteprima ritaglio */}
            {cropResult.croppedPath && (
              <div className="space-y-2">
                <Label>Anteprima Ritagliata</Label>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <img 
                    src={cropResult.croppedPath} 
                    alt="Firma ritagliata"
                    className="max-w-full h-auto max-h-48 mx-auto"
                  />
                </div>
              </div>
            )}

            {/* Statistiche */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Dimensioni Originali</Label>
                <span>{cropResult.originalDimensions.width} × {cropResult.originalDimensions.height}px</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Dimensioni Ritagliate</Label>
                <span>{cropResult.croppedDimensions.width} × {cropResult.croppedDimensions.height}px</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Area Ritaglio</Label>
                <span>{cropResult.cropBox.width} × {cropResult.cropBox.height}px</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Posizione</Label>
                <span>({cropResult.cropBox.left}, {cropResult.cropBox.top})</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Messaggio</span>
              </div>
              <p className="text-sm text-blue-700">{cropResult.message}</p>
            </div>
          </div>
        )}

        {/* Suggerimenti */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">💡 Suggerimenti per il Ritaglio Ottimale</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>Firme piccole su fogli A4:</strong> Il ritaglio automatico rimuove spazio vuoto e migliora l'accuratezza</li>
            <li>• <strong>Normalizzazione:</strong> Dimensioni uniformi permettono confronti più precisi</li>
            <li>• <strong>Confidenza alta (&gt;80%):</strong> Il ritaglio automatico ha identificato chiaramente i bordi</li>
            <li>• <strong>Confidenza bassa (&lt;60%):</strong> Considera un ritaglio manuale per risultati migliori</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}