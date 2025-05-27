import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Document } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useTranslation } from "react-i18next";

interface DocumentSelectionProps {
  selectedDocumentIds: number[];
  onSelectionChange: (documentIds: number[]) => void;
  className?: string;
}

export function DocumentSelection({
  selectedDocumentIds,
  onSelectionChange,
  className,
}: DocumentSelectionProps) {
  const { t } = useTranslation();
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (documents && documents.length > 0) {
      setSelectAll(selectedDocumentIds.length === documents.length);
    }
  }, [selectedDocumentIds, documents]);

  const handleSelectAll = () => {
    if (documents) {
      if (selectedDocumentIds.length === documents.length) {
        // Deselect all
        onSelectionChange([]);
        setSelectAll(false);
      } else {
        // Select all
        onSelectionChange(documents.map(doc => doc.id));
        setSelectAll(true);
      }
    }
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
    setSelectAll(false);
  };

  const handleToggleDocument = (id: number) => {
    if (selectedDocumentIds.includes(id)) {
      onSelectionChange(selectedDocumentIds.filter(docId => docId !== id));
    } else {
      onSelectionChange([...selectedDocumentIds, id]);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{t('query.selectDocuments')}</h3>
        <p className="text-sm text-gray-500 mb-4">
          {selectedDocumentIds.length === 0 
            ? t('query.noDocumentsSelected') 
            : t('query.selectAtLeastOne')}
        </p>
        
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner text={t('query.loadingDocuments')} />
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">{t('query.noDocumentsFound')}</p>
            <p className="text-sm text-gray-400 mt-2">
              {t('query.uploadFirst')}
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[calc(100vh-350px)] pr-4">
              <div className="space-y-3">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center mb-3 pb-3 border-b border-gray-100"
                  >
                    <Checkbox
                      id={`doc-${document.id}`}
                      checked={selectedDocumentIds.includes(document.id)}
                      onCheckedChange={() => handleToggleDocument(document.id)}
                    />
                    <label
                      htmlFor={`doc-${document.id}`}
                      className="ml-2 block text-sm font-medium text-gray-700 cursor-pointer truncate"
                      title={document.originalFilename}
                    >
                      {document.originalFilename}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <Button
                variant="link"
                size="sm"
                className="text-sm text-primary hover:text-primary-dark font-medium p-0"
                onClick={handleSelectAll}
              >
                {selectAll ? t('common.deselectAll') : t('common.selectAll')}
              </Button>
              {selectedDocumentIds.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium p-0"
                  onClick={handleDeselectAll}
                >
                  {t('common.deselectAll')}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
