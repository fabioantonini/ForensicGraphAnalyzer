import { Loader2, ZoomIn, ZoomOut, Search, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const { t } = useTranslation();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const transformRef = useRef(null);
  
  // Se lo stato è pending o processing, mostra il loader sovrapposto all'immagine
  const isProcessing = processingStatus === 'pending' || processingStatus === 'processing';
  
  // Assicuriamoci che l'URL dell'immagine abbia tutte le parti necessarie
  const imageUrl = filename.startsWith('/uploads/') 
    ? filename 
    : `/uploads/${filename}`;

  // Reset zoom when the image changes
  useEffect(() => {
    setIsImageLoaded(false);
    setImageFailed(false);
  }, [filename]);
    
  return (
    <div className={cn("relative w-full h-full group", className)}>
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        limitToBounds
        panning={{
          disabled: isProcessing || !isImageLoaded,
          velocityDisabled: true
        }}
        doubleClick={{
          disabled: isProcessing || !isImageLoaded,
          step: 0.5
        }}
        wheel={{
          disabled: isProcessing || !isImageLoaded,
          step: 0.2
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent wrapperClass="!w-full !h-full">
              <img 
                src={imageUrl} 
                alt={originalFilename || 'Signature'} 
                className={cn(
                  "w-full h-full object-contain p-2 transition-opacity",
                  !isImageLoaded && !imageFailed ? "opacity-0" : "opacity-100"
                )}
                onLoad={() => setIsImageLoaded(true)}
                onError={(e) => {
                  console.error(`Errore nel caricamento dell'immagine: ${imageUrl}`);
                  const img = e.target as HTMLImageElement;
                  img.src = '/placeholder-image.svg'; // Fallback a un'immagine di placeholder
                  setImageFailed(true);
                }}
              />
            </TransformComponent>
            
            {/* Zoom controls */}
            {!isProcessing && isImageLoaded && (
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
            )}
          </>
        )}
      </TransformWrapper>
      
      {/* Loading indicator */}
      {(isProcessing || (!isImageLoaded && !imageFailed)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {/* Zoom instruction hint */}
      {!isProcessing && isImageLoaded && (
        <div className="absolute top-2 left-2 text-xs text-gray-600 bg-white/70 px-1.5 py-0.5 rounded hidden group-hover:flex items-center gap-1">
          <Search className="h-3 w-3" />
          <span>{t('common.dragToMove', 'Trascina per muovere')}</span>
        </div>
      )}
    </div>
  );
}