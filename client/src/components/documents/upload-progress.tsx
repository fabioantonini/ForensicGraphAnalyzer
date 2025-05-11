import { Card, CardContent } from "@/components/ui/card";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface UploadProgressProps {
  documentId: number;
  filename: string;
  onDismiss: () => void;
}

type ProgressStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ProgressData {
  status: ProgressStatus;
  progress: number;
  processedChunks?: number;
  totalChunks?: number;
  timeRemaining?: number;
  error?: string;
}

export function UploadProgress({
  documentId,
  filename,
  onDismiss,
}: UploadProgressProps) {
  const { t } = useTranslation();
  const [shouldPoll, setShouldPoll] = useState(true);
  
  // Log di debug per verificare se il componente viene renderizzato
  console.log("UploadProgress renderizzato", { documentId, filename });
  
  // Effettua la query per ottenere l'avanzamento dell'elaborazione
  const { data, error, isLoading } = useQuery<ProgressData>({
    queryKey: [`/api/documents/${documentId}/progress`],
    // Interrompi il polling quando il documento è completato o fallito
    refetchInterval: shouldPoll ? 1000 : false,
    refetchIntervalInBackground: true,
  });
  
  // Quando lo stato cambia, aggiorna shouldPoll
  useEffect(() => {
    if (data && (data.status === 'completed' || data.status === 'failed')) {
      setShouldPoll(false);
    }
  }, [data]);
  
  // Auto-dismissione dopo 3 secondi di completamento
  useEffect(() => {
    if (data && data.status === 'completed') {
      const timer = setTimeout(() => {
        onDismiss();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [data, onDismiss]);
  
  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };
  
  const progress = data?.progress || 0;
  
  const renderStatusIcon = () => {
    if (!data) return null;
    
    switch (data.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };
  
  const getStatusText = (): string => {
    if (!data) return t('documents.uploading', 'Uploading');
    
    switch (data.status) {
      case 'pending':
        return t('documents.processing.pending', 'Waiting to process');
      case 'processing':
        return t('documents.processing.active', 'Processing document');
      case 'completed':
        return t('documents.processing.completed', 'Processing completed');
      case 'failed':
        return t('documents.processing.failed', 'Processing failed');
      default:
        return t('documents.uploading', 'Uploading');
    }
  };
  
  // Se c'è un errore nella query, mostriamo un messaggio appropriato
  if (error) {
    return (
      <Card className="fixed bottom-4 right-4 shadow-lg w-80 z-50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-900 flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              {t('documents.processing.error', 'Error')}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-gray-700"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-red-500">
            {t('documents.processing.errorFetching', 'Error fetching progress')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 shadow-lg w-80 z-50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-900 flex items-center">
            {renderStatusIcon()}
            <span className={renderStatusIcon() ? "ml-2" : ""}>
              {getStatusText()}
            </span>
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-500 hover:text-gray-700"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-500 mb-2 truncate" title={filename}>
          {filename}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${
              data?.status === 'failed' ? 'bg-red-500' : 'bg-secondary'
            }`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>
            {data?.processedChunks && data?.totalChunks 
              ? `${data.processedChunks}/${data.totalChunks} chunks`
              : `${progress}%`
            }
          </span>
          {data?.status === 'processing' && data?.timeRemaining && (
            <span>{formatTime(data.timeRemaining)} {t('documents.processing.remaining', 'remaining')}</span>
          )}
        </div>
        
        {data?.status === 'failed' && data?.error && (
          <p className="text-xs text-red-500 mt-2">
            {data.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
