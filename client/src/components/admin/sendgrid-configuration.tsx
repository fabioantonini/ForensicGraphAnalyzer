import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

// Definizione dello schema per la configurazione SendGrid
const sendgridConfigSchema = z.object({
  apiKey: z.string().min(1, { message: "La API key è obbligatoria" }),
  senderEmail: z.string().email({ message: "Inserisci un indirizzo email valido" }),
  isConfigured: z.boolean().optional(),
});

type SendGridConfig = z.infer<typeof sendgridConfigSchema>;

export function SendGridConfiguration() {
  const { t } = useTranslation(["admin", "common"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Query per ottenere la configurazione attuale
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/admin/sendgrid-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/sendgrid-config");
      return await res.json();
    },
  });

  // Form per la configurazione SendGrid
  const form = useForm<SendGridConfig>({
    resolver: zodResolver(sendgridConfigSchema),
    defaultValues: {
      apiKey: "",
      senderEmail: "noreply@mail.sendgrid.net",
      isConfigured: false,
    },
  });

  // Aggiorna i valori del form quando i dati sono disponibili
  React.useEffect(() => {
    if (config) {
      form.reset({
        apiKey: config.apiKey === "********" ? "" : config.apiKey || "",
        senderEmail: config.senderEmail || "",
        isConfigured: config.isConfigured || false,
      });
    }
  }, [config, form]);

  // Mutation per salvare la configurazione
  const saveMutation = useMutation({
    mutationFn: async (data: SendGridConfig) => {
      // Se apiKey è vuota ma config.apiKey è mascherato, non aggiorniamo la chiave
      if (!data.apiKey && config && config.apiKey === "********") {
        data.apiKey = "********";
      }
      
      const res = await apiRequest("POST", "/api/admin/sendgrid-config", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sendgrid-config"] });
      toast({
        title: t("admin:sendgrid.toast.success"),
        description: data.message || t("admin:sendgrid.toast.configUpdated"),
      });
    },
    onError: (error) => {
      toast({
        title: t("admin:sendgrid.toast.error"),
        description: error.message || t("admin:sendgrid.toast.configUpdateFailed"),
        variant: "destructive",
      });
    },
  });

  // Funzione per inviare il form
  const onSubmit = (data: SendGridConfig) => {
    saveMutation.mutate(data);
  };

  // Mutation per testare la configurazione
  const testConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/test-sendgrid");
      return await res.json();
    },
    onSuccess: () => {
      setTestStatus("success");
      toast({
        title: t("admin:sendgrid.toast.testSuccess"),
        description: t("admin:sendgrid.toast.testEmailSent"),
      });
    },
    onError: () => {
      setTestStatus("error");
      toast({
        title: t("admin:sendgrid.toast.testError"),
        description: t("admin:sendgrid.toast.testEmailFailed"),
        variant: "destructive",
      });
    },
  });

  // Funzione per testare la configurazione
  const testConfiguration = () => {
    setTestStatus("loading");
    testConfigMutation.mutate();
  };

  // Se i dati sono in caricamento, mostra un loader
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin:sendgrid.title")}</CardTitle>
          <CardDescription>{t("admin:sendgrid.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin:sendgrid.title")}</CardTitle>
        <CardDescription>{t("admin:sendgrid.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {config?.isConfigured && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>{t("admin:sendgrid.alert.configured.title")}</AlertTitle>
            <AlertDescription>
              {t("admin:sendgrid.alert.configured.description")}
            </AlertDescription>
          </Alert>
        )}

        {!config?.isConfigured && (
          <Alert className="mb-4" variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("admin:sendgrid.alert.notConfigured.title")}</AlertTitle>
            <AlertDescription>
              {t("admin:sendgrid.alert.notConfigured.description")}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin:sendgrid.form.apiKey.label")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={
                        config?.apiKey === "********"
                          ? "********"
                          : t("admin:sendgrid.form.apiKey.placeholder")
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("admin:sendgrid.form.apiKey.description")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senderEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin:sendgrid.form.senderEmail.label")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="noreply@mail.sendgrid.net"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("admin:sendgrid.form.senderEmail.description")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={!config?.isConfigured || testStatus === "loading"}
                onClick={testConfiguration}
              >
                {testStatus === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("admin:sendgrid.testButton.loading")}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t("admin:sendgrid.testButton.default")}
                  </>
                )}
              </Button>

              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common:saving")}
                  </>
                ) : (
                  t("common:save")
                )}
              </Button>
            </div>

            {testStatus === "success" && (
              <Alert variant="success" className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>{t("admin:sendgrid.testResult.success.title")}</AlertTitle>
                <AlertDescription>
                  {t("admin:sendgrid.testResult.success.description")}
                </AlertDescription>
              </Alert>
            )}

            {testStatus === "error" && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("admin:sendgrid.testResult.error.title")}</AlertTitle>
                <AlertDescription>
                  {t("admin:sendgrid.testResult.error.description")}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-start border-t px-6 py-4">
        <h3 className="text-sm font-medium">{t("admin:sendgrid.info.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("admin:sendgrid.info.description")}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {t("admin:sendgrid.info.domainWarning")}
        </p>
        <a
          href="https://sendgrid.com/free/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline mt-1"
        >
          {t("admin:sendgrid.info.link")}
        </a>
      </CardFooter>
    </Card>
  );
}