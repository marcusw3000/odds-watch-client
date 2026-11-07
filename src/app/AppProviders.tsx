import { useEffect, useState, lazy, Suspense, startTransition } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { AuthBootstrap } from "@/hooks/useAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

const AuthSync = lazy(() =>
  import("@/hooks/AuthSync").then((module) => ({
    default: module.AuthSync,
  }))
);

const DeferredAppShell = lazy(() =>
  import("./DeferredAppShell").then((module) => ({
    default: module.DeferredAppShell,
  }))
);

const STATIC_PUBLIC_ROUTES = new Set(['/faq', '/termos', '/privacidade', '/lgpd']);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

function PostLoginTasks() {
  const { user } = useAuth();

  useEffect(() => {
    const processPendingReferral = async () => {
      if (!user) return;

      const handledKey = `paperReferralHandled:${user.id}`;
      const metadataCode = typeof user.user_metadata?.paper_referral_code === 'string' ? user.user_metadata.paper_referral_code : null;
      const pendingCode = (localStorage.getItem(handledKey) ? null : metadataCode) || localStorage.getItem("pendingReferralCode");
      if (!pendingCode) return;
      try {
        const [{ applyPaperReferral }, { toast }] = await Promise.all([import('@/services/PaperReferralService'), import('sonner')]);
        const result = await applyPaperReferral(pendingCode);
        localStorage.removeItem("pendingReferralCode");
        localStorage.setItem(handledKey, '1');
        if (result === 'applied') toast.success('Convite do simulador vinculado.');
        else if (result !== 'already_linked') toast.error(result === 'ineligible' ? 'O convite é válido apenas para contas recentes sem operações.' : 'Não foi possível aplicar este convite.');
      } catch (error) {
        // Keep the code so a transient network or deployment error can be retried.
        console.error('Failed to link paper referral:', error);
      }
    };

    processPendingReferral();
  }, [user]);

  return null;
}

export function AppProviders({
  children,
  initialAuth,
  usdBrlRate,
}: {
  children: React.ReactNode;
  initialAuth?: AuthBootstrap;
  usdBrlRate?: number | null;
}) {
  const location = useLocation();
  const [queryClient] = useState(createQueryClient);
  const [shouldRenderDeferredShell, setShouldRenderDeferredShell] = useState(false);
  const shouldEnableAuthSync =
    Boolean(initialAuth?.user) || !STATIC_PUBLIC_ROUTES.has(location.pathname);

  useEffect(() => {
    const scheduleRender = globalThis.setTimeout(
      () => startTransition(() => setShouldRenderDeferredShell(true)),
      500,
    );

    return () => {
      globalThis.clearTimeout(scheduleRender);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider usdBrlRate={usdBrlRate}>
        <TooltipProvider>
        <AuthProvider initialAuth={initialAuth}>
          {shouldEnableAuthSync && (
            <Suspense fallback={null}>
              <AuthSync />
            </Suspense>
          )}
          <PostLoginTasks />
          {shouldRenderDeferredShell && (
            <Suspense fallback={null}>
              <DeferredAppShell />
            </Suspense>
          )}
          {children}
        </AuthProvider>
        </TooltipProvider>
        </CurrencyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
