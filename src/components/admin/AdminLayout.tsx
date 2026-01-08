import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getBreadcrumbs(pathname: string) {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: { label: string; path: string; isLast: boolean }[] = [];

  const labels: Record<string, string> = {
    admin: 'Admin',
    markets: 'Mercados',
    contestations: 'Contestações',
    new: 'Novo',
    settle: 'Liquidar',
  };

  paths.forEach((segment, index) => {
    const path = '/' + paths.slice(0, index + 1).join('/');
    const label = labels[segment] || segment;
    breadcrumbs.push({
      label,
      path,
      isLast: index === paths.length - 1,
    });
  });

  return breadcrumbs;
}

export function AdminLayout() {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const { user, isAdmin, loading, signOut } = useAuth();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Show access denied if authenticated but not admin
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão de administrador para acessar esta área.
            Entre em contato com um administrador se precisar de acesso.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" asChild>
              <Link to="/">Voltar ao Início</Link>
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-6">
            <SidebarTrigger className="-ml-2" />
            <Separator orientation="vertical" className="h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <BreadcrumbItem key={crumb.path}>
                    {index > 0 && <BreadcrumbSeparator />}
                    {crumb.isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.path}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                ADMIN
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
