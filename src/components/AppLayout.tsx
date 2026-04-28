import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
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

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/relaties", label: "Relaties", icon: Users },
  { path: "/zoekprofielen", label: "Zoekprofielen", icon: Search },
  { path: "/objecten", label: "Objecten", icon: Building2 },
  { path: "/referentieobjecten", label: "Referentieobjecten", icon: Library },
  { path: "/deals", label: "Deals", icon: Handshake },
  { path: "/pipeline", label: "Pipeline", icon: GitBranch },
  { path: "/taken", label: "Taken", icon: CheckSquare },
  { path: "/rapportage", label: "Rapportage", icon: BarChart3 },
];

function GebruikerMenu({ collapsed = false }: { collapsed?: boolean }) {
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
            <Link to="/admin">
              <Shield className="h-4 w-4 mr-2" /> Gebruikersbeheer
            </Link>
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

  return (
    // overflow-x-hidden op de root voorkomt horizontaal "schuiven" op mobiel
    <div className="flex h-screen bg-background overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0 transition-[width] duration-200 ease-out ${
          desktopCollapsed ? "lg:w-14" : "lg:w-64"
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
            <img src="/apple-touch-icon-v3.png" alt="Bito Vastgoed" className="h-8 w-8 object-contain" />
          ) : (
            <img src="/logo-bito-vastgoed.png" alt="Bito Vastgoed" className="h-24 w-auto max-w-full object-contain" />
          )}
        </Link>
        <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto ${desktopCollapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => {
            const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={desktopCollapsed ? item.label : undefined}
                className={`relative flex items-center rounded-md text-sm transition-colors ${
                  desktopCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2"
                } ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" aria-hidden />
                )}
                <item.icon className={`h-4 w-4 ${isActive ? "text-accent" : ""}`} />
                {!desktopCollapsed && item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border">
          <GebruikerMenu collapsed={desktopCollapsed} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card sticky top-0 z-30">
          <Link to="/" className="flex items-center -ml-1 px-2 py-1 rounded-md hover:bg-muted transition-colors">
            <img
              src="/logo-bito-vastgoed.png"
              alt="Bito Vastgoed"
              className="h-9 w-auto max-w-[120px] object-contain"
            />
          </Link>
          <div className="flex items-center gap-1">
            <MatchAlertBadge />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 -mr-2 rounded-md hover:bg-muted text-foreground"
              aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Desktop topbar — collapse-knop links, match-badge rechts */}
        <header className="hidden lg:flex items-center justify-between h-12 px-6 border-b border-border bg-card">
          <button
            onClick={() => setDesktopCollapsed((v) => !v)}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label={desktopCollapsed ? "Menu uitklappen" : "Menu inklappen"}
            title={desktopCollapsed ? "Menu uitklappen" : "Menu inklappen"}
          >
            {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <MatchAlertBadge />
        </header>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex flex-col"
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
                    <Link
                      key={item.path}
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
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-border pt-3">
                <GebruikerMenu />
              </div>
            </div>
          </div>
        )}

        {/* Main content area — overflow-x-hidden voorkomt mobiele zijdelingse scroll */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
