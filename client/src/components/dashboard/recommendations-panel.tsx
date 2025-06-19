import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, RefreshCw, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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
  const { t, i18n } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();
  
  // Multilingual translations
  const translations = {
    title: i18n.language === 'en' ? 'Personalized Insights' : 'Suggerimenti Personalizzati',
    noRecommendations: i18n.language === 'en' 
      ? 'No personalized insights available yet. Generate some to get started!' 
      : 'Nessun suggerimento personalizzato disponibile. Generane alcuni per iniziare!',
    loadError: i18n.language === 'en' 
      ? 'There was an error loading your insights.' 
      : 'Si è verificato un errore durante il caricamento dei suggerimenti.',
    refresh: i18n.language === 'en' ? 'Refresh' : 'Aggiorna',
    generate: i18n.language === 'en' ? 'Generate Insights' : 'Genera Suggerimenti',
    markViewed: i18n.language === 'en' ? 'Mark as viewed' : 'Segna come visualizzato',
    dismiss: i18n.language === 'en' ? 'Dismiss' : 'Ignora',
    generated: i18n.language === 'en' ? 'Insights Generated' : 'Suggerimenti Generati',
    generatedSuccess: i18n.language === 'en' 
      ? 'New insights have been generated based on your activity.' 
      : 'Nuovi suggerimenti sono stati generati in base alla tua attività.',
    error: i18n.language === 'en' ? 'Error' : 'Errore',
    generationError: i18n.language === 'en' 
      ? 'There was an error generating your insights. Please try again later.' 
      : 'Si è verificato un errore durante la generazione dei suggerimenti. Riprova più tardi.'
  };

  // Recupera le raccomandazioni non visualizzate e non rifiutate
  const { data: recommendations, isLoading, isError, refetch } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
    staleTime: 5 * 60 * 1000, // 5 minuti
  });
  
  // Reazione al cambio di lingua e all'aggiornamento delle raccomandazioni
  useEffect(() => {
    // Forza il refresh delle raccomandazioni quando la lingua cambia
    refetch();
  }, [i18n.language, refetch]);

  // Mutazione per contrassegnare una raccomandazione come visualizzata
  const viewMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("PATCH", `/api/recommendations/${id}`, {
        viewed: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  // Mutazione per contrassegnare una raccomandazione come rifiutata
  const dismissMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("PATCH", `/api/recommendations/${id}`, {
        dismissed: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  // Mutazione per generare nuove raccomandazioni
  const generateMutation = useMutation({
    mutationFn: () => 
      apiRequest("POST", "/api/recommendations/generate", {
        count: 3,
        locale: i18n.language // Passa la lingua attuale all'API
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      toast({
        title: translations.generated,
        description: translations.generatedSuccess,
      });
      setIsGenerating(false);
    },
    onError: () => {
      toast({
        title: translations.error,
        description: translations.generationError,
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  // Gestione del click sul pulsante di generazione
  const handleGenerateClick = () => {
    setIsGenerating(true);
    generateMutation.mutate();
    
    // Debug: controlliamo lo stato attuale delle raccomandazioni
    console.log("Avvio generazione suggerimenti:", { recommendations, locale: i18n.language });
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
  const translateCategory = (category: string): string => {
    if (i18n.language === 'en') {
      switch (category.toLowerCase()) {
        case 'document': return "Document Analysis";
        case 'signature': return "Signature Analysis";
        case 'workflow': return "Workflow";
        case 'learning': return "Learning";
        case 'tool': return "Tool";
        default: return category;
      }
    } else {
      switch (category.toLowerCase()) {
        case 'document': return "Analisi Documenti";
        case 'signature': return "Analisi Firme";
        case 'workflow': return "Flusso di Lavoro";
        case 'learning': return "Apprendimento";
        case 'tool': return "Strumento";
        default: return category;
      }
    }
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
          <CardTitle>{translations.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            {translations.noRecommendations}
          </p>
          <div className="flex justify-center mt-4">
            <Button onClick={handleGenerateClick} disabled={isGenerating}>
              {isGenerating ? <LoadingSpinner size="sm" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {translations.generate}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{translations.title}</CardTitle>
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
          {translations.refresh}
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
                    title={translations.markViewed}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => dismissMutation.mutate(recommendation.id)}
                    disabled={dismissMutation.isPending}
                    title={translations.dismiss}
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