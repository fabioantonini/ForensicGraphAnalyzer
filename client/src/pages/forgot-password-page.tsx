import { useState } from "react";
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
import { Link } from "wouter";

const forgotPasswordSchema = z.object({
  email: z.string().email("Inserisci un indirizzo email valido"),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/forgot-password", data);
      setIsSubmitted(true);
      toast({
        title: t("auth.resetPasswordEmailSent", "Email inviata"),
        description: t(
          "auth.resetPasswordEmailSentDesc",
          "Se l'indirizzo email è registrato, riceverai a breve un link per reimpostare la password."
        ),
        variant: "default",
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      toast({
        title: t("errors.errorOccurred", "Si è verificato un errore"),
        description: t(
          "errors.tryAgainLater",
          "Si è verificato un errore. Riprova più tardi."
        ),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              {t("auth.forgotPassword", "Password dimenticata?")}
            </h2>
            
            {!isSubmitted ? (
              <>
                <p className="text-sm text-gray-600 mb-6">
                  {t(
                    "auth.forgotPasswordInstructions",
                    "Inserisci l'indirizzo email associato al tuo account. Ti invieremo un link per reimpostare la password."
                  )}
                </p>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email", "Indirizzo Email")}</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder={t(
                                "auth.enterEmail",
                                "Inserisci il tuo indirizzo email"
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
                      {t("auth.sendResetLink", "Invia link di reset")}
                    </Button>
                  </form>
                </Form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="bg-green-100 text-green-800 p-4 rounded-md mb-6">
                  <p className="font-medium">
                    {t("auth.checkYourEmail", "Controlla la tua email")}
                  </p>
                  <p className="text-sm mt-1">
                    {t(
                      "auth.resetLinkSent",
                      "Se l'indirizzo fornito è associato a un account, riceverai un link per reimpostare la password."
                    )}
                  </p>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {t(
                    "auth.noEmailReceived",
                    "Non hai ricevuto l'email? Controlla la cartella spam o"
                  )}{" "}
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="text-primary hover:text-primary-dark underline"
                  >
                    {t("auth.tryAgain", "riprova")}
                  </button>
                  .
                </p>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t("auth.backToLogin", "Torna al")}
                {" "}
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
              {t('auth.recoveryMessage', 'Il sistema di recupero password ti permette di ripristinare l\'accesso al tuo account in modo sicuro.')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.features.checkEmail', 'Controlla la tua Email')}</h3>
                <p className="text-sm opacity-90">{t('auth.features.checkEmailDesc', 'Riceverai un link sicuro per reimpostare la password')}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v-1l1-1 1-1-1.257-.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.features.createNewPassword', 'Crea una Nuova Password')}</h3>
                <p className="text-sm opacity-90">{t('auth.features.newPasswordDesc', 'Scegli una password sicura per proteggere il tuo account')}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('auth.features.secureAccess', 'Accesso Sicuro')}</h3>
                <p className="text-sm opacity-90">{t('auth.features.secureDesc', 'Accedi nuovamente alla piattaforma in tutta sicurezza')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}