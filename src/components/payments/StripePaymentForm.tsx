import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface StripePaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function StripePaymentForm({ amount, onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/portfolio?deposit=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          onError(error.message || 'Erro na validação do pagamento');
        } else {
          onError('Ocorreu um erro inesperado. Tente novamente.');
        }
      } else if (paymentIntent) {
        if (paymentIntent.status === 'succeeded') {
          onSuccess();
        } else if (paymentIntent.status === 'processing') {
          onError('Pagamento está sendo processado. Aguarde alguns instantes.');
        } else if (paymentIntent.status === 'requires_action') {
          // This should be handled by the redirect
          onError('Pagamento requer ação adicional.');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      onError('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted-foreground">Valor do depósito</span>
          <span className="text-xl font-bold text-foreground">
            R$ {amount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="min-h-[200px]">
        <PaymentElement 
          onReady={() => setIsReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing || !isReady}
        className="w-full h-12 text-base font-semibold"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processando...
          </>
        ) : (
          `Pagar R$ ${amount.toFixed(2)}`
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Pagamento seguro processado pelo Stripe
      </p>
    </form>
  );
}
