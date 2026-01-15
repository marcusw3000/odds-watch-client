import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { MarketsPage } from "./pages/MarketsPage";
import { MarketDetailPage } from "./pages/MarketDetailPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import NotFound from "./pages/NotFound";
import { AuthPage } from "./pages/AuthPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { FeesPage } from "./pages/FeesPage";

// Admin imports
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminEventsPage } from "./pages/admin/AdminEventsPage";
import { AdminEventDetailPage } from "./pages/admin/AdminEventDetailPage";
import { AdminEventFormPage } from "./pages/admin/AdminEventFormPage";
import { AdminSettlementsPage } from "./pages/admin/AdminSettlementsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminFinancialOverview } from "./pages/admin/AdminFinancialOverview";
import { AdminFeesPage } from "./pages/admin/AdminFeesPage";
import { AdminLedgerPage } from "./pages/admin/AdminLedgerPage";
import { AdminRevenuePage } from "./pages/admin/AdminRevenuePage";
import { AdminAuditLogsPage } from "./pages/admin/AdminAuditLogsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminMarketEventsPage } from "./pages/admin/AdminMarketEventsPage";
import { AdminReferralsPage } from "./pages/admin/AdminReferralsPage";
import { AdminAppearancePage } from "./pages/admin/AdminAppearancePage";
import { ReferralPage } from "./pages/ReferralPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          </Route>
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="events/new" element={<AdminEventFormPage />} />
            <Route path="events/:id" element={<AdminEventDetailPage />} />
            <Route path="events/:id/edit" element={<AdminEventFormPage />} />
            <Route path="settlements" element={<AdminSettlementsPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="financial" element={<AdminFinancialOverview />} />
            <Route path="fees" element={<AdminFeesPage />} />
            <Route path="ledger" element={<AdminLedgerPage />} />
            <Route path="revenue" element={<AdminRevenuePage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="market-events" element={<AdminMarketEventsPage />} />
            <Route path="referrals" element={<AdminReferralsPage />} />
            <Route path="appearance" element={<AdminAppearancePage />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
