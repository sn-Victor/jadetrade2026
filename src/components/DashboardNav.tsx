import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'SmartTrade', path: '/smarttrade' },
  { label: 'Exchanges', path: '/exchanges' },
  { label: 'Marketplace', path: '/bots' },
];

interface DashboardNavProps {
  showNewBotButton?: boolean;
  showUserMenu?: boolean;
  onSignOut?: () => void;
}

export const DashboardNav = ({
  showNewBotButton = true,
  showUserMenu = false,
  onSignOut
}: DashboardNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const userName = user?.email?.split('@')[0] || 'Trader';

  return (
    <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/jadetrade-logo.png" alt="JadeTrade" className="h-8 w-auto" />
            </div>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              {user?.isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </button>
              )}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {showNewBotButton && (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4"
                onClick={() => navigate('/bots/create')}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Bot
              </Button>
            )}
            {showUserMenu && onSignOut && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-semibold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardNav;
