import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "wouter";

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, "La password deve essere di almeno 6 caratteri"),
    confirmPassword: z.string().min(6, "La password deve essere di almeno 6 caratteri"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Le password non corrispondono",
    path: ["confirmPassword"],
  });

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isTokenChecking, setIsTokenChecking] = useState(true);
  const [isResetSuccessful, setIsResetSuccessful] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    // Verifica la validità del token
    const verifyToken = async () => {
      try {
        setIsTokenChecking(true);
        const response = await apiRequest("GET", `/api/verify-reset-token/${token}`);
        const data = await response.json();
        setIsTokenValid(data.valid);
      } catch (error) {
        console.error("Error verifying token:", error);
        setIsTokenValid(false);
      } finally {
        setIsTokenChecking(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setIsTokenValid(false);
      setIsTokenChecking(false);
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordData) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/reset-password", {
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      
      setIsResetSuccessful(true);
      toast({
        title: t("auth.passwordResetSuccess", "Password reimpostata"),
        description: t(
          "auth.passwordResetSuccessDesc",
          "La tua password è stata reimpostata con successo. Ora puoi accedere con la nuova password."
        ),
        variant: "default",
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({
        title: t("errors.errorOccurred", "Si è verificato un errore"),
        description: t(
          "errors.resetPasswordFailed",
          "Non è stato possibile reimpostare la password. Il token potrebbe essere scaduto."
        ),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isTokenChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-neutral">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <p className="mt-4 text-gray-600">{t("common.loading", "Caricamento...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex md:items-center justify-center p-4 bg-neutral">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 md:gap-0">
        {/* Form */}
        <Card className="bg-white rounded-lg shadow-xl w-full overflow-hidden">
          <div className="bg-primary p-6 flex justify-between items-center">
            <h1 className="text-white text-2xl font-bold">{t('layout.appName', 'Grapholex Insight')}</h1>
            <div className="flex items-center">
              <div className="text-white text-sm mr-3">{t('layout.appDescription', 'Forensic Graphology')}</div>
              <LanguageSwitcher />
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-medium text-primary mb-6">
              {t("auth.resetPassword", "Reimposta Password")}
            </h2>

            {!isTokenValid && !isResetSuccessful ? (
              <div className="text-center py-8">
                <div className="bg-red-100 text-red-800 p-4 rounded-md mb-6">
                  <p className="font-medium">
                    {t("auth.invalidToken", "Token non valido o scaduto")}
                  </p>
                  <p className="text-sm mt-1">
                    {t(
                      "auth.requestNewLink",
                      "Il link di reset della password non è valido o è scaduto. Richiedi un nuovo link."
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/forgot-password")}
                  className="mt-4"
                >
                  {t("auth.requestNewResetLink", "Richiedi un nuovo link")}
                </Button>
              </div>
            ) : isResetSuccessful ? (
              <div className="text-center py-8">
                <div className="bg-green-100 text-green-800 p-4 rounded-md mb-6">
                  <p className="font-medium">
                    {t("auth.passwordResetSuccess", "Password reimpostata con successo")}
                  </p>
                  <p className="text-sm mt-1">
                    {t(
                      "auth.canLoginNow",
                      "La tua password è stata reimpostata. Ora puoi accedere con la nuova password."
                    )}
                  </p>
                </div>
                <Button onClick={() => navigate("/auth")} className="mt-4">
                  {t("auth.proceedToLogin", "Vai al login")}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-6">
                  {t(
                    "auth.createNewPasswordInstructions",
                    "Inserisci e conferma la tua nuova password."
                  )}
                </p>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("auth.newPassword", "Nuova Password")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={t(
                                "auth.enterNewPassword",
                                "Inserisci la nuova password"
                              )}
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
                          <FormLabel>
                            {t("auth.confirmPassword", "Conferma Password")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={t(
                                "auth.confirmNewPassword",
                                "Conferma la nuova password"
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : null}
                      {t("auth.resetPassword", "Reimposta Password")}
                    </Button>
                  </form>
                </Form>
              </>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t("auth.backToLogin", "Torna al")}{" "}
                <Link
                  href="/auth"
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  {t("auth.login", "Login")}
                </Link>
              </p>
            </div>
          </div>
        </Card>

        {/* Info Panel */}
        <div className="hidden md:flex flex-col justify-center bg-primary-dark p-8 rounded-r-lg text-white space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">{t('auth.passwordRecovery', 'Recupero Password')}</h2>
            <p className="opacity-90">
              {t('auth.recoverySecurityMessage', 'Completa il processo di recupero impostando una nuova password sicura per proteggere il tuo account.')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.features.strongPassword', 'Password Robusta')}</h3>
                <p className="text-sm opacity-90">{t('auth.features.strongPasswordDesc', 'Utilizza una password complessa con almeno 6 caratteri')}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.features.secureAccount', 'Account Sicuro')}</h3>
                <p className="text-sm opacity-90">{t('auth.features.secureAccountDesc', 'La nuova password protegge i tuoi dati grafologici')}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.features.immediateAccess', 'Accesso Immediato')}</h3>
                <p className="text-sm opacity-90">{t('auth.features.immediateAccessDesc', 'Accedi subito a tutti i tuoi progetti e documenti')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}