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

// Admin imports
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminMarketsPage } from "./pages/admin/AdminMarketsPage";
import { AdminMarketForm } from "./pages/admin/AdminMarketForm";
import { AdminContestationsPage } from "./pages/admin/AdminContestationsPage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";

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
          </Route>
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="markets" element={<AdminMarketsPage />} />
            <Route path="markets/new" element={<AdminMarketForm />} />
            <Route path="markets/:id" element={<AdminMarketForm />} />
            <Route path="contestations" element={<AdminContestationsPage />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
