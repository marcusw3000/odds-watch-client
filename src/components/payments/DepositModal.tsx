import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, X, CreditCard, QrCode, ArrowLeft, AlertTriangle, Loader2, Check, Plus, Copy, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCreatePaymentIntent, useConfirmPayment, useCheckPixStatus } from '@/hooks/usePayments';
import { useSavedCards, useChargeSavedCard } from '@/hooks/useSavedCards';
import { getStripePromise } from '@/lib/stripe';
import { StripePaymentForm } from './StripePaymentForm';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DepositModalProps {
  onClose: () => void;
}

const quickAmounts = [50, 100, 200, 500, 1000];

type Step = 'amount' | 'payment' | 'pix-waiting';

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
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixExpiresAt, setPixExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  
  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const createPaymentIntent = useCreatePaymentIntent();
  const confirmPayment = useConfirmPayment();
  const checkPixStatus = useCheckPixStatus();
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const checkPixPaymentStatus = useCallback(async () => {
    if (!paymentIntentId || pixConfirmed) return;

    try {
      const result = await checkPixStatus.mutateAsync(paymentIntentId);
      
      // Update PIX data if available
      if (result.pixQrCode) setPixQrCode(result.pixQrCode);
      if (result.pixCopyPaste) setPixCopyPaste(result.pixCopyPaste);
      if (result.expiresAt) setPixExpiresAt(result.expiresAt);
      
      if (result.status === 'succeeded') {
        setPixConfirmed(true);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        toast({
          title: 'PIX confirmado!',
          description: `R$ ${numericAmount.toFixed(2)} foi adicionado ao seu saldo.`,
        });
        // Wait a bit for the user to see the success state
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking PIX status:', error);
    }
  }, [paymentIntentId, pixConfirmed, numericAmount, toast]);

  // Start polling when in PIX waiting step
  useEffect(() => {
    if (step === 'pix-waiting' && paymentIntentId && !pixConfirmed) {
      // Initial check
      checkPixPaymentStatus();
      
      // Start polling every 3 seconds
      pollingIntervalRef.current = setInterval(checkPixPaymentStatus, 3000);
      
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [step, paymentIntentId, pixConfirmed, checkPixPaymentStatus]);

  const handleClose = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
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

    // Create a new payment intent
    try {
      const result = await createPaymentIntent.mutateAsync({ 
        amount: numericAmount, 
        method,
        saveCard: method === 'CARD' && saveCard,
      });
      
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
        setPaymentIntentId(result.paymentIntentId);
        
        if (method === 'PIX') {
          setStep('pix-waiting');
        } else {
          setStep('payment');
        }
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
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setStep('amount');
    setClientSecret(null);
    setPaymentIntentId(null);
    setPixQrCode(null);
    setPixCopyPaste(null);
    setPixExpiresAt(null);
    setPixConfirmed(false);
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

  const handleCopyPixCode = async () => {
    if (pixCopyPaste) {
      try {
        await navigator.clipboard.writeText(pixCopyPaste);
        setCopied(true);
        toast({
          title: 'Código copiado!',
          description: 'Cole o código no seu app de banco para pagar.',
        });
        setTimeout(() => setCopied(false), 3000);
      } catch {
        toast({
          title: 'Erro ao copiar',
          description: 'Tente selecionar e copiar manualmente.',
          variant: 'destructive',
        });
      }
    }
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

  // Calculate time remaining for PIX
  const getTimeRemaining = () => {
    if (!pixExpiresAt) return null;
    const now = new Date();
    const expires = new Date(pixExpiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expirado';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
            {(step === 'payment' || step === 'pix-waiting') && !pixConfirmed && (
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
              {step === 'amount' ? 'Depositar' : step === 'pix-waiting' ? 'Aguardando PIX' : 'Pagamento'}
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
                <div className="relative flex items-center">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">R$</span>
                  <Input
                    id="deposit-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10 pr-14 text-2xl font-bold h-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0,00"
                    min={10}
                    max={10000}
                  />
                  <div className="absolute right-1 flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.min(10000, numericAmount + 10)))}
                      className="flex items-center justify-center h-6 w-10 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.max(10, numericAmount - 10)))}
                      className="flex items-center justify-center h-6 w-10 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
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
          ) : step === 'pix-waiting' ? (
            <div className="space-y-6">
              {pixConfirmed ? (
                <div className="text-center space-y-4 py-6">
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-500">Pagamento Confirmado!</h3>
                    <p className="text-muted-foreground mt-1">
                      R$ {numericAmount.toFixed(2)} foi adicionado ao seu saldo.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Amount summary */}
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Valor a pagar</span>
                      <span className="text-xl font-bold text-foreground">
                        R$ {numericAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* QR Code or Loading */}
                  {!clientSecret ? (
                    <div className="space-y-4 py-6">
                      <Skeleton className="h-48 w-48 mx-auto" />
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Gerando código PIX...</span>
                      </div>
                    </div>
                  ) : (
                    <Elements 
                      stripe={getStripePromise()} 
                      options={{
                        clientSecret,
                        appearance: stripeAppearance,
                        locale: 'pt-BR',
                      }}
                    >
                      <PixPaymentContent
                        pixQrCode={pixQrCode}
                        pixCopyPaste={pixCopyPaste}
                        expiresAt={pixExpiresAt}
                        onCopy={handleCopyPixCode}
                        copied={copied}
                        getTimeRemaining={getTimeRemaining}
                        isChecking={checkPixStatus.isPending}
                      />
                    </Elements>
                  )}

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Aguardando pagamento...</span>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    O pagamento será confirmado automaticamente após a transferência PIX.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? (
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
                  stripe={getStripePromise()} 
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

// Separate component for PIX payment content (needs to be inside Elements)
function PixPaymentContent({
  pixQrCode,
  pixCopyPaste,
  expiresAt,
  onCopy,
  copied,
  getTimeRemaining,
  isChecking,
}: {
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  expiresAt: string | null;
  onCopy: () => void;
  copied: boolean;
  getTimeRemaining: () => string | null;
  isChecking: boolean;
}) {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Update time remaining every second
  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(getTimeRemaining());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [getTimeRemaining]);

  return (
    <div className="space-y-4">
      {/* QR Code */}
      {pixQrCode ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-white rounded-lg">
            <img 
              src={pixQrCode} 
              alt="QR Code PIX" 
              className="w-48 h-48"
            />
          </div>
          
          {timeRemaining && (
            <p className="text-sm text-muted-foreground">
              Expira em: <span className="font-mono font-bold">{timeRemaining}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 py-4">
          <Skeleton className="h-48 w-48" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando QR Code...</span>
          </div>
        </div>
      )}

      {/* Copy/Paste code */}
      {pixCopyPaste && (
        <div className="space-y-2">
          <Label>Código PIX Copia e Cola</Label>
          <div className="flex gap-2">
            <Input 
              value={pixCopyPaste} 
              readOnly 
              className="font-mono text-xs"
            />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
