import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Search,
  Building2,
  Handshake,
  CheckSquare,
  FileText,
  BarChart3,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/relaties', label: 'Relaties', icon: Users },
  { path: '/zoekprofielen', label: 'Zoekprofielen', icon: Search },
  { path: '/objecten', label: 'Objecten', icon: Building2 },
  { path: '/deals', label: 'Deals', icon: Handshake },
  { path: '/taken', label: 'Taken', icon: CheckSquare },
  { path: '/rapportage', label: 'Rapportage', icon: BarChart3 },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 border-r border-border bg-card">
        <div className="h-14 flex items-center px-5 border-b border-border">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Bito
          </span>
          <span className="text-lg font-light tracking-tight text-muted-foreground ml-1">
            Vastgoed
          </span>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Bito Dealflow v1.0</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-foreground">Bito</span>
            <span className="text-lg font-light text-muted-foreground ml-1">Vastgoed</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-md hover:bg-muted text-foreground"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
            <div className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border p-4" onClick={e => e.stopPropagation()}>
              <div className="mb-6">
                <span className="text-lg font-semibold text-foreground">Bito</span>
                <span className="text-lg font-light text-muted-foreground ml-1">Vastgoed</span>
              </div>
              <nav className="space-y-1">
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
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
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
