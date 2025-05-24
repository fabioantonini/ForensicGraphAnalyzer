import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppTour } from './app-tour';
import { useLocation } from 'wouter';

export function HelpTourButton() {
  const { t } = useTranslation();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [location] = useLocation();
  
  const getTourType = () => {
    if (location === '/') return 'dashboard';
    if (location === '/documents') return 'documents';
    if (location === '/signatures') return 'signatures';
    if (location === '/query') return 'assistant';
    if (location === '/settings') return 'settings';
    if (location === '/admin') return 'admin';
    return 'main';
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsTourOpen(true)}
        className="mr-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
        data-tour="help-button"
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        {t("tour.startTour", "Help & Tour")}
      </Button>
      
      <AppTour 
        isOpen={isTourOpen} 
        onClose={() => setIsTourOpen(false)} 
        tourType={getTourType() as any}
      />
    </>
  );
}