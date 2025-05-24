import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTour } from "./tour-provider";

export function TourHelpButton() {
  const { t } = useTranslation();
  const { startTour } = useTour();

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => startTour('main')}
      className="mr-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
      data-tour="help-button"
    >
      <HelpCircle className="h-4 w-4 mr-2" />
      {t("tour.startTour", "Help & Tour")}
    </Button>
  );
}