import { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface RateLimitAlertProps {
  retryAfter: number;
  onExpire: () => void;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function RateLimitAlert({
  retryAfter,
  onExpire,
  onRetry,
  title = 'Limite de requisições excedido',
  description = 'Aguarde antes de tentar novamente.',
}: RateLimitAlertProps) {
  const [countdown, setCountdown] = useState(retryAfter);

  useEffect(() => {
    if (countdown <= 0) {
      onExpire();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, onExpire]);

  const progress = ((retryAfter - countdown) / retryAfter) * 100;

  return (
    <Alert variant="destructive" className="border-warning/50 bg-warning/10">
      <Clock className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tempo restante</span>
            <span className="font-mono font-medium text-warning">{countdown}s</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {onRetry && countdown === 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="w-full mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
