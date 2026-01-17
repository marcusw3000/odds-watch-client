import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, User, Wallet, Menu, X, LogIn, LogOut, Gift, Trophy, Plus, Calculator, RefreshCw, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeaderSearch } from './HeaderSearch';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';
import { useMyLeaderboardProfile } from '@/hooks/useLeaderboard';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { DepositModal } from '@/components/payments/DepositModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  balance?: number;
  isBalanceLoading?: boolean;
}

export function Header({ balance = 2500, isBalanceLoading = false }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const location = useLocation();
  const { user, isAdmin, signOut, loading } = useAuth();
  const { data: myProfile } = useMyLeaderboardProfile();

  // formatCurrency is now imported from @/lib/formatters

  const navItems = [
    { path: '/markets', label: 'Mercados', icon: TrendingUp },
    { path: '/leaderboard', label: 'Ranking', icon: Trophy },
    { path: '/portfolio', label: 'Portfólio', icon: Briefcase },
  ];

  const isActive = (path: string) => {
    if (path === '/markets') {
      return location.pathname === '/' || location.pathname === '/markets' || location.pathname.startsWith('/market/');
    }
    return location.pathname === path;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getUserInitials = () => {
    if (myProfile?.display_name) {
      return myProfile.display_name.charAt(0).toUpperCase();
    }
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
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

        {/* Balance & User Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user && (
            <>
              <div className="flex items-center gap-1 rounded-lg bg-secondary pl-4 pr-1 py-1">
                {isBalanceLoading ? (
                  <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  "font-mono font-semibold text-foreground mr-1 transition-opacity duration-200",
                  isBalanceLoading && "opacity-60"
                )}>
                  {formatCurrency(balance)}
                </span>
                <Button 
                  size="sm" 
                  className="h-7 px-2 bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => setShowDepositModal(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <NotificationBell />
            </>
          )}
          
          {loading ? (
            <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={myProfile?.avatar_url || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{user.email}</p>
                  {isAdmin && (
                    <p className="text-xs leading-none text-primary">Administrador</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin">Painel Admin</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/portfolio">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Meu Portfólio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/referral">
                    <Gift className="mr-2 h-4 w-4" />
                    Indicar Amigos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/fees">
                    <Calculator className="mr-2 h-4 w-4" />
                    Taxas
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link to="/auth">
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Link>
            </Button>
          )}
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

            {user && (
              <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
                <div className="flex items-center gap-2">
                  {isBalanceLoading ? (
                    <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">Saldo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono font-semibold transition-opacity duration-200",
                    isBalanceLoading && "opacity-60"
                  )}>
                    {formatCurrency(balance)}
                  </span>
                  <Button 
                    size="sm" 
                    className="h-7 px-2 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => {
                      setShowDepositModal(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
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
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                  asChild
                >
                  <Link to="/admin">
                    <User className="h-4 w-4" />
                    Painel Admin
                  </Link>
                </Button>
              )}
            </nav>

            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={myProfile?.avatar_url || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground truncate">{user.email}</span>
                </div>
                <Button variant="outline" className="w-full" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
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

      {/* Deposit Modal */}
      {showDepositModal && (
        <DepositModal onClose={() => setShowDepositModal(false)} />
      )}
    </header>
  );
}
