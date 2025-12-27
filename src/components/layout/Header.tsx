import { useState } from 'react';
import { TrendingUp, User, Wallet, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  balance?: number;
  onNavigate?: (page: 'markets' | 'portfolio') => void;
  currentPage?: 'markets' | 'portfolio';
}

export function Header({ balance = 2500, onNavigate, currentPage = 'markets' }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const navItems = [
    { id: 'markets' as const, label: 'Mercados', icon: TrendingUp },
    { id: 'portfolio' as const, label: 'Portfólio', icon: User },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Predict<span className="text-gradient-primary">Market</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "gap-2 px-4",
                currentPage === item.id && "bg-accent text-accent-foreground"
              )}
              onClick={() => onNavigate?.(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
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
                  key={item.id}
                  variant={currentPage === item.id ? "secondary" : "ghost"}
                  className="justify-start gap-2"
                  onClick={() => {
                    onNavigate?.(item.id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
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
