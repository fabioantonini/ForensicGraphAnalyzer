import React, { createContext, useState, useContext, useEffect } from 'react';
import Joyride, { CallBackProps, Step, EVENTS, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface TourContextType {
  startTour: (tourName?: string) => void;
  endTour: () => void;
  resetTours: () => void;
  isActive: boolean;
}

const TourContext = createContext<TourContextType>({
  startTour: () => {},
  endTour: () => {},
  resetTours: () => {},
  isActive: false,
});

export const useTour = () => useContext(TourContext);

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [completedTours, setCompletedTours] = useLocalStorage<string[]>('completedTours', []);
  const [isActive, setIsActive] = useState(false);
  const [currentTour, setCurrentTour] = useState<string>('main');
  const [steps, setSteps] = useState<Step[]>([]);

  // Define the tours based on the current page
  useEffect(() => {
    if (!isActive) return;

    const setupTourSteps = () => {
      if (currentTour === 'main') {
        setSteps([
          {
            target: 'body',
            content: t('tour.welcome', 'Welcome to Grapholex Insight, your forensic graphology assistant! Let\'s walk through the main features.'),
            placement: 'center',
            disableBeacon: true,
          },
          {
            target: '[data-tour="sidebar"]',
            content: t('tour.sidebar', 'This sidebar gives you access to all the main features of the application.'),
            placement: 'right',
          },
          {
            target: '[data-tour="dashboard-link"]',
            content: t('tour.dashboard', 'The Dashboard gives you an overview of your recent activities and quick access to common actions.'),
            placement: 'right',
          },
          {
            target: '[data-tour="documents-link"]',
            content: t('tour.documents', 'Manage your document library. Upload, view, and analyze forensic documents.'),
            placement: 'right',
          },
          {
            target: '[data-tour="assistant-link"]',
            content: t('tour.assistant', 'Ask questions about your documents. The AI-powered assistant will analyze your documents and provide insights.'),
            placement: 'right',
          },
          {
            target: '[data-tour="signatures-link"]',
            content: t('tour.signatures', 'Verify signatures by comparing reference signatures with ones to be examined.'),
            placement: 'right',
          },
          {
            target: '[data-tour="settings-link"]',
            content: t('tour.settings', 'Configure your account settings, API keys, and preferences.'),
            placement: 'right',
          },
          {
            target: '[data-tour="user-menu"]',
            content: t('tour.profile', 'Access your profile settings and logout from here.'),
            placement: 'bottom',
          },
        ]);
      } else if (currentTour === 'dashboard') {
        setSteps([
          {
            target: '[data-tour="dashboard-stats"]',
            content: t('tour.dashboardStats', 'See your document and analysis statistics at a glance.'),
            placement: 'bottom',
            disableBeacon: true,
          },
          {
            target: '[data-tour="quick-upload"]',
            content: t('tour.quickUpload', 'Quickly upload new documents for analysis.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="recent-activities"]',
            content: t('tour.recentActivities', 'View your recent activities and analyses.'),
            placement: 'top',
          },
        ]);
      } else if (currentTour === 'documents') {
        setSteps([
          {
            target: '[data-tour="documents-header"]',
            content: t('tour.documentsHeader', 'This is your document library where you can manage all your forensic documents.'),
            placement: 'bottom',
            disableBeacon: true,
          },
          {
            target: '[data-tour="upload-button"]',
            content: t('tour.uploadButton', 'Click here to upload new documents.'),
            placement: 'left',
          },
          {
            target: '[data-tour="documents-view"]',
            content: t('tour.documentsView', 'View your documents in grid or list view.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="documents-filters"]',
            content: t('tour.documentsFilters', 'Filter documents by type, date, or search for specific files.'),
            placement: 'bottom',
          },
        ]);
      } else if (currentTour === 'signatures') {
        setSteps([
          {
            target: '[data-tour="signatures-header"]',
            content: t('tour.signaturesHeader', 'Welcome to the Signature Verification tool, a key feature for forensic graphology.'),
            placement: 'bottom',
            disableBeacon: true,
          },
          {
            target: '[data-tour="create-project"]',
            content: t('tour.createProject', 'Start by creating a signature project to organize your analysis.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="reference-signatures"]',
            content: t('tour.referenceSignatures', 'Upload authentic reference signatures here.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="verify-signatures"]',
            content: t('tour.verifySignatures', 'Upload signatures to verify against references.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="compare-signatures"]',
            content: t('tour.compareSignatures', 'Compare signatures and view detailed analysis reports.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="signature-methodology"]',
            content: t('tour.signatureMethodology', 'Learn about the scientific methodology behind our signature analysis.'),
            placement: 'left',
          },
        ]);
      } else if (currentTour === 'assistant') {
        setSteps([
          {
            target: '[data-tour="assistant-header"]',
            content: t('tour.assistantHeader', 'This is your Document Assistant, an AI-powered tool to analyze your documents.'),
            placement: 'bottom',
            disableBeacon: true,
          },
          {
            target: '[data-tour="document-selection"]',
            content: t('tour.documentSelection', 'Select the documents you want to analyze.'),
            placement: 'bottom',
          },
          {
            target: '[data-tour="query-input"]',
            content: t('tour.queryInput', 'Ask questions about your documents here. Be specific about forensic graphology terms for better results.'),
            placement: 'top',
          },
          {
            target: '[data-tour="chat-interface"]',
            content: t('tour.chatInterface', 'View the conversation history and document insights here.'),
            placement: 'left',
          },
        ]);
      }
    };

    setupTourSteps();
  }, [isActive, currentTour, t, location]);

  // Determine if we should automatically start the tour for a new user
  useEffect(() => {
    // Only show automatic tour for new users who haven't seen any tours
    const shouldShowTourAutomatically = 
      completedTours.length === 0 && 
      !completedTours.includes('main') && 
      location === '/';

    if (shouldShowTourAutomatically) {
      startTour('main');
    }
  }, [completedTours, location]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    
    // Tour is done or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setCompletedTours((prev: string[]) => [...prev, currentTour]);
      setIsActive(false);
    }
  };

  const startTour = (tourName: string = 'main') => {
    setCurrentTour(tourName);
    setIsActive(true);
  };

  const endTour = () => {
    setIsActive(false);
  };

  const resetTours = () => {
    setCompletedTours([]);
  };

  // Style overrides for tour
  const joyrideStyles = {
    options: {
      zIndex: 10000,
      primaryColor: '#6366f1', // Match your primary color
      textColor: '#374151',
      backgroundColor: '#ffffff',
      arrowColor: '#ffffff',
    },
    tooltip: {
      padding: '16px',
      borderRadius: '8px',
      fontSize: '14px',
      maxWidth: '400px',
    },
    tooltipTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      marginBottom: '8px',
    },
    tooltipContent: {
      padding: '8px 0',
      lineHeight: '1.5',
    },
    buttonNext: {
      backgroundColor: '#6366f1',
      padding: '8px 16px',
      borderRadius: '4px',
      color: '#ffffff',
    },
    buttonBack: {
      color: '#6366f1',
      marginRight: '8px',
    },
    buttonSkip: {
      color: '#94a3b8',
    },
  };

  return (
    <TourContext.Provider value={{ startTour, endTour, resetTours, isActive }}>
      {children}
      <Joyride
        callback={handleJoyrideCallback}
        continuous
        hideCloseButton
        hideBackButton={currentTour === 'main' && steps[0]?.target === 'body'}
        run={isActive}
        scrollToFirstStep
        showProgress
        showSkipButton
        steps={steps}
        styles={joyrideStyles}
        locale={{
          back: t('tour.back', 'Back'),
          close: t('tour.close', 'Close'),
          last: t('tour.finish', 'Finish'),
          next: t('tour.next', 'Next'),
          skip: t('tour.skip', 'Skip'),
        }}
      />
    </TourContext.Provider>
  );
}