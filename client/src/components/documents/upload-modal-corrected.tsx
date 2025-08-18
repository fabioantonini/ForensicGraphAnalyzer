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
import { Link, Import, Upload, AlertCircle } from "lucide-react";

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
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isDuplicate: boolean;
    type?: 'exact' | 'similar';
    message?: string;
    existingDocument?: any;
  } | null>(null);
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
      // Non notifichiamo qui perché abbiamo già creato una barra di avanzamento temporanea
      // L'aggiornamento avverrà tramite il polling dall'API di progresso
      
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
      
      // Notifichiamo il componente genitore dell'errore di caricamento
      // Questo garantisce che la barra di avanzamento appaia anche in caso di errore
      if (onUploadProgress && file) {
        // Usiamo un ID temporaneo negativo per segnalare un errore
        const errorDocId = -1 * Date.now();
        onUploadProgress(errorDocId, file.name);
      }
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
      // Non notifichiamo qui perché abbiamo già creato una barra di avanzamento temporanea
      // L'aggiornamento avverrà tramite il polling dall'API di progresso
      
      toast({
        title: t("documents.urlImportSuccess", "URL imported"),
        description: t("documents.urlImportSuccessDesc", "The web page was successfully imported"),
        variant: "default",
      });
      
      // Queste righe sono ora gestite direttamente in handleUpload
      // setUrl("");
      // onOpenChange(false);
      
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("documents.urlImportFailed", "Import failed"),
        description: error.message,
        variant: "destructive",
      });
      
      // Notifichiamo il componente genitore dell'errore di caricamento da URL
      // per mostrare la barra di avanzamento anche in caso di errore
      if (onUploadProgress && url) {
        // Usiamo un ID temporaneo negativo per segnalare un errore
        const errorDocId = -1 * Date.now();
        onUploadProgress(errorDocId, url);
      }
    },
  });

  const checkDuplicateFile = async (selectedFile: File) => {
    try {
      const response = await fetch("/api/documents/check-duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          fileSize: selectedFile.size
        }),
        credentials: "include",
      });
      
      if (response.ok) {
        const result = await response.json();
        setDuplicateCheck(result);
        
        if (result.isDuplicate) {
          toast({
            title: result.type === 'exact' ? "Documento già presente" : "Documento simile trovato",
            description: result.message,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Errore controllo duplicati:", error);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setDuplicateCheck(null);
    
    // Check for duplicates immediately after file selection
    checkDuplicateFile(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleUpload = () => {
    if (activeTab === "file" && file) {
      // Crea un ID temporaneo per iniziare a mostrare la barra di avanzamento immediatamente
      if (onUploadProgress) {
        const tempId = Date.now();
        onUploadProgress(tempId, file.name);
      }
      uploadFileMutation.mutate(file);
    } else if (activeTab === "url" && url) {
      // Crea un ID temporaneo per iniziare a mostrare la barra di avanzamento immediatamente
      if (onUploadProgress) {
        const tempId = Date.now();
        onUploadProgress(tempId, url);
      }
      uploadUrlMutation.mutate(url);
    }
    
    // Chiudi il modale subito dopo l'avvio del caricamento
    setFile(null);
    setUrl("");
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!uploadFileMutation.isPending && !uploadUrlMutation.isPending) {
      setFile(null);
      setUrl("");
      onOpenChange(false);
    }
  };

  const isUploading = uploadFileMutation.isPending || uploadUrlMutation.isPending;
  const canUpload = (activeTab === "file" && file && (!duplicateCheck || !duplicateCheck.isDuplicate)) || (activeTab === "url" && url);

  return (
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
              <div className="space-y-3">
                <SelectedFile file={file} onRemove={handleRemoveFile} />
                {duplicateCheck?.isDuplicate && (
                  <div className={`p-3 rounded-lg border ${
                    duplicateCheck.type === 'exact' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      <AlertCircle className={`h-4 w-4 mt-0.5 ${
                        duplicateCheck.type === 'exact' ? 'text-red-600' : 'text-orange-600'
                      }`} />
                      <div className={`text-sm ${
                        duplicateCheck.type === 'exact' ? 'text-red-800' : 'text-orange-800'
                      }`}>
                        <p className="font-medium">
                          {duplicateCheck.type === 'exact' ? 'Documento identico trovato' : 'Documento simile trovato'}
                        </p>
                        <p className="mt-1">{duplicateCheck.message}</p>
                        <p className="mt-2 text-xs">
                          Il caricamento è stato bloccato per evitare duplicati.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
  );
}