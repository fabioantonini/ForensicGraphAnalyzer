import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, RefreshCw, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

// Tipi per le raccomandazioni
interface Recommendation {
  id: number;
  title: string;
  content: string;
  category: string;
  relevanceScore: number;
  viewed: boolean;
  dismissed: boolean;
  createdAt: string;
}

export function RecommendationsPanel() {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();
  
  // Traduzioni dirette
  const translations = {
    title: "Suggerimenti Personalizzati",
    noRecommendations: "Nessun suggerimento personalizzato disponibile. Generane alcuni per iniziare!",
    loadError: "Si è verificato un errore durante il caricamento dei suggerimenti.",
    refresh: "Aggiorna",
    generate: "Genera Suggerimenti",
    markViewed: "Segna come visualizzato",
    dismiss: "Ignora"
  };

  // Recupera le raccomandazioni non visualizzate e non rifiutate
  const { data: recommendations, isLoading, isError } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
    staleTime: 5 * 60 * 1000, // 5 minuti
  });

  // Mutazione per contrassegnare una raccomandazione come visualizzata
  const viewMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/recommendations/${id}`, "PATCH", {
        viewed: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  // Mutazione per contrassegnare una raccomandazione come rifiutata
  const dismissMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/recommendations/${id}`, "PATCH", {
        dismissed: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  // Mutazione per generare nuove raccomandazioni
  const generateMutation = useMutation({
    mutationFn: () => 
      apiRequest("/api/recommendations/generate", "POST", {
        count: 3
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      toast({
        title: t("recommendations.generated"),
        description: t("recommendations.generatedSuccess"),
      });
      setIsGenerating(false);
    },
    onError: () => {
      toast({
        title: t("recommendations.error"),
        description: t("recommendations.generationError"),
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  // Gestione del click sul pulsante di generazione
  const handleGenerateClick = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  // Ottiene il colore del badge in base alla categoria
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'document':
        return "bg-blue-100 text-blue-800";
      case 'signature':
        return "bg-green-100 text-green-800";
      case 'workflow':
        return "bg-purple-100 text-purple-800";
      case 'learning':
        return "bg-amber-100 text-amber-800";
      case 'tool':
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Traduce la categoria
  const translateCategory = (category: string) => {
    return t(`recommendations.categories.${category.toLowerCase()}`);
  };

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>{translations.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <LoadingSpinner text="Caricamento..." />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>{translations.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            {translations.loadError}
          </p>
          <div className="flex justify-center mt-4">
            <Button onClick={handleGenerateClick} disabled={isGenerating}>
              {isGenerating ? <LoadingSpinner size="sm" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {translations.refresh}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se non ci sono raccomandazioni, mostra un messaggio
  if (!recommendations || recommendations.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>{t("recommendations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            {t("recommendations.noRecommendations")}
          </p>
          <div className="flex justify-center mt-4">
            <Button onClick={handleGenerateClick} disabled={isGenerating}>
              {isGenerating ? <LoadingSpinner size="sm" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t("recommendations.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("recommendations.title")}</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleGenerateClick} 
          disabled={isGenerating}
        >
          {isGenerating ? (
            <LoadingSpinner size="sm" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t("recommendations.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((recommendation) => (
            <div 
              key={recommendation.id} 
              className="bg-background border rounded-lg p-4 relative"
              data-tour="recommendation-item"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{recommendation.title}</h3>
                  <Badge className={`mt-1 ${getCategoryColor(recommendation.category)}`}>
                    {translateCategory(recommendation.category)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => viewMutation.mutate(recommendation.id)}
                    disabled={viewMutation.isPending}
                    title={t("recommendations.markViewed")}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => dismissMutation.mutate(recommendation.id)}
                    disabled={dismissMutation.isPending}
                    title={t("recommendations.dismiss")}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{recommendation.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}