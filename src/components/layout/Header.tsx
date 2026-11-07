import { useEffect, useState, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, Menu, X, LogIn, Trophy, Briefcase } from 'lucide-react';
import { KalshiIcon, PolymarketIcon } from './MarketBrandIcons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const HeaderSearch = lazy(() =>
  import('./HeaderSearch').then((module) => ({
    default: module.HeaderSearch,
  }))
);

const HeaderAuthenticatedControls = lazy(() =>
  import('./HeaderAuthenticatedControls').then((module) => ({
    default: module.HeaderAuthenticatedControls,
  }))
);

const MobileAuthenticatedMenu = lazy(() =>
  import('./HeaderAuthenticatedControls').then((module) => ({
    default: module.MobileAuthenticatedMenu,
  }))
);

function SearchFallback({ className }: { className?: string }) {
  return <div className={cn('h-10 w-full rounded-md bg-secondary/70 animate-pulse', className)} />;
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shouldRenderSearch, setShouldRenderSearch] = useState(false);
  const location = useLocation();
  const { user, loading } = useAuth();

  const navItems = [
    { path: '/polymarket', label: 'Polymarket', icon: PolymarketIcon },
    { path: '/kalshi', label: 'Kalshi', icon: KalshiIcon, unavailable: true },
    { path: '/leaderboard', label: 'Ranking', icon: Trophy },
    { path: '/portfolio', label: 'Portfólio', icon: Briefcase },
  ];

  const isActive = (path: string) => {
    return location.pathname === path ||
      (path === '/polymarket' && location.pathname.startsWith('/polymarket'));
  };

  useEffect(() => {
    const scheduleRender = globalThis.setTimeout(
      () => setShouldRenderSearch(true),
      200,
    );

    return () => {
      globalThis.clearTimeout(scheduleRender);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Predict<span className="text-gradient-primary">Market</span>
          </span>
        </Link>

        <div className="hidden md:block flex-1 max-w-md mx-8">
          {shouldRenderSearch ? (
            <Suspense fallback={<SearchFallback />}>
              <HeaderSearch />
            </Suspense>
          ) : (
            <SearchFallback />
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1 min-h-[40px]">
          {navItems.map((item) => item.unavailable ? (
            <Button
              key={item.path}
              variant="ghost"
              disabled
              aria-label="Kalshi indisponível"
              className="gap-2 px-4 cursor-not-allowed opacity-60"
            >
              <item.icon className="h-4 w-4 animate-pulse" aria-hidden="true" />
              {item.label}
              <span className="text-[10px] font-medium text-muted-foreground animate-pulse">Indisponível</span>
            </Button>
          ) : (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'gap-2 px-4',
                isActive(item.path) && 'bg-accent text-accent-foreground'
              )}
              asChild
            >
              <Link to={item.path}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-28 rounded-lg bg-secondary animate-pulse" />
          ) : user ? (
            <Suspense fallback={<div className="h-9 w-28 rounded-lg bg-secondary animate-pulse" />}>
              <HeaderAuthenticatedControls />
            </Suspense>
          ) : (
            <Button asChild>
              <Link to="/auth">
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Link>
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <div className="container mx-auto px-4 py-4 space-y-4">
            {shouldRenderSearch ? (
              <Suspense fallback={<SearchFallback className="w-full" />}>
                <HeaderSearch className="w-full" />
              </Suspense>
            ) : (
              <SearchFallback className="w-full" />
            )}

            <nav className="flex flex-col gap-2">
              {navItems.map((item) => item.unavailable ? (
                <Button
                  key={item.path}
                  variant="ghost"
                  disabled
                  className="justify-start gap-2 cursor-not-allowed opacity-60"
                >
                  <item.icon className="h-4 w-4 animate-pulse" aria-hidden="true" />
                  {item.label}
                  <span className="text-xs animate-pulse">Indisponível</span>
                </Button>
              ) : (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? 'secondary' : 'ghost'}
                  className="justify-start gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                  asChild
                >
                  <Link to={item.path}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>

            {loading ? (
              <div className="h-24 rounded-lg bg-secondary animate-pulse" />
            ) : user ? (
              <Suspense fallback={<div className="h-24 rounded-lg bg-secondary animate-pulse" />}>
                <MobileAuthenticatedMenu onNavigate={() => setMobileMenuOpen(false)} />
              </Suspense>
            ) : (
              <Button className="w-full" asChild>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
