import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Link2, Store, Shield, Plus,
  LogOut, ChevronDown, DollarSign, Webhook, Grid3X3, Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'SmartTrade', path: '/smarttrade', icon: TrendingUp },
  { label: 'Exchanges', path: '/exchanges', icon: Link2 },
  { label: 'Marketplace', path: '/bots', icon: Store },
];

const BOT_TYPES = [
  { id: 'dca', label: 'DCA Bot', icon: DollarSign, description: 'Dollar-cost averaging strategy' },
  { id: 'signal', label: 'Signal Bot', icon: Webhook, description: 'Webhook-based trading' },
  { id: 'grid', label: 'GRID Bot', icon: Grid3X3, description: 'Grid trading strategy' },
];

interface DashboardNavProps {
  onSignOut?: () => void;
}

export const DashboardNav = ({ onSignOut }: DashboardNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [botMenuOpen, setBotMenuOpen] = useState(false);

  const userName = user?.email?.split('@')[0] || 'Trader';

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0a0f0d] border-r border-white/5 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img src="/jadetrade-logo.png" alt="JadeTrade" className="h-8 w-auto" />
        </div>
      </div>

      {/* New Bot Button with Dropdown */}
      <div className="p-4">
        <DropdownMenu open={botMenuOpen} onOpenChange={setBotMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold justify-between"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Bot
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${botMenuOpen ? 'rotate-180' : ''}`} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-[#0a0f0d] border-white/10"
            align="start"
            sideOffset={8}
          >
            {BOT_TYPES.map((bot) => (
              <DropdownMenuItem
                key={bot.id}
                className="flex items-start gap-3 p-3 cursor-pointer focus:bg-emerald-500/10 focus:text-emerald-400"
                onClick={() => {
                  navigate(`/bots/create?type=${bot.id}`);
                  setBotMenuOpen(false);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <bot.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">{bot.label}</p>
                  <p className="text-xs text-muted-foreground">{bot.description}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}

          {/* Admin Link */}
          {user?.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Shield className="w-5 h-5" />
              Admin
            </button>
          )}
        </div>
      </nav>

      {/* User Section at Bottom */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
};

export default DashboardNav;
