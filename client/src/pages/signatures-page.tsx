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
  file: z.instanceof(FileList).refine(files => files.length === 1, "Seleziona un file")
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
    isLoading: signaturesLoading
  } = useQuery<Signature[]>({
    queryKey: ["/api/signature-projects", selectedProject, "signatures"],
    enabled: !!user && !!selectedProject,
    onSuccess: (data) => {
      console.log("Signatures loaded:", data);
    }
  });
  
  // Query to get reference signatures for selected project
  const { 
    data: referenceSignatures
  } = useQuery({
    queryKey: ["/api/signature-projects", selectedProject, "signatures", "reference"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/signature-projects/${selectedProject}/signatures?referenceOnly=true`);
      return res.json();
    },
    enabled: !!user && !!selectedProject,
  });
  
  // Mutation to create new project
  const createProject = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest("POST", "/api/signature-projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects"] });
      projectForm.reset();
      setIsCreateProjectOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures", "reference"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/signature-projects", selectedProject, "signatures", "reference"] });
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                selectedProject === project.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedProject(project.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardFooter className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Creato: {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Selected project content */}
      {selectedProject && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
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
                        render={({ field: { onChange, ...rest } }) => (
                          <FormItem>
                            <FormLabel>{t('signatures.selectFile')}</FormLabel>
                            <FormControl>
                              <input 
                                type="file" 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                onChange={(e) => onChange(e.target.files)}
                                accept="image/*"
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
                  <Button>
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
                        render={({ field: { onChange, ...rest } }) => (
                          <FormItem>
                            <FormLabel>{t('signatures.selectFile')}</FormLabel>
                            <FormControl>
                              <input 
                                type="file" 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                onChange={(e) => onChange(e.target.files)}
                                accept="image/*"
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
                variant="secondary"
                onClick={() => compareAllSignatures.mutate()}
                disabled={compareAllSignatures.isPending}
              >
                {compareAllSignatures.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('signatures.compareAll')}
              </Button>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">{t('signatures.referenceSignatures')}</h3>
            {signaturesLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !Array.isArray(signatures) || signatures.filter(s => s.isReference).length === 0 ? (
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
                {/* Aggiungiamo un messaggio di debug se ci sono firme di riferimento ma con stato non 'completed' */}
                {Array.isArray(signatures) && signatures.some(s => s.isReference && s.processingStatus !== 'completed') && (
                  <div className="col-span-full mb-2 p-2 bg-yellow-100 rounded-md">
                    <p className="text-sm text-yellow-700">
                      Ci sono {signatures.filter(s => s.isReference && s.processingStatus !== 'completed').length} firme di riferimento in elaborazione. 
                      Attendere il completamento per visualizzarle.
                    </p>
                  </div>
                )}
                {Array.isArray(signatures) && signatures
                  .filter((s: any) => s.isReference)
                  .map((signature: any) => (
                    <Card key={signature.id} className="overflow-hidden">
                      <div className="relative h-48 bg-gray-100">
                        <img 
                          src={`/uploads/${signature.filename}`} 
                          alt={signature.originalFilename}
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
                          {signature.originalFilename}
                        </p>
                        <div className="flex items-center mt-1">
                          <Badge className={getStatusColor(signature.processingStatus)}>
                            {signature.processingStatus}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
            ) : !Array.isArray(signatures) || signatures.filter(s => !s.isReference).length === 0 ? (
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
                {/* Aggiungiamo un messaggio di debug se ci sono firme da verificare ma con stato non 'completed' */}
                {Array.isArray(signatures) && signatures.some(s => !s.isReference && s.processingStatus !== 'completed') && (
                  <div className="col-span-full mb-2 p-2 bg-yellow-100 rounded-md">
                    <p className="text-sm text-yellow-700">
                      Ci sono {signatures.filter(s => !s.isReference && s.processingStatus !== 'completed').length} firme da verificare in elaborazione. 
                      Attendere il completamento per visualizzarle.
                    </p>
                  </div>
                )}
                {Array.isArray(signatures) && signatures
                  .filter((s: any) => !s.isReference)
                  .map((signature: any) => (
                    <Card key={signature.id} className="overflow-hidden">
                      <div className="relative h-48 bg-gray-100">
                        <img 
                          src={`/uploads/${signature.filename}`} 
                          alt={signature.originalFilename}
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
                          {signature.originalFilename}
                        </p>
                        <div className="flex items-center mt-1">
                          <Badge className={getStatusColor(signature.processingStatus)}>
                            {signature.processingStatus}
                          </Badge>
                        </div>
                        {signature.processingStatus === 'completed' && renderSimilarityScore(signature.similarityScore)}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}