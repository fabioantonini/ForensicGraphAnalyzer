import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  steps: {
    id: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    description?: string;
  }[];
  currentStep?: number;
  className?: string;
}

export function ProgressIndicator({ steps, currentStep = 0, className }: ProgressIndicatorProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={cn("w-full space-y-4", className)}>
      <Progress value={progress} className="h-2" />
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-3">
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              step.status === 'completed' && "bg-green-100 text-green-600",
              step.status === 'processing' && "bg-blue-100 text-blue-600",
              step.status === 'error' && "bg-red-100 text-red-600",
              step.status === 'pending' && "bg-gray-100 text-gray-400"
            )}>
              {step.status === 'completed' && <CheckCircle className="w-4 h-4" />}
              {step.status === 'processing' && <Clock className="w-4 h-4 animate-pulse" />}
              {step.status === 'error' && <AlertCircle className="w-4 h-4" />}
              {step.status === 'pending' && <span className="text-xs">{index + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                step.status === 'completed' && "text-green-600",
                step.status === 'processing' && "text-blue-600",
                step.status === 'error' && "text-red-600",
                step.status === 'pending' && "text-gray-500"
              )}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}