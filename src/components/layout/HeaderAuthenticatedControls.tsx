import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { User, Wallet, LogOut, Gift, Plus, Calculator, Headphones, Users, Settings } from 'lucide-react';
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
import { usePortfolioBalance } from '@/hooks/usePortfolioBalance';
import { formatCurrency } from '@/lib/formatters';

const DepositModal = lazy(() =>
  import('@/components/payments/DepositModal').then((module) => ({
    default: module.DepositModal,
  }))
);

const NotificationBell = lazy(() =>
  import('@/components/notifications/NotificationBell').then((module) => ({
    default: module.NotificationBell,
  }))
);

function BalanceIcon({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="relative">
      <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      {isLoading && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse"
          aria-label="Atualizando saldo"
        />
      )}
    </div>
  );
}

function useHeaderUserState() {
  const { user, isAdmin, signOut } = useAuth();
  const { data: myProfile } = useMyLeaderboardProfile();
  const { balance, isLoading } = usePortfolioBalance();

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
    balance,
    isBalanceLoading: isLoading,
    getUserInitials,
  };
}

export function HeaderAuthenticatedControls() {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const { user, isAdmin, signOut, myProfile, balance, isBalanceLoading, getUserInitials } = useHeaderUserState();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg bg-secondary pl-4 pr-1 py-1">
        <BalanceIcon isLoading={isBalanceLoading} />
        <span className="font-mono font-semibold text-foreground mr-1">
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
            <Link to="/copy-traders">
              <Users className="mr-2 h-4 w-4" />
              Copy Trading
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

      {showDepositModal && (
        <Suspense fallback={null}>
          <DepositModal onClose={() => setShowDepositModal(false)} />
        </Suspense>
      )}
    </>
  );
}

export function MobileAuthenticatedMenu({ onNavigate }: { onNavigate: () => void }) {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const { user, isAdmin, signOut, myProfile, balance, isBalanceLoading, getUserInitials } = useHeaderUserState();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    onNavigate();
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
        <div className="flex items-center gap-2">
          <BalanceIcon isLoading={isBalanceLoading} />
          <span className="text-sm text-muted-foreground">Saldo</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">
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
          <Link to="/copy-traders">
            <Users className="h-4 w-4" />
            Copy Trading
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

      {showDepositModal && (
        <Suspense fallback={null}>
          <DepositModal onClose={() => setShowDepositModal(false)} />
        </Suspense>
      )}
    </>
  );
}
