import { Loader2, ZoomIn, ZoomOut, Search, RotateCw, Pencil, Eraser, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface SignatureImageProps {
  filename: string;
  originalFilename?: string;
  className?: string;
  processingStatus?: string;
  onLineLengthChange?: (length: number) => void;
  dpi?: number;
}

export function SignatureImage({
  filename,
  originalFilename,
  className,
  processingStatus = "completed",
  onLineLengthChange,
  dpi = 300
}: SignatureImageProps) {
  const { t } = useTranslation();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const transformRef = useRef(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number, y: number } | null>(null);
  const [lineLength, setLineLength] = useState<number | null>(null);
  
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
    setDrawMode(false);
    setStartPoint(null);
    setEndPoint(null);
    setLineLength(null);
  }, [filename]);
  
  // Funzione per calcolare la lunghezza della linea in centimetri
  const calculateLineLength = (start: { x: number, y: number }, end: { x: number, y: number }): number => {
    // Calcola la distanza in pixel usando il teorema di Pitagora
    const pixelDistance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + 
      Math.pow(end.y - start.y, 2)
    );
    
    // Converti da pixel a centimetri usando il DPI
    // 1 pollice = 2.54 cm, quindi pixel / DPI * 2.54 = cm
    const cmDistance = (pixelDistance / dpi) * 2.54;
    
    return parseFloat(cmDistance.toFixed(2));
  };
    
  // Funzioni per gestire il disegno della linea
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
    setEndPoint({ x, y });
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawMode || !canvasRef.current || !startPoint) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setEndPoint({ x, y });
    
    // Disegna la linea sul canvas
    drawLineOnCanvas();
  };
  
  const endDrawing = () => {
    if (!isDrawing || !startPoint || !endPoint) return;
    
    setIsDrawing(false);
    
    // Calcola e imposta la lunghezza della linea
    const length = calculateLineLength(startPoint, endPoint);
    setLineLength(length);
    
    // Notifica il componente genitore se necessario
    if (onLineLengthChange) {
      onLineLengthChange(length);
    }
  };
  
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setStartPoint(null);
      setEndPoint(null);
      setLineLength(null);
      
      if (onLineLengthChange) {
        onLineLengthChange(0);
      }
    }
  };
  
  const drawLineOnCanvas = () => {
    if (!canvasRef.current || !startPoint || !endPoint) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Pulisci il canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Imposta lo stile della linea
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.strokeStyle = '#2563eb'; // Blu
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Disegna i punti di inizio e fine
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  // Aggiorna le dimensioni del canvas quando l'immagine viene caricata
  useEffect(() => {
    if (isImageLoaded && imgRef.current && canvasRef.current) {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      
      // Imposta le dimensioni del canvas per corrispondere all'immagine visualizzata
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    }
  }, [isImageLoaded]);
  
  // Ridisegna la linea quando cambia lo zoom
  useEffect(() => {
    if (startPoint && endPoint) {
      drawLineOnCanvas();
    }
  }, [startPoint, endPoint]);

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
          disabled: isProcessing || !isImageLoaded || (drawMode && isDrawing),
          velocityDisabled: true
        }}
        doubleClick={{
          disabled: isProcessing || !isImageLoaded || drawMode,
          step: 0.5
        }}
        wheel={{
          disabled: isProcessing || !isImageLoaded || drawMode,
          step: 0.2
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent wrapperClass="!w-full !h-full">
              <div className="relative w-full h-full">
                <img 
                  ref={imgRef}
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
                {isImageLoaded && (
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-auto"
                    style={{ display: drawMode ? 'block' : 'none', cursor: drawMode ? 'crosshair' : 'auto' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                  />
                )}
              </div>
            </TransformComponent>
            
            {/* Zoom e disegno controls */}
            {!isProcessing && isImageLoaded && (
              <div className="absolute bottom-2 right-2 flex-col gap-1 hidden group-hover:flex">
                {/* Pulsante per attivare/disattivare la modalità disegno */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={drawMode ? "default" : "secondary"} 
                        size="icon" 
                        className="h-7 w-7 opacity-90 hover:opacity-100 shadow" 
                        onClick={() => setDrawMode(!drawMode)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('common.drawLine', 'Disegna linea')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Pulsante per cancellare il disegno (visibile solo in modalità disegno) */}
                {drawMode && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-7 w-7 opacity-90 hover:opacity-100 shadow" 
                          onClick={clearCanvas}
                        >
                          <Eraser className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('common.clear', 'Cancella')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Pulsanti di zoom (visibili solo quando non si è in modalità disegno) */}
                {!drawMode && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </>
        )}
      </TransformWrapper>
      
      {/* Display dimensione linea se disponibile */}
      {lineLength !== null && drawMode && (
        <div className="absolute top-2 right-2 p-2 bg-white/90 rounded-md shadow-sm border border-gray-200 z-10">
          <div className="text-sm font-medium">
            {t('common.lineLength', 'Lunghezza della linea:')} {lineLength} cm
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {(isProcessing || (!isImageLoaded && !imageFailed)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {/* Istruzioni */}
      {!isProcessing && isImageLoaded && (
        <div className="absolute top-2 left-2 text-xs text-gray-600 bg-white/70 px-1.5 py-0.5 rounded hidden group-hover:flex items-center gap-1">
          {drawMode ? (
            <>
              <Pencil className="h-3 w-3" />
              <span>{t('common.drawLine', 'Disegna linea')}</span>
            </>
          ) : (
            <>
              <Search className="h-3 w-3" />
              <span>{t('common.dragToMove', 'Trascina per muovere')}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}