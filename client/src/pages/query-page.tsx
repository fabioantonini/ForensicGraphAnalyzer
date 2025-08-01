import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Document } from "@/lib/types";
import { DocumentSelection } from "@/components/query/document-selection";
import { ChatInterface } from "@/components/query/chat-interface";
import { useLocation } from "wouter";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";

export default function QueryPage() {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [documentMap, setDocumentMap] = useState<Record<number, Document>>({});
  const [initialQuery, setInitialQuery] = useState("");
  const { t } = useTranslation();

  // Get documents
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Extract document ID from URL parameters if present
  useEffect(() => {
    if (location.includes("?documentId=")) {
      const documentId = parseInt(
        location.split("?documentId=")[1].split("&")[0],
        10
      );
      if (!isNaN(documentId)) {
        setSelectedDocumentIds((prev) => 
          prev.includes(documentId) ? prev : [...prev, documentId]
        );
      }
    }
  }, [location]);

  // Create document map for faster lookup
  useEffect(() => {
    if (documents) {
      const map: Record<number, Document> = {};
      documents.forEach((doc) => {
        map[doc.id] = doc;
      });
      setDocumentMap(map);
    }
  }, [documents]);

  // Handle document selection change
  const handleSelectionChange = (documentIds: number[]) => {
    setSelectedDocumentIds(documentIds);
  };

  return (
    <div className="container mx-auto py-6">
      <h2 className="text-2xl font-bold text-primary mb-6" data-tour="assistant-header">
        {t('query.title')}
      </h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner text={t('query.loadingDocuments')} />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
          <div data-tour="document-selection" className="lg:w-2/5">
            <DocumentSelection
              selectedDocumentIds={selectedDocumentIds}
              onSelectionChange={handleSelectionChange}
              className="h-full"
            />
          </div>
          
          <div data-tour="chat-interface" className="lg:w-3/5 flex-1">
            <ChatInterface
              selectedDocumentIds={selectedDocumentIds}
              documentMap={documentMap}
              className="h-full"
              initialQuery={initialQuery}
            />
          </div>
        </div>
      )}
    </div>
  );
}
