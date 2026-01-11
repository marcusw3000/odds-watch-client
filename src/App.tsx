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

// Admin imports
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminEventsPage } from "./pages/admin/AdminEventsPage";
import { AdminEventDetailPage } from "./pages/admin/AdminEventDetailPage";
import { AdminEventFormPage } from "./pages/admin/AdminEventFormPage";
import { AdminSettlementsPage } from "./pages/admin/AdminSettlementsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
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
            <Route path="/auth" element={<AuthPage />} />
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
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
