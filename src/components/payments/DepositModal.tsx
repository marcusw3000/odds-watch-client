import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, X, CreditCard, QrCode, ArrowLeft, AlertTriangle, Loader2, Check, Plus } from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCreatePaymentIntent, useConfirmPayment } from '@/hooks/usePayments';
import { useSavedCards, useChargeSavedCard } from '@/hooks/useSavedCards';
import { stripePromise } from '@/lib/stripe';
import { StripePaymentForm } from './StripePaymentForm';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DepositModalProps {
  onClose: () => void;
}

const quickAmounts = [50, 100, 200, 500, 1000];

type Step = 'amount' | 'payment';

const cardBrandIcons: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
  unknown: '💳',
};

const formatCardBrand = (brand: string) => {
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    elo: 'Elo',
    hipercard: 'Hipercard',
  };
  return brands[brand.toLowerCase()] || brand;
};

export function DepositModal({ onClose }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('100');
  const [method, setMethod] = useState<'PIX' | 'CARD'>('PIX');
  const [step, setStep] = useState<Step>('amount');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [saveCard, setSaveCard] = useState(true);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  
  const createPaymentIntent = useCreatePaymentIntent();
  const confirmPayment = useConfirmPayment();
  const chargeSavedCard = useChargeSavedCard();
  const { data: savedCards, isLoading: isLoadingSavedCards } = useSavedCards();
  const { toast } = useToast();

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount >= 10 && numericAmount <= 10000;

  const hasSavedCards = savedCards && savedCards.length > 0;

  // Auto-select first saved card when switching to CARD method
  useEffect(() => {
    if (method === 'CARD' && hasSavedCards && !selectedSavedCard && !useNewCard) {
      setSelectedSavedCard(savedCards[0].id);
    }
  }, [method, hasSavedCards, savedCards, selectedSavedCard, useNewCard]);

  // Trigger entrance animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const handleContinue = async () => {
    if (!isValidAmount) return;

    // If using a saved card, charge it directly
    if (method === 'CARD' && selectedSavedCard && !useNewCard) {
      try {
        const result = await chargeSavedCard.mutateAsync({
          amount: numericAmount,
          paymentMethodId: selectedSavedCard,
        });
        
        if (result.success) {
          toast({
            title: 'Depósito confirmado!',
            description: `R$ ${numericAmount.toFixed(2)} foi adicionado ao seu saldo.`,
          });
          handleClose();
        } else {
          toast({
            title: 'Pagamento em processamento',
            description: 'Seu saldo será atualizado em instantes.',
          });
          handleClose();
        }
        return;
      } catch (error) {
        toast({
          title: 'Erro ao processar pagamento',
          description: error instanceof Error ? error.message : 'Tente novamente',
          variant: 'destructive',
        });
        return;
      }
    }

    // Otherwise, create a new payment intent
    try {
      const result = await createPaymentIntent.mutateAsync({ 
        amount: numericAmount, 
        method,
        saveCard: method === 'CARD' && saveCard,
      });
      
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
        setPaymentIntentId(result.paymentIntentId);
        setStep('payment');
      }
    } catch (error) {
      toast({
        title: 'Erro ao iniciar pagamento',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentSuccess = async () => {
    if (paymentIntentId) {
      try {
        await confirmPayment.mutateAsync(paymentIntentId);
        toast({
          title: 'Depósito confirmado!',
          description: `R$ ${numericAmount.toFixed(2)} foi adicionado ao seu saldo.`,
        });
        handleClose();
      } catch (error) {
        // Even if confirmation fails, the payment went through
        toast({
          title: 'Pagamento processado',
          description: 'Seu saldo será atualizado em instantes.',
        });
        handleClose();
      }
    }
  };

  const handlePaymentError = (message: string) => {
    toast({
      title: 'Erro no pagamento',
      description: message,
      variant: 'destructive',
    });
  };

  const handleBack = () => {
    setStep('amount');
    setClientSecret(null);
    setPaymentIntentId(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSelectNewCard = () => {
    setSelectedSavedCard(null);
    setUseNewCard(true);
  };

  const handleSelectSavedCard = (cardId: string) => {
    setSelectedSavedCard(cardId);
    setUseNewCard(false);
  };

  const stripeAppearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#22c55e',
      colorBackground: '#1c1917',
      colorText: '#fafaf9',
      colorDanger: '#ef4444',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '8px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        backgroundColor: '#292524',
        border: '1px solid #44403c',
      },
      '.Input:focus': {
        border: '1px solid #22c55e',
        boxShadow: '0 0 0 1px #22c55e',
      },
      '.Label': {
        color: '#a8a29e',
      },
      '.Tab': {
        backgroundColor: '#292524',
        border: '1px solid #44403c',
      },
      '.Tab--selected': {
        backgroundColor: '#1c1917',
        borderColor: '#22c55e',
      },
    },
  };

  const isProcessing = createPaymentIntent.isPending || chargeSavedCard.isPending;

  const modalContent = (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200",
        isVisible ? "bg-black/70" : "bg-black/0"
      )}
      onClick={handleBackdropClick}
    >
      <div 
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200 max-h-[90vh] overflow-y-auto",
          isVisible 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            {step === 'payment' && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack} 
                type="button"
                className="mr-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <ArrowDownToLine className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">
              {step === 'amount' ? 'Depositar' : 'Pagamento'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {step === 'amount' ? (
            <>
              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Valor do depósito</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">R$</span>
                  <Input
                    id="deposit-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10 text-2xl font-bold h-14"
                    placeholder="0,00"
                    min={10}
                    max={10000}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo R$10,00 • Máximo R$10.000,00
                </p>
              </div>

              {/* Quick Amounts */}
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((value, index) => (
                  <Button
                    key={value}
                    type="button"
                    variant={numericAmount === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmount(value.toString())}
                    className={cn(
                      "transition-all duration-200",
                      isVisible && "animate-fade-in"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    R${value}
                  </Button>
                ))}
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <Label>Método de pagamento</Label>
                <RadioGroup value={method} onValueChange={(v) => {
                  setMethod(v as 'PIX' | 'CARD');
                  if (v === 'PIX') {
                    setSelectedSavedCard(null);
                    setUseNewCard(false);
                  }
                }}>
                  <div
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                      method === 'PIX' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                    )}
                    onClick={() => setMethod('PIX')}
                  >
                    <RadioGroupItem value="PIX" id="deposit-method-pix" />
                    <QrCode className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <Label htmlFor="deposit-method-pix" className="cursor-pointer font-medium">PIX</Label>
                      <p className="text-xs text-muted-foreground">Instantâneo • Sem taxas</p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                      method === 'CARD' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                    )}
                    onClick={() => setMethod('CARD')}
                  >
                    <RadioGroupItem value="CARD" id="deposit-method-card" />
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <Label htmlFor="deposit-method-card" className="cursor-pointer font-medium">Cartão de Crédito</Label>
                      <p className="text-xs text-muted-foreground">Processamento imediato</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Saved Cards Section */}
              {method === 'CARD' && (
                <div className="space-y-3">
                  <Label>Selecionar cartão</Label>
                  
                  {isLoadingSavedCards ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Saved cards */}
                      {savedCards?.map((card) => (
                        <div
                          key={card.id}
                          className={cn(
                            'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                            selectedSavedCard === card.id && !useNewCard
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/40'
                          )}
                          onClick={() => handleSelectSavedCard(card.id)}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                            selectedSavedCard === card.id && !useNewCard
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          )}>
                            {selectedSavedCard === card.id && !useNewCard && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">
                              {formatCardBrand(card.brand)} •••• {card.last4}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Expira {card.expMonth.toString().padStart(2, '0')}/{card.expYear.toString().slice(-2)}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* New card option */}
                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                          useNewCard || (!hasSavedCards && method === 'CARD')
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/40'
                        )}
                        onClick={handleSelectNewCard}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                          useNewCard || (!hasSavedCards && method === 'CARD')
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        )}>
                          {(useNewCard || (!hasSavedCards && method === 'CARD')) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <Plus className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">Usar novo cartão</p>
                          <p className="text-xs text-muted-foreground">Adicionar um cartão diferente</p>
                        </div>
                      </div>

                      {/* Save card checkbox - only show for new card */}
                      {(useNewCard || !hasSavedCards) && (
                        <div className="flex items-center gap-2 pt-2">
                          <Checkbox 
                            id="save-card" 
                            checked={saveCard}
                            onCheckedChange={(checked) => setSaveCard(checked === true)}
                          />
                          <Label htmlFor="save-card" className="text-sm cursor-pointer">
                            Salvar cartão para pagamentos futuros
                          </Label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              {isValidAmount && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Você receberá</span>
                    <span className="text-xl font-bold text-green-500">
                      R${numericAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Continue Button */}
              <Button 
                type="button"
                className="w-full h-12 text-base transition-transform active:scale-[0.98]"
                onClick={handleContinue}
                disabled={!isValidAmount || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {method === 'CARD' && selectedSavedCard && !useNewCard ? 'Processando...' : 'Carregando...'}
                  </>
                ) : method === 'CARD' && selectedSavedCard && !useNewCard ? (
                  `Pagar R$ ${numericAmount.toFixed(2)}`
                ) : (
                  'Continuar para pagamento'
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {!stripePromise ? (
                <div className="p-6 rounded-lg bg-destructive/10 border border-destructive/30 text-center space-y-3">
                  <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
                  <div>
                    <h3 className="font-semibold text-destructive">Stripe não configurado</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      A chave pública do Stripe não foi encontrada. Configure VITE_STRIPE_PUBLISHABLE_KEY no arquivo .env
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleBack} className="mt-2">
                    Voltar
                  </Button>
                </div>
              ) : !clientSecret ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Carregando formulário de pagamento...</span>
                  </div>
                </div>
              ) : (
                <Elements 
                  stripe={stripePromise} 
                  options={{
                    clientSecret,
                    appearance: stripeAppearance,
                    locale: 'pt-BR',
                  }}
                >
                  <StripePaymentForm
                    amount={numericAmount}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </Elements>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
