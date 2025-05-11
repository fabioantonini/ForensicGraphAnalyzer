import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Mail, CheckCircle, XCircle } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Interfaccia per la configurazione email
interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string | null;
  isConfigured: boolean;
}

// Schema per la validazione del form
const emailConfigSchema = z.object({
  smtpHost: z.string().min(1, "L'host SMTP è obbligatorio"),
  smtpPort: z.coerce.number().min(1, "La porta deve essere un numero valido"),
  smtpSecure: z.boolean(),
  smtpUser: z.string().min(1, "L'username è obbligatorio"),
  smtpPassword: z.string().min(1, "La password è obbligatoria"),
});

type EmailConfigFormData = z.infer<typeof emailConfigSchema>;

export default function EmailConfiguration() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showTestSuccessDialog, setShowTestSuccessDialog] = useState(false);
  const [showTestErrorDialog, setShowTestErrorDialog] = useState(false);
  const [testErrorMessage, setTestErrorMessage] = useState("");

  // Fetch configurazione email
  const { data: emailConfig, isLoading } = useQuery<EmailConfig>({
    queryKey: ["/api/admin/email-config"],
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form per la configurazione
  const form = useForm<EmailConfigFormData>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "",
      smtpPassword: "",
    },
  });

  // Aggiorna i valori del form quando i dati vengono caricati
  React.useEffect(() => {
    if (emailConfig) {
      form.reset({
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort,
        smtpSecure: emailConfig.smtpSecure,
        smtpUser: emailConfig.smtpUser,
        smtpPassword: ""  // Non mostriamo la password salvata per sicurezza
      });
    }
  }, [emailConfig, form]);

  // Mutation per salvare la configurazione
  const saveConfigMutation = useMutation({
    mutationFn: async (data: EmailConfigFormData) => {
      const res = await apiRequest("POST", "/api/admin/email-config", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("admin.emailConfig.saveSuccess", "Configurazione salvata"),
        description: t("admin.emailConfig.saveSuccessDesc", "La configurazione email è stata salvata con successo"),
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-config"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per testare la configurazione email
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      setIsTestingEmail(true);
      const res = await apiRequest("POST", "/api/admin/test-email", {});
      return await res.json();
    },
    onSuccess: () => {
      setIsTestingEmail(false);
      setShowTestSuccessDialog(true);
    },
    onError: (error: Error) => {
      setIsTestingEmail(false);
      setTestErrorMessage(error.message);
      setShowTestErrorDialog(true);
    },
  });

  const onSubmit = (data: EmailConfigFormData) => {
    saveConfigMutation.mutate(data);
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.emailConfig.title", "Configurazione Email")}</CardTitle>
          <CardDescription>
            {t("admin.emailConfig.description", "Configura il server SMTP per l'invio di email di recupero password e notifiche")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-6 p-4 rounded-md bg-muted">
                <div className="shrink-0">
                  {emailConfig?.isConfigured ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">
                    {emailConfig?.isConfigured
                      ? t("admin.emailConfig.configured", "Email configurata")
                      : t("admin.emailConfig.notConfigured", "Email non configurata")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {emailConfig?.isConfigured
                      ? t("admin.emailConfig.configuredDesc", "Il server è configurato correttamente e può inviare email")
                      : t("admin.emailConfig.notConfiguredDesc", "Configura le impostazioni SMTP per abilitare l'invio di email")}
                  </p>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.emailConfig.smtpHost", "Host SMTP")}</FormLabel>
                          <FormControl>
                            <Input placeholder="smtp.gmail.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.emailConfig.smtpPort", "Porta SMTP")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="587"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="smtpSecure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="smtpSecure"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel htmlFor="smtpSecure">
                            {t("admin.emailConfig.useSecureConnection", "Usa connessione sicura (SSL/TLS)")}
                          </FormLabel>
                          <FormDescription>
                            {t("admin.emailConfig.useSecureConnectionDesc", "Attiva questa opzione se il tuo provider richiede SSL/TLS (solitamente sulla porta 465)")}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtpUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.emailConfig.smtpUser", "Username")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="nome@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="smtpPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.emailConfig.smtpPassword", "Password")}</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={emailConfig?.smtpPassword ? "••••••••" : t("admin.emailConfig.enterPassword", "Inserisci la password")}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {emailConfig?.smtpPassword && t("admin.emailConfig.leaveBlankToKeep", "Lascia vuoto per mantenere la password attuale")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testEmailMutation.mutate()}
                      disabled={
                        isTestingEmail ||
                        !emailConfig?.isConfigured ||
                        saveConfigMutation.isPending
                      }
                    >
                      {isTestingEmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {t("admin.emailConfig.testEmail", "Testa Email")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={saveConfigMutation.isPending}
                    >
                      {saveConfigMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      {t("admin.emailConfig.saveConfig", "Salva Configurazione")}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p>
            {t("admin.emailConfig.howToUseDesc", "La configurazione email è necessaria per il recupero password e altre notifiche. Assicurati di utilizzare un provider che consenta l'invio da applicazioni.")}
          </p>
        </CardFooter>
      </Card>

      {/* Dialog per test email riuscito */}
      <AlertDialog open={showTestSuccessDialog} onOpenChange={setShowTestSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.emailConfig.testSuccess", "Test email inviato con successo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.emailConfig.testSuccessDesc", "L'email di test è stata inviata correttamente. Controlla la casella email dell'amministratore.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>{t("common.close")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog per errore test email */}
      <AlertDialog open={showTestErrorDialog} onOpenChange={setShowTestErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.emailConfig.testError", "Errore nell'invio dell'email")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.emailConfig.testErrorDesc", "Si è verificato un errore durante l'invio dell'email di test:")}
              <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive">
                {testErrorMessage}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>{t("common.close")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}