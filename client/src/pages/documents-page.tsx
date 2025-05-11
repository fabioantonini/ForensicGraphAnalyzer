import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Search, LayoutGrid, List, Trash } from "lucide-react";
import { Document, FilterOptions } from "@/lib/types";
import { DocumentGrid } from "@/components/documents/document-grid";
import { UploadModal } from "@/components/documents/upload-modal-corrected";
import { UploadProgress } from "@/components/documents/upload-progress";
import { TestTabs } from "@/components/documents/test-tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize, getFileTypeIcon } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to list view
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  
  // Stato per la barra di avanzamento
  const [showProgressBar, setShowProgressBar] = useState<boolean>(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<number | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  
  // Callback per la gestione dell'avanzamento del caricamento
  const handleUploadProgress = (documentId: number, filename: string) => {
    console.log("DocumentsPage: ricevuto progresso di caricamento", { documentId, filename });
    setUploadedDocumentId(documentId);
    setUploadedFilename(filename);
    setShowProgressBar(true);
  };
  const [filters, setFilters] = useState<FilterOptions>({
    fileType: "all",
    searchTerm: "",
    dateRange: "all",
  });
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: t("documents.deleteSuccess", "Document deleted"),
        description: t("documents.deleteSuccessDesc", "The document has been successfully removed"),
        variant: "default",
      });
      setDocumentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("documents.deleteFailed", "Delete failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({
      ...filters,
      searchTerm: e.target.value,
    });
  };

  const handleFileTypeChange = (value: string) => {
    setFilters({
      ...filters,
      fileType: value,
    });
  };

  const handleDateRangeChange = (value: string) => {
    setFilters({
      ...filters,
      dateRange: value,
    });
  };

  // Apply filters to documents
  const filteredDocuments = documents?.filter((doc) => {
    let match = true;
    
    // Filter by file type
    if (filters.fileType && filters.fileType !== "all") {
      match = match && doc.fileType.includes(filters.fileType);
    }
    
    // Filter by search term
    if (filters.searchTerm && filters.searchTerm !== "") {
      match = match && doc.originalFilename.toLowerCase().includes(filters.searchTerm.toLowerCase());
    }
    
    return match;
  }) || [];

  const getFileTypeLabel = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return "PDF";
    } else if (fileType.includes("docx")) {
      return "DOCX";
    } else if (fileType.includes("pptx")) {
      return "PPTX";
    } else if (fileType.includes("txt")) {
      return "TXT";
    } else if (fileType.includes("html")) {
      return "HTML";
    } else {
      return "Unknown";
    }
  };

  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
  };

  const confirmDelete = () => {
    if (documentToDelete) {
      deleteMutation.mutate(documentToDelete.id);
    }
  };

  const renderDocumentsTable = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      );
    }

    if (filteredDocuments.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Trash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t("documents.noDocumentsFound", "No documents found")}
          </h3>
          <p className="text-gray-500">
            {documents?.length === 0
              ? t("documents.uploadFirst", "Upload your first document to get started.")
              : t("documents.noMatches", "No documents match your current filters.")}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("documents.name", "Name")}</TableHead>
              <TableHead>{t("documents.type", "Type")}</TableHead>
              <TableHead>{t("documents.size", "Size")}</TableHead>
              <TableHead>{t("documents.uploaded", "Uploaded")}</TableHead>
              <TableHead>{t("documents.status", "Status")}</TableHead>
              <TableHead className="text-right">{t("documents.actions", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.originalFilename}</TableCell>
                <TableCell>{getFileTypeLabel(doc.fileType)}</TableCell>
                <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                <TableCell>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      doc.indexed
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {doc.indexed ? t("documents.indexed", "Indexed") : t("documents.processing", "Processing")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteDocument(doc)}
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    {t("documents.delete", "Delete")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-primary">{t("documents.title", "Document Library")}</h2>
        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-secondary hover:bg-secondary-dark"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            {t("documents.upload", "Upload Document")}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4">
            <div className="relative flex-1">
              <Input
                className="pl-10 pr-4 py-2"
                placeholder={t("documents.searchPlaceholder", "Search documents...")}
                value={filters.searchTerm}
                onChange={handleSearchChange}
              />
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            <div className="flex-shrink-0">
              <Select value={filters.fileType} onValueChange={handleFileTypeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("documents.allTypes", "All Types")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("documents.allTypes", "All Types")}</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                  <SelectItem value="pptx">PPTX</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-shrink-0">
              <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("documents.allDates", "All Dates")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("documents.allDates", "All Dates")}</SelectItem>
                  <SelectItem value="today">{t("documents.today", "Today")}</SelectItem>
                  <SelectItem value="week">{t("documents.thisWeek", "This Week")}</SelectItem>
                  <SelectItem value="month">{t("documents.thisMonth", "This Month")}</SelectItem>
                  <SelectItem value="year">{t("documents.thisYear", "This Year")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Documents View */}
      {viewMode === 'grid' ? (
        <DocumentGrid
          documents={filteredDocuments}
          isLoading={isLoading}
          filters={filters}
        />
      ) : (
        renderDocumentsTable()
      )}

      {/* Upload Modal */}
      <UploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadProgress={handleUploadProgress}
      />

      {/* Progress Bar */}
      {showProgressBar && uploadedDocumentId && uploadedFilename && (
        <UploadProgress
          documentId={uploadedDocumentId}
          filename={uploadedFilename}
          onDismiss={() => {
            console.log("Progress bar dismissed from DocumentsPage");
            setShowProgressBar(false);
            setUploadedDocumentId(null);
            setUploadedFilename("");
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("documents.confirmDelete", "Are you sure?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete && t("documents.confirmDeleteMessage", 'This will permanently delete the document "{{filename}}". This action cannot be undone.', {
                filename: documentToDelete.originalFilename
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("documents.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
