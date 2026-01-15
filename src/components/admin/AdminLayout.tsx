import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Scale, 
  FileText, 
  LogOut,
  Menu,
  X,
  ChevronRight,
  DollarSign,
  Receipt,
  BookOpen,
  TrendingUp,
  ClipboardList,
  Users,
  Activity,
  Gift,
  Palette,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/events', label: 'Eventos', icon: Calendar },
  { path: '/admin/settlements', label: 'Liquidações', icon: Scale },
  { path: '/admin/audit', label: 'Auditoria', icon: FileText },
  { section: 'Financeiro' },
  { path: '/admin/financial', label: 'Visão Geral', icon: DollarSign },
  { path: '/admin/fees', label: 'Taxas', icon: Receipt },
  { path: '/admin/ledger', label: 'Ledger', icon: BookOpen },
  { path: '/admin/revenue', label: 'Receita', icon: TrendingUp },
  { section: 'Sistema' },
  { path: '/admin/audit-logs', label: 'Logs de Auditoria', icon: ClipboardList },
  { path: '/admin/users', label: 'Usuários', icon: Users },
  { path: '/admin/market-events', label: 'Eventos de Mercado', icon: Activity },
  { path: '/admin/referrals', label: 'Indicações', icon: Gift },
  { path: '/admin/appearance', label: 'Aparência', icon: Palette },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, isAdmin, loading, signOut } = useAuth();

  useEffect(() => {
    // Wait for loading to complete
    if (loading) return;

    // If not authenticated or not admin, redirect to login
    if (!user || !isAdmin) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, loading, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not admin
  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {sidebarOpen && (
            <span className="font-bold text-lg text-foreground">
              Admin Panel
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, index) => {
            if ('section' in item) {
              return sidebarOpen ? (
                <div key={item.section} className="pt-4 pb-1 px-3">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {item.section}
                  </span>
                </div>
              ) : (
                <div key={item.section} className="py-2">
                  <div className="h-px bg-border mx-2" />
                </div>
              );
            }
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.path, item.exact)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && isActive(item.path, item.exact) && (
                  <ChevronRight className="h-4 w-4 ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          {sidebarOpen && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-muted-foreground">Logado como</p>
              <p className="text-sm font-medium truncate">{user.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10',
              !sidebarOpen && 'justify-center'
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
