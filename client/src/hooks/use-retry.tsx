import { useState, useCallback } from 'react';
import { useNotifications } from '@/components/ui/toast-notifications';

interface RetryConfig {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: RetryConfig = {}
) {
  const { maxAttempts = 3, delay = 1000, backoff = true } = config;
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { warning, error: notifyError } = useNotifications();

  const retryFn = useCallback(async (...args: Parameters<T>) => {
    setIsRetrying(true);
    let currentAttempt = 0;

    while (currentAttempt < maxAttempts) {
      try {
        const result = await fn(...args);
        setAttempts(0);
        setIsRetrying(false);
        return result;
      } catch (error) {
        currentAttempt++;
        setAttempts(currentAttempt);

        if (currentAttempt < maxAttempts) {
          const waitTime = backoff ? delay * Math.pow(2, currentAttempt - 1) : delay;
          warning(
            `Tentativo ${currentAttempt} fallito`,
            `Riprovo tra ${waitTime / 1000} secondi...`
          );
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          setIsRetrying(false);
          notifyError(
            'Operazione fallita',
            `Tutti i ${maxAttempts} tentativi sono falliti`
          );
          throw error;
        }
      }
    }
  }, [fn, maxAttempts, delay, backoff, warning, notifyError]);

  return {
    retryFn,
    isRetrying,
    attempts,
    reset: () => {
      setAttempts(0);
      setIsRetrying(false);
    }
  };
}