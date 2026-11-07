import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut, Gift, Calculator, Headphones, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useMyLeaderboardProfile } from '@/hooks/useLeaderboard';
import { usePolymarketPaperTrading } from '@/hooks/usePolymarketPaperTrading';
import { usePaperPortfolioValue } from '@/hooks/usePaperPortfolioValue';

const NotificationBell = lazy(() =>
  import('@/components/notifications/NotificationBell').then((module) => ({
    default: module.NotificationBell,
  }))
);

const formatUsd = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(value);

function useHeaderUserState() {
  const { user, isAdmin, signOut } = useAuth();
  const { data: myProfile } = useMyLeaderboardProfile();
  const paper = usePolymarketPaperTrading();
  const portfolio = usePaperPortfolioValue(paper.data?.positions);
  const balance = Number(paper.data?.wallet?.balance_usd);
  const paperBalance = paper.data && Number.isFinite(balance) ? balance : null;

  const getUserInitials = () => {
    if (myProfile?.display_name) {
      return myProfile.display_name.charAt(0).toUpperCase();
    }

    if (!user?.email) {
      return 'U';
    }

    return user.email.charAt(0).toUpperCase();
  };

  return {
    user,
    isAdmin,
    signOut,
    myProfile,
    paperBalance,
    isPaperBalanceLoading: paper.isLoading,
    portfolioValue: portfolio.total,
    portfolioLoading: paper.isLoading || portfolio.isValuationLoading,
    getUserInitials,
  };
}

export function HeaderAuthenticatedControls() {
  const { user, isAdmin, signOut, myProfile, paperBalance, isPaperBalanceLoading, portfolioValue, portfolioLoading, getUserInitials } = useHeaderUserState();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div className="flex items-center rounded-xl border border-border bg-secondary/70 px-1 py-1" aria-label="Valores simulados em dólares">
        <Link to="/polymarket/paper" className="rounded-lg px-3 py-1 transition-colors hover:bg-accent"><span className="block text-[10px] font-medium text-muted-foreground">Carteira · virtual</span><span className="block whitespace-nowrap text-sm font-semibold tabular-nums">{isPaperBalanceLoading ? 'Carregando...' : paperBalance === null ? 'Indisponível' : formatUsd(paperBalance)}</span></Link>
        <div className="h-7 w-px bg-border" aria-hidden="true" />
        <Link to="/portfolio" className="rounded-lg px-3 py-1 transition-colors hover:bg-accent"><span className="block text-[10px] font-medium text-muted-foreground">Portfólio</span><span className="block whitespace-nowrap text-sm font-semibold tabular-nums text-emerald-400">{portfolioLoading ? 'Carregando...' : portfolioValue === null ? 'Indisponível' : formatUsd(portfolioValue)}</span></Link>
      </div>
      <Suspense fallback={null}>
        <NotificationBell />
      </Suspense>
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
            <Link to="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Configuracoes
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
          <DropdownMenuItem asChild>
            <Link to="/settings?tab=support">
              <Headphones className="mr-2 h-4 w-4" />
              Suporte
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  );
}

export function MobileAuthenticatedMenu({ onNavigate }: { onNavigate: () => void }) {
  const { user, isAdmin, signOut, myProfile, paperBalance, isPaperBalanceLoading, portfolioValue, portfolioLoading, getUserInitials } = useHeaderUserState();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    onNavigate();
  };

  return (
    <>
      <div className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border bg-secondary/70 p-1">
        <Link to="/polymarket/paper" onClick={onNavigate} className="rounded-lg px-3 py-2 hover:bg-accent"><span className="block text-xs text-muted-foreground">Carteira · virtual</span><span className="mt-1 block text-sm font-semibold tabular-nums">{isPaperBalanceLoading ? 'Carregando...' : paperBalance === null ? 'Indisponível' : formatUsd(paperBalance)}</span></Link>
        <Link to="/portfolio" onClick={onNavigate} className="rounded-lg px-3 py-2 hover:bg-accent"><span className="block text-xs text-muted-foreground">Portfólio</span><span className="mt-1 block text-sm font-semibold tabular-nums text-emerald-400">{portfolioLoading ? 'Carregando...' : portfolioValue === null ? 'Indisponível' : formatUsd(portfolioValue)}</span></Link>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          className="justify-start gap-2"
          onClick={onNavigate}
          asChild
        >
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            Configuracoes
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="justify-start gap-2"
          onClick={onNavigate}
          asChild
        >
          <Link to="/settings?tab=support">
            <Headphones className="h-4 w-4" />
            Suporte
          </Link>
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={onNavigate}
            asChild
          >
            <Link to="/admin">
              <User className="h-4 w-4" />
              Painel Admin
            </Link>
          </Button>
        )}
      </div>

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

    </>
  );
}
