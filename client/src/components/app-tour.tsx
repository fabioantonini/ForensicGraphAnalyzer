import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';

interface AppTourProps {
  isOpen?: boolean;
  onClose?: () => void;
  tourType?: 'main' | 'dashboard' | 'documents' | 'signatures' | 'assistant';
}

export function AppTour({ isOpen = false, onClose, tourType = 'main' }: AppTourProps) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [run, setRun] = useState(isOpen);
  const [steps, setSteps] = useState<Step[]>([]);

  // When isOpen prop changes, update run state
  useEffect(() => {
    setRun(isOpen);
  }, [isOpen]);

  // Set up steps based on tour type and current location
  useEffect(() => {
    if (!run) return;

    // Main application tour
    if (tourType === 'main') {
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
      ]);
    }
    // Dashboard specific tour
    else if (tourType === 'dashboard' && location === '/') {
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
    }
    // Documents page tour
    else if (tourType === 'documents' && location === '/documents') {
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
    }
    // Signatures page tour
    else if (tourType === 'signatures' && location === '/signatures') {
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
      ]);
    }
    // Assistant page tour
    else if (tourType === 'assistant' && location === '/query') {
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
  }, [run, tourType, t, location]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (onClose) {
        onClose();
      }
    }
  };

  // Style overrides for tour
  const joyrideStyles = {
    options: {
      zIndex: 10000,
      primaryColor: '#6366f1', // Match your primary color theme
    },
    tooltip: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
    },
    buttonNext: {
      backgroundColor: '#6366f1',
    },
    buttonBack: {
      color: '#6366f1',
    },
    buttonSkip: {
      color: '#94a3b8',
    },
  };

  return (
    <Joyride
      callback={handleCallback}
      continuous
      hideCloseButton
      run={run}
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
  );
}