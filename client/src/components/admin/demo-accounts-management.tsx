import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, DemoAccountCreation, DemoExtension } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, UserPlus, UserX, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Schema di validazione per la creazione di un account demo
const demoAccountSchema = z.object({
  username: z.string().min(3, "Username deve essere di almeno 3 caratteri"),
  password: z.string().min(6, "Password deve essere di almeno 6 caratteri"),
  confirmPassword: z.string(),
  email: z.string().email("Email non valida"),
  fullName: z.string().optional(),
  organization: z.string().optional(),
  profession: z.string().optional(),
  durationDays: z.coerce.number().min(1).max(365)
}).refine(data => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"]
});

// Schema di validazione per l'estensione di un account demo
const extendDemoSchema = z.object({
  userId: z.number().positive(),
  additionalDays: z.coerce.number().min(1).max(365)
});

type DemoAccountFormValues = z.infer<typeof demoAccountSchema>;
type ExtendDemoFormValues = z.infer<typeof extendDemoSchema>;

const DemoAccountsManagement: React.FC = () => {
  const { t } = useTranslation(["admin", "common"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form per creazione account demo
  const createForm = useForm<DemoAccountFormValues>({
    resolver: zodResolver(demoAccountSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      fullName: "",
      organization: "",
      profession: "",
      durationDays: 14
    }
  });
  
  // Form per estensione account demo
  const extendForm = useForm<ExtendDemoFormValues>({
    resolver: zodResolver(extendDemoSchema),
    defaultValues: {
      userId: 0,
      additionalDays: 7
    }
  });
  
  // Query per ottenere gli utenti demo attivi
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    select: (data) => data.filter((user: User) => user.accountType === 'demo')
  });
  
  // Query per ottenere gli account demo in scadenza nei prossimi 7 giorni
  const { data: expiringUsers } = useQuery({
    queryKey: ["/api/admin/demo-accounts/expiring"],
  });
  
  // Mutation per creare un account demo
  const createDemoMutation = useMutation({
    mutationFn: async (data: DemoAccountFormValues) => {
      const { confirmPassword, ...demoData } = data;
      const res = await apiRequest("POST", "/api/admin/demo-account", demoData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante la creazione dell'account demo");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account demo creato",
        description: "L'account demo è stato creato con successo"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Mutation per estendere un account demo
  const extendDemoMutation = useMutation({
    mutationFn: async (data: ExtendDemoFormValues) => {
      const res = await apiRequest("POST", "/api/admin/extend-demo", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante l'estensione dell'account demo");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account demo esteso",
        description: "La durata dell'account demo è stata estesa con successo"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-accounts/expiring"] });
      setExtendDialogOpen(false);
      extendForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Mutation per la manutenzione degli account demo
  const maintenanceDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/maintenance/demo-accounts", {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante la manutenzione degli account demo");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Manutenzione completata",
        description: `Disattivati ${data.deactivatedAccounts} account scaduti. ${data.purgedCount} account pronti per pulizia.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-accounts/expiring"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleCreateDemoSubmit = (data: DemoAccountFormValues) => {
    createDemoMutation.mutate(data);
  };
  
  const handleExtendDemoSubmit = (data: ExtendDemoFormValues) => {
    extendDemoMutation.mutate(data);
  };
  
  const handleExtendDemoClick = (user: User) => {
    setSelectedUser(user);
    extendForm.setValue("userId", user.id);
    setExtendDialogOpen(true);
  };
  
  // Funzione per formattare una data
  const formatDate = (date: Date | undefined) => {
    if (!date) return "N/A";
    return format(new Date(date), "dd/MM/yyyy");
  };
  
  // Funzione per ottenere i giorni rimanenti
  const getRemainingDays = (expiryDate: Date | undefined) => {
    if (!expiryDate) return 0;
    const days = differenceInDays(new Date(expiryDate), new Date());
    return Math.max(0, days);
  };
  
  // Filtra gli account attivi e scaduti
  const activeAccounts = users?.filter((user: User) => user.isActive);
  const expiredAccounts = users?.filter((user: User) => !user.isActive);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("demoAccounts.title")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => maintenanceDemoMutation.mutate()}>
            {t("demoAccounts.maintenance")}
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("demoAccounts.createNew")}
          </Button>
        </div>
      </div>
      
      {expiringUsers && expiringUsers.length > 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("demoAccounts.expiringAlert")}</AlertTitle>
          <AlertDescription>
            {t("demoAccounts.expiringDaysMessage", { count: expiringUsers.length })}
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            {t("demoAccounts.activeAccounts")}
          </TabsTrigger>
          <TabsTrigger value="expired">
            {t("demoAccounts.expiredAccounts")}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>{t("demoAccounts.activeAccounts")}</CardTitle>
              <CardDescription>
                {t("demoAccounts.activeDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeAccounts && activeAccounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("username")}</TableHead>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>Organizzazione</TableHead>
                      <TableHead>Scade il</TableHead>
                      <TableHead>Giorni rimasti</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAccounts.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.organization || "-"}</TableCell>
                        <TableCell>{formatDate(user.demoExpiresAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {getRemainingDays(user.demoExpiresAt)} giorni
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleExtendDemoClick(user)}
                          >
                            {t("demoAccounts.extend")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  {t("demoAccounts.noActiveAccounts")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="expired">
          <Card>
            <CardHeader>
              <CardTitle>{t("demoAccounts.expiredAccounts")}</CardTitle>
              <CardDescription>
                {t("demoAccounts.expiredDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expiredAccounts && expiredAccounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("username")}</TableHead>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>Organizzazione</TableHead>
                      <TableHead>Scaduto il</TableHead>
                      <TableHead>Dati fino al</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiredAccounts.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell className="text-muted-foreground">{user.username}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">{user.organization || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(user.demoExpiresAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(user.dataRetentionUntil)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleExtendDemoClick(user)}
                          >
                            {t("demoAccounts.reactivate")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Nessun account demo scaduto
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog per creare un nuovo account demo */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{t("demoAccounts.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("demoAccounts.createDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateDemoSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("username")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("demoAccounts.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={createForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo (opzionale)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizzazione (opzionale)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Professione (opzionale)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={createForm.control}
                name="durationDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("demoAccounts.duration")}</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="365" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit"
                  disabled={createDemoMutation.isPending}
                >
                  {createDemoMutation.isPending ? "Creazione..." : "Crea Account Demo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog per estendere un account demo */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("demoAccounts.extendTitle")}</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Estendi l'account demo <strong>{selectedUser.username}</strong>
                  {selectedUser.isActive === false && " (riattivazione)"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...extendForm}>
            <form onSubmit={extendForm.handleSubmit(handleExtendDemoSubmit)} className="space-y-4">
              <FormField
                control={extendForm.control}
                name="additionalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("demoAccounts.additionalDays")}</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="365" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setExtendDialogOpen(false)}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit"
                  disabled={extendDemoMutation.isPending}
                >
                  {extendDemoMutation.isPending ? "Estensione..." : (selectedUser?.isActive ? "Estendi" : "Riattiva")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoAccountsManagement;