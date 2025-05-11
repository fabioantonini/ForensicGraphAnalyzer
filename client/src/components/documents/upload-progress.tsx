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
  
  // Determina se stiamo usando un ID temporaneo o reale
  const isTempId = documentId < 0 || documentId > 1000000000; // IDs temporanei sono negativi o timestamp
  
  // Stato per tenere traccia dell'ultimo documento reale trovato
  const [lastRealDocumentId, setLastRealDocumentId] = useState<number | null>(null);

  // Crea un oggetto di stato iniziale per gli ID temporanei
  const initialTempData: ProgressData = {
    status: 'pending',
    progress: 5, // Valore iniziale basso
    processedChunks: 0,
    totalChunks: 100,
  };

  // Effettua la query per i documenti per cercare corrispondenze recenti
  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: isTempId, // Esegui la query solo per ID temporanei
    refetchInterval: isTempId ? 2000 : false, // Aggiorna ogni 2 secondi per ID temporanei
  });

  // Cerca un documento recente che corrisponda al nome del file
  useEffect(() => {
    if (isTempId && documents && documents.length > 0) {
      // Cerca per nome file o URL (filename contiene solo il nome del file, non il path completo)
      const matchingDoc = documents.find(doc => 
        doc.originalFilename.includes(filename) || 
        filename.includes(doc.originalFilename)
      );
      
      // Se troviamo una corrispondenza, salva l'ID
      if (matchingDoc && matchingDoc.id) {
        console.log("Trovato documento reale che corrisponde:", matchingDoc);
        setLastRealDocumentId(matchingDoc.id);
      }
    }
  }, [isTempId, documents, filename]);

  // Effettua la query per ottenere l'avanzamento dell'elaborazione
  const { data: apiData, error, isLoading } = useQuery<ProgressData>({
    queryKey: [`/api/documents/${lastRealDocumentId || documentId}/progress`],
    // Disabilita la query per ID temporanei che non hanno ancora trovato un ID reale
    enabled: !isTempId || (isTempId && lastRealDocumentId !== null),
    refetchInterval: shouldPoll ? 1000 : false,
    refetchIntervalInBackground: true,
  });

  // Usa i dati dall'API o lo stato iniziale per ID temporanei
  const data = (isTempId && !lastRealDocumentId) ? initialTempData : apiData;
  
  // Per ID temporanei, crea un effetto che simula l'avanzamento
  const [tempProgress, setTempProgress] = useState<number>(5);
  
  useEffect(() => {
    if (isTempId && !lastRealDocumentId) {
      // Incrementa gradualmente la barra fino al 40% per mostrare attività
      // ma solo se non abbiamo ancora trovato un ID reale
      const interval = setInterval(() => {
        setTempProgress(prev => {
          const newProgress = prev + 2; // Incremento graduale
          return newProgress < 40 ? newProgress : 40; // Massimo 40%
        });
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [isTempId, lastRealDocumentId]);
  
  // Sovrascrive i dati iniziali per ID temporanei con l'avanzamento simulato
  // ma solo se non abbiamo ancora trovato un ID reale
  if (isTempId && !lastRealDocumentId && data) {
    data.progress = tempProgress;
  }
  
  // Se abbiamo trovato un documento reale ma ancora usiamo l'ID temporaneo
  // aggiungiamo dei log per debug
  useEffect(() => {
    if (isTempId && lastRealDocumentId) {
      console.log(`UploadProgress: collegato documento temporaneo ${documentId} a reale ${lastRealDocumentId}`);
    }
  }, [isTempId, lastRealDocumentId, documentId]);
  
  // Quando lo stato cambia, aggiorna shouldPoll
  useEffect(() => {
    if (data && (data.status === 'completed' || data.status === 'failed')) {
      setShouldPoll(false);
    }
  }, [data]);
  
  // Auto-dismissione dopo 3 secondi di completamento
  useEffect(() => {
    if (data && data.status === 'completed') {
      console.log("UploadProgress: completato, imposto timer per auto-dismissione");
      const timer = setTimeout(() => {
        onDismiss();
      }, 5000); // Aumentato a 5 secondi per dare più tempo all'utente di vedere il completamento
      return () => clearTimeout(timer);
    }
  }, [data, onDismiss]);
  
  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };
  
  // Se non abbiamo ancora dati dal server, mostra una barra al 10% come indicazione che il processo è iniziato
  const progress = isLoading && !data ? 10 : (data?.progress || 0);
  
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
      <Card className="fixed bottom-4 right-4 shadow-lg w-80 z-[9999] border-2 border-red-500">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-red-500 text-lg flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
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
    <Card className="fixed bottom-4 right-4 shadow-lg w-96 z-[9999] border-2 border-primary animate-in slide-in-from-right-10">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-primary text-lg flex items-center">
            {renderStatusIcon()}
            <span className={renderStatusIcon() ? "ml-2" : ""}>
              {getStatusText()}
            </span>
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-700 mb-3 truncate font-medium" title={filename}>
          {filename}
        </p>
        <div className="w-full bg-gray-100 rounded-full h-5 mt-2 mb-2 overflow-hidden">
          <div
            className={`h-5 rounded-full transition-all duration-500 ${
              data?.status === 'failed' ? 'bg-red-500' : 'bg-primary'
            } shadow-inner flex items-center justify-center text-xs text-white font-medium`}
            style={{ width: `${Math.max(5, progress)}%` }}
          >
            {progress > 10 && `${Math.round(progress)}%`}
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          <span className="font-medium">
            {data?.processedChunks && data?.totalChunks 
              ? `${data.processedChunks}/${data.totalChunks} chunks`
              : `${progress}%`
            }
          </span>
          {data?.status === 'processing' && data?.timeRemaining && (
            <span className="font-medium">{formatTime(data.timeRemaining)} {t('documents.processing.remaining', 'remaining')}</span>
          )}
        </div>
        
        {data?.status === 'failed' && data?.error && (
          <p className="text-sm text-red-600 mt-3 px-3 py-2 bg-red-50 rounded-md border border-red-200">
            {data.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
