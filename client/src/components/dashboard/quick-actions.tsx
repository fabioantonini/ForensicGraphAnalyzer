import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useTranslation } from "react-i18next";
import { UploadModal } from "@/components/documents/upload-modal-fixed";
import { PlusCircle, ArrowRightCircle } from "lucide-react";

export function QuickUpload() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{t('dashboard.quickUpload')}</h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('dashboard.quickUploadDescription')}
        </p>
        
        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <Button 
            className="flex-1 min-w-0 whitespace-nowrap"
            onClick={() => setShowUploadModal(true)}
          >
            <PlusCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            {t('documents.uploadDocument')}
          </Button>
          
          <Button
            variant="outline"
            className="flex-1 min-w-0 whitespace-nowrap"
            onClick={() => setLocation("/documents")}
          >
            <ArrowRightCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            {t('dashboard.viewDocuments')}
          </Button>
        </div>
        
        <UploadModal
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
        />
      </CardContent>
    </Card>
  );
}

export function QuickQuery() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };
  
  const handleSubmit = () => {
    if (query.trim()) {
      setLocation("/query");
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{t('dashboard.quickQuery')}</h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('dashboard.quickQueryDescription')}
        </p>
        <div className="relative">
          <Input
            className="w-full px-4 py-3"
            placeholder={t('query.askAboutDocuments')}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Button
            className="absolute right-2 top-2"
            size="icon"
            onClick={handleSubmit}
            disabled={!query.trim()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        </div>
        <div className="text-sm text-gray-500 mt-2">
          <span className="font-medium">{t('query.tip')}:</span> {t('query.graphologyTip')}
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <QuickUpload />
      <QuickQuery />
    </div>
  );
}
