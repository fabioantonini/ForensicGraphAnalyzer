import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileInput, SelectedFile } from "@/components/ui/file-input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { Link, Import, Upload } from "lucide-react";
import { UploadProgress } from "./upload-progress";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadProgress?: (documentId: number, filename: string) => void;
}

export function UploadModal({ open, onOpenChange, onUploadProgress }: UploadModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("file");
  const [uploadedDocumentId, setUploadedDocumentId] = useState<number | null>(null);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(false);
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const { toast } = useToast();

  const uploadFileMutation = useMutation({
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
        throw new Error(errorData.message || "Failed to upload document");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Documento caricato con successo", data);
      
      // Salva l'ID del documento caricato
      setUploadedDocumentId(data.id);
      console.log("ID documento impostato:", data.id);
      
      // Ottieni il nome del file con controllo null
      if (file) {
        setUploadedFilename(file.name);
        console.log("Nome file impostato:", file.name);
      }
      
      // Mostra la barra di avanzamento
      setShowProgressBar(true);
      console.log("Show progress bar impostato a true");
      
      // Azzera il file selezionato e chiudi il modale
      setFile(null);
      onOpenChange(false);
      
      // Aggiorna le query
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: t("documents.uploadSuccess", "Document uploaded"),
        description: t("documents.processingDesc", "The document is being processed and will be available shortly"),
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("documents.uploadFailed", "Upload failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/documents/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to import document from URL");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Aggiungi il supporto per la barra di avanzamento anche per il caricamento da URL
      setUploadedDocumentId(data.id);
      setUploadedFilename(url);
      setShowProgressBar(true);
      
      setUrl("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: t("documents.urlImportSuccess", "URL imported"),
        description: t("documents.processingDesc", "The web page is being processed and will be available shortly"),
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("documents.urlImportFailed", "Import failed"),
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
    if (activeTab === "file" && file) {
      uploadFileMutation.mutate(file);
    } else if (activeTab === "url" && url) {
      uploadUrlMutation.mutate(url);
    }
  };

  const handleClose = () => {
    if (!uploadFileMutation.isPending && !uploadUrlMutation.isPending) {
      setFile(null);
      setUrl("");
      onOpenChange(false);
    }
  };

  const isUploading = uploadFileMutation.isPending || uploadUrlMutation.isPending;
  const canUpload = (activeTab === "file" && file) || (activeTab === "url" && url);

  // JSX per la barra di avanzamento del documento
  const renderProgressBar = () => {
    // Log di debug per verificare i valori delle variabili
    console.log("renderProgressBar", { 
      showProgressBar, 
      uploadedDocumentId, 
      uploadedFilename,
      shouldRender: showProgressBar && uploadedDocumentId && uploadedFilename
    });
    
    if (showProgressBar && uploadedDocumentId && uploadedFilename) {
      return (
        <UploadProgress
          documentId={uploadedDocumentId}
          filename={uploadedFilename}
          onDismiss={() => {
            console.log("Progress bar dismissed");
            setShowProgressBar(false);
            setUploadedDocumentId(null);
            setUploadedFilename("");
          }}
        />
      );
    }
    return null;
  };

  return (
    <>
      {renderProgressBar()}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("documents.uploadDocument", "Upload Document")}</DialogTitle>
            <DialogDescription>
              {t("documents.uploadDescription", "Upload a document to your forensic graphology knowledge base. Supported formats: PDF, DOCX, PPTX, TXT, HTML.")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="file" value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="file">
                <Upload className="h-4 w-4 mr-2" />
                {t("documents.uploadFile", "Upload File")}
              </TabsTrigger>
              <TabsTrigger value="url">
                <Link className="h-4 w-4 mr-2" />
                {t("documents.importUrl", "Import from URL")}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="file">
              {!file ? (
                <FileInput
                  onFileSelect={handleFileSelect}
                  buttonText={t("documents.dragAndDrop", "Drag & drop files or browse")}
                  helperText={t("documents.maxFileSize", "Maximum file size: 25MB")}
                />
              ) : (
                <SelectedFile file={file} onRemove={handleRemoveFile} />
              )}
            </TabsContent>
            
            <TabsContent value="url">
              <div className="space-y-2">
                <Label htmlFor="url">{t("documents.enterUrl", "Enter a web page URL")}</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  {t("documents.urlHelp", "The web page will be fetched and processed as HTML content.")}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!canUpload || isUploading}
            >
              {isUploading ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Import className="h-4 w-4 mr-2" />
              )}
              {activeTab === "file" 
                ? t("documents.upload", "Upload") 
                : t("documents.import", "Import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}