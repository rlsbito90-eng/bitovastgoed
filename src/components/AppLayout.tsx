import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Search,
  Building2,
  Handshake,
  CheckSquare,
  BarChart3,
  Menu,
  X,
  LogOut,
  Shield,
  Library,
  GitBranch,
  Target,
  PanelLeftClose,
  PanelLeftOpen,
  Calculator,
  Radar,
  Plus,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { useSwipeMenu } from "@/hooks/useSwipeMenu";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MatchAlertBadge from "@/components/MatchAlertBadge";
import NotificationsBell from "@/components/NotificationsBell";
import PullToRefresh from "@/components/PullToRefresh";
import RefreshButton from "@/components/RefreshButton";
import { useAutoRefreshOnFocus } from "@/hooks/useAppRefresh";

// Test-flag: hamburger rechts op mobiel. Zet op `false` om terug te draaien.
// Zie .lovable/plan.md (Mobile Workflow Polish — Blok 6).
const HAMBURGER_RIGHT_MOBILE = true;

const navItems: { path: string; label: string; icon: any; groupEnd?: boolean }[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, groupEnd: true },
  { path: "/taken", label: "Taken", icon: CheckSquare },
  { path: "/relaties", label: "Relaties", icon: Users, groupEnd: true },
  { path: "/objecten", label: "Aanbod", icon: Building2 },
  { path: "/zoekprofielen", label: "Matching", icon: Search },
  { path: "/referentieobjecten", label: "Referenties", icon: Library },
  { path: "/vastgoedrekenen", label: "Vastgoedrekenen", icon: Calculator, groupEnd: true },
  { path: "/deals", label: "Deals", icon: Handshake },
  { path: "/pipeline", label: "Pipeline", icon: GitBranch, groupEnd: true },
  { path: "/acquisitie", label: "Acquisitie", icon: Target },
  { path: "/acquisitie/funnel", label: "Acquisitie-funnel", icon: BarChart3 },
  { path: "/off-market", label: "Off-Market Radar", icon: Radar },
  { path: "/rapportage", label: "Rapportage", icon: BarChart3 },
];

function GebruikerMenu({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  if (!user) {
    return (
      <div className={`px-2 py-1.5 text-[10px] text-sidebar-foreground/60 ${collapsed ? "text-center" : ""}`}>
        {collapsed ? "—" : "Login tijdelijk uitgeschakeld"}
      </div>
    );
  }
  const initialen = (user.email || "?").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors w-full text-left ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? (user.email ?? "") : undefined}
        >
          <div className="h-7 w-7 rounded-full bg-sidebar-primary/20 text-sidebar-primary flex items-center justify-center text-xs font-medium shrink-0">
            {initialen}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs text-sidebar-foreground truncate font-medium">{user.email}</p>
              <p className="text-[10px] text-sidebar-foreground/60">{isAdmin ? "Admin" : "Medewerker"}</p>
            </div>
          )}
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
            <Link to="/admin#gebruikersbeheer" onClick={() => onNavigate?.()} data-testid="menu-gebruikersbeheer">
              <Shield className="h-4 w-4 mr-2" /> Gebruikersbeheer
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { onNavigate?.(); signOut(); }}>
          <LogOut className="h-4 w-4 mr-2" /> Uitloggen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    // Eenvoudige routing: doorsturen naar relaties met zoekterm in URL
    navigate(`/relaties?q=${encodeURIComponent(term)}`);
  }
  return (
    <form onSubmit={submit} className="hidden md:flex items-center gap-2 w-full max-w-md">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek relaties, objecten, deals…"
          className="w-full h-9 pl-9 pr-16 rounded-lg bg-muted/60 border border-transparent focus:border-border focus:bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 transition-all"
        />
        <kbd className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("bito.sidebar.collapsed") === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("bito.sidebar.collapsed", desktopCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [desktopCollapsed]);

  useSwipeMenu({
    isOpen: mobileOpen,
    onOpen: () => setMobileOpen(true),
    onClose: () => setMobileOpen(false),
  });

  // Automatisch verversen bij terugkeer naar de app/tab
  useAutoRefreshOnFocus();

  return (
    // overflow-x-hidden op de root voorkomt horizontaal "schuiven" op mobiel
    <div className="flex h-screen bg-background overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col border-r border-sidebar-border/60 glass-dark text-sidebar-foreground shrink-0 transition-[width] duration-200 ease-out ${
          desktopCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        <Link
          to="/"
          className={`h-24 flex items-center border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors ${
            desktopCollapsed ? "justify-center px-0" : "px-3"
          }`}
          title={desktopCollapsed ? "Bito Vastgoed" : undefined}
        >
          {desktopCollapsed ? (
            <img src="/apple-touch-icon-v3.png" alt="Bito Vastgoed" className="h-12 w-12 object-contain" />
          ) : (
            <img src="/logo-bito-vastgoed.png" alt="Bito Vastgoed" className="h-24 w-auto max-w-full object-contain" />
          )}
        </Link>
        <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto ${desktopCollapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => {
            const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  data-active={isActive ? "true" : "false"}
                  title={desktopCollapsed ? item.label : undefined}
                  className={`relative flex items-center rounded-lg text-sm transition-all duration-200 ${
                    desktopCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                  } ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium shadow-[0_0_0_1px_hsl(var(--accent)/0.25),0_8px_22px_-12px_hsl(var(--accent)/0.55)] ring-1 ring-accent/30"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-accent shadow-[0_0_10px_hsl(var(--accent)/0.6)]" aria-hidden />
                  )}
                  <item.icon className={`h-[18px] w-[18px] ${isActive ? "text-accent" : ""}`} />
                  {!desktopCollapsed && <span className="tracking-tight">{item.label}</span>}
                </Link>
                {item.groupEnd && (
                  <div className={`my-2 border-t border-sidebar-border/40 ${desktopCollapsed ? "mx-2" : "mx-1"}`} aria-hidden />
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border/60">
          <GebruikerMenu collapsed={desktopCollapsed} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
      <header
        className="lg:hidden flex items-center justify-between px-3 border-b border-border/60 glass-topbar sticky top-0 z-40"
        style={{ height: "var(--mobile-header-height, 3.5rem)" }}
      >
        {HAMBURGER_RIGHT_MOBILE ? (
          <>
            <Link to="/" className="flex items-center px-1 py-1 rounded-md hover:bg-muted/60 transition-colors min-w-0">
              <img
                src="/logo-bito-vastgoed.png"
                alt="Bito Vastgoed"
                className="h-9 w-auto max-w-[140px] object-contain"
              />
            </Link>
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              <RefreshButton />
              <MatchAlertBadge />
              <NotificationsBell />
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 -mr-1 rounded-md hover:bg-muted text-foreground min-w-11 min-h-11 flex items-center justify-center"
                aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 -ml-1 rounded-md hover:bg-muted text-foreground"
                aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link to="/" className="flex items-center px-1 py-1 rounded-md hover:bg-muted/60 transition-colors min-w-0">
                <img
                  src="/logo-bito-vastgoed.png"
                  alt="Bito Vastgoed"
                  className="h-9 w-auto max-w-[140px] object-contain"
                />
              </Link>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <RefreshButton />
              <MatchAlertBadge />
              <NotificationsBell />
            </div>
          </>
        )}
      </header>

        {/* Desktop topbar — premium: collapse, search, notifs, +Nieuw */}
        <header className="hidden lg:flex items-center gap-4 h-16 px-6 border-b border-border/60 glass-topbar sticky top-0 z-40">
          <button
            onClick={() => setDesktopCollapsed((v) => !v)}
            className="p-1.5 -ml-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label={desktopCollapsed ? "Menu uitklappen" : "Menu inklappen"}
            title={desktopCollapsed ? "Menu uitklappen" : "Menu inklappen"}
          >
            {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <RefreshButton />
            <MatchAlertBadge />
            <NotificationsBell />
            <Link to="/taken" className="btn-premium ml-2">
              <Plus className="h-4 w-4" />
              <span>Nieuw</span>
            </Link>

          </div>
        </header>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 glass-overlay"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="fixed left-0 top-0 bottom-0 w-72 glass-dark text-sidebar-foreground border-r border-sidebar-border/50 p-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="mb-6 flex items-center -mx-2 px-2 py-1 rounded-md hover:bg-sidebar-accent"
              >
                <img
                  src="/logo-bito-vastgoed.png"
                  alt="Bito Vastgoed"
                  className="h-10 w-auto max-w-[120px] object-contain"
                />
              </Link>
              <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                  const isActive =
                    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
                  return (
                    <div key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-accent" : ""}`} />
                        {item.label}
                      </Link>
                      {item.groupEnd && (
                        <div className="my-1.5 mx-1 border-t border-sidebar-border/60" aria-hidden />
                      )}
                    </div>
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-border pt-3">
                <GebruikerMenu onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Main content area — overflow-x-hidden voorkomt mobiele zijdelingse scroll */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
