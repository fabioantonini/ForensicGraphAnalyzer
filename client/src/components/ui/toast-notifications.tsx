import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface NotificationManager {
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

let notificationManager: NotificationManager | null = null;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  useEffect(() => {
    notificationManager = {
      success: (message: string, description?: string) => {
        toast({
          title: message,
          description,
          variant: "default",
        });
      },
      error: (message: string, description?: string) => {
        toast({
          title: message,
          description,
          variant: "destructive",
        });
      },
      warning: (message: string, description?: string) => {
        toast({
          title: message,
          description,
          variant: "default",
        });
      },
      info: (message: string, description?: string) => {
        toast({
          title: message,
          description,
          variant: "default",
        });
      },
    };

    return () => {
      notificationManager = null;
    };
  }, [toast]);

  return <>{children}</>;
}

export function useNotifications() {
  if (!notificationManager) {
    throw new Error('useNotifications deve essere utilizzato all\'interno di NotificationProvider');
  }
  return notificationManager;
}

// Utility globale per notifiche da qualsiasi parte dell'app
export const notify = {
  success: (message: string, description?: string) => {
    notificationManager?.success(message, description);
  },
  error: (message: string, description?: string) => {
    notificationManager?.error(message, description);
  },
  warning: (message: string, description?: string) => {
    notificationManager?.warning(message, description);
  },
  info: (message: string, description?: string) => {
    notificationManager?.info(message, description);
  },
};