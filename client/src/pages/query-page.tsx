import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Document } from "@/lib/types";
import { DocumentSelection } from "@/components/query/document-selection";
import { ChatInterface } from "@/components/query/chat-interface";
import { useLocation } from "wouter";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function QueryPage() {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [documentMap, setDocumentMap] = useState<Record<number, Document>>({});
  const [initialQuery, setInitialQuery] = useState("");

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
      <h2 className="text-2xl font-bold text-primary mb-6">RAG Query Interface</h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner text="Loading documents..." />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <DocumentSelection
            selectedDocumentIds={selectedDocumentIds}
            onSelectionChange={handleSelectionChange}
            className="md:w-1/3"
          />
          
          <ChatInterface
            selectedDocumentIds={selectedDocumentIds}
            documentMap={documentMap}
            className="md:w-2/3 flex-1"
            initialQuery={initialQuery}
          />
        </div>
      )}
    </div>
  );
}
