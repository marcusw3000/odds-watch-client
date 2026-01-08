import { Outlet } from 'react-router-dom';
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
import { useLocation, Link } from 'react-router-dom';

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
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                ADMIN
              </span>
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
