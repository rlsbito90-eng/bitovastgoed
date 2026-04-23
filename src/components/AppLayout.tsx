import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Search, Building2, Handshake, CheckSquare,
  BarChart3, Menu, X, LogOut, Shield, Library,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/relaties', label: 'Relaties', icon: Users },
  { path: '/zoekprofielen', label: 'Zoekprofielen', icon: Search },
  { path: '/objecten', label: 'Objecten', icon: Building2 },
  { path: '/referentieobjecten', label: 'Referentieobjecten', icon: Library },
  { path: '/deals', label: 'Deals', icon: Handshake },
  { path: '/taken', label: 'Taken', icon: CheckSquare },
  { path: '/rapportage', label: 'Rapportage', icon: BarChart3 },
];

function GebruikerMenu() {
  const { user, isAdmin, signOut } = useAuth();
  if (!user) return null;
  const initialen = (user.email || '?').slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors w-full text-left">
          <div className="h-7 w-7 rounded-full bg-sidebar-primary/20 text-sidebar-primary flex items-center justify-center text-xs font-medium shrink-0">
            {initialen}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-sidebar-foreground truncate font-medium">{user.email}</p>
            <p className="text-[10px] text-sidebar-foreground/60">{isAdmin ? 'Admin' : 'Medewerker'}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Ingelogd als</p>
          <p className="text-sm truncate">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin"><Shield className="h-4 w-4 mr-2" /> Gebruikersbeheer</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-2" /> Uitloggen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">Bito</span>
          <span className="text-lg font-light tracking-tight text-sidebar-foreground/60 ml-1">Vastgoed</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent/80" aria-hidden />
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                }`}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" aria-hidden />}
                <item.icon className={`h-4 w-4 ${isActive ? 'text-accent' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border">
          <GebruikerMenu />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card sticky top-0 z-30">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-foreground">Bito</span>
            <span className="text-lg font-light text-muted-foreground ml-1">Vastgoed</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 -mr-2 rounded-md hover:bg-muted text-foreground"
            aria-label={mobileOpen ? 'Menu sluiten' : 'Menu openen'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
            <div className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="mb-6 flex items-center">
                <span className="text-lg font-semibold text-sidebar-foreground">Bito</span>
                <span className="text-lg font-light text-sidebar-foreground/60 ml-1">Vastgoed</span>
              </div>
              <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? 'text-accent' : ''}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-border pt-3">
                <GebruikerMenu />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
