import React from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipProps {
  content: string;
  translationKey?: string;
  defaultContent?: string;
  width?: string;
  className?: string;
  iconSize?: number;
}

/**
 * Componente per mostrare tooltip contestuali di aiuto
 * Utilizza l'icona Info di default e mostra un tooltip al passaggio del mouse
 */
export function HelpTooltip({
  content,
  translationKey,
  defaultContent,
  width = "280px",
  className = "",
  iconSize = 16,
}: HelpTooltipProps) {
  const { t } = useTranslation();
  
  // Se è fornita una chiave di traduzione, usala per ottenere il contenuto
  const tooltipContent = translationKey 
    ? t(translationKey, defaultContent || content) 
    : content;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div 
            className={`text-muted-foreground hover:text-primary-foreground inline-flex cursor-help ${className}`}
            aria-label="Informazioni aggiuntive"
          >
            <Info size={iconSize} />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          style={{ maxWidth: width }} 
          className="text-sm p-3 bg-popover text-popover-foreground"
        >
          <div dangerouslySetInnerHTML={{ __html: tooltipContent }} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}