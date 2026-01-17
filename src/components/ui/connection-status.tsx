import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionState = 'online' | 'offline' | 'reconnecting';

interface ConnectionStatusProps {
  showOnlyWhenOffline?: boolean;
}

export function ConnectionStatus({ showOnlyWhenOffline = true }: ConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionState>('online');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setStatus('reconnecting');
      // Brief "reconnecting" state before showing online
      setTimeout(() => {
        setStatus('online');
        // Hide after showing "connected" briefly
        setTimeout(() => setIsVisible(false), 2000);
      }, 500);
    };

    const handleOffline = () => {
      setStatus('offline');
      setIsVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setStatus('offline');
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't render if online and showOnlyWhenOffline is true
  if (showOnlyWhenOffline && !isVisible) return null;

  const Icon = status === 'offline' ? WifiOff : status === 'reconnecting' ? Loader2 : Wifi;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-300',
        status === 'offline' && 'bg-destructive text-destructive-foreground',
        status === 'reconnecting' && 'bg-warning text-warning-foreground',
        status === 'online' && 'bg-success text-success-foreground',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <Icon className={cn(
        'h-4 w-4',
        status === 'reconnecting' && 'animate-spin'
      )} />
      <span className="text-xs font-medium">
        {status === 'offline' && 'Sem conexão'}
        {status === 'reconnecting' && 'Reconectando...'}
        {status === 'online' && 'Conectado'}
      </span>
    </div>
  );
}
