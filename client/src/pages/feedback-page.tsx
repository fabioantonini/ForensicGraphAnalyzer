import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, MessageSquare, TrendingUp, Star, Users, Bug, Lightbulb, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { SelectFeedback, InsertFeedback } from '@shared/schema';

// Validation schema
const feedbackSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  feature: z.string().optional(),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  rating: z.number().min(1).max(5).optional(),
  npsScore: z.number().min(0).max(10).optional(),
  priority: z.string().default('medium'),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const FeedbackPage = () => {
  const { t } = useTranslation('feedback');
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('submit');
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: '',
      feature: '',
      title: '',
      description: '',
      priority: 'medium',
    },
  });

  // Queries
  const { data: myFeedback } = useQuery({
    queryKey: ['/api/feedback/my'],
    enabled: activeTab === 'history',
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/feedback/stats'],
    enabled: activeTab === 'stats',
  });

  // Mutations
  const submitFeedback = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success.title'),
        description: t('success.message'),
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      setActiveTab('success');
    },
    onError: (error: any) => {
      toast({
        title: t('errors.submitFailed'),
        description: error.message || t('errors.tryAgain'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FeedbackFormData) => {
    submitFeedback.mutate(data);
  };

  // Quick action handlers
  const handleQuickAction = (category: string, feature?: string, actionType?: 'rateApp' | 'recommendations') => {
    form.setValue('category', category);
    if (feature) form.setValue('feature', feature);
    
    // Pre-fill additional data for specific actions using translations
    if (actionType) {
      form.setValue('title', t(`prefilledContent.${actionType}.title`));
      form.setValue('description', t(`prefilledContent.${actionType}.description`));
      form.setValue('priority', 'medium');
    }
    
    setActiveTab('submit');
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[status as keyof typeof colors] || colors.open}>
        {t(`status.${status}`) || status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-600">{t('subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="submit" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('tabs.submit')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('tabs.history')}
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('tabs.stats')}
          </TabsTrigger>
          <TabsTrigger value="success" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('tabs.success')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="space-y-6 mt-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                {t('quickActions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                  onClick={() => handleQuickAction('bug')}
                >
                  <Bug className="h-5 w-5 text-red-500" />
                  {t('quickActions.reportBug')}
                </Button>
                <Button
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                  onClick={() => handleQuickAction('feature_request')}
                >
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  {t('quickActions.requestFeature')}
                </Button>
                <Button
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                  onClick={() => handleQuickAction('usability', 'general', 'rateApp')}
                >
                  <Star className="h-5 w-5 text-blue-500" />
                  {t('quickActions.rateApp')}
                </Button>
                <Button
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                  onClick={() => handleQuickAction('usability', 'general', 'recommendations')}
                >
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  {t('quickActions.recommendations')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t('form.submitTitle', 'Invia Nuovo Feedback')}</CardTitle>
              <CardDescription>
                {t('form.submitDescription', 'Compila il form per condividere la tua esperienza e suggerimenti')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category */}
                  <div className="space-y-2">
                    <Label htmlFor="category">{t('form.category')} *</Label>
                    <Select
                      value={form.watch('category')}
                      onValueChange={(value) => form.setValue('category', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholder.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries({
                          usability: t('categories.usability'),
                          accuracy: t('categories.accuracy'), 
                          performance: t('categories.performance'),
                          design: t('categories.design'),
                          bug: t('categories.bug'),
                          feature_request: t('categories.feature_request')
                        }).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.category && (
                      <p className="text-sm text-red-600">{form.formState.errors.category.message}</p>
                    )}
                  </div>

                  {/* Feature */}
                  <div className="space-y-2">
                    <Label htmlFor="feature">{t('form.feature')}</Label>
                    <Select
                      value={form.watch('feature')}
                      onValueChange={(value) => form.setValue('feature', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholder.selectFeature')} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries({
                          signatures: t('features.signatures'),
                          ocr: t('features.ocr'),
                          peer_review: t('features.peer_review'), 
                          wake_up: t('features.wake_up'),
                          documents: t('features.documents'),
                          general: t('features.general')
                        }).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">{t('form.title')} *</Label>
                  <Input
                    id="title"
                    placeholder={t('form.titlePlaceholder')}
                    {...form.register('title')}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">{t('form.description')} *</Label>
                  <Textarea
                    id="description"
                    placeholder={t('form.descriptionPlaceholder')}
                    rows={4}
                    {...form.register('description')}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Rating */}
                  <div className="space-y-2">
                    <Label htmlFor="rating">
                      {t('form.rating')} {t('form.ratingOptional')}
                    </Label>
                    <Select
                      value={form.watch('rating')?.toString() || ''}
                      onValueChange={(value) => form.setValue('rating', value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="1-5 ⭐" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <SelectItem key={rating} value={rating.toString()}>
                            {rating} {'⭐'.repeat(rating)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* NPS Score */}
                  <div className="space-y-2">
                    <Label htmlFor="npsScore">
                      {t('form.npsScore')} {t('form.npsOptional')}
                    </Label>
                    <Select
                      value={form.watch('npsScore')?.toString() || ''}
                      onValueChange={(value) => form.setValue('npsScore', value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="0-10" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i} {i <= 6 ? '😞' : i <= 8 ? '😐' : '😊'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label htmlFor="priority">{t('form.priority')}</Label>
                    <Select
                      value={form.watch('priority')}
                      onValueChange={(value) => form.setValue('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholder.selectPriority')} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries({
                          low: t('priority.low'),
                          medium: t('priority.medium'), 
                          high: t('priority.high'),
                          critical: t('priority.critical')
                        }).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitFeedback.isPending}
                >
                  {submitFeedback.isPending ? t('form.submitting') : t('form.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('myFeedback.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!(myFeedback as any)?.feedback || (myFeedback as any).feedback.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">{t('myFeedback.empty')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(myFeedback as any)?.feedback?.map((feedback: SelectFeedback) => (
                    <div key={feedback.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{feedback.title}</h3>
                        <StatusBadge status={feedback.status} />
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{feedback.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{feedback.category}</span>
                        {feedback.feature && <span>{feedback.feature}</span>}
                        {feedback.rating && <span>⭐ {feedback.rating}/5</span>}
                        <span>{new Date(feedback.createdAt!).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t('stats.totalFeedback')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats as any)?.totalFeedback || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t('stats.averageRating')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats as any)?.averageRating || 0} ⭐
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t('stats.averageNPS')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats as any)?.averageNPS || 0}/10</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t('stats.statusBreakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {(stats as any)?.statusBreakdown?.map((status: any) => (
                    <div key={status.status} className="flex justify-between text-sm">
                      <span>{status.status}</span>
                      <span>{status.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="success" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-600 mb-2">{t('success.title')}</h2>
                <p className="text-gray-600 mb-6">{t('success.message')}</p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => setActiveTab('history')}>
                    {t('success.viewHistory')}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('submit')}>
                    {t('success.submitAnother')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedbackPage;