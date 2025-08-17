import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { Loader2, Mail, Send, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GmailConfig {
  email: string;
  appPassword: string;
  isConfigured: boolean;
}

interface GmailTestResult {
  success: boolean;
  message: string;
}

export function GmailConfiguration() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  // Fetch configurazione Gmail corrente
  const { data: config, isLoading: isLoadingConfig, refetch } = useQuery<GmailConfig>({
    queryKey: ["/api/admin/gmail-config"]
  });

  // Aggiorna lo stato quando i dati sono disponibili
  React.useEffect(() => {
    if (config) {
      setEmail(config.email || "");
      setAppPassword(config.appPassword || "");
      setIsConfigured(config.isConfigured || false);
      setHasChanged(false);
    }
  }, [config]);

  // Mutation per salvare la configurazione Gmail
  const saveConfigMutation = useMutation({
    mutationFn: async (configData: GmailConfig) => {
      const res = await apiRequest("POST", "/api/admin/gmail-config", configData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Successo",
        description: data.message || "Configurazione Gmail salvata con successo",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gmail-config"] });
      setHasChanged(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Errore nel salvataggio della configurazione Gmail: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation per testare la configurazione Gmail
  const testConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/test-gmail", {});
      return await res.json();
    },
    onSuccess: (data: GmailTestResult) => {
      toast({
        title: "Test completato",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nel test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const configData: GmailConfig = {
      email: email.trim(),
      appPassword: appPassword.trim(),
      isConfigured,
    };

    saveConfigMutation.mutate(configData);
  };

  const handleTest = () => {
    if (!isConfigured) {
      toast({
        title: "Gmail non configurato",
        description: "Configura e salva prima di testare",
        variant: "destructive",
      });
      return;
    }
    testConfigMutation.mutate();
  };

  const handleInputChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHasChanged(true);
  };

  const handleToggleChange = (checked: boolean) => {
    setIsConfigured(checked);
    setHasChanged(true);
  };

  if (isLoadingConfig) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Configurazione Gmail SMTP
        </CardTitle>
        <CardDescription>
          Configura Gmail SMTP per l'invio automatico delle email di reset password e notifiche.
          Gratuito fino a 500 email al giorno.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informazioni importanti */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Setup Gmail dedicato (consigliato):</strong>
            <br />• Crea nuovo Gmail: grapholexinsight@gmail.com
            <br />• Vai su Google Account → Sicurezza
            <br />• Attiva la verifica in 2 passaggi 
            <br />• Genera "Password per app" per "GrapholexInsight"
            <br />• Configura nome visualizzato professionale
          </AlertDescription>
        </Alert>

        {/* Switch per abilitare/disabilitare */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Abilita Gmail SMTP</Label>
            <div className="text-sm text-muted-foreground">
              Attiva l'invio email automatico tramite Gmail
            </div>
          </div>
          <Switch
            checked={isConfigured}
            onCheckedChange={handleToggleChange}
          />
        </div>

        {/* Configurazione email e password */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gmail-email">Email Gmail</Label>
            <Input
              id="gmail-email"
              type="email"
              placeholder="grapholexinsight@gmail.com"
              value={email}
              onChange={(e) => handleInputChange(setEmail)(e.target.value)}
              disabled={!isConfigured}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmail-password">Password App Gmail</Label>
            <Input
              id="gmail-password"
              type="password"
              placeholder="abcd efgh ijkl mnop"
              value={appPassword}
              onChange={(e) => handleInputChange(setAppPassword)(e.target.value)}
              disabled={!isConfigured}
            />
            <div className="text-xs text-muted-foreground">
              Password di 16 caratteri generata nelle impostazioni Google
              <br />
              <strong>Consiglio:</strong> Usa un Gmail dedicato (es: grapholexinsight@gmail.com) 
              invece del tuo account personale per maggiore professionalità
            </div>
          </div>
        </div>

        {/* Stato configurazione */}
        <div className="flex items-center gap-2">
          {config?.isConfigured ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">
                Gmail SMTP configurato e attivo
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-600 font-medium">
                Gmail SMTP non configurato
              </span>
            </>
          )}
        </div>

        {/* Pulsanti azione */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={!hasChanged || saveConfigMutation.isPending}
            className="flex-1"
          >
            {saveConfigMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salva Configurazione
          </Button>

          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!config?.isConfigured || testConfigMutation.isPending}
            className="flex-1"
          >
            {testConfigMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Test Email
          </Button>
        </div>

        {/* Vantaggi Gmail */}
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Vantaggi Gmail SMTP:</strong>
            <br />✅ Completamente gratuito (500 email/giorno)
            <br />✅ Nessun account trial da rinnovare
            <br />✅ Affidabilità Google garantita
            <br />✅ Configurazione semplice con App Password
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}