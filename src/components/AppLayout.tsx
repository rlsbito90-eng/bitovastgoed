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
  Lightbulb,
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
import {
  VR_WORKSPACE_NAV_ITEMS,
  resolveVrWorkspaceSection,
} from "@/lib/vastgoedrekenen/workspaceNavigation";

const HAMBURGER_RIGHT_MOBILE = true;

type NavGroup = "Werk" | "Vastgoed" | "Transacties" | "Acquisitie" | "Inzicht";

type NavItem = {
  path: string;
  label: string;
  icon: any;
  group: NavGroup;
  groupEnd?: boolean;
};

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, group: "Werk" },
  { path: "/taken", label: "Taken", icon: CheckSquare, group: "Werk" },
  { path: "/relaties", label: "Relaties", icon: Users, group: "Werk", groupEnd: true },
  { path: "/objecten", label: "Aanbod", icon: Building2, group: "Vastgoed" },
  { path: "/zoekprofielen", label: "Matching", icon: Search, group: "Vastgoed" },
  { path: "/referentieobjecten", label: "Referenties", icon: Library, group: "Vastgoed" },
  { path: "/vastgoedrekenen", label: "Vastgoedrekenen", icon: Calculator, group: "Vastgoed", groupEnd: true },
  { path: "/deals", label: "Deals", icon: Handshake, group: "Transacties" },
  { path: "/pipeline", label: "Pipeline", icon: GitBranch, group: "Transacties", groupEnd: true },
  { path: "/vastgoedkansen", label: "Vastgoedkansen", icon: Lightbulb, group: "Acquisitie" },
  { path: "/acquisitie", label: "Acquisitie", icon: Target, group: "Acquisitie" },
  { path: "/acquisitie/funnel", label: "Acquisitie-funnel", icon: BarChart3, group: "Acquisitie" },
  { path: "/off-market", label: "Off-Market Radar", icon: Radar, group: "Acquisitie", groupEnd: true },
  { path: "/rapportage", label: "Rapportage", icon: BarChart3, group: "Inzicht" },
];

export function isNavItemActive(itemPath: string, pathname: string): boolean {
  if (itemPath === "/") return pathname === "/";
  if (itemPath === "/acquisitie") {
    return pathname === "/acquisitie"
      || pathname.startsWith("/acquisitie/targets/")
      || pathname.startsWith("/acquisitie/campagnes/");
  }
  return pathname.startsWith(itemPath);
}

function VastgoedrekenenSubmenu({
  pathname,
  search,
  onNavigate,
}: {
  pathname: string;
  search: string;
  onNavigate?: () => void;
}) {
  if (!pathname.startsWith("/vastgoedrekenen")) return null;
  const actief = resolveVrWorkspaceSection(search);
  return (
    <ul className="mt-1 ml-5 space-y-0.5 border-l border-sidebar-border/60 pl-2" data-testid="vr-submenu">
      {VR_WORKSPACE_NAV_ITEMS.map((item) => (
        <li key={item.section}>
          <Link
            to={item.href}
            onClick={() => onNavigate?.()}
            data-testid={`vr-submenu-${item.section}`}
            aria-current={item.section === actief ? "page" : undefined}
            className={`block rounded-md px-2 py-2 text-xs transition-colors ${
              item.section === actief
                ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
            }`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GebruikerMenu({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  if (!user) {
    return (
      <div className={`px-2 py-1.5 text-xs text-sidebar-foreground/60 ${collapsed ? "text-center" : ""}`}>
        {collapsed ? "—" : "Login tijdelijk uitgeschakeld"}
      </div>
    );
  }

  const initialen = (user.email || "?").slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? (user.email ?? "") : undefined}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-medium text-sidebar-primary">
            {initialen}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{user.email}</p>
              <p className="text-xs text-sidebar-foreground/60">{isAdmin ? "Admin" : "Medewerker"}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Ingelogd als</p>
          <p className="truncate text-sm">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin#gebruikersbeheer" onClick={() => onNavigate?.()} data-testid="menu-gebruikersbeheer">
              <Shield className="mr-2 h-4 w-4" /> Gebruikersbeheer
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { onNavigate?.(); signOut(); }}>
          <LogOut className="mr-2 h-4 w-4" /> Uitloggen
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
    navigate(`/relaties?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={submit} className="hidden w-full max-w-md items-center gap-2 md:flex">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek relaties, objecten, deals…"
          className="h-9 w-full rounded-lg border border-transparent bg-muted/60 pl-9 pr-16 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-border focus:bg-card focus:ring-2 focus:ring-ring/30"
        />
        <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border/70 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline-flex">
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useSwipeMenu({
    isOpen: mobileOpen,
    onOpen: () => setMobileOpen(true),
    onClose: () => setMobileOpen(false),
  });

  useAutoRefreshOnFocus();

  return (
    <div className="flex h-screen min-h-0 overflow-x-hidden bg-background">
      <aside
        className={`hidden shrink-0 flex-col border-r border-sidebar-border/60 glass-dark text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex ${
          desktopCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        <Link
          to="/"
          className={`flex h-24 items-center border-b border-sidebar-border transition-colors hover:bg-sidebar-accent/40 ${
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
        <nav className={`flex-1 space-y-0.5 overflow-y-auto py-4 ${desktopCollapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.path, location.pathname);
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
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                  }`}
                >
                  {isActive && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-accent" aria-hidden />}
                  <item.icon className={`h-[18px] w-[18px] ${isActive ? "text-accent" : ""}`} />
                  {!desktopCollapsed && <span className="tracking-tight">{item.label}</span>}
                </Link>
                {item.path === "/vastgoedrekenen" && !desktopCollapsed && (
                  <VastgoedrekenenSubmenu pathname={location.pathname} search={location.search} />
                )}
                {item.groupEnd && <div className={`my-2 border-t border-sidebar-border/40 ${desktopCollapsed ? "mx-2" : "mx-1"}`} aria-hidden />}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border/60 p-3">
          <GebruikerMenu collapsed={desktopCollapsed} />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <header
          className="sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-border/60 px-3 glass-topbar lg:hidden"
          style={{
            height: "calc(var(--mobile-header-height, 3.5rem) + env(safe-area-inset-top))",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          {HAMBURGER_RIGHT_MOBILE ? (
            <>
              <Link to="/" className="flex min-w-0 items-center rounded-md px-1 py-1 transition-colors hover:bg-muted/60">
                <img src="/logo-bito-vastgoed.png" alt="Bito Vastgoed" className="h-9 w-auto max-w-[132px] object-contain" />
              </Link>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <RefreshButton />
                <MatchAlertBadge />
                <NotificationsBell />
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="-mr-1 flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-foreground hover:bg-muted"
                  aria-label={mobileOpen ? "Navigatie sluiten" : "Menu openen"}
                  aria-expanded={mobileOpen}
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </>
          ) : null}
        </header>

        <header className="sticky top-0 z-40 hidden h-16 shrink-0 items-center gap-4 border-b border-border/60 px-6 glass-topbar lg:flex">
          <button
            onClick={() => setDesktopCollapsed((v) => !v)}
            className="-ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

        {mobileOpen && (
          <div className="fixed inset-0 z-50 glass-overlay lg:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="fixed bottom-0 left-0 top-0 flex w-[min(86vw,20rem)] flex-col border-r border-sidebar-border/50 p-4 glass-dark text-sidebar-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label="Mobiele navigatie"
            >
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-md px-1 py-1 hover:bg-sidebar-accent">
                  <img src="/logo-bito-vastgoed.png" alt="Bito Vastgoed" className="h-10 w-auto max-w-[130px] object-contain" />
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sidebar-accent"
                  aria-label="Menu sluiten"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Hoofdnavigatie">
                {navItems.map((item, index) => {
                  const isActive = isNavItemActive(item.path, location.pathname);
                  const showGroup = index === 0 || navItems[index - 1].group !== item.group;
                  return (
                    <div key={item.path}>
                      {showGroup && (
                        <p className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45 first:mt-0">
                          {item.group}
                        </p>
                      )}
                      <Link
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          isActive
                            ? "bg-sidebar-accent font-medium text-sidebar-foreground ring-1 ring-accent/20"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-accent" : ""}`} />
                        <span>{item.label}</span>
                      </Link>
                      {item.path === "/vastgoedrekenen" && (
                        <VastgoedrekenenSubmenu pathname={location.pathname} search={location.search} onNavigate={() => setMobileOpen(false)} />
                      )}
                    </div>
                  );
                })}
              </nav>

              <div className="shrink-0 border-t border-sidebar-border pt-3">
                <GebruikerMenu onNavigate={() => setMobileOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
