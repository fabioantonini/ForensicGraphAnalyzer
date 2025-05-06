import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportTemplate } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { File, FileCheck, FileEdit, Plus, TrashIcon, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

// Schema per la creazione/modifica di un template
const templateFormSchema = z.object({
  name: z.string().min(1, { message: "Il nome è obbligatorio" }),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  template: z.any().optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

export default function ReportTemplatesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<ReportTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("my-templates");

  // Query per recuperare i template personali
  const { data: myTemplates, isLoading: myTemplatesLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/report-templates"],
    staleTime: 1000 * 60 * 5, // 5 minuti
  });

  // Query per recuperare i template pubblici
  const { data: publicTemplates, isLoading: publicTemplatesLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/report-templates/public"],
    staleTime: 1000 * 60 * 5, // 5 minuti
  });

  // Mutation per creare un nuovo template
  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const response = await fetch("/api/report-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nella creazione del template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Successo",
        description: "Template creato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore nella creazione del template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation per aggiornare un template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TemplateFormValues }) => {
      const response = await fetch(`/api/report-templates/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'aggiornamento del template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Successo",
        description: "Template aggiornato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore nell'aggiornamento del template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation per eliminare un template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/report-templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'eliminazione del template");
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      setIsDeleteAlertOpen(false);
      setCurrentTemplate(null);
      toast({
        title: "Successo",
        description: "Template eliminato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore nell'eliminazione del template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Form per la creazione di un nuovo template
  const createForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isPublic: false,
      template: {
        header: {
          title: "Rapporto di Analisi Firma",
          logo: true,
          date: true,
        },
        sections: [
          {
            title: "Informazioni sul Caso",
            enabled: true,
          },
          {
            title: "Risultati dell'Analisi",
            enabled: true,
            showSimilarityScore: true,
            showComparisonChart: true,
          },
          {
            title: "Analisi Tecnica",
            enabled: true,
          },
          {
            title: "Metodologia",
            enabled: true,
          },
        ],
        footer: {
          showPageNumbers: true,
          text: "© GrapholexInsight - Rapporto generato automaticamente",
        },
      },
    },
  });

  // Form per la modifica di un template esistente
  const editForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    // I valori predefiniti verranno impostati quando un template viene selezionato per la modifica
  });

  const onCreateSubmit = (data: TemplateFormValues) => {
    createTemplateMutation.mutate(data);
  };

  const onEditSubmit = (data: TemplateFormValues) => {
    if (currentTemplate) {
      updateTemplateMutation.mutate({ id: currentTemplate.id, data });
    }
  };

  const handleEditTemplate = (template: ReportTemplate) => {
    setCurrentTemplate(template);
    // Imposta i valori del form di modifica con i dati del template selezionato
    editForm.reset({
      name: template.name,
      description: template.description || "",
      isPublic: template.isPublic || false,
      template: template.template,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteTemplate = (template: ReportTemplate) => {
    setCurrentTemplate(template);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = () => {
    if (currentTemplate) {
      deleteTemplateMutation.mutate(currentTemplate.id);
    }
  };

  // Rendering dei template come cards
  const renderTemplateCards = (templates: ReportTemplate[] | undefined, isLoading: boolean, isOwner: boolean = true) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[100px] w-full" />
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 pt-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (!templates || templates.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {isOwner ? "Non hai ancora creato alcun template." : "Non ci sono template pubblici disponibili."}
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.isPublic && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">
                    <Share2 className="h-3 w-3 mr-1" />
                    Pubblico
                  </div>
                )}
              </div>
              <CardDescription className="line-clamp-2">{template.description || "Nessuna descrizione"}</CardDescription>
            </CardHeader>
            <CardContent>
              {template.thumbnailUrl ? (
                <img src={template.thumbnailUrl} alt={template.name} className="w-full h-[100px] object-cover rounded-md" />
              ) : (
                <div className="w-full h-[100px] bg-muted rounded-md flex items-center justify-center">
                  <FileCheck className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end space-x-2 pt-2">
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template)}
                    className="text-destructive"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Elimina
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)}>
                    <FileEdit className="h-4 w-4 mr-1" />
                    Modifica
                  </Button>
                </>
              )}
              <Button variant="default" size="sm">
                <File className="h-4 w-4 mr-1" />
                Usa
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Template Report</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Template
        </Button>
      </div>

      <Tabs defaultValue="my-templates" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="my-templates">I miei Template</TabsTrigger>
          <TabsTrigger value="public-templates">Template Pubblici</TabsTrigger>
        </TabsList>
        <TabsContent value="my-templates" className="mt-6">
          {renderTemplateCards(myTemplates, myTemplatesLoading, true)}
        </TabsContent>
        <TabsContent value="public-templates" className="mt-6">
          {renderTemplateCards(publicTemplates, publicTemplatesLoading, false)}
        </TabsContent>
      </Tabs>

      {/* Dialog per la creazione di un nuovo template */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crea Nuovo Template</DialogTitle>
            <DialogDescription>Crea un nuovo template di report personalizzato.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome del template" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrizione del template (opzionale)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Pubblico</FormLabel>
                      <FormDescription>
                        Rendi questo template disponibile a tutti gli utenti.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4">Configurazione Template</h3>
                {/* Qui andrebbe un editor di template avanzato con la possibilità di personalizzare le sezioni */}
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-muted-foreground text-sm">Editor Template (anteprima)</p>
                  <pre className="text-xs mt-2 overflow-auto max-h-[200px]">
                    {JSON.stringify(createForm.watch("template"), null, 2)}
                  </pre>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={createTemplateMutation.isPending}>
                  {createTemplateMutation.isPending ? "Creazione in corso..." : "Crea Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog per la modifica di un template esistente */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Template</DialogTitle>
            <DialogDescription>Modifica il template di report selezionato.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome del template" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrizione del template (opzionale)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Pubblico</FormLabel>
                      <FormDescription>
                        Rendi questo template disponibile a tutti gli utenti.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4">Configurazione Template</h3>
                {/* Qui andrebbe un editor di template avanzato */}
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-muted-foreground text-sm">Editor Template (anteprima)</p>
                  <pre className="text-xs mt-2 overflow-auto max-h-[200px]">
                    {JSON.stringify(editForm.watch("template"), null, 2)}
                  </pre>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={updateTemplateMutation.isPending}>
                  {updateTemplateMutation.isPending ? "Aggiornamento in corso..." : "Aggiorna Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Alert dialog per la conferma di eliminazione */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo template?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Questo eliminerà permanentemente il template
              "{currentTemplate?.name}" e rimuoverà tutti i dati associati dal nostro server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending ? "Eliminazione in corso..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
