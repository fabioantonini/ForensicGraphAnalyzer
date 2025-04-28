import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureImageProps {
  filename: string;
  originalFilename?: string;
  className?: string;
  processingStatus?: string;
}

export function SignatureImage({
  filename,
  originalFilename,
  className,
  processingStatus = "completed"
}: SignatureImageProps) {
  // Se lo stato è pending o processing, mostra il loader sovrapposto all'immagine
  const isProcessing = processingStatus === 'pending' || processingStatus === 'processing';
  
  // Assicuriamoci che l'URL dell'immagine abbia tutte le parti necessarie
  const imageUrl = filename.startsWith('/uploads/') 
    ? filename 
    : `/uploads/${filename}`;
    
  return (
    <div className={cn("relative w-full h-full", className)}>
      <img 
        src={imageUrl} 
        alt={originalFilename || 'Signature'} 
        className="w-full h-full object-contain p-2"
        onError={(e) => {
          console.error(`Errore nel caricamento dell'immagine: ${imageUrl}`);
          const img = e.target as HTMLImageElement;
          img.src = '/placeholder-image.svg'; // Fallback a un'immagine di placeholder
        }}
      />
      
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}