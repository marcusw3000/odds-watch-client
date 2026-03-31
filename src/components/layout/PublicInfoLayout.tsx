import { Link, Outlet, useLocation } from 'react-router-dom';
import { FileText, HelpCircle, Scale, ShieldCheck, TrendingUp } from 'lucide-react';

import { Footer } from './Footer';
import { cn } from '@/lib/utils';

const infoNavItems = [
  { path: '/faq', label: 'FAQ', icon: HelpCircle },
  { path: '/termos', label: 'Termos', icon: Scale },
  { path: '/privacidade', label: 'Privacidade', icon: FileText },
  { path: '/lgpd', label: 'LGPD', icon: ShieldCheck },
];

export function PublicInfoLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
                <TrendingUp className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  Predict<span className="text-gradient-primary">Market</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Informacoes institucionais e politicas da plataforma
                </p>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                to="/markets"
                className="inline-flex items-center rounded-lg border border-border px-3 py-2 font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Ver mercados
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Entrar
              </Link>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {infoNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  location.pathname === item.path
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-240px)] w-full max-w-6xl px-4 py-8 md:px-6">
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
