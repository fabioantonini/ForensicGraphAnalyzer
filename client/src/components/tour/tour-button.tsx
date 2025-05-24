import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTour } from "./tour-provider";

interface TourButtonProps {
  tourName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
  className?: string;
}

export function TourButton({
  tourName = "main",
  variant = "outline",
  size = "sm",
  showIcon = true,
  className = "",
}: TourButtonProps) {
  const { t } = useTranslation();
  const { startTour } = useTour();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => startTour(tourName)}
      className={className}
      aria-label={t("tour.startTour", "Start guided tour")}
    >
      {showIcon && <HelpCircle className="h-4 w-4 mr-2" />}
      {t("tour.startTour", "Help & Tour")}
    </Button>
  );
}