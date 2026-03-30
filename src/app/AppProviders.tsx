import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { AuthBootstrap } from "@/hooks/useAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useWebVitals } from "@/hooks/useWebVitals";
import { ReferralService } from "@/services/ReferralService";
import { toast } from "sonner";

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

function WebVitalsTracker() {
  useWebVitals();
  return null;
}

export function AppProviders({
  children,
  initialAuth,
}: {
  children: React.ReactNode;
  initialAuth?: AuthBootstrap;
}) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialAuth={initialAuth}>
          <TooltipProvider>
            <WebVitalsTracker />
            <PostLoginTasks />
            <Toaster />
            <Sonner />
            <ConnectionStatus />
            {children}
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
