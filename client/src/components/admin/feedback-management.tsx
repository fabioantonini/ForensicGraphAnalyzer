import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Badge,
  BadgeProps
} from "@/components/ui/badge";
import {
  Button
} from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Textarea
} from "@/components/ui/textarea";
import { Loader2, Eye, MessageSquare, Star } from "lucide-react";

interface FeedbackItem {
  id: number;
  category: string;
  feature?: string;
  rating?: number;
  npsScore?: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  userId?: number;
  adminResponse?: string;
  respondedAt?: string;
}

interface FeedbackStats {
  totalFeedback: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  averageRating: number;
  averageNPS: number;
}

export default function FeedbackManagement() {
  const { toast } = useToast();
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState("");
  const [newStatus, setNewStatus] = useState("");

  // Fetch all feedback
  const { data: feedbackData, isLoading: isLoadingFeedback } = useQuery({
    queryKey: ['/api/feedback']
  });

  // Fetch feedback statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery<FeedbackStats>({
    queryKey: ['/api/feedback/stats']
  });

  // Mutation to update feedback status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminResponse }: { id: number; status: string; adminResponse?: string }) => {
      const response = await apiRequest('PUT', `/api/feedback/${id}/status`, {
        status,
        adminResponse,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Successo",
        description: "Stato feedback aggiornato",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback/stats'] });
      setIsDetailDialogOpen(false);
      setSelectedFeedback(null);
      setAdminResponse("");
      setNewStatus("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare lo stato",
        variant: "destructive",
      });
    },
  });

  const openDetailDialog = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setAdminResponse(feedback.adminResponse || "");
    setNewStatus(feedback.status);
    setIsDetailDialogOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedFeedback || !newStatus) return;

    updateStatusMutation.mutate({
      id: selectedFeedback.id,
      status: newStatus,
      adminResponse: adminResponse.trim() || undefined,
    });
  };

  const getStatusBadgeVariant = (status: string): BadgeProps['variant'] => {
    switch (status) {
      case 'open': return 'default';
      case 'in_progress': return 'secondary';
      case 'resolved': return 'default';
      case 'closed': return 'outline';
      default: return 'default';
    }
  };

  const getPriorityBadgeVariant = (priority: string): BadgeProps['variant'] => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'default';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  const renderStars = (rating: number | undefined) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-xs text-gray-600 ml-1">({rating}/5)</span>
      </div>
    );
  };

  const feedback = (feedbackData as any)?.feedback || [];

  if (isLoadingFeedback || isLoadingStats) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-900">{(stats as any).totalFeedback}</div>
            <div className="text-sm text-blue-700">Feedback Totali</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-900">{(stats as any).averageRating}</div>
            <div className="text-sm text-green-700">Valutazione Media</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-900">{(stats as any).averageNPS}</div>
            <div className="text-sm text-purple-700">NPS Medio</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-900">
              {(stats as any).statusBreakdown?.find((s: any) => s.status === 'open')?.count || 0}
            </div>
            <div className="text-sm text-orange-700">Aperti</div>
          </div>
        </div>
      )}

      {/* Feedback Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Priorità</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Valutazione</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Nessun feedback ricevuto
                </TableCell>
              </TableRow>
            ) : (
              feedback.map((item: FeedbackItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {formatDate(item.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.category}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadgeVariant(item.priority)}>
                      {item.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {renderStars(item.rating)}
                    {item.npsScore && (
                      <div className="text-xs text-gray-600 mt-1">
                        NPS: {item.npsScore}/10
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailDialog(item)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Dettagli
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedFeedback && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Dettagli Feedback #{selectedFeedback.id}
                </DialogTitle>
                <DialogDescription>
                  Ricevuto il {formatDate(selectedFeedback.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Categoria</label>
                    <Badge variant="outline" className="ml-2">{selectedFeedback.category}</Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priorità</label>
                    <Badge variant={getPriorityBadgeVariant(selectedFeedback.priority)} className="ml-2">
                      {selectedFeedback.priority}
                    </Badge>
                  </div>
                </div>

                {selectedFeedback.feature && (
                  <div>
                    <label className="text-sm font-medium">Funzionalità</label>
                    <p className="text-sm text-gray-700 mt-1">{selectedFeedback.feature}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Titolo</label>
                  <p className="text-sm text-gray-700 mt-1">{selectedFeedback.title}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Descrizione</label>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{selectedFeedback.description}</p>
                </div>

                {(selectedFeedback.rating || selectedFeedback.npsScore) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedFeedback.rating && (
                      <div>
                        <label className="text-sm font-medium">Valutazione</label>
                        <div className="mt-1">{renderStars(selectedFeedback.rating)}</div>
                      </div>
                    )}
                    {selectedFeedback.npsScore && (
                      <div>
                        <label className="text-sm font-medium">NPS Score</label>
                        <p className="text-sm text-gray-700 mt-1">{selectedFeedback.npsScore}/10</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Stato</label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aperto</SelectItem>
                          <SelectItem value="in_progress">In Lavorazione</SelectItem>
                          <SelectItem value="resolved">Risolto</SelectItem>
                          <SelectItem value="closed">Chiuso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-medium">Risposta Admin</label>
                    <Textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Aggiungi una risposta o note interne..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  {selectedFeedback.adminResponse && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium">Risposta Precedente</label>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                        {selectedFeedback.adminResponse}
                      </p>
                      {selectedFeedback.respondedAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Risposto il {formatDate(selectedFeedback.respondedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDetailDialogOpen(false)}
                >
                  Chiudi
                </Button>
                <Button
                  onClick={handleUpdateStatus}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Aggiorna Stato
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}