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
  
  return (
    <div className={cn("relative w-full h-full", className)}>
      <img 
        src={`/uploads/${filename}`} 
        alt={originalFilename || 'Signature'} 
        className="w-full h-full object-contain p-2"
      />
      
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}