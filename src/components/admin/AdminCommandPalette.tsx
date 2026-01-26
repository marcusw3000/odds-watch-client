import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Calendar,
  Scale,
  FileText,
  DollarSign,
  Receipt,
  BookOpen,
  TrendingUp,
  ClipboardList,
  Users,
  Activity,
  Gift,
  Flag,
  Lightbulb,
  Headphones,
  Copy,
  Settings,
  Plus,
  Search,
  Server,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navigationItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/events', label: 'Eventos', icon: Calendar },
  { path: '/admin/settlements', label: 'Liquidações', icon: Scale },
  { path: '/admin/audit', label: 'Auditoria', icon: FileText },
  { path: '/admin/financial', label: 'Visão Financeira', icon: DollarSign },
  { path: '/admin/fees', label: 'Taxas', icon: Receipt },
  { path: '/admin/ledger', label: 'Ledger', icon: BookOpen },
  { path: '/admin/revenue', label: 'Receita', icon: TrendingUp },
  { path: '/admin/copy-trade-settings', label: 'Copy Trade - Configurações', icon: Settings },
  { path: '/admin/copy-traders', label: 'Copy Trade - Traders', icon: Copy },
  { path: '/admin/suggestions', label: 'Sugestões', icon: Lightbulb },
  { path: '/admin/reports', label: 'Denúncias', icon: Flag },
  { path: '/admin/support', label: 'Suporte', icon: Headphones },
  { path: '/admin/audit-logs', label: 'Logs de Auditoria', icon: ClipboardList },
  { path: '/admin/users', label: 'Usuários', icon: Users },
  { path: '/admin/market-events', label: 'Eventos de Mercado', icon: Activity },
  { path: '/admin/referrals', label: 'Indicações', icon: Gift },
  { path: '/admin/system', label: 'Sistema', icon: Server },
];

const quickActions = [
  { path: '/admin/events/new', label: 'Criar Novo Evento', icon: Plus },
  { path: '/admin/settlements', label: 'Ver Liquidações Pendentes', icon: Scale },
  { path: '/admin/users', label: 'Buscar Usuário', icon: Search },
];

export function AdminCommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  const runCommand = useCallback((command: () => void) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        
        <CommandGroup heading="Ações Rápidas">
          {quickActions.map((item) => (
            <CommandItem
              key={item.path}
              onSelect={() => runCommand(() => navigate(item.path))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Navegação">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.path}
              onSelect={() => runCommand(() => navigate(item.path))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { open, setOpen };
}
