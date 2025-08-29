import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { SignatureImage } from "@/components/signature-image";
import { SignatureCard } from "@/components/signature-card";
import { SignatureMethodologyDialog } from "@/components/signature-methodology-dialog";
import { HelpTooltip } from "@/components/help-tooltip";
import { SignatureDragDropZone } from "@/components/signature-drag-drop-zone";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { SignatureProject, Signature } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Trash2, Upload, FileCheck, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

// Project schema
const projectSchema = z.object({
  name: z.string().min(3, "Il nome deve avere almeno 3 caratteri"),
  description: z.string().optional()
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// File upload schema with real dimensions
const fileSchema = z.object({
  file: z.any()
    .refine(file => {
      // Supporta sia FileList che il nostro FileList-like object
      return (file instanceof FileList) || (Array.isArray(file) && file.length === 1);
    }, "Input non valido")
    .refine(files => {
      if (files instanceof FileList) {
        return files.length === 1;
      }
      return Array.isArray(files) && files.length === 1;
    }, "Seleziona un file"),
  realWidthMm: z.number()
    .min(5, "La larghezza deve essere almeno 5mm")
    .max(200, "La larghezza non può superare 200mm"),
  realHeightMm: z.number()
    .min(3, "L'altezza deve essere almeno 3mm")
    .max(100, "L'altezza non può superare 100mm")
});

type FileFormValues = z.infer<typeof fileSchema>;

export default function SignaturesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [isUploadReferenceOpen, setIsUploadReferenceOpen] = useState(false);
  const [isUploadVerifyOpen, setIsUploadVerifyOpen] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<Signature[] | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [selectedReferenceFile, setSelectedReferenceFile] = useState<File | null>(null);
  const [selectedVerifyFile, setSelectedVerifyFile] = useState<File | null>(null);
  // Rimosso state per modifica DPI globale
  
  // Form for creating new project
  const projectForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Form for reference signature upload
  const referenceForm = useForm<FileFormValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: {
      realWidthMm: 50,
      realHeightMm: 20,
    },
  });
  
  // Form for verification signature upload
  const verifyForm = useForm<FileFormValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: {
      realWidthMm: 50,
      realHeightMm: 20,
    },
  });
  
  // Query to get all projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects,
  } = useQuery<SignatureProject[]>({
    queryKey: ["/api/signature-projects"],
  });
  
  // Rimosso form per modificare DPI globale del progetto
  // poiché ogni firma ha ora il proprio valore DPI
  
  // Query to get signatures for selected project
  const { 
    data: signatures = [],
    isLoading: signaturesLoading,
    refetch: refetchSignatures
  } = useQuery<Signature[]>({
    queryKey: [`/api/signature-projects/${selectedProject}/signatures`],
    enabled: !!user && !!selectedProject,
    staleTime: 0, // Cache disabilitata per aggiornamenti immediati
    refetchOnWindowFocus: true, // Refetch quando finestra diventa attiva
    refetchInterval: 2000, // Polling fisso ogni 2 secondi - più affidabile
    refetchOnMount: true,
    
    // Setup di un gestore di errore personalizzato
    select: (data) => {
      // Se i dati non sono un array valido, restituisci un array vuoto
      if (!Array.isArray(data)) {
        console.error("Dati non validi ricevuti (non è un array):", data);
        return [];
      }
      

      
      // Controllo se riceviamo progetti invece di firme (errore comune)
      const containsProjects = data.length > 0 && 
        data.some(item => 'name' in item && !('projectId' in item));
      
      if (containsProjects) {
        console.error("⚠️ ERRORE: L'API ha restituito progetti invece di firme!");
        return []; // Restituisci un array vuoto quando i dati sono di tipo errato
      }
      
      // Verifica se qualcuna delle firme ha parametri (elaborazione completata)
      const hasProcessedSignatures = data.some(
        sig => sig.parameters && Object.keys(sig.parameters).length > 0
      );
      
      if (!hasProcessedSignatures && data.length > 0) {
      }
      
      return data; // Restituisci tutti i dati, dovrebbero già essere filtrati dal server
    }
  });
  
  // Mutation to create new project
  const createProject = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest("POST", "/api/signature-projects", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects"] });
      projectForm.reset();
      setIsCreateProjectOpen(false);
      
      // Breve ritardo prima di selezionare il progetto per garantire che
      // eventuali operazioni di pulizia sul server siano completate
      setTimeout(() => {
        setSelectedProject(data.id);
      }, 500);
      
      toast({
        title: "Successo",
        description: "Progetto creato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante la creazione del progetto: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to upload reference signature
  const uploadReference = useMutation({
    mutationFn: async (data: FileFormValues) => {
      const formData = new FormData();
      // Gestisce sia FileList che array
      const file = data.file instanceof FileList ? data.file[0] : data.file[0];
      formData.append("signature", file);
      formData.append("realWidthMm", data.realWidthMm.toString());
      formData.append("realHeightMm", data.realHeightMm.toString());
      
      const res = await fetch(`/api/signature-projects/${selectedProject}/signatures/reference`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Errore durante il caricamento della firma");
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalida la query per aggiornare i dati delle firme
      queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
      
      // Per compatibilità con il resto del codice manteniamo anche la vecchia
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      
      referenceForm.reset();
      setSelectedReferenceFile(null);
      setIsUploadReferenceOpen(false);
      toast({
        title: "Successo",
        description: "Firma di riferimento caricata con successo",
      });
      
      // Forziamo un refetch immediato delle firme
      setTimeout(() => {
        refetchSignatures();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante il caricamento della firma: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to upload verification signature
  const uploadVerify = useMutation({
    mutationFn: async (data: FileFormValues) => {
      const formData = new FormData();
      // Gestisce sia FileList che array
      const file = data.file instanceof FileList ? data.file[0] : data.file[0];
      formData.append("signature", file);
      formData.append("realWidthMm", data.realWidthMm.toString());
      formData.append("realHeightMm", data.realHeightMm.toString());
      
      const res = await fetch(`/api/signature-projects/${selectedProject}/signatures/verify`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Errore durante il caricamento della firma");
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalida la query per aggiornare i dati delle firme
      queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
      
      // Per compatibilità con il resto del codice manteniamo anche la vecchia
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      
      verifyForm.reset();
      setSelectedVerifyFile(null);
      setIsUploadVerifyOpen(false);
      toast({
        title: "Successo",
        description: "Firma caricata per la verifica",
      });
      
      // Forza refetch immediato e ripetuto per garantire aggiornamenti
      refetchSignatures();
      setTimeout(() => refetchSignatures(), 1000);
      setTimeout(() => refetchSignatures(), 3000);
      setTimeout(() => refetchSignatures(), 5000);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante il caricamento della firma: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to delete a project
  const deleteProject = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await apiRequest("DELETE", `/api/signature-projects/${projectId}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects"] });
      if (selectedProject) {
        setSelectedProject(null);
      }
      toast({
        title: "Successo",
        description: "Progetto eliminato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante l'eliminazione del progetto: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to delete a signature
  const deleteSignature = useMutation({
    mutationFn: async (signatureId: number) => {
      const res = await apiRequest("DELETE", `/api/signatures/${signatureId}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
      toast({
        title: "Successo",
        description: "Firma eliminata con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante l'eliminazione della firma: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Function to handle project creation
  const onCreateProject = (data: ProjectFormValues) => {
    createProject.mutate(data);
  };
  
  // Function to handle reference upload
  const onUploadReference = (data: FileFormValues) => {
    if (data.file && data.file.length > 0) {
      uploadReference.mutate(data);
    }
  };
  
  // Function to handle verification upload
  const onUploadVerify = (data: FileFormValues) => {
    if (data.file && data.file.length > 0) {
      uploadVerify.mutate(data);
    }
  };
  
  // Handle project deletion
  const handleDeleteProject = (projectId: number) => {
    if (confirm("Sei sicuro di voler eliminare questo progetto? Tutte le firme associate saranno eliminate.")) {
      deleteProject.mutate(projectId);
    }
  };
  
  // Handle signature deletion or refresh
  const handleDeleteSignature = (signatureId: number) => {
    // Se l'ID è -1, è una richiesta di aggiornamento, non una cancellazione
    if (signatureId === -1) {

      refetchSignatures();
      return;
    }
    
    // Altrimenti procedi con l'eliminazione normale
    if (confirm("Sei sicuro di voler eliminare questa firma?")) {
      deleteSignature.mutate(signatureId);
    }
  };
  
  // Rimosso getStatusColor perché ora è gestito dal componente SignatureCard
  
  // Mutation to generate reports for all verification signatures at once
  const generateAllReports = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Nessun progetto selezionato");
      

      
      // Utilizziamo il nuovo endpoint che genera report per tutte le firme in una singola richiesta
      const res = await fetch(`/api/signature-projects/${selectedProject}/generate-all-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Errore durante la generazione dei report");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Aggiorniamo la query per garantire che i dati siano aggiornati
      queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      
      toast({
        title: "Successo",
        description: `Generati ${data.successful} report di ${data.total} firme`,
      });
      
      // Se abbiamo generato almeno un report, scarichiamo automaticamente il PDF
      if (data.successful > 0 && data.results.some((r: any) => r.success)) {
        const firstSuccessfulReport = data.results.find((r: any) => r.success);
        if (firstSuccessfulReport) {
          setTimeout(() => {
            window.location.href = `/api/signatures/${firstSuccessfulReport.id}/report`;
          }, 1500);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante la generazione dei report: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to compare all signatures using the new endpoint
  const compareAllSignatures = useMutation({
    // DISABILITA CACHE per garantire richiesta reale al server
    gcTime: 0,
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Nessun progetto selezionato");
      
      try {
        // FORZA INVALIDAZIONE CACHE prima della richiesta
        queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
        queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
        
        // BYPASS REACT QUERY CACHE - Usa fetch diretto con cache disabled
        const response = await fetch(`/api/signature-projects/${selectedProject}/compare-all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ 
            timestamp: Date.now(), 
            force: true,
            bypass_cache: true
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error(`[FRONTEND] ERRORE fetch diretto:`, error);
        throw error;
      }
    },
    onSuccess: (data: Signature[]) => {
      // Salva i risultati e mostra il dialog
      setComparisonResults(data);
      setShowResultsDialog(true);
      
      // Forza l'aggiornamento completo dei dati
      queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      
      // Forza un refetch immediato per garantire i dati aggiornati
      setTimeout(() => {
        refetchSignatures();
      }, 100);
      
      toast({
        title: "Successo",
        description: "Confronto delle firme completato",
      });
    },
    onError: (error: Error) => {
      console.error(`[FRONTEND] Errore confronto:`, error);
      toast({
        title: "Errore",
        description: `Errore durante il confronto delle firme: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Rimosso renderSimilarityScore perché ora è gestito dal componente SignatureCard
  
  // Rimosso mutation per aggiornare il DPI globale del progetto
  // perché ogni firma ha ora il proprio valore DPI

  // Rimosso useEffect per aggiornare il form DPI globale
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6" data-tour="signatures-header">
        <h1 className="text-3xl font-bold">{t('signatures.title')}</h1>
        <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
          <DialogTrigger asChild>
            <Button data-tour="create-project">{t('signatures.createProject')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('signatures.createProject')}</DialogTitle>
              <DialogDescription>
                {t('signatures.createProjectDescription')}
              </DialogDescription>
            </DialogHeader>
            <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit(onCreateProject)} className="space-y-4">
                <FormField
                  control={projectForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('signatures.projectName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('signatures.projectNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('signatures.projectDescription')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('signatures.projectDescriptionPlaceholder')} 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createProject.isPending}
                  >
                    {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Projects list */}
      {isLoadingProjects ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="rounded-full p-3 bg-primary-100 mb-4">
              <FileCheck className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">{t('signatures.noProjects')}</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              {t('signatures.noProjectsDescription')}
            </p>
            <Button onClick={() => setIsCreateProjectOpen(true)}>
              {t('signatures.createFirstProject')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              className={`cursor-pointer hover:border-primary transition-colors ${
                selectedProject === project.id ? 'border-2 border-primary' : ''
              }`}
              onClick={() => setSelectedProject(project.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {project.description && (
                  <CardDescription>
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardFooter className="pt-2">
                <p className="text-xs text-muted-foreground">
                  {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Selected project */}
      {selectedProject && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold">
                {projects.find(p => p.id === selectedProject)?.name}
              </h2>
              {/* Rimosso visualizzazione e controllo DPI globale */}
            </div>
            <div className="flex space-x-2">
              <Dialog open={isUploadReferenceOpen} onOpenChange={(open) => {
                setIsUploadReferenceOpen(open);
                if (!open) {
                  setSelectedReferenceFile(null);
                  referenceForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-tour="reference-signatures">
                    <Upload className="h-4 w-4 mr-2" />
                    {t('signatures.uploadReference')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('signatures.uploadReference')}</DialogTitle>
                    <DialogDescription>
                      {t('signatures.uploadReferenceDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...referenceForm}>
                    <form onSubmit={referenceForm.handleSubmit(onUploadReference)} className="space-y-4">
                      <FormField
                        control={referenceForm.control}
                        name="file"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('signatures.selectFile', 'Firma di riferimento')}</FormLabel>
                            <FormControl>
                              <SignatureDragDropZone
                                onFileSelect={(file) => {
                                  // Crea un oggetto FileList-like compatibile
                                  const fileListLike = Object.assign([file], {
                                    item: (index: number) => index === 0 ? file : null,
                                    length: 1
                                  });
                                  field.onChange(fileListLike);
                                  setSelectedReferenceFile(file);
                                }}
                                isUploading={uploadReference.isPending}
                                selectedFile={selectedReferenceFile}
                                title={t('signatures.upload.dragDropReference', 'Trascina qui la firma di riferimento')}
                                subtitle={t('signatures.upload.referenceHelp', 'Carica una firma autentica da usare come riferimento per il confronto')}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium mb-3">Dimensioni reali della firma</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Specifica le dimensioni effettive della firma sulla carta per un'analisi accurata.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={referenceForm.control}
                            name="realWidthMm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Larghezza (mm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="5"
                                    max="200"
                                    step="0.5"
                                    placeholder="50"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={referenceForm.control}
                            name="realHeightMm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Altezza (mm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="3"
                                    max="100"
                                    step="0.5"
                                    placeholder="20"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={uploadReference.isPending}
                        >
                          {uploadReference.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t('common.upload')}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isUploadVerifyOpen} onOpenChange={(open) => {
                setIsUploadVerifyOpen(open);
                if (!open) {
                  setSelectedVerifyFile(null);
                  verifyForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-tour="verify-signatures">
                    <Upload className="h-4 w-4 mr-2" />
                    {t('signatures.uploadVerify')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('signatures.uploadVerify')}</DialogTitle>
                    <DialogDescription>
                      {t('signatures.uploadVerifyDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...verifyForm}>
                    <form onSubmit={verifyForm.handleSubmit(onUploadVerify)} className="space-y-4">
                      <FormField
                        control={verifyForm.control}
                        name="file"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('signatures.selectFile', 'Firma da verificare')}</FormLabel>
                            <FormControl>
                              <SignatureDragDropZone
                                onFileSelect={(file) => {
                                  // Crea un oggetto FileList-like compatibile
                                  const fileListLike = Object.assign([file], {
                                    item: (index: number) => index === 0 ? file : null,
                                    length: 1
                                  });
                                  field.onChange(fileListLike);
                                  setSelectedVerifyFile(file);
                                }}
                                isUploading={uploadVerify.isPending}
                                selectedFile={selectedVerifyFile}
                                title={t('signatures.upload.dragDropVerify', 'Trascina qui la firma da verificare')}
                                subtitle={t('signatures.upload.verifyHelp', 'Carica la firma di cui vuoi verificare l\'autenticità')}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium mb-3">Dimensioni reali della firma</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Specifica le dimensioni effettive della firma sulla carta per un'analisi accurata.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={verifyForm.control}
                            name="realWidthMm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Larghezza (mm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="5"
                                    max="200"
                                    step="0.5"
                                    placeholder="50"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={verifyForm.control}
                            name="realHeightMm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Altezza (mm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="3"
                                    max="100"
                                    step="0.5"
                                    placeholder="20"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={uploadVerify.isPending}
                        >
                          {uploadVerify.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t('common.upload')}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => refetchSignatures()}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('signatures.comparisonDialog.refreshStatus')}
                </Button>
                <Button 
                  variant="default"
                  onClick={() => compareAllSignatures.mutate()}
                  disabled={compareAllSignatures.isPending}
                  data-tour="compare-signatures"
                >
                  {compareAllSignatures.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('signatures.compareAll')}
                </Button>
                <HelpTooltip 
                  content=""
                  translationKey="signatures.help.compareAllDesc" 
                  defaultContent="Confronta tutte le firme da verificare con tutte le firme di riferimento. Il confronto analizza molteplici parametri grafologici per determinare la probabilità di autenticità."
                  iconSize={16}
                  className="ml-2"
                />
              </div>
              
              <div className="flex items-center">
                <Button 
                  variant="secondary"
                  onClick={() => generateAllReports.mutate()}
                  disabled={generateAllReports.isPending}
                >
                  {generateAllReports.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('signatures.generateReports')}
                </Button>
                <HelpTooltip 
                  content=""
                  translationKey="signatures.help.generateAllReportsDesc" 
                  defaultContent="Genera report PDF dettagliati per tutte le firme da verificare. I report includono immagini comparative, parametri di analisi e conclusioni sull'autenticità."
                  iconSize={16}
                  className="ml-2"
                />
              </div>
            </div>
          </div>
          

          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">{t('signatures.referenceSignatures')}</h3>
                <HelpTooltip 
                  content=""
                  translationKey="signatures.help.referenceSignaturesDesc" 
                  defaultContent="Le firme di riferimento sono esempi autentici della firma del soggetto. Carica almeno una firma di riferimento per avviare il processo di verifica."
                  iconSize={18}
                />
              </div>
              <SignatureMethodologyDialog />
            </div>
            {signaturesLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div>
                {/* Messaggio se ci sono firme di riferimento in elaborazione */}
                {Array.isArray(signatures) && signatures.some((s: any) => s.isReference && s.processingStatus !== 'completed') && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
                    Ci sono {signatures.filter((s: any) => s.isReference && s.processingStatus !== 'completed').length} firme di riferimento in elaborazione. 
                    Attendere il completamento per visualizzarle completamente.
                  </div>
                )}
                
                {Array.isArray(signatures) && signatures.filter((s: any) => s.isReference).length === 0 ? (
                  <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <div className="rounded-full p-3 bg-primary-100 mb-4">
                        <AlertCircle className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">{t('signatures.noReferenceSignatures')}</h3>
                      <p className="text-center text-sm text-muted-foreground mb-4">
                        {t('signatures.noReferenceSignaturesDescription')}
                      </p>
                      <div className="flex items-center">
                        <Button onClick={() => setIsUploadReferenceOpen(true)}>
                          {t('signatures.uploadFirstReference')}
                        </Button>
                        <HelpTooltip 
                          content=""
                          translationKey="signatures.help.uploadReferenceDesc" 
                          defaultContent="Carica firme autentiche di riferimento. Queste firme saranno usate come base per il confronto con le firme da verificare."
                          iconSize={16}
                          className="ml-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.isArray(signatures) && 
                     signatures
                      .filter((s: any) => s.isReference)
                      .sort((a: any, b: any) => (a.analysisReport ? -1 : 1))
                      .map((signature: any) => (
                        <SignatureCard 
                          key={signature.id}
                          signature={signature}
                          onDelete={handleDeleteSignature}
                        />
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Separator className="my-6" />
          
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-semibold">{t('signatures.verificationsSignatures')}</h3>
              <HelpTooltip 
                content=""
                translationKey="signatures.help.verificationSignaturesDesc" 
                defaultContent="Queste sono le firme di cui desideri verificare l'autenticità. Verranno confrontate con le firme di riferimento per determinare la probabilità di autenticità."
                iconSize={18}
              />
            </div>
            {signaturesLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div>
                {/* Messaggio se ci sono firme da verificare in elaborazione */}
                {Array.isArray(signatures) && 
                  signatures.length > 0 && 
                  signatures.some((s: any) => !s.isReference && !s.parameters) && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
                      Ci sono {signatures.filter((s: any) => !s.isReference && !s.parameters).length} firme da verificare in elaborazione. 
                      Attendere il completamento per visualizzare il risultato della verifica.
                    </div>
                  )
                }
                
                {Array.isArray(signatures) && signatures.filter((s: any) => !s.isReference).length === 0 ? (
                  <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <div className="rounded-full p-3 bg-primary-100 mb-4">
                        <AlertCircle className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">{t('signatures.noVerifySignatures')}</h3>
                      <p className="text-center text-sm text-muted-foreground mb-4">
                        {t('signatures.noVerifySignaturesDescription')}
                      </p>
                      <div className="flex items-center">
                        <Button onClick={() => setIsUploadVerifyOpen(true)}>
                          {t('signatures.uploadFirstVerify')}
                        </Button>
                        <HelpTooltip 
                          content=""
                          translationKey="signatures.help.uploadVerifyDesc" 
                          defaultContent="Carica firme da verificare. Queste firme saranno confrontate con le firme di riferimento per determinarne l'autenticità."
                          iconSize={16}
                          className="ml-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.isArray(signatures) && 
                     signatures
                      .filter((s: any) => !s.isReference)
                      .sort((a: any, b: any) => (a.analysisReport ? -1 : 1))
                      .map((signature: any) => (
                        <SignatureCard 
                          key={signature.id} 
                          signature={signature}
                          onDelete={handleDeleteSignature}
                          showSimilarity={true}
                        />
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Rimosso dialogo di modifica DPI globale */}
      
      {/* Dialog per mostrare i risultati del confronto */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen flex flex-col p-0 m-0">
          <DialogHeader className="px-6 pt-4 pb-2 border-b bg-background">
            <div>
              <DialogTitle>{t('signatures.comparisonDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('signatures.comparisonDialog.subtitle')}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-3">
              {/* Statistiche generali */}
              {comparisonResults && comparisonResults.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3 mb-3">
                  <h3 className="font-medium mb-2">{t('signatures.comparisonDialog.analysisSummary')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-primary">
                        {comparisonResults.filter(s => !s.isReference).length}
                      </div>
                      <div className="text-muted-foreground">{t('signatures.comparisonDialog.signaturesAnalyzed')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        {comparisonResults.filter(s => !s.isReference && s.verdict === 'Autentica').length}
                      </div>
                      <div className="text-muted-foreground">{t('signatures.comparisonDialog.authentic')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        {comparisonResults.filter(s => !s.isReference && s.verdict === 'Autentica dissimulata').length}
                      </div>
                      <div className="text-muted-foreground">{t('signatures.comparisonDialog.authenticDissimulated')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-400">
                        {comparisonResults.filter(s => !s.isReference && s.verdict === 'Probabilmente autentica').length}
                      </div>
                      <div className="text-muted-foreground">{t('signatures.comparisonDialog.probablyAuthentic')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-orange-600">
                        {comparisonResults.filter(s => !s.isReference && s.verdict === 'Sospetta').length}
                      </div>
                      <div className="text-muted-foreground">{t('signatures.comparisonDialog.suspicious')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {comparisonResults.filter(s => !s.isReference && s.verdict === 'Probabilmente falsa').length}
                      </div>
                      <div className="text-muted-foreground">{t('signatures.comparisonDialog.probablyFalse')}</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                {comparisonResults && comparisonResults.length > 0 ? (
                  // Mostra solo le firme da verificare (non di riferimento)
                  comparisonResults.filter(sig => !sig.isReference).map((signature, index) => (
                    <div key={signature.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{signature.originalFilename}</h4>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-4">
                              <p className="text-sm text-muted-foreground">
                                <strong>{t('signatures.comparisonDialog.similarity')}</strong> {signature.comparisonResult ? (signature.comparisonResult * 100).toFixed(1) : '0'}%
                              </p>
                              
                              {/* === NUOVI PARAMETRI DI NATURALEZZA === */}
                              {signature.naturalnessScore !== null && signature.naturalnessScore !== undefined && (
                                <p className="text-sm text-muted-foreground">
                                  <strong>🧠 Naturalezza:</strong> {(signature.naturalnessScore * 100).toFixed(1)}%
                                </p>
                              )}
                              
                              {signature.verdict && (
                                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                  signature.verdict === 'Autentica' ? 'bg-green-100 text-green-800' :
                                  signature.verdict === 'Autentica dissimulata' ? 'bg-blue-100 text-blue-800' :
                                  signature.verdict === 'Probabilmente autentica' ? 'bg-green-100 text-green-700' :
                                  signature.verdict === 'Incerta' ? 'bg-yellow-100 text-yellow-800' :
                                  signature.verdict === 'Sospetta' ? 'bg-orange-100 text-orange-800' :
                                  signature.verdict === 'Probabilmente falsa' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  🎯 {signature.verdict}
                                </span>
                              )}
                              
                              {signature.parameters?.realDimensions && (
                                <p className="text-sm text-muted-foreground">
                                  <strong>Dimensioni:</strong> {signature.parameters.realDimensions.widthMm?.toFixed(1)}×{signature.parameters.realDimensions.heightMm?.toFixed(1)}mm
                                </p>
                              )}
                            </div>
                            
                            {/* Spiegazione del verdetto se disponibile */}
                            {signature.verdictExplanation && (
                              <div className="mt-1">
                                <p className="text-xs text-gray-600 italic">
                                  💡 {signature.verdictExplanation}
                                </p>
                              </div>
                            )}
                        
                        {/* Tabella di confronto parametri dettagliata */}
                        {signature.analysisReport && (() => {
                          try {
                            const reportData = JSON.parse(signature.analysisReport);
                            
                            // Usa le firme di riferimento dall'array signatures originale invece che da comparisonResults
                            const referenceSignatures = signatures.filter((s: any) => s.isReference && s.parameters) || [];
                            
                            const referenceData = referenceSignatures.length > 0 && referenceSignatures[0].parameters 
                              ? referenceSignatures[0].parameters : null;
                            
                            // DEBUG: Mostra cosa contengono i dati
                            console.log('[TABLE DEBUG] reportData keys:', Object.keys(reportData || {}));
                            console.log('[TABLE DEBUG] referenceData keys:', Object.keys(referenceData || {}));
                            console.log('[TABLE DEBUG] referenceSignatures found:', referenceSignatures.length);
                            
                            if (!reportData || !referenceData) {
                              console.log('[TABLE DEBUG] Missing data - reportData:', !!reportData, 'referenceData:', !!referenceData);
                              return null;
                            }
                            
                            // === PARAMETRI CLASSICI DI GRAFOLOGIA ===
                            const classicParams = [
                              { 
                                key: 'Proportion', 
                                label: t('signatures.comparisonTable.proportion'), 
                                format: (v: number) => v?.toFixed(2) 
                              },
                              { 
                                key: 'Inclination', 
                                label: t('signatures.comparisonTable.inclination'), 
                                format: (v: number) => v?.toFixed(1) 
                              },
                              { 
                                key: 'PressureMean', 
                                label: t('signatures.comparisonTable.intensityMean'), 
                                format: (v: number) => v?.toFixed(0) 
                              },
                              { 
                                key: 'PressureStd', 
                                label: t('signatures.comparisonTable.intensityDev'), 
                                format: (v: number) => v?.toFixed(1) 
                              },
                              { 
                                key: 'AvgCurvature', 
                                label: t('signatures.comparisonTable.curvature'), 
                                format: (v: number) => v?.toFixed(2) 
                              },
                              { 
                                key: 'Velocity', 
                                label: t('signatures.comparisonTable.velocity'), 
                                format: (v: number) => v?.toFixed(1) 
                              },
                              { 
                                key: 'AvgSpacing', 
                                label: t('signatures.comparisonTable.spacing'), 
                                format: (v: number) => v?.toFixed(1) 
                              },
                              { 
                                key: 'AvgAsolaSize', 
                                label: t('signatures.comparisonTable.loopSize'), 
                                format: (v: number) => v?.toFixed(2) 
                              },
                              { 
                                key: 'OverlapRatio', 
                                label: t('signatures.comparisonTable.overlapRatio'), 
                                format: (v: number) => v?.toFixed(2) 
                              },
                              { 
                                key: 'LetterConnections', 
                                label: t('signatures.comparisonTable.letterConnections'), 
                                format: (v: number) => v?.toFixed(0) 
                              },
                              { 
                                key: 'BaselineStdMm', 
                                label: t('signatures.comparisonTable.baselineDev'), 
                                format: (v: number) => v?.toFixed(1) 
                              },
                              { 
                                key: 'StrokeComplexity', 
                                label: t('signatures.comparisonTable.strokeComplexity'), 
                                format: (v: number) => v?.toFixed(3) 
                              },
                              { 
                                key: 'ConnectedComponents', 
                                label: t('signatures.comparisonTable.connectedComponents'), 
                                format: (v: number) => v?.toFixed(0) 
                              },
                              { 
                                key: 'WritingStyle', 
                                label: t('signatures.comparisonTable.writingStyle'), 
                                format: (v: string) => v || 'N/A'
                              },
                              { 
                                key: 'Readability', 
                                label: t('signatures.comparisonTable.readability'), 
                                format: (v: string) => v || 'N/A'
                              }
                            ];

                            // === PARAMETRI DI NATURALEZZA (ANTI-DISSIMULAZIONE) ===
                            const naturalnessParams = [
                              { 
                                key: 'FluidityScore', 
                                label: '🧠 Fluidità', 
                                format: (v: number) => `${v?.toFixed(1)}%` 
                              },
                              { 
                                key: 'PressureConsistency', 
                                label: '🔄 Consistenza Pressione', 
                                format: (v: number) => `${v?.toFixed(1)}%` 
                              },
                              { 
                                key: 'CoordinationIndex', 
                                label: '🎯 Coordinazione', 
                                format: (v: number) => `${v?.toFixed(1)}%` 
                              },
                              { 
                                key: 'NaturalnessIndex', 
                                label: '✨ Naturalezza Totale', 
                                format: (v: number) => `${v?.toFixed(1)}%` 
                              }
                            ];
                            
                            return (
                              <div className="mt-3 space-y-4">
                                {/* === TABELLA 1: PARAMETRI CLASSICI DI GRAFOLOGIA === */}
                                <div className="border rounded-lg p-3 bg-gray-50">
                                  <h6 className="font-medium mb-2 text-sm">📊 {t('signatures.comparisonTable.title')}</h6>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left py-1 px-2">{t('signatures.comparisonTable.parameter')}</th>
                                          <th className="text-center py-1 px-2">{t('signatures.comparisonTable.reference')}</th>
                                          <th className="text-center py-1 px-2">{t('signatures.comparisonTable.verification')}</th>
                                          <th className="text-center py-1 px-2">{t('signatures.comparisonTable.compatibility')}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {classicParams.map(param => {
                                          const refValue = referenceData[param.key];
                                          const verifyValue = reportData[param.key];
                                          if (refValue === undefined || verifyValue === undefined) return null;
                                          
                                          // Calcola compatibilità con logica migliorata per valori piccoli
                                          const diff = Math.abs(refValue - verifyValue);
                                          const maxValue = Math.max(Math.abs(refValue), Math.abs(verifyValue));
                                          
                                          let compatibility;
                                          // Per parametri con valori molto piccoli (es. asole), usa soglie assolute
                                          if (param.key === 'AvgAsolaSize' || param.key === 'BaselineStdMm') {
                                            if (diff <= 0.05) compatibility = 95; // Entrambi molto piccoli = alta compatibilità
                                            else if (diff <= 0.1) compatibility = 80;
                                            else if (diff <= 0.2) compatibility = 70;
                                            else if (diff <= 0.5) compatibility = 60;
                                            else if (diff <= 1.0) compatibility = 50;
                                            else if (diff <= 2.0) compatibility = 30;
                                            else compatibility = Math.max(10, 100 - (diff * 40)); // Formula più graduale
                                          }
                                          // Per altri parametri, usa logica relativa migliorata
                                          else {
                                            if (maxValue > 0) {
                                              const relativeDiff = diff / maxValue;
                                              // Soglia di tolleranza per evitare 0% su piccole differenze
                                              if (relativeDiff <= 0.05) compatibility = 98;
                                              else if (relativeDiff <= 0.1) compatibility = 90;
                                              else if (relativeDiff <= 0.15) compatibility = 80;
                                              else compatibility = Math.max(0, 100 - (relativeDiff * 100));
                                            } else {
                                              compatibility = 100; // Entrambi zero
                                            }
                                          }
                                          
                                          return (
                                            <tr key={param.key} className="border-b">
                                              <td className="py-1 px-2 font-medium">{param.label}</td>
                                              <td className="text-center py-1 px-2">{(param as any).format(refValue)}</td>
                                              <td className="text-center py-1 px-2">{(param as any).format(verifyValue)}</td>
                                              <td className="text-center py-1 px-2">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                                  compatibility >= 85 ? 'bg-green-100 text-green-800' :
                                                  compatibility >= 65 ? 'bg-yellow-100 text-yellow-800' :
                                                  'bg-red-100 text-red-800'
                                                }`}>
                                                  {compatibility.toFixed(1)}%
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                      })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* === TABELLA 2: ANALISI DI NATURALEZZA === */}
                                <div className="border rounded-lg p-3 bg-blue-50">
                                  <h6 className="font-medium mb-2 text-sm">🧠 Analisi di Naturalezza (Anti-Dissimulazione)</h6>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left py-1 px-2">Parametro</th>
                                          <th className="text-center py-1 px-2">Riferimento</th>
                                          <th className="text-center py-1 px-2">Verifica</th>
                                          <th className="text-center py-1 px-2">Compatibilità</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {naturalnessParams.map(param => {
                                          const refValue = referenceData[param.key];
                                          const verifyValue = reportData[param.key];
                                          if (refValue === undefined || verifyValue === undefined) return null;
                                          
                                          // === CORREZIONE: Usa stesso algoritmo della compatibilità principale ===
                                          const diff = Math.abs(refValue - verifyValue);
                                          const maxValue = Math.max(Math.abs(refValue), Math.abs(verifyValue));
                                          let compatibility;
                                          
                                          if (maxValue > 0) {
                                            const relativeDiff = diff / maxValue;
                                            if (relativeDiff <= 0.05) compatibility = 98;
                                            else if (relativeDiff <= 0.1) compatibility = 90;
                                            else if (relativeDiff <= 0.15) compatibility = 80;
                                            else if (relativeDiff <= 0.25) compatibility = 60;
                                            else if (relativeDiff <= 0.50) compatibility = 30;
                                            else compatibility = Math.max(10, 100 - (relativeDiff * 100));
                                          } else {
                                            compatibility = 100;
                                          }
                                          
                                          return (
                                            <tr key={param.key} className="border-b">
                                              <td className="py-1 px-2 font-medium">{param.label}</td>
                                              <td className="text-center py-1 px-2">{(param as any).format(refValue)}</td>
                                              <td className="text-center py-1 px-2">{(param as any).format(verifyValue)}</td>
                                              <td className="text-center py-1 px-2">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                                  compatibility >= 85 ? 'bg-green-100 text-green-800' :
                                                  compatibility >= 65 ? 'bg-yellow-100 text-yellow-800' :
                                                  'bg-red-100 text-red-800'
                                                }`}>
                                                  {compatibility.toFixed(1)}%
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-600">
                                    💡 <strong>Naturalezza Totale:</strong> {signature.naturalnessScore ? (signature.naturalnessScore * 100).toFixed(1) : 'N/A'}%
                                  </div>
                                </div>

                                {/* === GRAFICI DI CONFRONTO === */}
                                <div className="border rounded-lg p-3 bg-slate-50">
                                  <h6 className="font-medium mb-2 text-sm">📊 Grafici di Confronto</h6>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Grafico Classico */}
                                    {signature.comparisonChart && (
                                      <div className="text-center">
                                        <p className="text-xs font-medium text-gray-600 mb-1">📈 Parametri Grafologici Classici</p>
                                        <img 
                                          src={`data:image/png;base64,${signature.comparisonChart}`} 
                                          alt="Grafico confronto parametri classici"
                                          className="max-w-full h-auto rounded border"
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Grafico Naturalezza */}
                                    {signature.naturalnessChart && (
                                      <div className="text-center">
                                        <p className="text-xs font-medium text-gray-600 mb-1">🧠 Analisi Naturalezza (Anti-Dissimulazione)</p>
                                        <img 
                                          src={`data:image/png;base64,${signature.naturalnessChart}`} 
                                          alt="Grafico analisi naturalezza"
                                          className="max-w-full h-auto rounded border"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* === ANALISI COMBINATA SIMILARITÀ + NATURALEZZA === */}
                                {signature.naturalnessScore && signature.comparisonResult && (
                                  <div className="border rounded-lg p-3 bg-gradient-to-r from-purple-50 to-indigo-50">
                                    <h6 className="font-medium mb-2 text-sm">🎯 Analisi Combinata (Matrice 2D)</h6>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium">📈 Similarità:</span> {(signature.comparisonResult * 100).toFixed(1)}%
                                      </div>
                                      <div>
                                        <span className="font-medium">🧠 Naturalezza:</span> {(signature.naturalnessScore * 100).toFixed(1)}%
                                      </div>
                                    </div>
                                    <div className="mt-2 p-2 bg-white rounded text-center">
                                      <span className={`text-sm font-semibold px-3 py-1 rounded ${
                                        signature.verdict === 'Autentica' ? 'bg-green-100 text-green-800' :
                                        signature.verdict === 'Autentica dissimulata' ? 'bg-blue-100 text-blue-800' :
                                        signature.verdict === 'Probabilmente autentica' ? 'bg-green-100 text-green-700' :
                                        signature.verdict === 'Incerta' ? 'bg-yellow-100 text-yellow-800' :
                                        signature.verdict === 'Sospetta' ? 'bg-orange-100 text-orange-800' :
                                        signature.verdict === 'Probabilmente falsa' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        🎯 {signature.verdict}
                                      </span>
                                      {signature.confidenceLevel && (
                                        <div className="mt-1 text-xs text-gray-600">
                                          Confidenza: {signature.confidenceLevel.toFixed(0)}%
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* === SOGLIE DI CLASSIFICAZIONE (SEMPRE VISIBILI) === */}
                                    <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded border-l-4 border-blue-400">
                                      <div className="font-medium text-sm text-gray-800 mb-2 flex items-center gap-2">
                                        📋 <span>Criteri di Classificazione (Matrice 2D)</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-700">
                                        <div><strong className="text-green-700">🟢 Autentica:</strong> Sim≥85% + Nat≥80%</div>
                                        <div><strong className="text-blue-700">🔵 Autentica Dissimulata:</strong> 55%≤Sim&lt;65% + Nat≥80%</div>
                                        <div><strong className="text-green-600">🟡 Prob. Autentica:</strong> Sim≥75% + Nat≥75%</div>
                                        <div><strong className="text-orange-600">🟠 Sospetta:</strong> Sim&lt;55% + Nat≥80% o Sim media + Nat&lt;50%</div>
                                        <div><strong className="text-red-600">🔴 Prob. Falsa:</strong> Sim&lt;65% + Nat&lt;60%</div>
                                        <div><strong className="text-gray-600">⚪ Incerta:</strong> Parametri intermedi</div>
                                      </div>
                                    </div>
                                    
                                    {/* === NUOVA SEZIONE: INTERPRETAZIONE DELL'ANALISI === */}
                                    {signature.verdictExplanation && (
                                      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-400">
                                        <div className="font-medium text-sm text-blue-800 mb-2 flex items-center gap-2">
                                          🤖 <span>Interpretazione dell'Analisi</span>
                                        </div>
                                        <div className="text-xs text-blue-900 leading-relaxed">
                                          {signature.verdictExplanation.split('\n\n').map((paragraph, index) => (
                                            <p key={index} className="mb-2 last:mb-0">
                                              {paragraph}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          } catch (e) {
                            console.error('Errore parsing analysisReport:', e);
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                    <Badge variant={
                      !signature.comparisonResult ? "secondary" :
                      signature.comparisonResult >= 0.85 ? "default" :
                      signature.comparisonResult >= 0.65 ? "secondary" : "destructive"
                    }>
                      {!signature.comparisonResult ? "Non elaborata" :
                       signature.comparisonResult >= 0.85 ? "Autentica" :
                       signature.comparisonResult >= 0.65 ? "Prob. Autentica" : "Sospetta"}
                    </Badge>
                  </div>
                  
                  
                  
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-6">
                Nessun risultato disponibile
              </p>
            )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}