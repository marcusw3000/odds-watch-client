import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, User, Wallet, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeaderSearch } from './HeaderSearch';
import { cn } from '@/lib/utils';

interface HeaderProps {
  balance?: number;
}

export function Header({ balance = 2500 }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const navItems = [
    { path: '/markets', label: 'Mercados', icon: TrendingUp },
    { path: '/portfolio', label: 'Portfólio', icon: User },
  ];

  const isActive = (path: string) => {
    if (path === '/markets') {
      return location.pathname === '/' || location.pathname === '/markets' || location.pathname.startsWith('/market/');
    }
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Predict<span className="text-gradient-primary">Market</span>
          </span>
        </Link>

        {/* Desktop Search */}
        <div className="hidden md:block flex-1 max-w-md mx-8">
          <HeaderSearch />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                "gap-2 px-4",
                isActive(item.path) && "bg-accent text-accent-foreground"
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

        {/* Balance & Actions */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(balance)}
            </span>
          </div>
          <Button variant="premium" size="sm">
            Depositar
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <div className="container mx-auto px-4 py-4 space-y-4">
            {/* Mobile Search */}
            <HeaderSearch className="w-full" />

            <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Saldo</span>
              </div>
              <span className="font-mono font-semibold">{formatCurrency(balance)}</span>
            </div>
            
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? "secondary" : "ghost"}
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

            <Button variant="premium" className="w-full">
              Depositar
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
