import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertCircle, Mail, Gift, KeyRound, Eye, EyeOff, User, Lock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ReferralService } from '@/services/ReferralService';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  rememberMe: z.boolean().optional(),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter menos de 100 caracteres'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar os termos para continuar',
  }),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Get return URL from location state (for after login)
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/';
  const { user, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Password recovery state
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  
  // Password visibility state
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  
  // Referral code from URL
  const referralCode = searchParams.get('ref');

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
  });

  // Auto switch to signup if referral code is present
  useEffect(() => {
    if (referralCode) {
      setActiveTab('signup');
    }
  }, [referralCode]);

  // Redirect if already logged in (but not during OAuth callback)
  useEffect(() => {
    const url = new URL(window.location.href);
    const isOAuthCallback = url.searchParams.has('code') || window.location.hash.includes('access_token');
    
    // If we're processing an OAuth callback, show loading and let OAuthCallbackHandler handle it
    if (isOAuthCallback) {
      console.log('[AuthPage] OAuth callback detected, showing loading state');
      setIsOAuthProcessing(true);
      return;
    }
    
    if (user) {
      console.log('[AuthPage] User already logged in, redirecting to:', returnTo);
      navigate(returnTo);
    }
  }, [user, navigate, returnTo]);

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: signInError } = await signIn(data.email, data.password);
      
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Por favor, confirme seu email antes de fazer login');
        } else {
          setError(signInError.message);
        }
        return;
      }
      navigate(returnTo);
    } catch (err) {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSignupSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: signUpError } = await signUp(data.email, data.password, data.fullName);
      
      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          setError('Este email já está cadastrado. Faça login.');
          setActiveTab('login');
        } else {
          setError(signUpError.message);
        }
        return;
      }
      
      // Link referral if code was provided
      if (referralCode) {
        localStorage.setItem('pendingReferralCode', referralCode);
      }
      
      setSuccessMessage('Conta criada! Verifique seu email para confirmar o cadastro.');
      signupForm.reset();
    } catch (err) {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Process pending referral after login
  useEffect(() => {
    const processPendingReferral = async () => {
      if (!user) return;
      
      const pendingCode = localStorage.getItem('pendingReferralCode');
      if (pendingCode) {
        const { success, error } = await ReferralService.linkReferral(user.id, pendingCode);
        localStorage.removeItem('pendingReferralCode');
        
        if (success) {
          toast({
            title: 'Indicação aplicada!',
            description: 'Você receberá desconto nas taxas por 30 dias.',
          });
        } else if (error) {
          console.error('Failed to link referral:', error);
        }
      }
    };
    
    processPendingReferral();
  }, [user, toast]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    // Store return URL and referral code before redirect
    if (returnTo && returnTo !== '/') {
      localStorage.setItem('authReturnTo', returnTo);
    } else {
      // Default to /markets if no specific return URL
      localStorage.setItem('authReturnTo', '/markets');
    }
    if (referralCode) {
      localStorage.setItem('pendingReferralCode', referralCode);
    }

    try {
      console.log('[Auth] Starting Google OAuth flow...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Use the current origin - Supabase will redirect back here with ?code=...
          redirectTo: `${window.location.origin}/auth`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[Auth] Google OAuth error:', error);
        setError(error.message);
      }
    } catch (err) {
      console.error('[Auth] Google OAuth exception:', err);
      setError('Erro ao conectar com Google. Tente novamente.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!recoveryEmail.trim()) {
      return;
    }

    setIsRecoveryLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
        redirectTo: `${window.location.origin}/auth?recovery=true`,
      });

      if (error) {
        setError(error.message);
      } else {
        setRecoverySuccess(true);
      }
    } catch (err) {
      setError('Erro ao enviar email de recuperação. Tente novamente.');
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  // Full-screen loading during OAuth callback processing
  if (isOAuthProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Finalizando login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center space-y-3">
          {/* Logo/Brand */}
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Bem-vindo ao OddsWatch</CardTitle>
          <CardDescription className="text-base">
            {referralCode 
              ? 'Você foi indicado! Crie sua conta e ganhe desconto nas taxas.'
              : 'Entre na sua conta ou crie uma nova'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Code Badge */}
          {referralCode && (
            <Alert className="bg-primary/10 border-primary/30 animate-in fade-in-0 duration-300">
              <Gift className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                Código de indicação: <strong>{referralCode}</strong> - Você ganhará desconto nas taxas!
              </AlertDescription>
            </Alert>
          )}

          {/* Google Sign In Button */}
          <Button
            variant="outline"
            className="w-full h-11 transition-all duration-200 hover:bg-muted/50 hover:scale-[1.01] active:scale-[0.99]"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continuar com Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <Mail className="h-4 w-4" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="transition-all duration-200">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="transition-all duration-200">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 animate-in fade-in-0 slide-in-from-left-2 duration-300">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              autoComplete="email"
                              className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showLoginPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="current-password"
                              className="pl-10 pr-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              tabIndex={-1}
                            >
                              {showLoginPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
                              )}
                              <span className="sr-only">
                                {showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                              </span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Remember Me Checkbox */}
                  <FormField
                    control={loginForm.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                          Lembrar-me neste dispositivo
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-11 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>

                  {/* Password Recovery Dialog */}
                  <Dialog open={isRecoveryOpen} onOpenChange={(open) => {
                    setIsRecoveryOpen(open);
                    if (!open) {
                      setRecoveryEmail('');
                      setRecoverySuccess(false);
                      setError(null);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="link" type="button" className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Esqueceu sua senha?
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Recuperar Senha</DialogTitle>
                        <DialogDescription>
                          Digite seu email para receber um link de recuperação de senha.
                        </DialogDescription>
                      </DialogHeader>
                      
                      {recoverySuccess ? (
                        <Alert className="bg-primary/10 border-primary/30">
                          <Mail className="h-4 w-4 text-primary" />
                          <AlertDescription className="text-primary">
                            Email enviado! Verifique sua caixa de entrada para redefinir sua senha.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              value={recoveryEmail}
                              onChange={(e) => setRecoveryEmail(e.target.value)}
                              disabled={isRecoveryLoading}
                              className="pl-10"
                            />
                          </div>
                          <Button 
                            onClick={handlePasswordRecovery} 
                            className="w-full"
                            disabled={isRecoveryLoading || !recoveryEmail.trim()}
                          >
                            {isRecoveryLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              'Enviar Link de Recuperação'
                            )}
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 animate-in fade-in-0 slide-in-from-right-2 duration-300">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Seu nome completo"
                              autoComplete="name"
                              className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              autoComplete="email"
                              className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showSignupPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pl-10 pr-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowSignupPassword(!showSignupPassword)}
                              tabIndex={-1}
                            >
                              {showSignupPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
                              )}
                              <span className="sr-only">
                                {showSignupPassword ? "Ocultar senha" : "Mostrar senha"}
                              </span>
                            </Button>
                          </div>
                        </FormControl>
                        <PasswordStrengthIndicator password={field.value} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Terms Acceptance Checkbox */}
                  <FormField
                    control={signupForm.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            Li e aceito os{' '}
                            <Link 
                              to="/termos" 
                              target="_blank" 
                              className="text-primary hover:underline font-medium"
                            >
                              Termos de Uso
                            </Link>{' '}
                            e a{' '}
                            <Link 
                              to="/privacidade" 
                              target="_blank" 
                              className="text-primary hover:underline font-medium"
                            >
                              Política de Privacidade
                            </Link>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-11 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
