import { useState, useEffect } from 'react';
import { useNotifications } from '@/components/ui/toast-notifications';

export function useOfflineSupport() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { warning, info } = useNotifications();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        info('Connessione ripristinata', 'Sei di nuovo online');
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      warning('Connessione persa', 'Alcune funzionalità potrebbero non funzionare');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, warning, info]);

  return { isOnline, wasOffline };
}