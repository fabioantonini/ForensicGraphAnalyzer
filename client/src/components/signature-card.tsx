import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2 } from "lucide-react";
import { SignatureImage } from "./signature-image";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

interface SignatureCardProps {
  signature: any; 
  onDelete: (id: number) => void;
  showSimilarity?: boolean;
}

export function SignatureCard({ 
  signature, 
  onDelete,
  showSimilarity = false
}: SignatureCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  
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
  
  // Verifica se dobbiamo mostrare il pulsante per il rapporto di analisi
  const hasAdvancedAnalysis = showSimilarity && 
    signature.processingStatus === 'completed' && 
    signature.comparisonResult !== null && 
    (signature.comparisonChart || signature.analysisReport);
  
  return (
    <>
      <Card className="overflow-hidden">
        <div className="relative h-48 bg-gray-100">
          <SignatureImage 
            filename={signature.filename}
            originalFilename={signature.originalFilename}
            processingStatus={signature.processingStatus}
            className="w-full h-full"
          />
          <div className="absolute top-2 right-2 flex space-x-2">
            {hasAdvancedAnalysis && (
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
          <div className="flex items-center mt-1">
            <Badge className={getStatusColor(signature.processingStatus)}>
              {getStatusTranslation(signature.processingStatus)}
            </Badge>
          </div>
          
          {/* Mostra il punteggio di similarità solo per le firme da verificare */}
          {showSimilarity && signature.processingStatus === 'completed' && renderSimilarityScore(signature.comparisonResult)}
        </CardContent>
      </Card>

      {hasAdvancedAnalysis && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {t('signatures.analysisReport.title', 'Rapporto di analisi firma')} - {signature.originalFilename}
              </DialogTitle>
              <DialogDescription>
                {t('signatures.analysisReport.subtitle', 'Dettagli del confronto con la firma di riferimento')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Punteggio di similarità */}
              <div className="bg-muted rounded p-4">
                <h3 className="font-medium text-lg mb-2">
                  {t('signatures.verification.similarityScore', 'Punteggio di somiglianza')}: {(signature.comparisonResult * 100).toFixed(1)}%
                </h3>
                <Progress value={signature.comparisonResult * 100} className="h-3" />
              </div>
              
              {/* Visualizza il grafico di confronto se disponibile */}
              {signature.comparisonChart && (
                <div>
                  <h3 className="font-medium mb-2 text-lg">{t('signatures.analysisReport.comparisonChart', 'Grafico di confronto')}</h3>
                  <div className="bg-white rounded border p-2 flex justify-center">
                    <img 
                      src={`data:image/png;base64,${signature.comparisonChart}`} 
                      alt="Comparison Chart" 
                      className="max-w-full h-auto"
                    />
                  </div>
                </div>
              )}
              
              {/* Visualizza il report di analisi se disponibile */}
              {signature.analysisReport && (
                <div>
                  <h3 className="font-medium mb-2 text-lg">{t('signatures.analysisReport.technicalDescription', 'Descrizione tecnica')}</h3>
                  <ScrollArea className="h-[200px] rounded bg-muted p-4">
                    <div className="whitespace-pre-line">
                      {signature.analysisReport}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Link al report PDF se disponibile */}
              {signature.reportPath && (
                <div className="mt-4">
                  <Button asChild>
                    <a 
                      href={`/api/signatures/${signature.id}/report`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {t('signatures.analysisReport.downloadPdf', 'Scarica report PDF')}
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}