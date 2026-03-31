import { useEffect, useState, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { AuthBootstrap } from "@/hooks/useAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

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

      const pendingCode = localStorage.getItem("pendingReferralCode");
      if (!pendingCode) return;

      const [{ ReferralService }, { toast }] = await Promise.all([
        import('@/services/ReferralService'),
        import('sonner'),
      ]);

      const { success, error } = await ReferralService.linkReferral(user.id, pendingCode);
      localStorage.removeItem("pendingReferralCode");

      if (success) {
        toast.success("Indicacao aplicada! Voce recebera desconto nas taxas por 30 dias.");
      } else if (error) {
        console.error("Failed to link referral:", error);
      }
    };

    processPendingReferral();
  }, [user]);

  return null;
}

export function AppProviders({
  children,
  initialAuth,
}: {
  children: React.ReactNode;
  initialAuth?: AuthBootstrap;
}) {
  const location = useLocation();
  const [queryClient] = useState(createQueryClient);
  const [shouldRenderDeferredShell, setShouldRenderDeferredShell] = useState(false);
  const shouldEnableAuthSync =
    Boolean(initialAuth?.user) || !STATIC_PUBLIC_ROUTES.has(location.pathname);

  useEffect(() => {
    const scheduleRender =
      'requestIdleCallback' in window
        ? window.requestIdleCallback(() => setShouldRenderDeferredShell(true), { timeout: 2000 })
        : window.setTimeout(() => setShouldRenderDeferredShell(true), 500);

    return () => {
      if (typeof scheduleRender === 'number') {
        window.clearTimeout(scheduleRender);
        return;
      }

      window.cancelIdleCallback(scheduleRender);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
