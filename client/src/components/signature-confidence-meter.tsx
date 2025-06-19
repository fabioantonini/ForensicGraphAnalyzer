import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Eye,
  Zap,
  Target,
  Scissors,
  Image as ImageIcon,
  Info,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';

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

interface SignatureConfidenceMeterProps {
  onImageAnalyzed?: (result: ImageQualityResult, imageFile: File) => void;
  className?: string;
  title?: string;
  description?: string;
}

export function SignatureConfidenceMeter({ 
  onImageAnalyzed, 
  className = "",
  title,
  description
}: SignatureConfidenceMeterProps) {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageQualityResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{ file: File; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Create preview
    const preview = URL.createObjectURL(file);
    setUploadedImage({ file, preview });

    try {
      // Create FormData for API request
      const formData = new FormData();
      formData.append('image', file);

      // Analyze image quality
      const response = await apiRequest('POST', '/api/analyze-image-quality', formData, {
        headers: {} // Don't set Content-Type, let browser set it for FormData
      });

      if (response.ok) {
        const result = await response.json() as ImageQualityResult;
        setAnalysisResult(result);
        onImageAnalyzed?.(result, file);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze image');
      }
    } catch (err) {
      console.error('Error analyzing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze image quality');
    } finally {
      setIsAnalyzing(false);
    }
  }, [onImageAnalyzed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.tiff', '.bmp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setUploadedImage(null);
    setError(null);
    if (uploadedImage?.preview) {
      URL.revokeObjectURL(uploadedImage.preview);
    }
  };

  const getOverallStatusIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getOverallStatusColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMetricIcon = (category: string) => {
    switch (category) {
      case 'resolution': return <ImageIcon className="h-4 w-4" />;
      case 'contrast': return <Eye className="h-4 w-4" />;
      case 'sharpness': return <Zap className="h-4 w-4" />;
      case 'completeness': return <Scissors className="h-4 w-4" />;
      case 'signaturePresence': return <Target className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getMetricColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {title || t('confidence.title', 'Signature Quality Analyzer')}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag & Drop Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${isDragActive 
              ? 'border-primary bg-primary/10' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
            ${isAnalyzing ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{t('confidence.analyzing', 'Analyzing image quality...')}</p>
            </div>
          ) : uploadedImage ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted">
                <img 
                  src={uploadedImage.preview} 
                  alt="Uploaded signature"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-sm font-medium">{uploadedImage.file.name}</p>
              <Button variant="outline" size="sm" onClick={resetAnalysis}>
                {t('confidence.analyzeAnother', 'Analyze Another')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive 
                  ? t('confidence.dropHere', 'Drop signature image here')
                  : t('confidence.dragDrop', 'Drag & drop signature image or click to browse')
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {t('confidence.supportedFormats', 'Supports JPEG, PNG, TIFF, BMP (max 10MB)')}
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Analysis Results */}
        <AnimatePresence>
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Overall Confidence Score */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {getOverallStatusIcon(analysisResult.overall)}
                  <span className="text-lg font-semibold">
                    {t('confidence.overallScore', 'Overall Confidence')}: {analysisResult.overall}%
                  </span>
                </div>
                <Progress value={analysisResult.overall} className="h-3" />
                <Badge className={getOverallStatusColor(analysisResult.overall)}>
                  {analysisResult.suitableForAnalysis 
                    ? t('confidence.suitable', 'Suitable for Analysis')
                    : t('confidence.needsImprovement', 'Needs Improvement')
                  }
                </Badge>
              </div>

              <Separator />

              {/* Detailed Metrics */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">
                  {t('confidence.detailedAnalysis', 'Detailed Analysis')}
                </h4>
                
                {/* Resolution */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getMetricIcon('resolution')}
                    <span className="text-sm">{t('confidence.metrics.resolution', 'Resolution')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getMetricColor(analysisResult.resolution.score)}`}>
                      {analysisResult.resolution.score}%
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {analysisResult.resolution.width}×{analysisResult.resolution.height}px
                    </div>
                  </div>
                </div>

                {/* Contrast */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getMetricIcon('contrast')}
                    <span className="text-sm">{t('confidence.metrics.contrast', 'Contrast')}</span>
                  </div>
                  <span className={`text-sm font-medium ${getMetricColor(analysisResult.contrast.score)}`}>
                    {analysisResult.contrast.score}%
                  </span>
                </div>

                {/* Sharpness */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getMetricIcon('sharpness')}
                    <span className="text-sm">{t('confidence.metrics.sharpness', 'Sharpness')}</span>
                  </div>
                  <span className={`text-sm font-medium ${getMetricColor(analysisResult.sharpness.score)}`}>
                    {analysisResult.sharpness.score}%
                  </span>
                </div>

                {/* Completeness */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getMetricIcon('completeness')}
                    <span className="text-sm">{t('confidence.metrics.completeness', 'Completeness')}</span>
                  </div>
                  <span className={`text-sm font-medium ${getMetricColor(analysisResult.completeness.score)}`}>
                    {analysisResult.completeness.score}%
                  </span>
                </div>

                {/* Signature Presence */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getMetricIcon('signaturePresence')}
                    <span className="text-sm">{t('confidence.metrics.signaturePresence', 'Signature Presence')}</span>
                  </div>
                  <span className={`text-sm font-medium ${getMetricColor(analysisResult.signaturePresence.score)}`}>
                    {analysisResult.signaturePresence.score}%
                  </span>
                </div>
              </div>

              {/* Recommendations */}
              {analysisResult.recommendations.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      {t('confidence.recommendations', 'Recommendations')}
                    </h4>
                    <ul className="space-y-1">
                      {analysisResult.recommendations.map((rec, index) => (
                        <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-primary">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}