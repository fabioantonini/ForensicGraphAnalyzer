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
import { Loader2, Trash2, Upload, FileCheck, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

// Project schema
const projectSchema = z.object({
  name: z.string().min(3, "Il nome deve avere almeno 3 caratteri"),
  description: z.string().optional(),
  dpi: z.number().min(72).max(1200).default(300)
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
      dpi: 300,
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
    staleTime: 10000, // Ricarica dopo 10 secondi
    refetchOnMount: true, // Ricarica ad ogni montaggio del componente
    refetchInterval: 5000, // Aggiorna ogni 5 secondi
    
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
      
      // Verifica se qualcuna delle firme ha cambiato stato
      const pendingOrProcessing = data.some(
        sig => sig.processingStatus === 'pending' || sig.processingStatus === 'processing'
      );
      
      if (pendingOrProcessing) {
        console.log("Rilevate firme in elaborazione, continuo a monitorare...");
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
      console.log("Caricamento firma di riferimento iniziato");
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
      
      console.log("Firma di riferimento caricata con successo");
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
        console.log("Refetch forzato delle firme");
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
      console.log("Caricamento firma da verificare iniziato");
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
      
      console.log("Firma da verificare caricata con successo");
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
      
      // Forziamo un refetch immediato delle firme
      setTimeout(() => {
        refetchSignatures();
        console.log("Refetch forzato delle firme dopo verifica");
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
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
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
      console.log('Richiesta di aggiornamento ricevuta, ricaricamento firme...');
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
      
      console.log(`Avvio generazione report per tutte le firme nel progetto ${selectedProject}`);
      
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
      
      // Se abbiamo generato almeno un report, offriamo un link per scaricare il primo
      if (data.successful > 0 && data.results.some((r: any) => r.success && r.reportPath)) {
        const firstSuccessfulReport = data.results.find((r: any) => r.success && r.reportPath);
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
      
      console.log(`[FRONTEND] Avvio confronto multiplo per progetto ${selectedProject} usando l'endpoint compare-all`);
      console.log(`[FRONTEND] URL endpoint: /api/signature-projects/${selectedProject}/compare-all`);
      console.log(`[FRONTEND] PRIMA della chiamata apiRequest - timestamp: ${new Date().toISOString()}`);
      
      try {
        // FORZA INVALIDAZIONE CACHE prima della richiesta
        console.log(`[FRONTEND] INVALIDAZIONE CACHE per progetto ${selectedProject}`);
        queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
        queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
        
        // BYPASS REACT QUERY CACHE - Usa fetch diretto con cache disabled
        console.log(`[FRONTEND] CHIAMATA COMPARE-ALL VIA FETCH DIRETTO - timestamp: ${new Date().toISOString()}`);
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
        console.log(`[FRONTEND] DATI RICEVUTI VIA FETCH DIRETTO - timestamp: ${new Date().toISOString()}`);
        console.log(`[FRONTEND] Dati ricevuti:`, responseData);
        return responseData;
      } catch (error) {
        console.error(`[FRONTEND] ERRORE fetch diretto:`, error);
        throw error;
      }
    },
    onSuccess: (data: Signature[]) => {
      console.log(`[FRONTEND] Successo confronto. Dati ricevuti:`, data);
      console.log(`[FRONTEND] Numero firme ricevute:`, data.length);
      
      // Salva i risultati e mostra il dialog
      setComparisonResults(data);
      setShowResultsDialog(true);
      
      // Aggiorniamo la query per garantire che i dati siano aggiornati
      queryClient.invalidateQueries({ queryKey: [`/api/signature-projects/${selectedProject}/signatures`] });
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
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
                <FormField
                  control={projectForm.control}
                  name="dpi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('signatures.dpi')}
                        <HelpTooltip
                          content=""
                          translationKey="signatures.help.dpiDesc"
                          defaultContent="Densità di pixel per pollice (DPI) delle immagini di firma. Utilizzato per calcolare le dimensioni reali. I valori comuni sono 300 per scansioni standard, 600 per scansioni ad alta risoluzione."
                          iconSize={16}
                          className="ml-1"
                        />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={72}
                          max={1200}
                          placeholder="300"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 300)}
                          value={field.value || 300}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('signatures.dpiAutomaticExtraction')}
                      </p>
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
              
              <div className="flex items-center">
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
                  {t('signatures.generateAllReports', 'Genera Report PDF')}
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
                      .sort((a: any, b: any) => a.processingStatus === 'completed' ? -1 : 1)
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
                  signatures.some((s: any) => !s.isReference && s.processingStatus !== 'completed') && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
                      Ci sono {signatures.filter((s: any) => !s.isReference && s.processingStatus !== 'completed').length} firme da verificare in elaborazione. 
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
                      .sort((a: any, b: any) => a.processingStatus === 'completed' ? -1 : 1)
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
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Risultati Confronto Firme - Analisi Forense</DialogTitle>
            <DialogDescription>
              Analisi completata utilizzando 16+ parametri avanzati per il confronto grafologico
            </DialogDescription>
          </DialogHeader>
          
          {/* Statistiche generali */}
          {comparisonResults && comparisonResults.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-2">Riepilogo Analisi</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-primary">
                    {comparisonResults.filter(s => !s.isReference).length}
                  </div>
                  <div className="text-muted-foreground">Firme analizzate</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {comparisonResults.filter(s => !s.isReference && (s.comparisonResult ?? 0) >= 0.85).length}
                  </div>
                  <div className="text-muted-foreground">Autentiche (≥85%)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-yellow-600">
                    {comparisonResults.filter(s => !s.isReference && (s.comparisonResult ?? 0) >= 0.65 && (s.comparisonResult ?? 0) < 0.85).length}
                  </div>
                  <div className="text-muted-foreground">Prob. Autentiche (65-84%)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-red-600">
                    {comparisonResults.filter(s => !s.isReference && (s.comparisonResult ?? 0) < 0.65).length}
                  </div>
                  <div className="text-muted-foreground">Sospette (&lt;65%)</div>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {comparisonResults && comparisonResults.length > 0 ? (
              // Mostra solo le firme da verificare (non di riferimento)
              comparisonResults.filter(sig => !sig.isReference).map((signature, index) => (
                <div key={signature.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-lg">{signature.originalFilename}</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-4">
                          <p className="text-sm text-muted-foreground">
                            <strong>Similarità:</strong> {signature.comparisonResult ? (signature.comparisonResult * 100).toFixed(1) : '0'}%
                          </p>
                          {signature.parameters?.realDimensions && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Dimensioni:</strong> {signature.parameters.realDimensions.widthMm?.toFixed(1)}×{signature.parameters.realDimensions.heightMm?.toFixed(1)}mm
                            </p>
                          )}
                        </div>
                        
                        {/* Parametri tecnici chiave */}
                        {signature.parameters && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                              {signature.parameters.strokeWidth?.meanMm && (
                                <div><strong>Spessore medio:</strong> {signature.parameters.strokeWidth.meanMm.toFixed(2)}mm</div>
                              )}
                              {signature.parameters.inclination !== undefined && (
                                <div><strong>Inclinazione:</strong> {signature.parameters.inclination.toFixed(1)}°</div>
                              )}
                              {signature.parameters.connectivity?.totalStrokeLength && (
                                <div><strong>Lunghezza tratto:</strong> {signature.parameters.connectivity.totalStrokeLength.toFixed(0)}mm</div>
                              )}
                              {signature.parameters.connectivity?.strokeComplexity && (
                                <div><strong>Complessità:</strong> {(signature.parameters.connectivity.strokeComplexity * 100).toFixed(0)}%</div>
                              )}
                              {signature.parameters.velocity !== undefined && (
                                <div><strong>Velocità:</strong> {signature.parameters.velocity}/5</div>
                              )}
                              {signature.parameters.writingStyle && (
                                <div><strong>Stile:</strong> {signature.parameters.writingStyle}</div>
                              )}
                            </div>
                            
                            {/* Parametri avanzati Python */}
                            <div className="border-t pt-2">
                              <h6 className="text-xs font-medium text-muted-foreground mb-1">Parametri Avanzati (Python/OpenCV):</h6>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                {signature.parameters.avgSpacing !== undefined && (
                                  <div><strong>Spaziatura media:</strong> {signature.parameters.avgSpacing.toFixed(1)}mm</div>
                                )}
                                {signature.parameters.pressureStd !== undefined && (
                                  <div><strong>Dev. pressione:</strong> {signature.parameters.pressureStd.toFixed(1)}</div>
                                )}
                                {signature.parameters.pressureMean !== undefined && (
                                  <div><strong>Pressione media:</strong> {signature.parameters.pressureMean.toFixed(0)}</div>
                                )}
                                {signature.parameters.readability && (
                                  <div><strong>Leggibilità:</strong> {signature.parameters.readability}</div>
                                )}
                                {signature.parameters.avgAsolaSize !== undefined && (
                                  <div><strong>Dim. asole:</strong> {signature.parameters.avgAsolaSize.toFixed(2)}mm</div>
                                )}
                                {signature.parameters.baselineStdMm !== undefined && (
                                  <div><strong>Dev. baseline:</strong> {signature.parameters.baselineStdMm.toFixed(1)}mm</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
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
                  
                  {signature.analysisReport && (
                    <div className="bg-muted p-3 rounded text-sm">
                      <h5 className="font-medium mb-2">Analisi Dettagliata:</h5>
                      <pre className="whitespace-pre-wrap text-xs font-mono">
                        {signature.analysisReport}
                      </pre>
                    </div>
                  )}
                  
                  {signature.comparisonChart && (
                    <div className="mt-3">
                      <h5 className="font-medium mb-2">Grafico di Confronto:</h5>
                      <img 
                        src={`data:image/png;base64,${signature.comparisonChart}`} 
                        alt="Grafico confronto" 
                        className="max-w-full h-auto border rounded"
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-6">
                Nessun risultato disponibile
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowResultsDialog(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SignatureMethodologyDialog />
    </div>
  );
}