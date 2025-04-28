import { useState, useEffect } from 'react';

interface SignatureImageProps {
  filename: string;
  originalFilename?: string;
  className?: string;
  processingStatus?: string;
}

export function SignatureImage({
  filename,
  originalFilename,
  className = "",
  processingStatus = "completed"
}: SignatureImageProps) {
  const [imageUrl, setImageUrl] = useState<string>(`/uploads/${filename}?t=${Date.now()}`);
  const [loadError, setLoadError] = useState<boolean>(false);
  
  // Refresha l'immagine ogni secondo se è in stato "processing"
  useEffect(() => {
    if (processingStatus === 'processing') {
      const interval = setInterval(() => {
        setImageUrl(`/uploads/${filename}?t=${Date.now()}`);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [filename, processingStatus]);
  
  const handleImageError = () => {
    setLoadError(true);
    console.log(`Errore nel caricamento dell'immagine: ${filename}`);
  };
  
  // SVG placeholder per immagini non disponibili
  const placeholderSvg = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkZpcm1hIGluIGVsYWJvcmF6aW9uZTwvdGV4dD48L3N2Zz4=`;
  
  // SVG placeholder per firme in elaborazione
  const processingSvg = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjdmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM0Mjk1ZjUiPkZpcm1hIGluIGVsYWJvcmF6aW9uZTwvdGV4dD48L3N2Zz4=`;
  
  // Determina la sorgente dell'immagine
  const imageSrc = loadError || processingStatus === 'failed' 
    ? placeholderSvg 
    : processingStatus === 'processing' && loadError
      ? processingSvg
      : imageUrl;
  
  const fullClassName = `max-w-full h-full object-contain p-2 border border-gray-200 ${
    processingStatus === 'processing' ? 'animate-pulse' : ''
  } ${className}`;
  
  return (
    <img
      src={imageSrc}
      alt={originalFilename || 'Signature'}
      className={fullClassName}
      onError={handleImageError}
    />
  );
}