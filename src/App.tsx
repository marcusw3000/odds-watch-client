import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/layout/Layout";
import { MarketsPage } from "./pages/MarketsPage";
import { MarketDetailPage } from "./pages/MarketDetailPage";
import { supabase } from "@/integrations/supabase/client";
import { PortfolioPage } from "./pages/PortfolioPage";
import NotFound from "./pages/NotFound";
import { AuthPage } from "./pages/AuthPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { FeesPage } from "./pages/FeesPage";
import { ReferralPage } from "./pages/ReferralPage";
import ProfilePage from "./pages/ProfilePage";
import { Loader2 } from "lucide-react";

// Lazy load admin pages for bundle optimization
const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminEventsPage = lazy(() => import("./pages/admin/AdminEventsPage").then(m => ({ default: m.AdminEventsPage })));
const AdminEventDetailPage = lazy(() => import("./pages/admin/AdminEventDetailPage").then(m => ({ default: m.AdminEventDetailPage })));
const AdminEventFormPage = lazy(() => import("./pages/admin/AdminEventFormPage").then(m => ({ default: m.AdminEventFormPage })));
const AdminSettlementsPage = lazy(() => import("./pages/admin/AdminSettlementsPage").then(m => ({ default: m.AdminSettlementsPage })));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage").then(m => ({ default: m.AdminAuditPage })));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage").then(m => ({ default: m.AdminLoginPage })));
const AdminFinancialOverview = lazy(() => import("./pages/admin/AdminFinancialOverview").then(m => ({ default: m.AdminFinancialOverview })));
const AdminFeesPage = lazy(() => import("./pages/admin/AdminFeesPage").then(m => ({ default: m.AdminFeesPage })));
const AdminLedgerPage = lazy(() => import("./pages/admin/AdminLedgerPage").then(m => ({ default: m.AdminLedgerPage })));
const AdminRevenuePage = lazy(() => import("./pages/admin/AdminRevenuePage").then(m => ({ default: m.AdminRevenuePage })));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage").then(m => ({ default: m.AdminAuditLogsPage })));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage").then(m => ({ default: m.AdminUsersPage })));
const AdminMarketEventsPage = lazy(() => import("./pages/admin/AdminMarketEventsPage").then(m => ({ default: m.AdminMarketEventsPage })));
const AdminReferralsPage = lazy(() => import("./pages/admin/AdminReferralsPage").then(m => ({ default: m.AdminReferralsPage })));
const AdminAppearancePage = lazy(() => import("./pages/admin/AdminAppearancePage").then(m => ({ default: m.AdminAppearancePage })));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage").then(m => ({ default: m.AdminReportsPage })));

// Loading fallback for lazy-loaded components
const AdminLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

// Component to handle OAuth callback tokens (supports both PKCE and implicit flows)
function OAuthCallbackHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleAuthCallback = async () => {
      const url = new URL(window.location.href);
      
      // Check for PKCE flow: ?code=... in query params
      const code = url.searchParams.get('code');
      
      // Check for implicit flow: #access_token=... in hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      console.log('[Auth Callback] Checking for OAuth tokens...', {
        hasCode: !!code,
        hasHashTokens: !!(accessToken && refreshToken),
        pathname: url.pathname,
      });
      
      let sessionEstablished = false;
      
      // Handle PKCE flow (code in query params)
      if (code) {
        console.log('[Auth Callback] Processing PKCE code...');
        
        try {
          // Exchange code for session - Supabase handles this automatically
          // when detectSessionInUrl is true (default), but we ensure it's processed
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[Auth Callback] Error exchanging code for session:', error);
          } else if (data.session) {
            console.log('[Auth Callback] PKCE session established:', data.session.user?.email);
            sessionEstablished = true;
          }
        } catch (err) {
          console.error('[Auth Callback] Exception during code exchange:', err);
        }
        
        // Clean up the URL (remove code param)
        url.searchParams.delete('code');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
      
      // Handle implicit flow (tokens in hash)
      if (accessToken && refreshToken && !sessionEstablished) {
        console.log('[Auth Callback] Processing hash tokens...');
        
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('[Auth Callback] Error setting session from hash:', error);
        } else {
          console.log('[Auth Callback] Hash session established successfully');
          sessionEstablished = true;
        }
        
        // Clean up the URL hash
        window.history.replaceState(null, '', window.location.pathname);
      }
      
      // If session was established, handle redirect
      if (sessionEstablished) {
        const returnTo = localStorage.getItem('authReturnTo');
        localStorage.removeItem('authReturnTo');
        
        console.log('[Auth Callback] Session ready, redirecting to:', returnTo || '/markets');
        
        // Small delay to ensure state propagates before navigation
        setTimeout(() => {
          window.location.href = returnTo || '/markets';
        }, 100);
      }
    };
    
    handleAuthCallback();
  }, []);

  return <>{children}</>;
}

// Import connection status
import { ConnectionStatus } from "@/components/ui/connection-status";

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ConnectionStatus />
        <BrowserRouter>
          <OAuthCallbackHandler>
            <Routes>
              <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/markets" replace />} />
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/market/:id" element={<MarketDetailPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/referral" element={<ReferralPage />} />
              <Route path="/fees" element={<FeesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
            </Route>
            
            {/* Admin Routes - Lazy Loaded */}
            <Route path="/admin/login" element={
              <Suspense fallback={<AdminLoadingFallback />}>
                <AdminLoginPage />
              </Suspense>
            } />
            <Route path="/admin" element={
              <Suspense fallback={<AdminLoadingFallback />}>
                <AdminLayout />
              </Suspense>
            }>
              <Route index element={<Suspense fallback={<AdminLoadingFallback />}><AdminDashboard /></Suspense>} />
              <Route path="events" element={<Suspense fallback={<AdminLoadingFallback />}><AdminEventsPage /></Suspense>} />
              <Route path="events/new" element={<Suspense fallback={<AdminLoadingFallback />}><AdminEventFormPage /></Suspense>} />
              <Route path="events/:id" element={<Suspense fallback={<AdminLoadingFallback />}><AdminEventDetailPage /></Suspense>} />
              <Route path="events/:id/edit" element={<Suspense fallback={<AdminLoadingFallback />}><AdminEventFormPage /></Suspense>} />
              <Route path="settlements" element={<Suspense fallback={<AdminLoadingFallback />}><AdminSettlementsPage /></Suspense>} />
              <Route path="audit" element={<Suspense fallback={<AdminLoadingFallback />}><AdminAuditPage /></Suspense>} />
              <Route path="financial" element={<Suspense fallback={<AdminLoadingFallback />}><AdminFinancialOverview /></Suspense>} />
              <Route path="fees" element={<Suspense fallback={<AdminLoadingFallback />}><AdminFeesPage /></Suspense>} />
              <Route path="ledger" element={<Suspense fallback={<AdminLoadingFallback />}><AdminLedgerPage /></Suspense>} />
              <Route path="revenue" element={<Suspense fallback={<AdminLoadingFallback />}><AdminRevenuePage /></Suspense>} />
              <Route path="audit-logs" element={<Suspense fallback={<AdminLoadingFallback />}><AdminAuditLogsPage /></Suspense>} />
              <Route path="users" element={<Suspense fallback={<AdminLoadingFallback />}><AdminUsersPage /></Suspense>} />
              <Route path="market-events" element={<Suspense fallback={<AdminLoadingFallback />}><AdminMarketEventsPage /></Suspense>} />
              <Route path="referrals" element={<Suspense fallback={<AdminLoadingFallback />}><AdminReferralsPage /></Suspense>} />
              <Route path="appearance" element={<Suspense fallback={<AdminLoadingFallback />}><AdminAppearancePage /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<AdminLoadingFallback />}><AdminReportsPage /></Suspense>} />
            </Route>
            
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OAuthCallbackHandler>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;