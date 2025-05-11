import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link, useRoute } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, { message: "La password deve essere di almeno 8 caratteri" }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { t } = useTranslation(['common']);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [token, setToken] = useState("");
  const [, setLocation] = useLocation();
  
  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Estrai il token dall'URL al caricamento della pagina
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    
    if (!tokenParam) {
      setIsLoading(false);
      setErrorMessage(t('common:resetPassword.noToken'));
      return;
    }
    
    setToken(tokenParam);
    
    // Verifica la validità del token
    const verifyToken = async () => {
      try {
        const response = await apiRequest("GET", `/api/verify-reset-token?token=${tokenParam}`);
        const result = await response.json();
        
        if (response.ok && result.valid) {
          setIsValidToken(true);
        } else {
          setErrorMessage(result.message || t('common:resetPassword.invalidToken'));
        }
      } catch (error: any) {
        setErrorMessage(error.message || t('common:errors.requestFailed'));
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyToken();
  }, [t]);
  
  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest("POST", "/api/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setIsCompleted(true);
        
        // Dopo 3 secondi, reindirizza alla pagina di login
        setTimeout(() => {
          setLocation("/auth");
        }, 3000);
      } else {
        throw new Error(result.message || t('common:errors.requestFailed'));
      }
    } catch (error: any) {
      toast({
        title: t('common:errors.error'),
        description: error.message || t('common:errors.requestFailed'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Mostra il loader durante la verifica del token
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>{t('common:resetPassword.verifying')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Mostra un messaggio di errore se il token non è valido
  if (!isValidToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">{t('common:resetPassword.invalidTokenTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage || t('common:resetPassword.invalidToken')}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="link" asChild>
              <Link href="/forgot-password">{t('common:resetPassword.tryAgain')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Mostra un messaggio di successo se la password è stata reimpostata
  if (isCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">{t('common:resetPassword.successTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle className="text-green-800">{t('common:resetPassword.successTitle')}</AlertTitle>
              <AlertDescription className="text-green-700">
                {t('common:resetPassword.successDescription')}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="link" asChild>
              <Link href="/auth">{t('common:resetPassword.goToLogin')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Mostra il form per reimpostare la password se il token è valido
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t('common:resetPassword.title')}</CardTitle>
          <CardDescription>
            {t('common:resetPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common:resetPassword.newPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common:resetPassword.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common:resetPassword.resetting')}
                  </>
                ) : (
                  t('common:resetPassword.reset')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" asChild>
            <Link href="/auth">{t('common:resetPassword.cancel')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}