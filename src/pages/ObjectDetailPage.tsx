import { useEffect, useRef, useState, useMemo, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import {
  getMatchesForObjectFromData,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatM2,
  formatPercent,
  formatEurPerM2,
  formatHuurPerM2PerJaar,
  
  ASSET_CLASS_LABELS,
  ONDERHOUDSSTAAT_LABELS,
  VERKOPER_VIA_LABELS,
  DOCUMENT_TYPE_LABELS,
  INDEXATIE_BASIS_LABELS,
  AANBIEDINGSWIJZE_LABELS,
  OBJECT_STATUS_LABELS,
} from '@/data/mock-data';
import {
  resolveBAR,
  resolveNAR,
  resolveNOI,
  resolveDerived,
  calculateFactor,
  calculateMonthlyRent,
  calculateRentPerM2,
  deriveVerhuurMetrics,
  isStrongMatch,
  countKandidaten,
  selectLeadDeal,
  calculateExpectedFee,

} from '@/lib/derivations';

import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';
import {
  ArrowLeft, MapPin, Pencil, Trash2, EyeOff, Star,
  FileText, Download, Building2, Phone, Mail,
  Sparkles, Send, StickyNote, Upload, ChevronRight,
  Activity, Calculator, FolderOpen, Users, LineChart,
  Info, Calendar, Target, AlertCircle, ArrowUpRight, Coins, MoreHorizontal, ClipboardCheck, Scale, Contact as ContactIcon,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import BiedingenSection from '@/components/biedingen/BiedingenSection';
import KandidaatSelectieDialog from '@/components/pipeline/KandidaatSelectieDialog';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import GeenActieBadge, { isVerlopen as taakIsVerlopen } from '@/components/GeenActieBadge';

import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import ObjectReferentieAnalyseSectie from '@/components/object/ObjectReferentieAnalyseSectie';
import { ClassificatieRij } from '@/components/TaxonomieBadges';
import MatchUitleg from '@/components/MatchUitleg';
import ObjectPipelineSectie from '@/components/pipeline/ObjectPipelineSectie';
import ObjectPipelineFaseSectie from '@/components/pipeline/ObjectPipelineFaseSectie';
import ArchiveerDialog from '@/components/ArchiveerDialog';
import { Archive, ArchiveRestore } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getSignedUrls, getSignedUrl, formatFileSize } from '@/lib/storage';
import ObjectPdfButton from '@/components/pdf/ObjectPdfButton';

import ListNavigator from '@/components/ListNavigator';
import { getListNavigation } from '@/lib/listNavigation';
import VastgoedrekenenTab from '@/components/vastgoedrekenen/VastgoedrekenenTab';
import ObjectDossierCard, { type DossierTab } from '@/components/object/dossier/ObjectDossierCard';
import Timeline from '@/components/contactmoment/Timeline';
import { buildMapsUrl } from '@/lib/maps';

/* ============================================================
 * Local presentational primitives — institutional dealroom look
 * ============================================================ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="field-label">{label}</p>
      <div className="field-value mt-1.5">{children}</div>
    </div>
  );
}

/** Compact underwriting tile — dense, mono numeric */
function MetricTile({
  label,
  value,
  hint,
  accent,
  tone = 'default',
  badge,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  tone?: 'default' | 'positive' | 'warning';
  /** Subtiele bron-indicatie: AUTO (afgeleid) of HANDMATIG (override). */
  badge?: 'auto' | 'handmatig';
}) {
  const toneCls =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-foreground';
  return (
    <div
      className={`relative rounded-lg border border-border/60 bg-card/60 px-3.5 py-3 min-w-0 overflow-hidden ${
        accent ? 'accent-rule' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">
          {label}
        </p>
        {badge && (
          <span
            className={`shrink-0 inline-flex items-center rounded-sm px-1 py-px text-[8.5px] font-semibold uppercase tracking-[0.08em] border ${
              badge === 'auto'
                ? 'border-border/60 text-muted-foreground/80 bg-muted/40'
                : 'border-accent/40 text-accent bg-accent/5'
            }`}
            title={badge === 'auto' ? 'Automatisch afgeleid' : 'Handmatig ingevoerd / override'}
          >
            {badge === 'auto' ? 'auto' : 'handm.'}
          </span>
        )}
      </div>
      <p className={`mt-1.5 text-base sm:text-lg font-semibold font-mono-data leading-none break-words ${toneCls}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}

/** Header chip for hero metadata strip */
function HeaderChip({
  icon: Icon,
  children,
  href,
  title,
}: {
  icon?: any;
  children: ReactNode;
  href?: string;
  title?: string;
}) {
  const cls =
    'inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 bg-background/60 backdrop-blur border border-border/50 rounded-full px-2.5 py-1';
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        className={`${cls} hover:text-foreground hover:border-accent/60 hover:bg-background/80 transition-colors cursor-pointer min-h-[28px]`}
      >
        {Icon && <Icon className="h-3 w-3 text-accent" />}
        <span>{children}</span>
        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
      </a>
    );
  }
  return (
    <span className={cls}>
      {Icon && <Icon className="h-3 w-3 text-accent" />}
      {children}
    </span>
  );
}

/** Section anchor wrapper with consistent title */
function SectionAnchor({
  id,
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-28 lg:scroll-mt-36 ${className ?? ''}`}>
      <div className="flex items-end justify-between gap-3 mb-3 pl-1 sm:pl-2">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/80">
              {eyebrow}
            </p>
          )}
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight mt-0.5">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Helpers — bepalen of conditionele detail-secties zichtbaar moeten zijn */
function hasPotentieData(o: any): boolean {
  return !!(o && (o.ontwikkelPotentie || o.transformatiePotentie || o.potentieOmschrijving ||
    o.potentieStrategie || o.potentieExtraM2 != null || o.potentieExtraUnits != null ||
    o.potentieOnderbouwingStatus || o.potentieAfhankelijkheden || o.potentieBron));
}
function hasJuridischData(o: any): boolean {
  return !!(o && (o.eigendomssituatie || o.erfpachtinformatie || o.bestemmingsinformatie ||
    o.kadastraalNummer || o.kadastraleGemeente || o.kadastraleSectie));
}
function hasContactenData(o: any): boolean {
  return !!(o && (o.verkoperNaam || o.verkoperEmail || o.verkoperTelefoon ||
    o.contactNaam || o.contactEmail || o.contactTelefoon));
}

/** Sticky section nav (cockpit subnav) — vaste basis, conditioneel uitgebreid in page */
type SectionDef = { id: string; label: string; icon: any };

const BASE_SECTIONS: SectionDef[] = [
  { id: 'overzicht', label: 'Overzicht', icon: Info },
  { id: 'dealflow', label: 'Dealflow', icon: Target },
  { id: 'financieel', label: 'Financieel', icon: LineChart },
  { id: 'verhuur', label: 'Verhuur', icon: Users },
  { id: 'pand', label: 'Pand', icon: Building2 },
  // potentie (conditioneel) wordt hier dynamisch tussen geplaatst
  // juridisch (conditioneel)
  // verkoper (conditioneel) — vervangt oude 'contacten'
  { id: 'aanbieding', label: 'Aanbieding', icon: Sparkles },
  { id: 'dossier', label: 'Dossier', icon: ClipboardCheck },
  { id: 'kandidaten', label: 'Kandidaten', icon: Users },
  // referenties (conditioneel) wordt hier dynamisch tussen geplaatst (na 'kandidaten')
  { id: 'vastgoedrekenen', label: 'Vastgoedrekenen', icon: Calculator },
  { id: 'biedingen', label: 'Biedingen', icon: Coins },
  { id: 'activiteit', label: 'Activiteit', icon: Target },
];

/** Mobile-only sectiebar items — op desktop staan deze al in de rechter sidebar */
const MOBILE_ONLY_SECTIONS: SectionDef[] = [
  { id: 'deal-cockpit', label: 'Cockpit', icon: Target },
  { id: 'next-action', label: 'Next action', icon: Calendar },
  { id: 'quick-actions', label: 'Quick actions', icon: Sparkles },
];

/* ============================================================
 * Workspace tabs (Optie C — hybride layout V1)
 * ============================================================ */

type WorkspaceTabId =
  | 'overzicht' | 'dealflow' | 'kandidaten' | 'vastgoedrekenen'
  | 'financieel' | 'dossier' | 'pand' | 'meer' | 'cockpit';

const WORKSPACE_TABS: Array<{ id: WorkspaceTabId; label: string; icon: any; mobileOnly?: boolean }> = [
  { id: 'overzicht',       label: 'Overzicht',       icon: Info },
  { id: 'dealflow',        label: 'Dealflow',        icon: Target },
  { id: 'kandidaten',      label: 'Kandidaten',      icon: Users },
  { id: 'vastgoedrekenen', label: 'Vastgoedrekenen', icon: Calculator },
  { id: 'financieel',      label: 'Financieel',      icon: LineChart },
  { id: 'dossier',         label: 'Dossier',         icon: ClipboardCheck },
  { id: 'pand',            label: 'Pand',            icon: Building2 },
  { id: 'meer',            label: 'Meer',            icon: MoreHorizontal },
  { id: 'cockpit',         label: 'Cockpit',         icon: Target, mobileOnly: true },
];

/** Map van anchor-id (deep links blijven werken) naar tab waarop het anchor leeft */
const ANCHOR_TO_TAB: Record<string, WorkspaceTabId> = {
  overzicht: 'overzicht',
  dealflow: 'dealflow', biedingen: 'dealflow', activiteit: 'dealflow',
  kandidaten: 'kandidaten', referenties: 'kandidaten',
  vastgoedrekenen: 'vastgoedrekenen',
  financieel: 'financieel', verhuur: 'financieel',
  dossier: 'dossier', aanbieding: 'dossier', documenten: 'dossier',
  pand: 'pand', potentie: 'pand',
  juridisch: 'meer', verkoper: 'meer',
  'deal-cockpit': 'cockpit', 'next-action': 'cockpit', 'quick-actions': 'cockpit',
};

const WORKSPACE_TAB_STORAGE_KEY = 'object-detail:last-tab';

/** Workspace tabs nav — vereenvoudigde versie van SectionNav voor tab-state */
function WorkspaceTabsNav({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ id: WorkspaceTabId; label: string; icon: any; mobileOnly?: boolean }>;
  active: WorkspaceTabId;
  onSelect: (id: WorkspaceTabId) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const updateEdges = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const max = sc.scrollWidth - sc.clientWidth;
    setEdges({ left: sc.scrollLeft > 2, right: sc.scrollLeft < max - 2 });
  };

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = sc.scrollWidth - sc.clientWidth;
      if (max <= 0) return;
      e.preventDefault();
      sc.scrollLeft += e.deltaY;
      updateEdges();
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    sc.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    updateEdges();
    return () => {
      sc.removeEventListener('wheel', onWheel as any);
      sc.removeEventListener('scroll', updateEdges as any);
      window.removeEventListener('resize', updateEdges);
    };
  }, []);

  // Centreer actieve tab indien buiten beeld
  useEffect(() => {
    const el = tabRefs.current[active];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const left = el.offsetLeft - sc.clientWidth / 2 + el.offsetWidth / 2;
    const max = sc.scrollWidth - sc.clientWidth;
    sc.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior: 'smooth' });
  }, [active]);

  return (
    <nav
      data-object-section-nav="true"
      className="sticky top-0 z-20 -mx-3 sm:-mx-8 lg:-mx-10 px-3 sm:px-8 lg:px-10 pt-2 pb-2.5 bg-background/95 backdrop-blur-md border-b border-border/40"
    >
      <div className="relative">
        {edges.left && (
          <div aria-hidden className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-background/95 to-transparent rounded-l-xl" />
        )}
        {edges.right && (
          <div aria-hidden className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-background/95 to-transparent rounded-r-xl" />
        )}
        <div
          ref={scrollerRef}
          className="glass-topbar rounded-xl border border-border/60 shadow-sm px-2 py-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap flex items-stretch gap-1 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                ref={(el) => { tabRefs.current[t.id] = el; }}
                className={`group relative inline-flex shrink-0 items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full text-[13px] sm:text-sm font-medium transition-all ${t.mobileOnly ? 'lg:hidden' : ''} ${
                  isActive
                    ? 'glass-pill-active text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/40'
                }`}
              >
                <t.icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}





function SectionNav({ active, sections }: { active: string; sections: SectionDef[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const programmaticUntilRef = useRef<number>(0);
  const lastCenteredRef = useRef<string>('');
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const prefersReduced = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const updateEdges = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const max = sc.scrollWidth - sc.clientWidth;
    setEdges({ left: sc.scrollLeft > 2, right: sc.scrollLeft < max - 2 });
  };

  // Wheel → horizontaal scrollen op desktop (verticale wheel mapt naar horizontale scroll)
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      // Trackpad horizontale swipe levert deltaX → niets doen, browser regelt het al
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = sc.scrollWidth - sc.clientWidth;
      if (max <= 0) return;
      // Voorkom dat de page meescrollt wanneer we horizontaal kunnen scrollen
      e.preventDefault();
      sc.scrollLeft += e.deltaY;
      updateEdges();
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    sc.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    updateEdges();
    return () => {
      sc.removeEventListener('wheel', onWheel as any);
      sc.removeEventListener('scroll', updateEdges as any);
      window.removeEventListener('resize', updateEdges);
    };
  }, []);

  const isTabFullyVisible = (el: HTMLElement, scroller: HTMLElement, pad = 24) => {
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    const viewLeft = scroller.scrollLeft + pad;
    const viewRight = scroller.scrollLeft + scroller.clientWidth - pad;
    return left >= viewLeft && right <= viewRight;
  };

  const centerTab = (id: string, force = false) => {
    const el = tabRefs.current[id];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    if (!force && isTabFullyVisible(el, scroller)) {
      lastCenteredRef.current = id;
      return;
    }
    const target = el.offsetLeft - scroller.clientWidth / 2 + el.offsetWidth / 2;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const left = Math.max(0, Math.min(max, target));
    if (Math.abs(scroller.scrollLeft - left) < 4) {
      lastCenteredRef.current = id;
      return;
    }
    scroller.scrollTo({ left, behavior: prefersReduced() ? 'auto' : 'smooth' });
    lastCenteredRef.current = id;
  };

  // Scrollspy-driven updates: alleen centreren als tab buiten beeld is en
  // niet tijdens een programmatic scroll. Debounced via rAF.
  useEffect(() => {
    if (!active) return;
    if (Date.now() < programmaticUntilRef.current) return;
    if (lastCenteredRef.current === active) return;
    const raf = requestAnimationFrame(() => centerTab(active, false));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    // Geef click-centering voorrang en negeer scrollspy-centering tijdelijk.
    programmaticUntilRef.current = Date.now() + 700;
    centerTab(id, true);

    const target = document.getElementById(id);
    if (!target) return;

    const subNav = navRef.current?.getBoundingClientRect().height ?? 52;
    const buffer = 8;

    const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
      let el: HTMLElement | null = node?.parentElement ?? null;
      while (el) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
      }
      return window;
    };
    const scrollParent = getScrollParent(target);
    const behavior: ScrollBehavior = prefersReduced() ? 'auto' : 'smooth';

    if (scrollParent === window) {
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      const rootStyles = getComputedStyle(document.documentElement);
      const parsePx = (v: string, fb: number) => {
        const n = parseFloat(v);
        if (!n) return fb;
        return v.trim().endsWith('rem') ? n * 16 : n;
      };
      const topbar = isDesktop
        ? parsePx(rootStyles.getPropertyValue('--desktop-header-height'), 64)
        : parsePx(rootStyles.getPropertyValue('--mobile-header-height'), 56);
      const top = target.getBoundingClientRect().top + window.scrollY - (topbar + subNav + buffer);
      window.scrollTo({ top, behavior });
    } else {
      const parent = scrollParent as HTMLElement;
      const top = target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - (subNav + buffer);
      parent.scrollTo({ top, behavior });
    }

    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      ref={navRef}
      data-object-section-nav="true"
      className="sticky top-0 z-20 -mx-3 sm:-mx-8 lg:-mx-10 px-3 sm:px-8 lg:px-10 pt-2 pb-2.5 bg-background/95 backdrop-blur-md border-b border-border/40"
    >
      <div className="relative">
        {edges.left && (
          <div aria-hidden className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-background/95 to-transparent rounded-l-xl" />
        )}
        {edges.right && (
          <div aria-hidden className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-background/95 to-transparent rounded-r-xl" />
        )}
        <div
          ref={scrollerRef}
          className="glass-topbar rounded-xl border border-border/60 shadow-sm px-2 py-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap flex items-stretch gap-1 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                ref={(el) => { tabRefs.current[s.id] = el; }}
                className={`group relative inline-flex shrink-0 items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full text-[13px] sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'glass-pill-active text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/40'
                }`}
              >
                <s.icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {s.label}
              </a>
            );
          })}
          <span aria-hidden className="lg:hidden shrink-0 self-center h-5 w-px bg-border/60 mx-1" />
          {MOBILE_ONLY_SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                ref={(el) => { tabRefs.current[s.id] = el; }}
                className={`lg:hidden group relative inline-flex shrink-0 items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full text-[13px] sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'glass-pill-active text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/40'
                }`}
              >
                <s.icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}



/* ============================================================
 * Page
 * ============================================================ */

export default function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const { labelFor } = useSubcategorieen();
  const { propertyTypeById, propertySubtypeById, dealTypeById } = usePropertyTaxonomie();
  const object = store.getObjectById(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [editInitialTab, setEditInitialTab] = useState<string>('algemeen');
  const openEdit = (tab: string = 'algemeen') => {
    setEditInitialTab(tab);
    setEditOpen(true);
  };
  const [archiefOpen, setArchiefOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const [kandidaatDialogOpen, setKandidaatDialogOpen] = useState(false);
  const [notitieDialogOpen, setNotitieDialogOpen] = useState(false);
  const [taakDialogOpen, setTaakDialogOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<any>(null);
  const [dossierOpenRequest, setDossierOpenRequest] = useState<{ tab: DossierTab; token: number } | null>(null);

  // ── Workspace tabs: bepaal welke tabs zichtbaar zijn voor dit object ──
  const visibleTabs = useMemo(() => {
    const hasMeer = !!object && (
      hasJuridischData(object) ||
      hasContactenData(object) ||
      store.getDealsByObject(object.id).length > 0
    );
    return WORKSPACE_TABS.filter(t => t.id !== 'meer' || hasMeer);
  }, [object, store]);

  // ── Tab-state: prioriteit URL (?tab=) → hash-shim → localStorage → 'overzicht' ──
  const readInitialTab = (): WorkspaceTabId => {
    if (typeof window === 'undefined') return 'overzicht';
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('tab');
    if (fromQuery && WORKSPACE_TABS.some(t => t.id === fromQuery)) return fromQuery as WorkspaceTabId;
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && ANCHOR_TO_TAB[hash]) return ANCHOR_TO_TAB[hash];
    try {
      const stored = window.localStorage.getItem(WORKSPACE_TAB_STORAGE_KEY);
      if (stored && WORKSPACE_TABS.some(t => t.id === stored)) return stored as WorkspaceTabId;
    } catch { /* ignore */ }
    return 'overzicht';
  };
  const [activeTab, setActiveTabState] = useState<WorkspaceTabId>(readInitialTab);

  const setActiveTab = (id: WorkspaceTabId) => {
    setActiveTabState(id);
    try { window.localStorage.setItem(WORKSPACE_TAB_STORAGE_KEY, id); } catch { /* ignore */ }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', id);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* ignore */ }
  };

  // Zorg dat actieve tab geldig blijft als visibleTabs verandert (bv. 'meer' verdwijnt)
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === activeTab)) {
      setActiveTabState('overzicht');
    }
  }, [visibleTabs, activeTab]);

  // Numbering voor eyebrows — gebruikt tab-volgorde (Documenten ongenummerd)
  const UNNUMBERED_SECTIONS = new Set(['documenten']);
  const eyebrowFor = (id: string, suffix?: string): string | undefined => {
    if (UNNUMBERED_SECTIONS.has(id)) return suffix;
    // Gebruik de tab-volgorde voor nummering (overzicht=01, dealflow=02, ...)
    const tabForId = ANCHOR_TO_TAB[id];
    if (!tabForId) return suffix;
    const idx = visibleTabs.filter(t => !t.mobileOnly).findIndex(t => t.id === tabForId);
    if (idx === -1) return suffix;
    const nn = String(idx + 1).padStart(2, '0');
    return suffix ? `${nn} — ${suffix}` : nn;
  };

  // Scroll naar een element binnen huidige tab (gebruikt door deep-links en quick actions)
  const performScroll = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return false;
    const sectionNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
    const sectionNavHeight = sectionNav?.getBoundingClientRect().height ?? 60;
    const buffer = 12;
    const rootStyles = getComputedStyle(document.documentElement);
    const parsePx = (v: string, fb: number) => {
      const n = parseFloat(v);
      if (!n) return fb;
      return v.trim().endsWith('rem') ? n * 16 : n;
    };
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const topbar = isDesktop
      ? parsePx(rootStyles.getPropertyValue('--desktop-header-height'), 64)
      : parsePx(rootStyles.getPropertyValue('--mobile-header-height'), 56);
    const top = target.getBoundingClientRect().top + window.scrollY - (topbar + sectionNavHeight + buffer);
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    return true;
  };

  /**
   * Navigeer naar een anchor (deep link compat).
   * Schakelt eerst naar de juiste tab, scrollt daarna binnen die tab naar het anchor.
   */
  const goToAnchor = (anchorId: string) => {
    const tab = ANCHOR_TO_TAB[anchorId];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
      // Wacht tot tab-content gemount is, dan scrollen
      requestAnimationFrame(() => {
        requestAnimationFrame(() => performScroll(anchorId));
        setTimeout(() => performScroll(anchorId), 180);
      });
    } else {
      requestAnimationFrame(() => performScroll(anchorId));
    }
    if (history.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.hash = anchorId;
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      } catch { /* ignore */ }
    }
  };

  const openDossierTab = (tab: DossierTab) => {
    setDossierOpenRequest({ tab, token: Date.now() });
    goToAnchor('documenten');
  };

  // Reageer op externe hash-wijzigingen (bv. browser back/forward met #anchor)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash && ANCHOR_TO_TAB[hash]) {
        const tab = ANCHOR_TO_TAB[hash];
        if (tab !== activeTab) setActiveTab(tab);
        requestAnimationFrame(() => performScroll(hash));
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Bij eerste mount: als URL al een hash heeft, scroll ernaartoe na render
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && ANCHOR_TO_TAB[hash]) {
      setTimeout(() => performScroll(hash), 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fotos = id ? store.getFotosVoorObject(id) : [];
  useEffect(() => {
    if (fotos.length === 0) { setFotoUrls({}); return; }
    let cancelled = false;
    (async () => {
      const map = await getSignedUrls(fotos.map(f => f.storagePath), 60 * 30);
      if (!cancelled) setFotoUrls(map);
    })();
    return () => { cancelled = true; };
  }, [fotos.map(f => f.storagePath).join('|')]);



  if (!object) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Object niet gevonden.</p>
        <Link to="/objecten" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar objecten</Link>
      </div>
    );
  }

  const huurders = store.getHuurdersVoorObject(object.id);
  const documenten = store.getDocumentenVoorObject(object.id);
  // Centrale verhuur-derivation (Prompt 3.3): huurdersregels leidend, object fallback.
  const verhuur = deriveVerhuurMetrics(object, huurders);
  const deals = store.getDealsByObject(object.id);
  const matches = getMatchesForObjectFromData(object, store.zoekprofielen);
  // Top kandidaten = sterke matches (score ≥ STRONG_MATCH_THRESHOLD, 0–100).
  const sterkeMatches = matches.filter(m => isStrongMatch(m.score));
  const objectTaken = store.getTakenByObject(object.id);
  const kandidatenPipeline = store.getPipelineVoorObject(object.id);
  const parentObject = object.parentObjectId ? store.getObjectById(object.parentObjectId) : null;
  const reedsGekoppeldRelaties = new Set<string>(kandidatenPipeline.map(k => k.relatieId));
  // Totaal aantal kandidaten voor dit object — unieke union van sterke matches en pipeline-relaties.
  const kandidatenTotaal = countKandidaten({
    matches,
    pipelineRows: kandidatenPipeline,
    objectId: object.id,
  }).total;
  const volgendeTaak = (() => {
    const open = objectTaken
      .filter(t => t.status === 'open')
      .sort((a, b) => {
        const av = taakIsVerlopen(a.deadline) ? 0 : 1;
        const bv = taakIsVerlopen(b.deadline) ? 0 : 1;
        if (av !== bv) return av - bv;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    return open[0] ?? null;
  })();

  // ── Financiële KPI's via centrale derivation helpers (Prompt 3.2) ──
  // Bron van waarheid: src/lib/derivations/financial.ts
  // Override-model per veld: opgeslagen BAR/NAR/NOI/huurPerM2 wordt als
  // handmatige snapshot beschouwd; anders wordt auto-derived gebruikt.
  // Prijsindicatie wordt NOOIT gebruikt voor rendement/factor/€-m²-berekening.
  const bar = resolveBAR(object.huurinkomsten, object.vraagprijs, object.brutoAanvangsrendement);
  const barEffect = bar.value;
  const barIsHandmatig = bar.source === 'override';

  // NAR: NOI = override-waarde indien aanwezig, anders jaarhuur − servicekostenJaar
  const noi = resolveNOI(object.huurinkomsten, object.servicekostenJaar, object.noi);
  const noiEffect = noi.value;
  const noiIsHandmatig = noi.source === 'override';

  const nar = resolveNAR(noiEffect, object.vraagprijs, object.nettoAanvangsrendement);
  const narEffect = nar.value;
  const narIsHandmatig = nar.source === 'override';

  const factor = calculateFactor(object.vraagprijs, object.huurinkomsten);
  const maandhuur = calculateMonthlyRent(object.huurinkomsten);

  const m2VoorBerekening = object.oppervlakteVvo ?? object.oppervlakte;
  const prijsPerM2Str = formatEurPerM2(object.vraagprijs, m2VoorBerekening);
  const huurPerM2Auto = calculateRentPerM2(object.huurinkomsten, m2VoorBerekening);
  const huurPerM2Resolved = resolveDerived(huurPerM2Auto, object.huurPerM2);
  const huurPerM2Berekend = huurPerM2Resolved.value;
  const huurPerM2IsHandmatig = huurPerM2Resolved.source === 'override';
  const huurPerM2Str = formatHuurPerM2PerJaar(huurPerM2Berekend);

  // Lead deal voor cockpit — centrale selector (Prompt 3.6)
  const leadDeal = selectLeadDeal(deals, object.id);
  // Gewogen verwachte fee voor lead deal — centrale helper
  const leadDealVerwachteFee = leadDeal ? calculateExpectedFee([leadDeal]) : 0;


  const handleDelete = async () => {
    try {
      await store.deleteObject(object.id);
      toast.success('Object gearchiveerd');
      navigate('/objecten');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const handleDownload = async (storagePath: string) => {
    try {
      const url = await getSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message ?? 'Download mislukt');
    }
  };

  const subcatLabel = labelFor(object.subcategorieId);
  const hoofdfoto = fotos.find(f => f.isHoofdfoto) ?? fotos[0];
  const heroUrl = hoofdfoto ? fotoUrls[hoofdfoto.storagePath] : undefined;

  const propertyTypeLabel = object.propertyTypeId
    ? (propertyTypeById(object.propertyTypeId)?.name ?? ASSET_CLASS_LABELS[object.type])
    : ASSET_CLASS_LABELS[object.type];
  const propertySubtypeLabels = (object.propertySubtypeIds ?? [])
    .map(id => propertySubtypeById(id)?.name)
    .filter(Boolean) as string[];
  const dealTypeLabels = (object.dealTypeIds ?? [])
    .map(id => dealTypeById(id)?.name)
    .filter(Boolean) as string[];
  const subtypeLabel = propertySubtypeLabels.length > 0
    ? propertySubtypeLabels.join(', ')
    : (subcatLabel ?? object.subcategorie);
  const documentatieStatusRows = Object.entries(object.documentatieStatus ?? {})
    .filter(([, status]) => !!status);
  const IM_SECTIE_LABELS: Record<string, string> = {
    propositie: 'Propositie',
    object: 'Objectomschrijving',
    locatie: 'Locatie',
    oppervlakten: 'Oppervlakten per verdieping',
    huur: 'Huurinformatie',
    financieel: "Financiële scenario's",
    marktwaarde: 'Marktwaarde-indicatie',
    technisch: 'Technische staat',
    juridisch: 'Juridisch & kadaster',
    duurzaamheid: 'Duurzaamheid / energielabel',
    risicos: "Risico's",
    documentatie: 'Documentatie-overzicht',
    proces: 'Proces & voorwaarden',
    contact: 'Contact',
  };
  const verborgenImSecties = Object.entries(object.imSectiesZichtbaar ?? {})
    .filter(([, zichtbaar]) => zichtbaar === false)
    .map(([key]) => key);
  const locatieLabel = [
    object.adres,
    [object.postcode, object.plaats].filter(Boolean).join(' '),
    object.provincie,
  ].filter(Boolean).join(', ') || object.publiekeRegio || object.plaats || object.provincie || 'Locatie onbekend';
  const mapsUrl = buildMapsUrl({
    adres: object.adres,
    postcode: object.postcode,
    plaats: object.plaats ?? object.publiekeRegio,
    provincie: object.provincie,
  });

  return (
    <div className="page-shell-detail">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/objecten" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Objecten
        </Link>
        <ListNavigator
          info={getListNavigation('objecten', object.id, store.objecten.map(o => o.id))}
          buildHref={(id) => `/objecten/${id}`}
          itemLabel="object"
        />
      </div>

      {/* =================================================
          PREMIUM HERO — asset overview
          ================================================= */}
      {(() => {
        const badgesBlock = (
          <div className="flex items-center gap-1.5 flex-wrap">
            <ObjectStatusBadge status={object.status} />
            {object.exclusief && (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-accent/40 text-accent rounded-full bg-accent/15 backdrop-blur">
                Exclusief
              </span>
            )}
            {object.anoniem && (
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground/80 bg-background/60 backdrop-blur border border-border/50 px-2 py-0.5 rounded-full">
                <EyeOff className="h-3 w-3" /> Anoniem
              </span>
            )}
            {object.isPortefeuille && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-accent/15 text-accent backdrop-blur border border-accent/30 px-2 py-0.5 rounded-full">
                <Building2 className="h-3 w-3" /> Portefeuille
              </span>
            )}
          </div>
        );

        const unarchiveObject = async () => {
          try {
            await store.unarchiveObject(object.id);
            toast.success('Object teruggezet naar Actief');
          } catch (err: any) {
            toast.error(`Terugzetten mislukt: ${err.message ?? 'onbekende fout'}`);
          }
        };

        // Desktop / overlay — alle acties zichtbaar
        const actionsBlock = (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium bg-background/70 backdrop-blur border border-border/60 rounded-md hover:bg-background transition text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" /> Bewerken
            </button>
            <ObjectPdfButton object={object} />
            {object.isArchived ? (
              <button
                onClick={unarchiveObject}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium bg-background/70 backdrop-blur border border-border/60 rounded-md hover:bg-background transition text-foreground"
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Activeren
              </button>
            ) : (
              <button
                onClick={() => setArchiefOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium bg-background/70 backdrop-blur border border-border/60 rounded-md hover:bg-background transition text-foreground"
              >
                <Archive className="h-3.5 w-3.5" /> Archiveer
              </button>
            )}
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center justify-center px-2 py-1.5 text-[12px] bg-background/70 backdrop-blur border border-destructive/40 rounded-md hover:bg-destructive/10 transition text-destructive"
              aria-label="Verwijderen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );

        // Mobiel — alleen Bewerken + PDF primair; rest in overflow-menu
        const actionsBlockMobile = (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-[12.5px] font-medium glass-chip rounded-lg hover:bg-background transition text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" /> Bewerken
            </button>
            <div className="[&>button]:!w-full [&>button]:!h-9 [&>button]:!justify-center [&>button]:!rounded-lg">
              <ObjectPdfButton object={object} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Meer acties"
                  className="inline-flex items-center justify-center h-9 w-9 glass-chip rounded-lg hover:bg-background transition text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {object.isArchived ? (
                  <DropdownMenuItem onClick={unarchiveObject}>
                    <ArchiveRestore className="h-4 w-4 mr-2" /> Activeren
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setArchiefOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" /> Archiveer
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );

        const titleBlock = (
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-semibold text-foreground tracking-tight leading-[1.1] break-words drop-shadow-sm">
              {object.titel}
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              <HeaderChip
                icon={MapPin}
                href={mapsUrl ?? undefined}
                title={mapsUrl ? 'Open in Google Maps' : undefined}
              >
                {locatieLabel}
              </HeaderChip>
              <HeaderChip icon={Building2}>{propertyTypeLabel}</HeaderChip>
              {subtypeLabel && <HeaderChip>{subtypeLabel}</HeaderChip>}
              {object.internReferentienummer && (
                <HeaderChip>{object.internReferentienummer}</HeaderChip>
              )}
            </div>
          </div>
        );

        return (
          <header className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm glass-card">
            {/* Banner */}
            <div className="relative aspect-[21/9] sm:aspect-[24/8] lg:aspect-[28/8] bg-muted">
              {heroUrl ? (
                <img src={heroUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full relative flex items-center justify-center"
                  style={{
                    backgroundImage:
                      'radial-gradient(120% 100% at 0% 0%, hsl(var(--accent) / 0.22), transparent 55%),' +
                      'radial-gradient(120% 100% at 100% 100%, hsl(var(--secondary) / 0.22), transparent 60%),' +
                      'linear-gradient(135deg, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.78))',
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.07]" style={{
                    backgroundImage:
                      'linear-gradient(hsl(var(--accent-foreground) / 0.6) 1px, transparent 1px),' +
                      'linear-gradient(90deg, hsl(var(--accent-foreground) / 0.6) 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                  }} />
                  <div className="relative flex flex-col items-center gap-2 text-primary-foreground/80">
                    <div className="h-14 w-14 rounded-2xl bg-background/10 backdrop-blur border border-accent/30 flex items-center justify-center shadow-lg">
                      <Building2 className="h-7 w-7 text-accent" />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">
                      Geen foto beschikbaar
                    </span>
                  </div>
                </div>
              )}
              {/* Gradient scrim (alleen op sm+, waar overlay-content erover heen valt) */}
              <div className="absolute inset-0 hidden sm:block bg-gradient-to-t from-background via-background/70 to-background/10" />
              <div className="absolute inset-0 hidden sm:block bg-gradient-to-r from-background/70 via-transparent to-background/30" />
            </div>

            {/* MOBIEL — content stroomt onder de banner, geen overlap */}
            <div className="sm:hidden p-4 space-y-3.5 bg-card/80 backdrop-blur">
              {badgesBlock}
              {titleBlock}
              <div className="pt-1">{actionsBlockMobile}</div>
            </div>

            {/* DESKTOP — overlay content */}
            <div className="hidden sm:flex absolute inset-0 flex-col justify-between p-6 lg:p-8">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {badgesBlock}
                {actionsBlock}
              </div>
              <div className="mt-auto">{titleBlock}</div>
            </div>
          </header>
        );
      })()}

      {/* =================================================
          HERO KPI STRIP — dynamisch: alleen relevante tiles
          ================================================= */}
      {(() => {
        const tiles: ReactNode[] = [];
        if (object.vraagprijs != null || object.prijsindicatie) {
          tiles.push(
            <MetricTile
              key="vraagprijs"
              label="Vraagprijs"
              value={
                object.vraagprijs != null
                  ? formatCurrency(object.vraagprijs)
                  : <span className="text-sm font-normal italic text-muted-foreground line-clamp-2">{object.prijsindicatie}</span>
              }
              hint={object.vraagprijs == null && object.prijsindicatie ? 'Prijsindicatie' : undefined}
              accent
            />,
          );
        }
        if (object.vraagprijs != null && m2VoorBerekening) {
          tiles.push(<MetricTile key="m2" label="€ / m²" value={prijsPerM2Str} badge="auto" />);
        }
        if (barEffect != null) {
          tiles.push(
            <MetricTile
              key="bar"
              label="BAR"
              value={formatPercent(barEffect, 2)}
              tone={barEffect >= 6 ? 'positive' : 'default'}
              badge={barIsHandmatig ? 'handmatig' : 'auto'}
            />,
          );
        }
        if (factor != null) {
          tiles.push(<MetricTile key="factor" label="Factor" value={`${factor.toFixed(1)}×`} badge="auto" />);
        }
        if (object.huurinkomsten) {
          tiles.push(
            <MetricTile
              key="huur"
              label="Huur / jr"
              value={formatCurrencyCompact(object.huurinkomsten)}
              hint={maandhuur != null ? `${formatCurrencyCompact(maandhuur)} / mnd` : undefined}
            />,
          );
        }
        if (object.oppervlakte) {
          tiles.push(<MetricTile key="opp" label="Oppervlakte" value={formatM2(object.oppervlakte)} />);
        }
        if (tiles.length === 0) return null;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
            {tiles}
          </div>
        );
      })()}

      {/* Huurders + WALT/WALB strip — alleen relevante tiles */}
      {(() => {
        const tiles: ReactNode[] = [];
        if (verhuur.aantalHuurders != null && verhuur.aantalHuurders > 0) {
          tiles.push(<MetricTile key="h" label="Huurders" value={verhuur.aantalHuurders.toString()} />);
        }
        if (verhuur.waltJaren != null) {
          tiles.push(<MetricTile key="walt" label="WALT" value={`${verhuur.waltJaren.toFixed(1)} jr`} />);
        }
        if (verhuur.walbJaren != null) {
          tiles.push(<MetricTile key="walb" label="WALB" value={`${verhuur.walbJaren.toFixed(1)} jr`} />);
        }
        if (tiles.length === 0) return null;
        const cols = tiles.length === 1 ? 'grid-cols-1' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
        return <div className={`grid ${cols} gap-2 sm:gap-2.5`}>{tiles}</div>;
      })()}

      {/* =================================================
          STICKY SECTION NAV
          ================================================= */}
      <WorkspaceTabsNav tabs={visibleTabs} active={activeTab} onSelect={setActiveTab} />

      {/* =================================================
          MAIN GRID — content + sticky deal cockpit
          ================================================= */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 xl:gap-8 min-w-0 items-start">
        {/* LEFT — content */}
        <div className="space-y-6 lg:space-y-8 min-w-0 max-w-full">

          {/* ============ 1. OVERZICHT — Identificatie + Locatie + Classificatie ============ */}
          <SectionAnchor id="overzicht" eyebrow={eyebrowFor("overzicht", "Asset")} title="Overzicht">
            <div className="section-card p-5 sm:p-6 space-y-5">
              <ClassificatieRij
                propertyTypeId={object.propertyTypeId}
                fallbackAssetClass={object.type}
                subtypeIds={object.propertySubtypeIds}
                dealTypeIds={object.dealTypeIds}
                mode="single"
              />

              <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4 hairline pt-5">
                <div className="rounded-lg border border-border/60 bg-card/50 p-4 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-accent" />
                    <h3 className="section-title">Locatie</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                    {object.adres && <Field label="Adres">{object.adres}</Field>}
                    {object.postcode && <Field label="Postcode">{object.postcode}</Field>}
                    {object.plaats && <Field label="Plaats">{object.plaats}</Field>}
                    {object.provincie && <Field label="Provincie">{object.provincie}</Field>}
                    {object.publiekeRegio && <Field label="Publieke regio">{object.publiekeRegio}</Field>}
                    {object.locatieOmschrijving && (
                      <div className="sm:col-span-2">
                        <Field label="Locatie-omschrijving"><pre className="whitespace-pre-wrap font-sans text-sm">{object.locatieOmschrijving}</pre></Field>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/50 p-4 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-accent" />
                    <h3 className="section-title">Identificatie</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-5 gap-y-3">
                    {object.internReferentienummer && <Field label="Intern nummer">{object.internReferentienummer}</Field>}
                    <Field label="Objectstatus">{OBJECT_STATUS_LABELS[object.status] ?? object.status}</Field>
                    {object.aanbiedingswijze && <Field label="Aanbiedingswijze">{AANBIEDINGSWIJZE_LABELS[object.aanbiedingswijze]}</Field>}
                    {object.anoniem && <Field label="Anonimiteit">Anoniem presenteren</Field>}
                    {object.publiekeNaam && <Field label="Publieke naam">{object.publiekeNaam}</Field>}
                    {object.bron && <Field label="Bron">{object.bron}</Field>}
                    {object.exclusief && <Field label="Exclusiviteit">Exclusief aangeboden</Field>}
                    {object.isPortefeuille && <Field label="Portefeuille">Ja</Field>}
                    {parentObject && (
                      <Field label="Onderdeel van portefeuille">
                        <Link to={`/objecten/${parentObject.id}`} className="text-accent hover:underline inline-flex items-center gap-1">
                          {parentObject.titel} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </Field>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 hairline pt-5">
                <Field label="Type vastgoed">{propertyTypeLabel}</Field>
                {subtypeLabel && <Field label="Subtype">{subtypeLabel}</Field>}
                {dealTypeLabels.length > 0 && <Field label="Dealtype / propositie">{dealTypeLabels.join(', ')}</Field>}
                <Field label="Toegevoegd"><span className="tabular-nums">{formatDate(object.datumToegevoegd)}</span></Field>
              </div>
            </div>
          </SectionAnchor>

          {/* ============ DEALFLOW (direct onder Overzicht voor snelle workflow) ============ */}
          <SectionAnchor id="dealflow" eyebrow={eyebrowFor("dealflow", "Pipeline")} title="Dealflow">
            <ObjectPipelineFaseSectie object={object} />
          </SectionAnchor>

          {/* ============ FINANCIEEL ============ */}
          <SectionAnchor id="financieel" eyebrow={eyebrowFor("financieel", "Financials")} title="Financieel">
            <div className="section-card p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                <MetricTile
                  label="Vraagprijs"
                  value={
                    object.vraagprijs != null
                      ? formatCurrency(object.vraagprijs)
                      : (object.prijsindicatie ? <span className="text-sm font-normal italic text-muted-foreground line-clamp-2">{object.prijsindicatie}</span> : '—')
                  }
                  hint={object.vraagprijs == null && object.prijsindicatie ? 'Prijsindicatie' : undefined}
                  accent
                />
                <MetricTile
                  label="BAR"
                  value={barEffect != null ? formatPercent(barEffect, 2) : '—'}
                  badge={barEffect != null ? (barIsHandmatig ? 'handmatig' : 'auto') : undefined}
                />
                {narEffect != null && (
                  <MetricTile
                    label="NAR"
                    value={formatPercent(narEffect, 2)}
                    badge={narIsHandmatig ? 'handmatig' : 'auto'}
                  />
                )}
                <MetricTile
                  label="Factor"
                  value={factor != null ? `${factor.toFixed(1)}×` : '—'}
                  badge={factor != null ? 'auto' : undefined}
                />
                {object.huurinkomsten != null && (
                  <MetricTile label="Huur / jr" value={formatCurrency(object.huurinkomsten)} />
                )}
                {maandhuur != null && (
                  <MetricTile
                    label="Huur / mnd"
                    value={formatCurrency(Math.round(maandhuur))}
                    badge="auto"
                  />
                )}
                {noiEffect != null && (
                  <MetricTile
                    label="NOI"
                    value={formatCurrency(noiEffect)}
                    tone="positive"
                    badge={noiIsHandmatig ? 'handmatig' : 'auto'}
                  />
                )}
                {object.servicekostenJaar != null && (
                  <MetricTile label="Servicekosten" value={formatCurrency(object.servicekostenJaar)} />
                )}
                <MetricTile label="€ / m²" value={prijsPerM2Str} badge="auto" />
                {huurPerM2Berekend != null && (
                  <MetricTile
                    label="Huur / m²"
                    value={huurPerM2Str}
                    badge={huurPerM2IsHandmatig ? 'handmatig' : 'auto'}
                  />
                )}
                {object.wozWaarde != null && (
                  <MetricTile
                    label="WOZ"
                    value={formatCurrency(object.wozWaarde)}
                    hint={object.wozPeildatum ? formatDate(object.wozPeildatum) : undefined}
                  />
                )}
                {object.taxatiewaarde != null && (
                  <MetricTile
                    label="Taxatie"
                    value={formatCurrency(object.taxatiewaarde)}
                    hint={object.taxatiedatum ? formatDate(object.taxatiedatum) : undefined}
                  />
                )}
                {object.marktwaardeIndicatie != null && (
                  <MetricTile
                    label="Marktwaarde"
                    value={formatCurrency(object.marktwaardeIndicatie)}
                    hint={object.marktwaardeBron ?? undefined}
                  />
                )}
              </div>

              {object.prijsindicatie && (
                <div className="hairline pt-4">
                  <Field label="Prijsindicatie / toelichting"><pre className="whitespace-pre-wrap font-sans text-sm">{object.prijsindicatie}</pre></Field>
                </div>
              )}

              {object.financieleScenarios && (
                object.financieleScenarios.huidig || object.financieleScenarios.marktconform || object.financieleScenarios.naRenovatie
              ) && (
                <div className="hairline pt-4">
                  <p className="field-label mb-2">Financiële scenario's</p>
                  <div className="overflow-x-auto rounded-md border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Scenario</th>
                          <th className="text-right font-medium px-3 py-2">Jaarhuur</th>
                          <th className="text-right font-medium px-3 py-2">BAR</th>
                          <th className="text-right font-medium px-3 py-2">NOI</th>
                          <th className="text-left font-medium px-3 py-2">Toelichting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['huidig','marktconform','naRenovatie'] as const).map(k => {
                          const s = object.financieleScenarios?.[k];
                          if (!s) return null;
                          const label = k === 'huidig' ? 'Huidig' : k === 'marktconform' ? 'Marktconform' : 'Na renovatie';
                          return (
                            <tr key={k} className="border-t border-border/40">
                              <td className="px-3 py-2 font-medium">{label}</td>
                              <td className="px-3 py-2 text-right font-mono-data">{s.jaarhuur != null ? formatCurrency(s.jaarhuur) : '—'}</td>
                              <td className="px-3 py-2 text-right font-mono-data">{s.bar != null ? formatPercent(s.bar, 2) : '—'}</td>
                              <td className="px-3 py-2 text-right font-mono-data">{s.noi != null ? formatCurrency(s.noi) : '—'}</td>
                              <td className="px-3 py-2 text-muted-foreground">{s.opmerking ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="hairline pt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>
                  Voor scenario-analyse en gevoeligheid:&nbsp;
                  <button type="button" onClick={() => goToAnchor('vastgoedrekenen')} className="text-accent hover:underline font-medium">open vastgoedrekenen →</button>
                </span>
              </div>
            </div>

            {/* Referentieanalyse staat verderop in eigen sectie 'Referenties' */}
          </SectionAnchor>


          {/* ============ VERHUUR ============ */}
          <SectionAnchor id="verhuur" eyebrow={eyebrowFor("verhuur", "Verhuur")} title="Verhuur">
            <div className="section-card p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-4">
                <Field label="Verhuurstatus"><span className="capitalize">{object.verhuurStatus}</span></Field>
                {object.huidigGebruik && (<Field label="Huidig gebruik">{object.huidigGebruik}</Field>)}
                {verhuur.aantalHuurders != null && (
                  <Field label={verhuur.source === 'huurders' ? 'Aantal huurders' : 'Aantal huurders (indicatie)'}>
                    <span className="tabular-nums">{verhuur.aantalHuurders}</span>
                  </Field>
                )}
                {verhuur.leegstandPct != null && (
                  <Field label="Leegstand"><span className="font-mono-data">{formatPercent(verhuur.leegstandPct)}</span></Field>
                )}
                {object.beschikbaarVanaf && (
                  <Field label="Beschikbaar vanaf"><span className="tabular-nums">{formatDate(object.beschikbaarVanaf)}</span></Field>
                )}
              </div>

              {/* Soft mismatch warnings — alleen tonen als huurdersregels bestaan */}
              {verhuur.source === 'huurders' && (verhuur.warnings.rentMismatch || verhuur.warnings.tenantCountMismatch) && (
                <div className="hairline pt-4 space-y-1.5">
                  {verhuur.warnings.rentMismatch && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Let op: objecthuur ({formatCurrencyCompact(verhuur.detail.objectRent ?? 0)}) wijkt af van som huurdersregels ({formatCurrencyCompact(verhuur.detail.sumTenantRent ?? 0)}).</span>
                    </div>
                  )}
                  {verhuur.warnings.tenantCountMismatch && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Let op: aantal huurders op object ({object.aantalHuurders}) wijkt af van huurderslijst ({verhuur.detail.tenantsCount}).</span>
                    </div>
                  )}
                </div>
              )}

              {verhuur.aantalHuurders != null && verhuur.aantalHuurders > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 hairline pt-5">
                  <MetricTile label="Huurders" value={verhuur.aantalHuurders.toString()} />
                  <MetricTile
                    label="Totale jaarhuur"
                    value={verhuur.totaleJaarhuur != null ? formatCurrencyCompact(verhuur.totaleJaarhuur) : '—'}
                    hint={verhuur.totaleJaarhuur != null ? `${formatCurrencyCompact(verhuur.totaleJaarhuur / 12)} / mnd` : undefined}
                  />
                  <MetricTile label="WALT" value={verhuur.waltJaren != null ? `${verhuur.waltJaren.toFixed(1)} jr` : '—'} />
                  <MetricTile label="WALB" value={verhuur.walbJaren != null ? `${verhuur.walbJaren.toFixed(1)} jr` : '—'} />
                </div>
              )}
            </div>

            {huurders.length > 0 && (
              <div className="section-card p-5 sm:p-6 space-y-3 mt-4">
                <h3 className="section-title">Huurders ({huurders.length})</h3>
                <div className="space-y-2">
                  {huurders.map(h => (
                    <div key={h.id} className="border border-border/60 rounded-md p-3 bg-card/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{h.huurderNaam}</p>
                        {h.branche && <span className="text-xs text-muted-foreground">· {h.branche}</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                        {h.oppervlakteM2 != null && <span>{formatM2(h.oppervlakteM2)}</span>}
                        {h.jaarhuur != null && <span className="font-mono-data">{formatCurrency(h.jaarhuur)}/jr</span>}
                        {h.ingangsdatum && <span>Ingang: {formatDate(h.ingangsdatum)}</span>}
                        {h.einddatum && <span>Einde: {formatDate(h.einddatum)}</span>}
                        {h.opzegmogelijkheid && <span>Break: {formatDate(h.opzegmogelijkheid)}</span>}
                        {h.indexatieBasis && (
                          <span>
                            Index: {INDEXATIE_BASIS_LABELS[h.indexatieBasis]}
                            {h.indexatieBasis === 'vast_pct' && h.indexatiePct != null && ` (${h.indexatiePct}%)`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionAnchor>

          {/* ============ PAND & TECHNISCHE STAAT ============ */}
          <SectionAnchor id="pand" eyebrow={eyebrowFor("pand", "Pand")} title="Pand & technische staat">
            <div className="section-card p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-4">
                {object.bouwjaar != null && (
                  <Field label="Bouwjaar"><span className="tabular-nums">{object.bouwjaar}</span></Field>
                )}
                {(object.energielabelV2 || object.energielabel) && (
                  <Field label="Energielabel"><span className="font-semibold">{object.energielabelV2 ?? object.energielabel}</span></Field>
                )}
                {object.onderhoudsstaatNiveau && (
                  <Field label="Onderhoudsstaat">{ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau]}</Field>
                )}
                {!object.onderhoudsstaatNiveau && object.onderhoudsstaat && (
                  <Field label="Onderhoudsstaat">{object.onderhoudsstaat}</Field>
                )}
                {object.aantalVerdiepingen != null && (<Field label="Verdiepingen">{object.aantalVerdiepingen}</Field>)}
                {object.aantalUnits != null && (<Field label="Units">{object.aantalUnits}</Field>)}
                {object.asbestinventarisatieAanwezig && (<Field label="Asbest">Aanwezig</Field>)}
                {/* Legacy `documentenBeschikbaar` is bewust niet meer als losse rij getoond:
                    dossier-readiness (sectie Dossierstatus) is de leidende bron voor documentstatus. */}
              </div>

              {(object.oppervlakteVvo || object.oppervlakteBvo || object.oppervlakteGbo || object.perceelOppervlakte) && (
                <div className="hairline pt-5">
                  <p className="field-label mb-2">Oppervlakten (NEN 2580)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {object.oppervlakteVvo && (
                      <div className="text-sm"><span className="text-muted-foreground">VVO:</span> <span className="font-mono-data">{formatM2(object.oppervlakteVvo)}</span></div>
                    )}
                    {object.oppervlakteBvo && (
                      <div className="text-sm"><span className="text-muted-foreground">BVO:</span> <span className="font-mono-data">{formatM2(object.oppervlakteBvo)}</span></div>
                    )}
                    {object.oppervlakteGbo && (
                      <div className="text-sm"><span className="text-muted-foreground">GBO:</span> <span className="font-mono-data">{formatM2(object.oppervlakteGbo)}</span></div>
                    )}
                    {object.perceelOppervlakte && (
                      <div className="text-sm"><span className="text-muted-foreground">Perceel:</span> <span className="font-mono-data">{formatM2(object.perceelOppervlakte)}</span></div>
                    )}
                  </div>
                </div>
              )}

              {object.oppervlaktenPerVerdieping && object.oppervlaktenPerVerdieping.length > 0 && (
                <div className="hairline pt-5">
                  <p className="field-label mb-2">Oppervlakten per verdieping</p>
                  <div className="overflow-x-auto rounded-md border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Verdieping</th>
                          <th className="text-right font-medium px-3 py-2">VVO</th>
                          <th className="text-right font-medium px-3 py-2">BVO</th>
                          <th className="text-left font-medium px-3 py-2">Bestemming</th>
                        </tr>
                      </thead>
                      <tbody>
                        {object.oppervlaktenPerVerdieping.map((rij, index) => (
                          <tr key={`${rij.verdieping}-${index}`} className="border-t border-border/40">
                            <td className="px-3 py-2 font-medium">{rij.verdieping || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono-data">{rij.vvo != null ? formatM2(rij.vvo) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono-data">{rij.bvo != null ? formatM2(rij.bvo) : '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{rij.bestemming || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {object.technischeStaatOmschrijving && (
                <div className="hairline pt-5">
                  <Field label="Technische staat">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{object.technischeStaatOmschrijving}</pre>
                  </Field>
                </div>
              )}

              {(object.recenteInvesteringen || object.achterstalligOnderhoud) && (
                <div className="hairline pt-5 grid sm:grid-cols-2 gap-4">
                  {object.recenteInvesteringen && <Field label="Recente investeringen"><pre className="whitespace-pre-wrap font-sans text-sm">{object.recenteInvesteringen}</pre></Field>}
                  {object.achterstalligOnderhoud && <Field label="Achterstallig onderhoud"><pre className="whitespace-pre-wrap font-sans text-sm">{object.achterstalligOnderhoud}</pre></Field>}
                </div>
              )}
            </div>
          </SectionAnchor>

          {/* ============ POTENTIE & MOGELIJKHEDEN (conditioneel) ============ */}
          {hasPotentieData(object) && (() => {
            const huidigeM2 = object.oppervlakteVvo ?? object.oppervlakteBvo ?? object.oppervlakteGbo ?? null;
            const extraM2 = object.potentieExtraM2 ?? null;
            const totaalM2 = (huidigeM2 != null || extraM2 != null) ? ((huidigeM2 ?? 0) + (extraM2 ?? 0)) : null;
            const huidigeUnits = object.aantalUnits ?? null;
            const extraUnits = object.potentieExtraUnits ?? null;
            const totaalUnits = (huidigeUnits != null || extraUnits != null) ? ((huidigeUnits ?? 0) + (extraUnits ?? 0)) : null;
            const types: string[] = [];
            if (object.ontwikkelPotentie) types.push('Ontwikkelpotentie');
            if (object.transformatiePotentie) types.push('Transformatiepotentie');
            const Kpi = ({ label, value }: { label: string; value: ReactNode }) => (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 font-mono-data text-sm font-semibold break-words">{value}</p>
              </div>
            );
            return (
              <SectionAnchor id="potentie" eyebrow={eyebrowFor("potentie", "Upside")} title="Potentie & mogelijkheden">
                <div className="section-card p-5 sm:p-6 space-y-4">
                  {types.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {types.map(t => (
                        <span key={t} className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    {(huidigeM2 != null || extraM2 != null || totaalM2 != null) && (
                      <div className="min-w-0">
                        <p className="field-label mb-2">m²-overzicht</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Kpi label="Huidig" value={huidigeM2 != null ? formatM2(huidigeM2) : '—'} />
                          <Kpi label="Extra mogelijk" value={extraM2 != null ? formatM2(extraM2) : '—'} />
                          <Kpi label="Totaal na plan" value={totaalM2 != null ? formatM2(totaalM2) : '—'} />
                        </div>
                      </div>
                    )}
                    {(huidigeUnits != null || extraUnits != null || totaalUnits != null) && (
                      <div className="min-w-0">
                        <p className="field-label mb-2">Units-overzicht</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Kpi label="Huidig" value={huidigeUnits != null ? huidigeUnits.toLocaleString('nl-NL') : '—'} />
                          <Kpi label="Extra mogelijk" value={extraUnits != null ? extraUnits.toLocaleString('nl-NL') : '—'} />
                          <Kpi label="Totaal na plan" value={totaalUnits != null ? totaalUnits.toLocaleString('nl-NL') : '—'} />
                        </div>
                      </div>
                    )}
                  </div>

                  {(object.potentieStrategie || object.potentieOnderbouwingStatus) && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {object.potentieStrategie && <Field label="Mogelijke strategie">{object.potentieStrategie}</Field>}
                      {object.potentieOnderbouwingStatus && <Field label="Status onderbouwing">{object.potentieOnderbouwingStatus}</Field>}
                    </div>
                  )}

                  {object.potentieOmschrijving && (
                    <Field label="Potentieomschrijving">
                      <p className="whitespace-pre-wrap text-sm break-words">{object.potentieOmschrijving}</p>
                    </Field>
                  )}
                  {object.potentieAfhankelijkheden && (
                    <Field label="Afhankelijkheden / risico's">
                      <p className="whitespace-pre-wrap text-sm break-words">{object.potentieAfhankelijkheden}</p>
                    </Field>
                  )}
                  {object.potentieBron && (
                    <Field label="Bron / onderbouwing">
                      <p className="whitespace-pre-wrap text-sm break-words text-muted-foreground">{object.potentieBron}</p>
                    </Field>
                  )}
                </div>
              </SectionAnchor>
            );
          })()}

          {/* ============ JURIDISCH & KADASTRAAL (conditioneel) ============ */}
          {hasJuridischData(object) && (
            <SectionAnchor id="juridisch" eyebrow={eyebrowFor("juridisch", "Legal")} title="Juridisch & kadastraal">
              <div className="section-card p-5 sm:p-6 space-y-3">
                {object.eigendomssituatie && <Field label="Eigendomssituatie">{object.eigendomssituatie}</Field>}
                {(object.kadastraleGemeente || object.kadastraalNummer) && (
                  <Field label="Kadaster">
                    {[object.kadastraleGemeente, object.kadastraleSectie, object.kadastraalNummer].filter(Boolean).join(' ')}
                  </Field>
                )}
                {object.erfpachtinformatie && <Field label="Erfpacht">{object.erfpachtinformatie}</Field>}
                {object.bestemmingsinformatie && <Field label="Bestemming">{object.bestemmingsinformatie}</Field>}
              </div>
            </SectionAnchor>
          )}

          {/* ============ CONTACTEN (conditioneel) ============ */}
          {(hasContactenData(object) || deals.length > 0) && (
            <SectionAnchor id="verkoper" eyebrow={eyebrowFor("verkoper", "Seller")} title="Verkoper & relaties">

              <div className="grid sm:grid-cols-2 gap-4">
                {(object.verkoperNaam || object.verkoperEmail || object.verkoperTelefoon) && (
                  <div className="section-card p-5 space-y-3">
                    <h3 className="section-title">Verkoper / eigenaar / aanbieder</h3>
                    <div className="space-y-3">
                      {object.verkoperNaam && (
                        <Field label="Naam">
                          {object.verkoperNaam}
                          {object.verkoperRol && <span className="text-muted-foreground"> · {object.verkoperRol}</span>}
                        </Field>
                      )}
                      {object.verkoperVia && <Field label="Via">{VERKOPER_VIA_LABELS[object.verkoperVia] ?? object.verkoperVia}</Field>}
                      {object.verkoperTelefoon && (
                        <Field label="Telefoon">
                          <a href={`tel:${object.verkoperTelefoon}`} className="hover:text-accent inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />{object.verkoperTelefoon}
                          </a>
                        </Field>
                      )}
                      {object.verkoperEmail && (
                        <Field label="E-mail">
                          <a href={`mailto:${object.verkoperEmail}`} className="hover:text-accent inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />{object.verkoperEmail}
                          </a>
                        </Field>
                      )}
                      {object.verkoopmotivatie && <Field label="Verkoopmotivatie">{object.verkoopmotivatie}</Field>}
                    </div>
                  </div>
                )}
                {(object.contactNaam || object.contactEmail || object.contactTelefoon) && (
                  <div className="section-card p-5 space-y-3">
                    <h3 className="section-title">Objectcontact / makelaar / tussenpersoon</h3>
                    <div className="space-y-3">
                      {object.contactNaam && (
                        <Field label="Naam">
                          {object.contactNaam}
                          {object.contactFunctie && <span className="text-muted-foreground"> · {object.contactFunctie}</span>}
                        </Field>
                      )}
                      {object.contactTelefoon && (
                        <Field label="Telefoon">
                          <a href={`tel:${object.contactTelefoon}`} className="hover:text-accent inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />{object.contactTelefoon}
                          </a>
                        </Field>
                      )}
                      {object.contactEmail && (
                        <Field label="E-mail">
                          <a href={`mailto:${object.contactEmail}`} className="hover:text-accent inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />{object.contactEmail}
                          </a>
                        </Field>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </SectionAnchor>

          )}


          {/* ============ AANBIEDING & PROCES ============ */}
          <SectionAnchor id="aanbieding" eyebrow={eyebrowFor("aanbieding", "Offering")} title="Aanbieding & proces">
            {(object.samenvatting || object.investeringsthese || object.onderscheidendeKenmerken || object.risicos || object.opmerkingen ||
              object.propositie || object.objectomschrijving || object.procesVoorwaarden || object.dataroomUrl ||
              documentatieStatusRows.length > 0 || verborgenImSecties.length > 0 || object.interneOpmerkingen) ? (
              <div className="section-card p-5 sm:p-6 space-y-4">
                {object.samenvatting && <Field label="Samenvatting">{object.samenvatting}</Field>}
                {object.investeringsthese && (
                  <Field label="Investeringsthese">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{object.investeringsthese}</pre>
                  </Field>
                )}
                {object.onderscheidendeKenmerken && (
                  <Field label="Onderscheidende kenmerken">{object.onderscheidendeKenmerken}</Field>
                )}
                {object.risicos && (
                  <Field label="Risico's">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{object.risicos}</pre>
                  </Field>
                )}
                {object.opmerkingen && <Field label="Opmerkingen">{object.opmerkingen}</Field>}
                {object.propositie && <Field label="Propositie"><pre className="whitespace-pre-wrap font-sans text-sm">{object.propositie}</pre></Field>}
                {object.objectomschrijving && <Field label="Objectomschrijving"><pre className="whitespace-pre-wrap font-sans text-sm">{object.objectomschrijving}</pre></Field>}
                {object.procesVoorwaarden && <Field label="Procesvoorwaarden"><pre className="whitespace-pre-wrap font-sans text-sm">{object.procesVoorwaarden}</pre></Field>}
                {object.dataroomUrl && (
                  <Field label="Dataroom">
                    <a href={object.dataroomUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1 break-all">
                      {object.dataroomUrl} <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </Field>
                )}
                {documentatieStatusRows.length > 0 && (
                  <Field label="Documentatie-overzicht">
                    <div className="flex flex-wrap gap-1.5">
                      {documentatieStatusRows.map(([type, status]) => (
                        <span key={type} className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground">
                          {DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] ?? type}: {status === 'beschikbaar' ? 'beschikbaar' : status === 'op_aanvraag' ? 'op aanvraag' : 'na NDA'}
                        </span>
                      ))}
                    </div>
                  </Field>
                )}
                {verborgenImSecties.length > 0 && (
                  <Field label="Niet getoond in IM">
                    <div className="flex flex-wrap gap-1.5">
                      {verborgenImSecties.map(key => (
                        <span key={key} className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                          {IM_SECTIE_LABELS[key] ?? key}
                        </span>
                      ))}
                    </div>
                  </Field>
                )}
                {object.interneOpmerkingen && (
                  <div className="bg-warning/5 border border-warning/20 rounded-md p-3.5">
                    <p className="field-label text-warning">Interne opmerking</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{object.interneOpmerkingen}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="section-card p-5 text-sm text-muted-foreground">
                Nog geen aanbiedingsteksten ingevuld. Voeg deze toe via <button type="button" onClick={() => openEdit('aanbieding')} className="text-accent hover:underline">Object bewerken</button>.
              </div>
            )}
          </SectionAnchor>

          {/* ============ DOSSIERSTATUS ============ */}
          <SectionAnchor id="dossier" eyebrow={eyebrowFor("dossier", "Readiness")} title="Dossierstatus">
            <ObjectDossierCard
              objectId={object.id}
              objectRecord={object as unknown as Record<string, unknown>}
              openTabRequest={dossierOpenRequest}
            />
          </SectionAnchor>

          {/* ============ KANDIDATEN ============ */}
          {activeTab === 'kandidaten' && (
          <SectionAnchor
            id="kandidaten"
            eyebrow={eyebrowFor("kandidaten", "Candidates")}
            title={`Kandidaten · ${kandidatenTotaal}`}
          >
            <div className="section-card overflow-hidden">
              <header className="section-header">
                <h3 className="section-title">Top kandidaten</h3>
              </header>
              {sterkeMatches.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                  {matches.length === 0
                    ? 'Geen matches gevonden.'
                    : 'Geen sterke matches (score ≥ 70/100).'}
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {sterkeMatches.slice(0, 10).map((m, i) => {
                    const rel = store.getRelatieById(m.relatieId);
                    const zp = store.zoekprofielen.find(z => z.id === m.zoekprofielId);
                    return (
                      <details key={i} className="group">
                        <summary className="row-hover block px-5 py-4 cursor-pointer list-none">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <Link
                              to={`/relaties/${m.relatieId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-foreground truncate hover:text-accent inline-flex items-center gap-1"
                            >
                              {rel?.bedrijfsnaam}
                              <ArrowUpRight className="h-3 w-3 opacity-50" />
                            </Link>
                            <MatchScoreBadge score={m.score} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {zp?.naam ?? 'Zoekprofiel'} · {m.redenen.slice(0, 2).join(' · ')}
                          </p>
                        </summary>
                        <div className="px-5 pb-4 bg-muted/20">
                          <MatchUitleg match={m} object={object} compact />
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Kandidaten / dealtraject (pipeline + toevoegen-knop) */}
            <div className="mt-4">
              <ObjectPipelineSectie objectId={object.id} />
            </div>
          </SectionAnchor>
          )}


          {/* ============ REFERENTIES (conditioneel) ============ */}
          {activeTab === 'kandidaten' && object.referentieanalyseZichtbaar !== false && (
            <SectionAnchor id="referenties" eyebrow={eyebrowFor("referenties", "Benchmarks")} title="Referentieanalyse">
              <ObjectReferentieAnalyseSectie object={object} />
            </SectionAnchor>
          )}


          {/* ============ DOCUMENTEN (ondersteunend, zonder hoofdnummer) ============ */}
          {activeTab === 'dossier' && documenten.length > 0 && (
            <SectionAnchor
              id="documenten"
              eyebrow={eyebrowFor("documenten", "Data room")}
              title="Documenten"
            >
              {(() => {
                const plattegronden = documenten.filter(d => d.documenttype === 'plattegrond');
                const overigeDocs = documenten.filter(d => d.documenttype !== 'plattegrond');
                const renderDocRow = (doc: typeof documenten[number]) => (
                  <div key={doc.id} className="row-hover flex items-center gap-3 border border-border/60 rounded-lg p-3 bg-card/40">
                    <div className="h-9 w-9 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.bestandsnaam}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {DOCUMENT_TYPE_LABELS[doc.documenttype]} · {formatFileSize(doc.bestandsgrootteBytes)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.storagePath)}
                      className="p-2 hover:bg-muted rounded shrink-0"
                      aria-label="Downloaden"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                );
                return (
                  <>
                    {overigeDocs.length > 0 && (
                      <div className="section-card p-5 sm:p-6 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="section-title">Documenten ({overigeDocs.length})</h3>
                          <button
                            type="button"
                            onClick={() => openEdit('media')}
                            className="text-xs text-accent hover:underline"
                          >
                            Beheren
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {overigeDocs.map(renderDocRow)}
                        </div>
                      </div>
                    )}
                    {plattegronden.length > 0 && (
                      <div className="section-card p-5 sm:p-6 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="section-title">Plattegronden ({plattegronden.length})</h3>
                          <button
                            type="button"
                            onClick={() => openEdit('media')}
                            className="text-xs text-accent hover:underline"
                          >
                            Beheren
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {plattegronden.map(renderDocRow)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </SectionAnchor>
          )}


          {/* ============ VASTGOEDREKENEN ============ */}
          {activeTab === 'vastgoedrekenen' && (
          <SectionAnchor
            id="vastgoedrekenen"
            eyebrow={eyebrowFor("vastgoedrekenen", "Underwriting")}
            title="Vastgoedrekenen"
          >
            <div className="section-card p-3 sm:p-5">
              <VastgoedrekenenTab
                objectId={object.id}
                objectArea={(object as { woonoppervlak?: number; oppervlakte?: number }).woonoppervlak ?? (object as { oppervlakte?: number }).oppervlakte ?? null}
                objectWoz={(object as { wozWaarde?: number }).wozWaarde ?? null}
                objectEnergyLabel={(object as { energielabel?: string }).energielabel ?? null}
                objectBouwjaar={(object as { bouwjaar?: number }).bouwjaar ?? null}
                objectRawType={(object as { typeVastgoed?: string; subcategorie?: string }).typeVastgoed ?? (object as { subcategorie?: string }).subcategorie ?? null}
              />
            </div>
          </SectionAnchor>
          )}

          {/* ============ BIEDINGEN ============ */}
          {activeTab === 'dealflow' && (
          <SectionAnchor id="biedingen" eyebrow={eyebrowFor("biedingen", "Negotiations")} title="Biedingen">
            <BiedingenSection
              scope={{ objectId: object.id }}
              vraagprijs={object.vraagprijs ?? null}
              defaults={{ objectId: object.id }}
              toonObject={false}
            />
          </SectionAnchor>
          )}

          {/* ============ ACTIVITEIT ============ */}
          {activeTab === 'dealflow' && (
          <SectionAnchor id="activiteit" eyebrow={eyebrowFor("activiteit", "Activity")} title="Activiteit & notities">
            <Timeline objectId={object.id} />
          </SectionAnchor>
          )}
        </div>

        {/* RIGHT — sticky deal cockpit */}
        <aside className={`${activeTab === 'cockpit' ? '' : 'hidden lg:block'} lg:sticky lg:top-[88px] space-y-3 min-w-0`}>
          {/* Deal status cockpit */}
          <div id="deal-cockpit" className="section-card p-5 space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Deal cockpit
              </p>
              {leadDeal && <DealFaseBadge fase={leadDeal.fase} />}
            </div>

            {leadDeal ? (
              <div className="space-y-3">
                <div>
                  <p className="field-label">Lead deal</p>
                  <Link
                    to={`/deals/${leadDeal.id}`}
                    className="text-sm font-medium text-foreground hover:text-accent inline-flex items-center gap-1 mt-0.5"
                  >
                    {store.getRelatieById(leadDeal.relatieId)?.bedrijfsnaam ?? 'Onbekend'}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                {leadDeal.commissieBedrag != null && (
                  <div className="hairline pt-3 space-y-2">
                    <div>
                      <p className="field-label">Potentiële commissie</p>
                      <p className="font-mono-data text-xl font-semibold text-foreground mt-0.5">
                        {formatCurrency(leadDeal.commissieBedrag)}
                      </p>
                    </div>
                    <div>
                      <p className="field-label">Verwachte fee (gewogen)</p>
                      <p className="font-mono-data text-sm text-muted-foreground mt-0.5">
                        {formatCurrency(leadDealVerwachteFee)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 hairline pt-3">
                  <div>
                    <p className="field-label">Deals</p>
                    <p className="font-mono-data text-sm font-semibold mt-0.5">{deals.length}</p>
                  </div>
                  <div>
                    <p className="field-label">Kandidaten</p>
                    <p className="font-mono-data text-sm font-semibold mt-0.5">{kandidatenTotaal}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Target className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nog geen actieve deal gekoppeld.</p>
              </div>
            )}
          </div>

          {/* Volgende actie — uit Taken-module */}
          <div id="next-action" className="section-card p-5 space-y-3 scroll-mt-24">

            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Next action
              </p>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">from Taken</span>
            </div>
            {volgendeTaak ? (
              <button
                type="button"
                onClick={() => { setEditTaak(volgendeTaak); setTaakDialogOpen(true); }}
                className="w-full text-left flex items-start gap-2.5 group"
              >
                <div className="h-7 w-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2">
                    {volgendeTaak.titel}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(volgendeTaak.deadline)}
                      {volgendeTaak.deadlineTijd ? ` · ${volgendeTaak.deadlineTijd}` : ''}
                    </p>
                    {taakIsVerlopen(volgendeTaak.deadline) && (
                      <GeenActieBadge variant="verlopen" date={volgendeTaak.deadline} />
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent shrink-0" />
              </button>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Geen volgende actie gepland.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditTaak(null); setTaakDialogOpen(true); }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition"
                >
                  <Calendar className="h-3.5 w-3.5" /> Taak aanmaken
                </button>
              </div>
            )}
            {objectTaken.filter(t => t.status === 'open').length > 1 && (
              <p className="text-[11px] text-muted-foreground hairline pt-2">
                +{objectTaken.filter(t => t.status === 'open').length - 1} open ta{objectTaken.filter(t => t.status === 'open').length - 1 === 1 ? 'ak' : 'ken'}
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div id="quick-actions" className="section-card p-5 space-y-1.5 scroll-mt-24">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent mb-2">
              Quick actions
            </p>
            <button
              type="button"
              onClick={() => setKandidaatDialogOpen(true)}
              className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-muted-foreground" /> Kandidaat toevoegen
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => openDossierTab('aanbieding')}
              className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-muted-foreground" /> Teaser sturen
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setNotitieDialogOpen(true)}
              className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
            >
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> Notitie toevoegen
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => openEdit('media')}
              className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-muted-foreground" /> Document uploaden
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            {activeTab === 'vastgoedrekenen' ? (
              <div
                aria-current="true"
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm rounded-md bg-accent/10 text-accent border border-accent/20"
              >
                <Calculator className="h-3.5 w-3.5" /> Huidige tab: Vastgoedrekenen
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('vastgoedrekenen')}
                className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
              >
                <Calculator className="h-3.5 w-3.5 text-muted-foreground" /> Vastgoedrekenen openen
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </button>
            )}
          </div>
        </aside>
      </div>

      <ObjectFormDialog open={editOpen} onOpenChange={setEditOpen} object={object} initialTab={editInitialTab} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Object verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Verwijdert {object.titel} uit alle lijsten (soft delete). Het record blijft in de database staan voor herstel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ArchiveerDialog
        open={archiefOpen}
        onOpenChange={setArchiefOpen}
        kind="object"
        onConfirm={async ({ reason, note }) => {
          try {
            await store.archiveObject(object.id, reason, note);
            setArchiefOpen(false);
            toast.success('Object gearchiveerd');
          } catch (err: any) {
            toast.error(`Archiveren mislukt: ${err.message ?? 'onbekende fout'}`);
          }
        }}
      />

      <KandidaatSelectieDialog
        open={kandidaatDialogOpen}
        onOpenChange={setKandidaatDialogOpen}
        objectId={object.id}
        reedsGekoppeld={reedsGekoppeldRelaties}
        onToegevoegd={() => toast.success('Kandidaat toegevoegd aan pipeline')}
      />

      <ContactMomentFormDialog
        open={notitieDialogOpen}
        onOpenChange={setNotitieDialogOpen}
        defaultType="notitie"
        defaultObjectId={object.id}
      />

      <TaakFormDialog
        open={taakDialogOpen}
        onOpenChange={(o) => { setTaakDialogOpen(o); if (!o) setEditTaak(null); }}
        taak={editTaak}
        defaultObjectId={object.id}
      />

      {/* Mobile bottom scroll space — zodat laatste sectie netjes onder sticky bar past */}
      <div aria-hidden className="lg:hidden h-[40vh]" />
    </div>
  );
}
