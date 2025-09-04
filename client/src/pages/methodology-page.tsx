import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { Calculator, Brain, Eye, Microscope, BarChart3, Target, Cog, FileText } from "lucide-react";

export default function MethodologyPage() {
  const { t, i18n } = useTranslation('methodology');
  const isItalian = i18n.language === 'it';

  const parameterCategories = [
    {
      id: "graphological",
      title: t('categories.graphological.title'),
      description: t('categories.graphological.description'),
      icon: <Calculator className="h-5 w-5" />,
      weight: "40%",
      count: 15,
      color: "bg-blue-500"
    },
    {
      id: "naturalness", 
      title: t('categories.naturalness.title'),
      description: t('categories.naturalness.description'),
      icon: <Brain className="h-5 w-5" />,
      weight: t('categories.naturalness.weight'),
      count: 4,
      color: "bg-green-500"
    },
    {
      id: "ssim",
      title: t('categories.ssim.title'), 
      description: t('categories.ssim.description'),
      icon: <Eye className="h-5 w-5" />,
      weight: "60%",
      count: 4,
      color: "bg-purple-500"
    },
    {
      id: "metadata",
      title: t('categories.metadata.title'),
      description: t('categories.metadata.description'), 
      icon: <Cog className="h-5 w-5" />,
      weight: t('categories.metadata.weight'),
      count: 13,
      color: "bg-gray-500"
    }
  ];

  const topParameters = [
    { name: "PressureMean", weight: "16%", description: t('parameters.pressureMean') },
    { name: "AvgCurvature", weight: "14%", description: t('parameters.avgCurvature') },
    { name: "Proportion", weight: "12%", description: t('parameters.proportion') },
    { name: "Velocity", weight: "10%", description: t('parameters.velocity') },
    { name: "PressureStd", weight: "8%", description: t('parameters.pressureStd') }
  ];

  const authenticityThresholds = [
    { range: "≥85%", label: t('thresholds.authentic'), color: "bg-green-100 text-green-800", confidence: "95%" },
    { range: "65-84%", label: t('thresholds.probablyAuthentic'), color: "bg-yellow-100 text-yellow-800", confidence: "75%" },
    { range: "50-64%", label: t('thresholds.inconclusive'), color: "bg-orange-100 text-orange-800", confidence: "50%" },
    { range: "<50%", label: t('thresholds.suspicious'), color: "bg-red-100 text-red-800", confidence: "90%" }
  ];

  const naturalnessParams = [
    { name: "FluidityScore", weight: "40%", description: t('naturalness.fluidity') },
    { name: "PressureConsistency", weight: "30%", description: t('naturalness.pressure') },
    { name: "CoordinationIndex", weight: "30%", description: t('naturalness.coordination') }
  ];

  const methodologyUrl = isItalian 
    ? 'PARAMETRI_ANALISI_GRAFOLOGICA.md'
    : 'GRAPHOLOGICAL_ANALYSIS_PARAMETERS.md';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Microscope className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="parameters">{t('tabs.parameters')}</TabsTrigger>
          <TabsTrigger value="algorithms">{t('tabs.algorithms')}</TabsTrigger>
          <TabsTrigger value="interpretation">{t('tabs.interpretation')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {t('overview.systemTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                {t('overview.systemDescription')}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {parameterCategories.map((category) => (
                  <Card key={category.id} className="border-l-4" style={{ borderLeftColor: category.color.replace('bg-', '#') === category.color ? '#3b82f6' : undefined }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {category.icon}
                        <h3 className="font-semibold text-sm">{category.title}</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">{t('overview.weight')}</span>
                          <Badge variant="secondary">{category.weight}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">{t('overview.parameters')}</span>
                          <span className="text-xs font-medium">{category.count}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('overview.formulaTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                <div className="text-center space-y-2">
                  <div>{t('overview.formula.final')}</div>
                  <div className="text-muted-foreground">=</div>
                  <div>({t('overview.formula.ssim')} × 0.60) + ({t('overview.formula.parameters')} × 0.40)</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">60%</div>
                  <div className="text-sm text-purple-700">{t('overview.formula.ssimWeight')}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">40%</div>
                  <div className="text-sm text-blue-700">{t('overview.formula.parametersWeight')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parameters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {t('parameters.graphologicalTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {t('parameters.graphologicalDescription')}
              </p>
              <div className="space-y-3">
                {topParameters.map((param, index) => (
                  <div key={param.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">#{index + 1}</Badge>
                      <div>
                        <div className="font-medium">{param.name}</div>
                        <div className="text-sm text-muted-foreground">{param.description}</div>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">{param.weight}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                {t('parameters.naturalnessTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {t('parameters.naturalnessDescription')}
              </p>
              <div className="space-y-3">
                {naturalnessParams.map((param) => (
                  <div key={param.name} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="font-medium">{param.name}</div>
                      <div className="text-sm text-muted-foreground">{param.description}</div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">{param.weight}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="algorithms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('algorithms.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">{t('algorithms.inclination.title')}</h3>
                <p className="text-sm text-muted-foreground mb-3">{t('algorithms.inclination.description')}</p>
                <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                  <div>inclination_diff = abs(ref_val - ver_val)</div>
                  <div>compatibility = 1 - min(1, inclination_diff / 45.0)</div>
                  <div>return max(0.1, compatibility)</div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">{t('algorithms.pressure.title')}</h3>
                <p className="text-sm text-muted-foreground mb-3">{t('algorithms.pressure.description')}</p>
                <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                  <div>image_flat = image.flatten().astype(np.float64)</div>
                  <div>pressure_mean = float(np.mean(image_flat))</div>
                  <div>pressure_std = float(np.std(image_flat))</div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">{t('algorithms.naturalness.title')}</h3>
                <p className="text-sm text-muted-foreground mb-3">{t('algorithms.naturalness.description')}</p>
                <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                  <div>naturalness = (</div>
                  <div className="ml-4">fluidity * 0.4 +</div>
                  <div className="ml-4">pressure_consistency * 0.3 +</div>
                  <div className="ml-4">coordination * 0.3</div>
                  <div>)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interpretation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('interpretation.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                {t('interpretation.description')}
              </p>
              
              <div className="space-y-4">
                <h3 className="font-semibold">{t('interpretation.thresholds')}</h3>
                {authenticityThresholds.map((threshold) => (
                  <div key={threshold.range} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge className={threshold.color}>{threshold.range}</Badge>
                      <span className="font-medium">{threshold.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('interpretation.confidence')}: {threshold.confidence}
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div>
                <h3 className="font-semibold mb-4">{t('interpretation.matrix.title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('interpretation.matrix.description')}
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="font-semibold p-2"></div>
                    <div className="font-semibold p-2 text-center">{t('interpretation.matrix.highNaturalness')}</div>
                    <div className="font-semibold p-2 text-center">{t('interpretation.matrix.lowNaturalness')}</div>
                    
                    <div className="font-semibold p-2">{t('interpretation.matrix.highSimilarity')}</div>
                    <div className="p-2 bg-green-100 text-green-800 rounded text-center">✅ {t('interpretation.matrix.authentic')}</div>
                    <div className="p-2 bg-yellow-100 text-yellow-800 rounded text-center">⚠️ {t('interpretation.matrix.skilledCopy')}</div>
                    
                    <div className="font-semibold p-2">{t('interpretation.matrix.mediumSimilarity')}</div>
                    <div className="p-2 bg-yellow-100 text-yellow-800 rounded text-center">✅ {t('interpretation.matrix.probablyAuthentic')}</div>
                    <div className="p-2 bg-red-100 text-red-800 rounded text-center">❌ {t('interpretation.matrix.suspicious')}</div>
                    
                    <div className="font-semibold p-2">{t('interpretation.matrix.lowSimilarity')}</div>
                    <div className="p-2 bg-red-100 text-red-800 rounded text-center">⚠️ {t('interpretation.matrix.suspicious')}</div>
                    <div className="p-2 bg-red-100 text-red-800 rounded text-center">❌ {t('interpretation.matrix.probablyFalse')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('documentation.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            {t('documentation.description')}
          </p>
          <a 
            href={`/${methodologyUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            {t('documentation.viewDocument')}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}