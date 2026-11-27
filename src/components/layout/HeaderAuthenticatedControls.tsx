import { lazy, Suspense, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { User, LogOut, Gift, Calculator, Headphones, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

type DepositStatus = { id: string; valueCents: number; status: string; pixCode: string | null };
type PixHistoryItem = DepositStatus & { direction: 'deposit' | 'withdrawal'; createdAt: string };

function PixAccess({ userId }: { userId: string }) {
  const storageKey = `orbmarket-pix-deposit-${userId}`;
  const [amount, setAmount] = useState('');
  const [intent, setIntent] = useState<{ id: string; valueCents: number } | null>(null);
  const [deposit, setDeposit] = useState<DepositStatus | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [history, setHistory] = useState<PixHistoryItem[]>([]);
  const [mode, setMode] = useState<'deposit' | 'withdrawal'>('deposit');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [document, setDocument] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('national_registration');
  const [withdrawalMessage, setWithdrawalMessage] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const withdrawalStorageKey = `orbmarket-pix-withdrawal-${userId}`;
  const [withdrawalPending, setWithdrawalPending] = useState<{ id: string; valueCents: number } | null>(null);

  async function refreshOverview() {
    try {
      const [balanceResponse, historyResponse] = await Promise.all([
        fetch('/api/pix/balance').catch(() => null),
        fetch('/api/pix/deposit').catch(() => null),
      ]);
      if (balanceResponse?.ok) {
        const data = await balanceResponse.json();
        setBalanceCents(Number.isSafeInteger(data.availableCents) ? data.availableCents : null);
      } else setBalanceCents(null);
      if (historyResponse?.ok) {
        const data = await historyResponse.json();
        if (Array.isArray(data.operations)) setHistory(data.operations);
      }
    } catch {
      setBalanceCents(null);
      setHistory([]);
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.id === 'string' && Number.isSafeInteger(saved.valueCents)) setIntent(saved);
    } catch { sessionStorage.removeItem(storageKey); }
  }, [storageKey]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(withdrawalStorageKey) || 'null');
      if (saved && typeof saved.id === 'string' && Number.isSafeInteger(saved.valueCents)) setWithdrawalPending(saved);
    } catch { setWithdrawalMessage('Não foi possível recuperar a solicitação. Consulte o histórico.'); }
  }, [withdrawalStorageKey]);

  useEffect(() => {
    if (!withdrawalPending) return;
    const item = history.find(entry => entry.id === withdrawalPending.id);
    if (item && (item.status === 'paid' || item.status === 'canceled')) {
      sessionStorage.removeItem(withdrawalStorageKey);
      setWithdrawalPending(null);
      setWithdrawalMessage(item.status === 'paid' ? 'Saque confirmado.' : 'Saque cancelado. O saldo foi liberado.');
    }
  }, [history, withdrawalPending, withdrawalStorageKey]);

  async function send(method: 'GET' | 'POST', current: { id: string; valueCents: number }) {
    setLoading(true);
    setMessage('');
    try {
      let recheckQueued = false;
      if (method === 'GET') {
        const recheck = await fetch(`/api/pix/deposit/recheck?id=${encodeURIComponent(current.id)}`, { method: 'POST' }).catch(() => null);
        recheckQueued = Boolean(recheck?.ok);
      }
      const url = method === 'GET' ? `/api/pix/deposit?id=${encodeURIComponent(current.id)}` : '/api/pix/deposit';
      const response = await fetch(url, { method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) } : {}) });
      const data = await response.json();
      if (!response.ok) {
        if (method === 'POST' && (response.status === 400 || response.status === 403 || data.code === 'unavailable')) {
          sessionStorage.removeItem(storageKey);
          setIntent(null);
        }
        setMessage(typeof data.error === 'string' ? data.error : 'Não foi possível consultar o depósito.');
        return;
      }
      setDeposit(data);
      if (recheckQueued && data.status !== 'paid') setMessage('Atualização solicitada. Consulte novamente em instantes.');
      void refreshOverview();
    } catch {
      setMessage('Não foi possível confirmar o resultado. Consulte o status antes de tentar novamente.');
    } finally { setLoading(false); }
  }

  function createDeposit() {
    if (intent) { void send('POST', intent); return; }
    const value = amount.trim().replace(',', '.');
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) { setMessage('Informe um valor válido em reais.'); return; }
    const [reais, cents = ''] = value.split('.');
    const valueCents = Number(reais) * 100 + Number(cents.padEnd(2, '0'));
    if (valueCents < 50) { setMessage('O valor mínimo é R$ 0,50.'); return; }
    const next = { id: crypto.randomUUID(), valueCents };
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    setIntent(next);
    void send('POST', next);
  }

  function reset() {
    sessionStorage.removeItem(storageKey);
    setIntent(null);
    setDeposit(null);
    setMessage('');
    setAmount('');
  }

  async function withdraw() {
    const value = withdrawalAmount.trim().replace(',', '.');
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) { setWithdrawalMessage('Informe um valor válido em reais.'); return; }
    const [reais, cents = ''] = value.split('.');
    const valueCents = Number(reais) * 100 + Number(cents.padEnd(2, '0'));
    if (valueCents < 50) { setWithdrawalMessage('Informe um valor de pelo menos R$ 0,50.'); return; }
    let prior: { id: string; valueCents: number } | null = null;
    try { prior = JSON.parse(sessionStorage.getItem(withdrawalStorageKey) || 'null'); } catch { setWithdrawalMessage('Não foi possível recuperar a solicitação. Consulte o histórico.'); return; }
    if (prior && prior.valueCents !== valueCents) { setWithdrawalMessage('Consulte o histórico antes de alterar o valor da solicitação pendente.'); return; }
    const current = prior ?? { id: crypto.randomUUID(), valueCents };
    sessionStorage.setItem(withdrawalStorageKey, JSON.stringify(current));
    setWithdrawalPending(current);
    setWithdrawalLoading(true);
    setWithdrawalMessage('');
    try {
      const response = await fetch('/api/pix/withdrawal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...current, receiverDocument: document, pixKey, pixKeyType }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 400 || response.status === 403 || data.code === 'unavailable' || data.code === 'insufficient_balance') { sessionStorage.removeItem(withdrawalStorageKey); setWithdrawalPending(null); }
        setWithdrawalMessage(typeof data.error === 'string' ? data.error : 'Saque indisponível.');
        return;
      }
      setWithdrawalMessage('Solicitação registrada. Acompanhe o status nas movimentações recentes.');
      setDocument('');
      setPixKey('');
      void refreshOverview();
    } catch {
      setWithdrawalMessage('Resultado não confirmado. Consulte o histórico antes de tentar novamente.');
    } finally { setWithdrawalLoading(false); }
  }

  return (
    <Dialog onOpenChange={open => { if (open) void refreshOverview(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Depositar / Sacar</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Depósitos e saques via PIX</DialogTitle>
          <DialogDescription>
            Acompanhe seu depósito PIX em reais. O saldo virtual do simulador é separado.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">Saldo real disponível: <strong>{balanceCents === null ? 'Indisponível' : (balanceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
        <div className="flex gap-2"><Button size="sm" variant={mode === 'deposit' ? 'secondary' : 'ghost'} onClick={() => setMode('deposit')}>Depositar</Button><Button size="sm" variant={mode === 'withdrawal' ? 'secondary' : 'ghost'} onClick={() => setMode('withdrawal')}>Sacar</Button></div>
        {mode === 'deposit' && <>
        <p className="text-xs text-muted-foreground">A Pushin Pay processa os pagamentos. A OrbMarket é responsável pelos serviços oferecidos, pelo suporte e pelo cumprimento de suas obrigações.</p>
        {!intent && <label className="grid gap-2 text-sm">Valor do depósito em reais<input className="h-10 rounded-md border border-input bg-background px-3" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label>}
        {intent && <p className="text-sm">Valor solicitado: {(intent.valueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
        {deposit && <p className="text-sm" role="status">{deposit.status === 'paid' ? 'Pagamento confirmado e crédito registrado.' : deposit.status === 'canceled' ? 'Cobrança cancelada.' : deposit.status === 'expired' ? 'Cobrança expirada.' : deposit.status === 'created' ? 'Aguardando pagamento.' : 'Aguardando confirmação da cobrança.'}</p>}
        {deposit?.pixCode && deposit.status === 'created' && <div className="grid gap-3"><div className="mx-auto rounded-xl bg-white p-4"><QRCodeSVG value={deposit.pixCode} size={200} marginSize={1} role="img" aria-label="QR Code para pagamento PIX" /></div><label className="grid gap-2 text-sm">PIX copia e cola<textarea className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-xs" readOnly value={deposit.pixCode} onFocus={event => event.currentTarget.select()} /></label></div>}
        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
        <div className="flex flex-wrap gap-2">
          {!deposit && <Button disabled={loading} onClick={createDeposit}>{loading ? 'Aguarde...' : intent ? 'Tentar novamente' : 'Gerar PIX'}</Button>}
          {intent && <Button variant="outline" disabled={loading} onClick={() => void send('GET', intent)}>Consultar status</Button>}
          {deposit && ['paid', 'canceled', 'expired'].includes(deposit.status) && <Button variant="outline" onClick={reset}>Novo depósito</Button>}
        </div>
        </>}
        {mode === 'withdrawal' && <div className="grid gap-3">
          {withdrawalPending ? <><p className="text-sm">Saque de {(withdrawalPending.valueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} aguardando confirmação.</p><Button variant="outline" onClick={() => void refreshOverview()}>Atualizar movimentações</Button></> : <>
          <label className="grid gap-1 text-sm">Valor do saque em reais<input className="h-10 rounded-md border border-input bg-background px-3" inputMode="decimal" value={withdrawalAmount} onChange={event => setWithdrawalAmount(event.target.value)} placeholder="0,00" /></label>
          <label className="grid gap-1 text-sm">CPF ou CNPJ do destinatário<input className="h-10 rounded-md border border-input bg-background px-3" inputMode="numeric" value={document} onChange={event => setDocument(event.target.value)} /></label>
          <label className="grid gap-1 text-sm">Tipo de chave PIX<select className="h-10 rounded-md border border-input bg-background px-3" value={pixKeyType} onChange={event => setPixKeyType(event.target.value)}><option value="national_registration">CPF ou CNPJ</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="evp">Chave aleatória</option></select></label>
          <label className="grid gap-1 text-sm">Chave PIX<input className="h-10 rounded-md border border-input bg-background px-3" value={pixKey} onChange={event => setPixKey(event.target.value)} /></label>
          <Button disabled={withdrawalLoading} onClick={() => void withdraw()}>{withdrawalLoading ? 'Aguarde...' : 'Solicitar saque'}</Button>
          </>}
          {withdrawalMessage && <p className="text-sm text-muted-foreground" role="status">{withdrawalMessage}</p>}
        </div>}
        {history.length > 0 && <div className="max-h-36 space-y-2 overflow-y-auto"><p className="text-sm font-medium">Movimentações recentes</p>{history.map(item => <div key={item.id} className="flex items-center justify-between gap-2 text-xs"><span>{item.direction === 'deposit' ? 'Depósito' : 'Saque'} · {(item.valueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {item.status === 'paid' ? 'Confirmado' : item.status === 'canceled' ? 'Cancelado' : item.status === 'expired' ? 'Expirado' : 'Pendente'}</span>{item.direction === 'deposit' && item.status === 'created' && <Button size="sm" variant="ghost" onClick={() => { const next = { id: item.id, valueCents: item.valueCents }; sessionStorage.setItem(storageKey, JSON.stringify(next)); setIntent(next); setDeposit(item); }}>Abrir</Button>}</div>)}</div>}
      </DialogContent>
    </Dialog>
  );
}

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
        <PixAccess key={user.id} userId={user.id} />
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
        <PixAccess key={user.id} userId={user.id} />
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
