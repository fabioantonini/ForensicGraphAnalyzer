import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { SignatureImage } from "./signature-image";
import { Progress } from "@/components/ui/progress";

interface SignatureCardProps {
  signature: any; 
  onDelete: (id: number) => void;
  showSimilarity?: boolean;
}

export function SignatureCard({ 
  signature, 
  onDelete,
  showSimilarity = false
}: SignatureCardProps) {
  
  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Function to render similarity score
  const renderSimilarityScore = (score: number | null) => {
    if (score === null) return null;
    
    let color = 'bg-red-500';
    let text = 'Firma non autentica';
    
    if (score >= 0.8) {
      color = 'bg-green-500';
      text = 'Firma autentica';
    } else if (score >= 0.6) {
      color = 'bg-yellow-500';
      text = 'Firma sospetta';
    }
    
    return (
      <div className="mt-2">
        <p className="text-sm font-medium">Punteggio di somiglianza: {(score * 100).toFixed(1)}%</p>
        <Progress value={score * 100} className="h-2 mt-1" />
        <Badge className={`mt-2 ${color}`}>{text}</Badge>
      </div>
    );
  };
  
  return (
    <Card className="overflow-hidden">
      <div className="relative h-48 bg-gray-100">
        <SignatureImage 
          filename={signature.filename}
          originalFilename={signature.originalFilename}
          processingStatus={signature.processingStatus}
          className="w-full h-full"
        />
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-80 hover:opacity-100"
          onClick={() => onDelete(signature.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="p-3">
        <p className="text-sm truncate" title={signature.originalFilename}>
          {signature.originalFilename || 'Unknown File'}
        </p>
        <div className="flex items-center mt-1">
          <Badge className={getStatusColor(signature.processingStatus)}>
            {signature.processingStatus}
          </Badge>
        </div>
        
        {/* Mostra il punteggio di similarità solo per le firme da verificare */}
        {showSimilarity && signature.processingStatus === 'completed' && renderSimilarityScore(signature.comparisonResult)}
      </CardContent>
    </Card>
  );
}