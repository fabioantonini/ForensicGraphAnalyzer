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
import { AlertCircle } from "lucide-react";

// Schema di validazione per la creazione di un account demo
const demoAccountSchema = z.object({
  username: z.string().min(3, "Username deve essere di almeno 3 caratteri"),
  password: z.string().min(6, "Password deve essere di almeno 6 caratteri"),
  confirmPassword: z.string(),
  email: z.string().email("Email non valida"),
  fullName: z.string().optional(),
  organization: z.string().optional(),
  profession: z.string().optional(),
  durationDays: z.number().min(1).max(365)
}).refine(data => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"]
});

// Schema di validazione per l'estensione di un account demo
const extendDemoSchema = z.object({
  userId: z.number().positive(),
  additionalDays: z.number().min(1).max(365)
});

type DemoAccountFormValues = z.infer<typeof demoAccountSchema>;
type ExtendDemoFormValues = z.infer<typeof extendDemoSchema>;

export function DemoAccountsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form per la creazione di account demo
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
  
  // Form per l'estensione di account demo
  const extendForm = useForm<ExtendDemoFormValues>({
    resolver: zodResolver(extendDemoSchema),
    defaultValues: {
      userId: 0,
      additionalDays: 7
    }
  });
  
  // Query per ottenere tutti gli utenti
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    throwOnError: false
  });
  
  // Query per ottenere le statistiche del sistema (inclusi gli account demo in scadenza)
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    throwOnError: false
  });
  
  // Mutation per creare un account demo
  const createDemoMutation = useMutation({
    mutationFn: async (data: DemoAccountFormValues) => {
      const res = await apiRequest("POST", "/api/admin/demo-account", data);
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
  
  // Mutation per la manutenzione degli account demo (disattivazione account scaduti)
  const maintenanceMutation = useMutation({
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
        title: "Manutenzione account demo completata",
        description: `${data.deactivatedAccounts} account disattivati, ${data.purgeReadyAccounts} pronti per la purga`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Submit handler per la creazione di account demo
  function onCreateSubmit(data: DemoAccountFormValues) {
    createDemoMutation.mutate(data);
  }
  
  // Submit handler per l'estensione di account demo
  function onExtendSubmit(data: ExtendDemoFormValues) {
    extendDemoMutation.mutate(data);
  }
  
  // Handler per aprire il form di estensione per un utente specifico
  function handleExtendClick(user: User) {
    setSelectedUser(user);
    extendForm.setValue("userId", user.id);
    setExtendDialogOpen(true);
  }
  
  // Filtra gli account demo attivi
  const demoAccounts = users?.filter(user => 
    user.accountType === 'demo' && user.isActive === true) || [];
  
  // Filtra gli account demo scaduti o disattivati
  const expiredAccounts = users?.filter(user => 
    user.accountType === 'demo' && (user.isActive === false || new Date(user.demoExpiresAt as Date) < new Date())) || [];
  
  // Accedi agli account in scadenza dalle statistiche
  const expiringAccounts = stats?.expiringDemoAccounts || [];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{t("admin.demoAccounts.title")}</h2>
        <div className="space-x-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            {t("admin.demoAccounts.createNew")}
          </Button>
          <Button variant="outline" onClick={() => maintenanceMutation.mutate()}>
            {t("admin.demoAccounts.maintenance")}
          </Button>
        </div>
      </div>
      
      {/* Account demo in scadenza */}
      {expiringAccounts.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle>{t("admin.demoAccounts.expiringAlert")}</AlertTitle>
          <AlertDescription>
            {expiringAccounts.length} account demo scadranno nei prossimi 7 giorni.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Account demo attivi */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.demoAccounts.activeAccounts")}</CardTitle>
          <CardDescription>
            {t("admin.demoAccounts.activeDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demoAccounts.length === 0 ? (
            <p className="text-gray-500 italic">{t("admin.demoAccounts.noActiveAccounts")}</p>
          ) : (
            <div className="space-y-4">
              {demoAccounts.map(user => (
                <div key={user.id} className="border rounded-md p-4 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.username}</span>
                      <Badge variant="outline">{user.email}</Badge>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {user.fullName && <span className="mr-2">{user.fullName}</span>}
                      {user.organization && <span className="mr-2">({user.organization})</span>}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="mr-2">
                        Scade il: {format(new Date(user.demoExpiresAt as Date), 'dd/MM/yyyy')}
                      </span>
                      <Badge variant={
                        differenceInDays(new Date(user.demoExpiresAt as Date), new Date()) < 3 
                          ? "destructive" 
                          : differenceInDays(new Date(user.demoExpiresAt as Date), new Date()) < 7 
                            ? "outline" 
                            : "secondary"
                      }>
                        {differenceInDays(new Date(user.demoExpiresAt as Date), new Date())} giorni rimasti
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => handleExtendClick(user)}>
                    {t("admin.demoAccounts.extend")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Account demo scaduti o disattivati */}
      {expiredAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.demoAccounts.expiredAccounts")}</CardTitle>
            <CardDescription>
              {t("admin.demoAccounts.expiredDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiredAccounts.map(user => (
                <div key={user.id} className="border rounded-md p-4 flex justify-between items-center opacity-70">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.username}</span>
                      <Badge variant="outline">{user.email}</Badge>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {user.fullName && <span className="mr-2">{user.fullName}</span>}
                      {user.organization && <span className="mr-2">({user.organization})</span>}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="mr-2">
                        Scaduto il: {format(new Date(user.demoExpiresAt as Date), 'dd/MM/yyyy')}
                      </span>
                      <Badge variant="destructive">
                        Eliminazione dati: {format(new Date(user.dataRetentionUntil as Date), 'dd/MM/yyyy')}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => handleExtendClick(user)}>
                    {t("admin.demoAccounts.reactivate")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Dialog per la creazione di account demo */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("admin.demoAccounts.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.demoAccounts.createDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.username")}</FormLabel>
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
                      <FormLabel>{t("auth.email")}</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
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
                      <FormLabel>{t("auth.password")}</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
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
                      <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.fullName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.organization")}</FormLabel>
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
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.profession")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="durationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.demoAccounts.duration")}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min={1} 
                          max={365}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createDemoMutation.isPending}
                >
                  {createDemoMutation.isPending ? "Creazione..." : t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog per l'estensione di un account demo */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("admin.demoAccounts.extendTitle")}</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Estendi l'account demo per <strong>{selectedUser.username}</strong>
                  {selectedUser.demoExpiresAt && (
                    <>
                      <br />
                      Scadenza attuale: {format(new Date(selectedUser.demoExpiresAt), 'dd/MM/yyyy')}
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...extendForm}>
            <form onSubmit={extendForm.handleSubmit(onExtendSubmit)} className="space-y-4">
              <FormField
                control={extendForm.control}
                name="additionalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.demoAccounts.additionalDays")}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min={1} 
                        max={365}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={extendDemoMutation.isPending}
                >
                  {extendDemoMutation.isPending ? "Estensione..." : t("admin.demoAccounts.extend")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}