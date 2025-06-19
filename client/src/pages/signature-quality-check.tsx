import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SignatureConfidenceMeter } from '@/components/signature-confidence-meter';
import { ArrowRight, CheckCircle, AlertTriangle, XCircle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QualityMetric {
  score: number;
  status: 'low' | 'medium' | 'high' | 'cropped' | 'partial' | 'complete' | 'minimal' | 'adequate' | 'good';
  recommendation?: string;
  value?: number;
  width?: number;
  height?: number;
  dpi?: number;
  edgePixels?: number;
  totalPixels?: number;
  inkPixels?: number;
  backgroundPixels?: number;
  ratio?: number;
}

interface ImageQualityResult {
  overall: number;
  resolution: QualityMetric;
  contrast: QualityMetric;
  sharpness: QualityMetric;
  completeness: QualityMetric;
  signaturePresence: QualityMetric;
  recommendations: string[];
  suitableForAnalysis: boolean;
}

export default function SignatureQualityCheck() {
  const { t } = useTranslation();
  const [, navigate] = useNavigate();
  const [analyzedImages, setAnalyzedImages] = useState<Array<{
    file: File;
    result: ImageQualityResult;
    preview: string;
  }>>([]);

  const handleImageAnalyzed = (result: ImageQualityResult, file: File) => {
    const preview = URL.createObjectURL(file);
    setAnalyzedImages(prev => [...prev, { file, result, preview }]);
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const proceedToVerification = () => {
    navigate('/signatures');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('confidence.title', 'Signature Quality Analyzer')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('qualityCheck.description', 'Check the quality of your signature images before proceeding with verification analysis')}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          {t('qualityCheck.info', 'This tool helps you evaluate the quality of signature images before performing verification analysis. Good quality images lead to more accurate results.')}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Analyzer */}
        <div className="space-y-4">
          <SignatureConfidenceMeter
            onImageAnalyzed={handleImageAnalyzed}
            title={t('qualityCheck.analyzeTitle', 'Analyze Signature Quality')}
            description={t('qualityCheck.analyzeDescription', 'Upload signature images to check their suitability for verification analysis')}
          />

          {/* Quick Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t('qualityCheck.tips.title', 'Quality Tips')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{t('qualityCheck.tips.resolution', 'Use high resolution images (at least 300 DPI)')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{t('qualityCheck.tips.lighting', 'Ensure good lighting and contrast')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{t('qualityCheck.tips.complete', 'Include the complete signature without cropping')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{t('qualityCheck.tips.clean', 'Use clean, unfolded documents')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {analyzedImages.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t('qualityCheck.results.title', 'Analysis Results')}
                  </CardTitle>
                  <CardDescription>
                    {t('qualityCheck.results.description', 'Quality assessment for uploaded images')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analyzedImages.map((analysis, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      {/* Image Preview */}
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded border overflow-hidden bg-muted flex-shrink-0">
                          <img 
                            src={analysis.preview} 
                            alt={`Signature ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {analysis.file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getScoreIcon(analysis.result.overall)}
                            <span className="text-sm">
                              {t('confidence.overallScore', 'Overall Confidence')}: {analysis.result.overall}%
                            </span>
                          </div>
                          <Badge className={`mt-2 ${getScoreColor(analysis.result.overall)}`}>
                            {analysis.result.suitableForAnalysis 
                              ? t('confidence.suitable', 'Suitable for Analysis')
                              : t('confidence.needsImprovement', 'Needs Improvement')
                            }
                          </Badge>
                        </div>
                      </div>

                      {/* Quality Breakdown */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span>{t('confidence.metrics.resolution', 'Resolution')}:</span>
                          <span className={analysis.result.resolution.score >= 70 ? 'text-green-600' : 'text-yellow-600'}>
                            {analysis.result.resolution.score}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('confidence.metrics.contrast', 'Contrast')}:</span>
                          <span className={analysis.result.contrast.score >= 70 ? 'text-green-600' : 'text-yellow-600'}>
                            {analysis.result.contrast.score}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('confidence.metrics.sharpness', 'Sharpness')}:</span>
                          <span className={analysis.result.sharpness.score >= 70 ? 'text-green-600' : 'text-yellow-600'}>
                            {analysis.result.sharpness.score}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('confidence.metrics.completeness', 'Completeness')}:</span>
                          <span className={analysis.result.completeness.score >= 70 ? 'text-green-600' : 'text-yellow-600'}>
                            {analysis.result.completeness.score}%
                          </span>
                        </div>
                      </div>

                      {/* Top Recommendations */}
                      {analysis.result.recommendations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {t('confidence.recommendations', 'Recommendations')}:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {analysis.result.recommendations.slice(0, 2).map((rec, recIndex) => (
                              <li key={recIndex} className="flex items-start gap-1">
                                <span className="text-primary">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  onClick={proceedToVerification}
                  className="flex-1"
                  disabled={!analyzedImages.some(img => img.result.suitableForAnalysis)}
                >
                  {t('qualityCheck.proceedToVerification', 'Proceed to Verification')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {!analyzedImages.some(img => img.result.suitableForAnalysis) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('qualityCheck.warning', 'None of the analyzed images meet the minimum quality standards for reliable verification. Please improve image quality before proceeding.')}
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-muted-foreground">
                  <p className="text-sm">
                    {t('qualityCheck.noResults', 'Upload signature images to see quality analysis results')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}