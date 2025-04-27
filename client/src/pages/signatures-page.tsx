import { useState } from "react";
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
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// File upload schema
const fileSchema = z.object({
  file: z.any()
    .refine(file => file instanceof FileList, "Input non valido")
    .refine(files => (files instanceof FileList) && files.length === 1, "Seleziona un file")
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
    defaultValues: {},
  });
  
  // Form for verification signature upload
  const verifyForm = useForm<FileFormValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: {},
  });
  
  // Query to get all projects
  const { 
    data: projects = [],
    isLoading: projectsLoading
  } = useQuery<SignatureProject[]>({
    queryKey: ["/api/signature-projects"],
    enabled: !!user,
  });
  
  // Query to get signatures for selected project
  const { 
    data: signatures = [],
    isLoading: signaturesLoading,
    refetch: refetchSignatures
  } = useQuery<Signature[]>({
    queryKey: ["/api/signature-projects", selectedProject, "signatures"],
    enabled: !!user && !!selectedProject,
    staleTime: 0, // Forza sempre il refetch
    refetchOnMount: true, // Ricarica ad ogni montaggio del componente
    refetchInterval: 5000, // Aggiorna ogni 5 secondi
    
    // Implementa un selettore per garantire che riceviamo solo firme valide
    select: (data) => {
      // Se i dati non sono un array valido, restituisci un array vuoto
      if (!Array.isArray(data)) {
        console.log("Dati non validi ricevuti:", data);
        return [];
      }
      
      // Solo firme che hanno effettivamente un projectId che corrisponde al progetto selezionato
      const validSignatures = data.filter(s => 
        s && typeof s === 'object' && 'projectId' in s && s.projectId === selectedProject
      );
      
      console.log(`Debug firme: ricevute ${data.length}, valide ${validSignatures.length}`);
      
      return validSignatures;
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
    mutationFn: async (data: FileList) => {
      const formData = new FormData();
      formData.append("signature", data[0]);
      
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
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      referenceForm.reset();
      setIsUploadReferenceOpen(false);
      toast({
        title: "Successo",
        description: "Firma di riferimento caricata con successo",
      });
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
    mutationFn: async (data: FileList) => {
      const formData = new FormData();
      formData.append("signature", data[0]);
      
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
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      verifyForm.reset();
      setIsUploadVerifyOpen(false);
      toast({
        title: "Successo",
        description: "Firma caricata per la verifica",
      });
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
      uploadReference.mutate(data.file);
    }
  };
  
  // Function to handle verification upload
  const onUploadVerify = (data: FileFormValues) => {
    if (data.file && data.file.length > 0) {
      uploadVerify.mutate(data.file);
    }
  };
  
  // Handle project deletion
  const handleDeleteProject = (projectId: number) => {
    if (confirm("Sei sicuro di voler eliminare questo progetto? Tutte le firme associate saranno eliminate.")) {
      deleteProject.mutate(projectId);
    }
  };
  
  // Handle signature deletion
  const handleDeleteSignature = (signatureId: number) => {
    if (confirm("Sei sicuro di voler eliminare questa firma?")) {
      deleteSignature.mutate(signatureId);
    }
  };
  
  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Mutation to manually compare all signatures
  const compareAllSignatures = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Nessun progetto selezionato");
      
      // Ottieni tutte le firme del progetto
      const allSignatures = await queryClient.fetchQuery<Signature[]>({
        queryKey: ["/api/signature-projects", selectedProject, "signatures"],
      });
      
      // Verifica se ci sono firme di riferimento e di verifica
      const referenceSignatures = allSignatures.filter((s) => s.isReference && s.processingStatus === 'completed');
      const verificationSignatures = allSignatures.filter((s) => !s.isReference && s.processingStatus === 'completed');
      
      if (referenceSignatures.length === 0) {
        throw new Error("Nessuna firma di riferimento completata disponibile");
      }
      
      if (verificationSignatures.length === 0) {
        throw new Error("Nessuna firma da verificare disponibile o completata");
      }
      
      // Per ogni firma da verificare, richiedi un nuovo confronto
      const promises = verificationSignatures.map(async (signature: any) => {
        const res = await fetch(`/api/signatures/${signature.id}/compare`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ projectId: selectedProject }),
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Errore durante il confronto della firma");
        }
        
        return res.json();
      });
      
      // Attendi che tutti i confronti siano completati
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures"] });
      toast({
        title: "Successo",
        description: "Confronto delle firme completato",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore durante il confronto delle firme: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Function to render similarity score
  const renderSimilarityScore = (score: number | null) => {
    if (score === null) return null;
    
    let color = 'bg-red-500';
    let text = 'Firma non autentica';
    
    if (score >= 0.8) {
      color = 'bg-green-500';
      text = 'Firma autentica';
    } else if (score >= 0.6) {
      color = 'bg-yellow-500';
      text = 'Firma sospetta';
    }
    
    return (
      <div className="mt-2">
        <p className="text-sm font-medium">Punteggio di somiglianza: {(score * 100).toFixed(1)}%</p>
        <Progress value={score * 100} className="h-2 mt-1" />
        <Badge className={`mt-2 ${color}`}>{text}</Badge>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('signatures.title')}</h1>
        <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
          <DialogTrigger asChild>
            <Button>{t('signatures.createProject')}</Button>
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
      {projectsLoading ? (
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
                <CardDescription>
                  {project.description || t('signatures.noDescription')}
                </CardDescription>
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
            <h2 className="text-2xl font-semibold">
              {projects.find(p => p.id === selectedProject)?.name}
            </h2>
            <div className="flex space-x-2">
              <Dialog open={isUploadReferenceOpen} onOpenChange={setIsUploadReferenceOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
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
                            <FormLabel>{t('signatures.selectFile')}</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files) {
                                    field.onChange(e.target.files);
                                  }
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
              
              <Dialog open={isUploadVerifyOpen} onOpenChange={setIsUploadVerifyOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
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
                            <FormLabel>{t('signatures.selectFile')}</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files) {
                                    field.onChange(e.target.files);
                                  }
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
              
              <Button 
                variant="default"
                onClick={() => compareAllSignatures.mutate()}
                disabled={compareAllSignatures.isPending}
              >
                {compareAllSignatures.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('signatures.compareAll')}
              </Button>
            </div>
          </div>
          
          {/* Debugging Info */}
          <Card className="bg-blue-50 mb-6 border border-blue-200">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Debug Info:</h4>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const confirmDelete = confirm("Sei sicuro di voler eliminare completamente il progetto? Questa operazione eliminerà il progetto attuale e ne creerà uno nuovo con lo stesso nome. Questo è l'unico modo per rimuovere eventuali firme fantasma.");
                    
                    if (confirmDelete) {
                      if (!selectedProject) {
                        toast({
                          title: "Errore",
                          description: "Nessun progetto selezionato",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      toast({
                        title: "Ricreazione in corso",
                        description: "Eliminazione e ricreazione del progetto...",
                      });
                      
                      // Salviamo i dettagli del progetto prima di eliminarlo
                      const currentProject = projects.find(p => p.id === selectedProject);
                      
                      if (!currentProject) {
                        toast({
                          title: "Errore",
                          description: "Progetto non trovato",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      const projectName = currentProject.name;
                      const projectDescription = currentProject.description || '';
                      
                      // SOLUZIONE RADICALE: Elimina e ricrea il progetto
                      // Questo è garantito per risolvere il problema delle firme fantasma
                      deleteProject.mutateAsync(selectedProject)
                        .then(() => {
                          toast({
                            title: "Progetto eliminato",
                            description: "Creazione del nuovo progetto in corso...",
                          });
                          
                          // Forza l'invalidazione della cache prima di creare il nuovo progetto
                          queryClient.removeQueries();
                          queryClient.invalidateQueries();
                          
                          // Crea un nuovo progetto con lo stesso nome
                          return createProject.mutateAsync({ 
                            name: projectName, 
                            description: projectDescription 
                          });
                        })
                        .then((newProject) => {
                          // Forza nuovamente l'invalidazione della cache dopo la creazione
                          queryClient.invalidateQueries();
                          
                          toast({
                            title: "Operazione completata",
                            description: `Il progetto "${projectName}" è stato ricreato pulito`,
                          });
                          
                          // Seleziona automaticamente il nuovo progetto
                          if (newProject && newProject.id) {
                            setSelectedProject(newProject.id);
                          }
                        })
                        .catch(err => {
                          console.error("Errore durante la ricreazione del progetto:", err);
                          toast({
                            title: "Errore",
                            description: "Impossibile completare l'operazione",
                            variant: "destructive"
                          });
                        });
                    }
                  }}
                >
                  Ripulisci progetto
                </Button>
              </div>
              <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-32">
                {JSON.stringify({
                  totalSignatures: Array.isArray(signatures) ? signatures.length : 0,
                  referenceSignatures: Array.isArray(signatures) ? signatures.filter((s: any) => s.isReference).length : 0,
                  verifySignatures: Array.isArray(signatures) ? signatures.filter((s: any) => !s.isReference).length : 0,
                  signatureDetails: Array.isArray(signatures) ? signatures.map((s: any) => ({
                    id: s.id,
                    filename: s.filename,
                    type: s.isReference ? 'reference' : 'verify',
                    status: s.processingStatus
                  })) : []
                }, null, 2)}
              </pre>
            </CardContent>
          </Card>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">{t('signatures.referenceSignatures')}</h3>
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
                      <Button onClick={() => setIsUploadReferenceOpen(true)}>
                        {t('signatures.uploadFirstReference')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.isArray(signatures) && 
                     signatures
                      .filter((s: any) => s.isReference)
                      .sort((a: any, b: any) => a.processingStatus === 'completed' ? -1 : 1)
                      .map((signature: any) => (
                        <Card key={signature.id} className="overflow-hidden">
                          <div className="relative h-48 bg-gray-100">
                            <img 
                              src={`/uploads/${signature.filename}`} 
                              alt={signature.originalFilename || 'Signature'}
                              className="w-full h-full object-contain p-2"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-7 w-7 opacity-80 hover:opacity-100"
                              onClick={() => handleDeleteSignature(signature.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <CardContent className="p-3">
                            <p className="text-sm truncate" title={signature.originalFilename}>
                              {signature.originalFilename || 'Unknown File'}
                            </p>
                            <div className="flex items-center mt-1">
                              <Badge className={getStatusColor(signature.processingStatus)}>
                                {signature.processingStatus}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Separator className="my-6" />
          
          <div>
            <h3 className="text-xl font-semibold mb-3">{t('signatures.verificationsSignatures')}</h3>
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
                      <Button onClick={() => setIsUploadVerifyOpen(true)}>
                        {t('signatures.uploadFirstVerify')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.isArray(signatures) && 
                     signatures
                      .filter((s: any) => !s.isReference)
                      .sort((a: any, b: any) => a.processingStatus === 'completed' ? -1 : 1)
                      .map((signature: any) => (
                        <Card key={signature.id} className="overflow-hidden">
                          <div className="relative h-48 bg-gray-100">
                            <img 
                              src={`/uploads/${signature.filename}`} 
                              alt={signature.originalFilename || 'Signature'}
                              className="w-full h-full object-contain p-2"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-7 w-7 opacity-80 hover:opacity-100"
                              onClick={() => handleDeleteSignature(signature.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <CardContent className="p-3">
                            <p className="text-sm truncate" title={signature.originalFilename}>
                              {signature.originalFilename || 'Unknown File'}
                            </p>
                            <div className="flex items-center mt-1">
                              <Badge className={getStatusColor(signature.processingStatus)}>
                                {signature.processingStatus}
                              </Badge>
                            </div>
                            {signature.processingStatus === 'completed' && renderSimilarityScore(signature.similarityScore)}
                          </CardContent>
                        </Card>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}