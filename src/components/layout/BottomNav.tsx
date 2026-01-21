import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Briefcase, Trophy, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/markets', icon: Home, label: 'Mercados' },
  { path: '/portfolio', icon: Briefcase, label: 'Portfólio' },
  { path: '/leaderboard', icon: Trophy, label: 'Ranking' },
  { path: '/profile', icon: User, label: 'Perfil' },
];

export const BottomNav = memo(function BottomNav() {
  const location = useLocation();
  
  // Hide on auth and admin pages
  if (location.pathname.startsWith('/auth') || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path || 
            (item.path === '/markets' && location.pathname === '/');
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                isActive 
                  ? "text-primary scale-105" 
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "animate-bounce-once"
              )} />
              <span className={cn(
                "text-[10px] font-medium tracking-tight",
                isActive && "font-semibold"
              )}>{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
});
