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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Projects sidebar */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{t('signatures.projects')}</h2>
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className={`cursor-pointer hover:border-primary transition-colors ${
                    selectedProject === project.id ? 'border-primary bg-muted/50' : ''
                  }`}
                  onClick={() => setSelectedProject(project.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  {project.description && (
                    <CardContent className="p-4 pt-0">
                      <CardDescription>{project.description}</CardDescription>
                    </CardContent>
                  )}
                  <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Signatures content */}
          <div className="lg:col-span-9">
            {selectedProject ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">
                    {projects.find((p) => p.id === selectedProject)?.name}
                  </h2>
                  <div className="space-x-2">
                    <Dialog open={isUploadReferenceOpen} onOpenChange={setIsUploadReferenceOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
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
                              render={({ field: { onChange, value, ...rest } }) => (
                                <FormItem>
                                  <FormLabel>{t('signatures.file')}</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="file" 
                                      accept="image/*"
                                      onChange={(e) => onChange(e.target.files)}
                                      {...rest}
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
                        <Button 
                          disabled={!referenceSignatures || referenceSignatures.length === 0}
                        >
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
                              render={({ field: { onChange, value, ...rest } }) => (
                                <FormItem>
                                  <FormLabel>{t('signatures.file')}</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="file" 
                                      accept="image/*" 
                                      onChange={(e) => onChange(e.target.files)}
                                      {...rest}
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
                  </div>
                </div>
                
                {/* Reference signatures section */}
                <h3 className="text-lg font-semibold mb-3">{t('signatures.referenceSignatures')}</h3>
                
                {signaturesLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !signatures || !signatures.filter((s: any) => s.isReference).length ? (
                  <Card className="border-dashed border-2 mb-6">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <AlertCircle className="h-6 w-6 text-muted-foreground mb-4" />
                      <p className="text-center text-sm text-muted-foreground mb-4">
                        {t('signatures.noReferenceSignatures')}
                      </p>
                      <Button onClick={() => setIsUploadReferenceOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('signatures.uploadReference')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                    {signatures
                      .filter((signature: any) => signature.isReference)
                      .map((signature: any) => (
                        <Card key={signature.id} className="overflow-hidden">
                          <div className="relative aspect-square bg-black/5">
                            <img 
                              src={`/uploads/${signature.filename}`} 
                              alt={signature.originalFilename}
                              className="absolute inset-0 w-full h-full object-contain"
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
                          <CardFooter className="p-3 flex-col items-start">
                            <p className="text-sm font-medium truncate w-full" title={signature.originalFilename}>
                              {signature.originalFilename}
                            </p>
                            <Badge 
                              className={`mt-1 ${getStatusColor(signature.processingStatus)}`}
                            >
                              {signature.processingStatus === 'pending' ? 'In attesa' : 
                               signature.processingStatus === 'processing' ? 'In elaborazione' :
                               signature.processingStatus === 'completed' ? 'Completato' : 'Fallito'}
                            </Badge>
                          </CardFooter>
                        </Card>
                      ))}
                  </div>
                )}
                
                <Separator className="my-6" />
                
                {/* Verification signatures section */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">{t('signatures.verificationSignatures')}</h3>
                  {!referenceSignatures || referenceSignatures.length === 0 ? (
                    <div className="flex items-center text-sm text-yellow-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {t('signatures.needReferenceFirst')}
                    </div>
                  ) : null}
                </div>
                
                {signaturesLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !signatures || !signatures.filter((s: any) => !s.isReference).length ? (
                  <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <AlertCircle className="h-6 w-6 text-muted-foreground mb-4" />
                      <p className="text-center text-sm text-muted-foreground mb-4">
                        {t('signatures.noVerificationSignatures')}
                      </p>
                      <Button 
                        onClick={() => setIsUploadVerifyOpen(true)}
                        disabled={!referenceSignatures || referenceSignatures.length === 0}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {t('signatures.uploadVerify')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {signatures
                      .filter((signature: any) => !signature.isReference)
                      .map((signature: any) => (
                        <Card key={signature.id} className="overflow-hidden">
                          <div className="relative aspect-square bg-black/5">
                            <img 
                              src={`/uploads/${signature.filename}`} 
                              alt={signature.originalFilename}
                              className="absolute inset-0 w-full h-full object-contain"
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
                          <CardFooter className="p-3 flex-col items-start">
                            <p className="text-sm font-medium truncate w-full" title={signature.originalFilename}>
                              {signature.originalFilename}
                            </p>
                            <Badge 
                              className={`mt-1 ${getStatusColor(signature.processingStatus)}`}
                            >
                              {signature.processingStatus === 'pending' ? 'In attesa' : 
                               signature.processingStatus === 'processing' ? 'In elaborazione' :
                               signature.processingStatus === 'completed' ? 'Completato' : 'Fallito'}
                            </Badge>
                            {signature.processingStatus === 'completed' && 
                             renderSimilarityScore(signature.comparisonResult)}
                          </CardFooter>
                        </Card>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-10">
                  <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">{t('signatures.selectProject')}</h3>
                  <p className="text-center text-sm text-muted-foreground">
                    {t('signatures.selectProjectDescription')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}