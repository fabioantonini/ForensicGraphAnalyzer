import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileInput, SelectedFile } from "@/components/ui/file-input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useTranslation } from "react-i18next";

export function QuickUpload() {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('documents.uploadFailedGeneric'));
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('documents.uploadSuccess'),
        description: t('documents.uploadSuccessMessage'),
        variant: "default",
      });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setLocation("/documents");
    },
    onError: (error: Error) => {
      toast({
        title: t('documents.uploadFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };
  
  const handleRemoveFile = () => {
    setFile(null);
  };
  
  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{t('dashboard.quickUpload')}</h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('dashboard.quickUploadDescription')}
        </p>
        
        {!file ? (
          <FileInput
            onFileSelect={handleFileSelect}
            buttonText={t('documents.dragDropOrBrowse')}
            helperText={t('documents.fileFormatInfo')}
          />
        ) : (
          <div>
            <SelectedFile file={file} onRemove={handleRemoveFile} />
            <Button 
              className="w-full mt-4" 
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : null}
              {t('documents.uploadDocument')}
            </Button>
          </div>
        )}
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
