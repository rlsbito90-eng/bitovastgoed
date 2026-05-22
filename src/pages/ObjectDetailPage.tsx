import { useEffect, useRef, useState, ReactNode } from 'react';
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
  eurPerM2,
  ASSET_CLASS_LABELS,
  ONDERHOUDSSTAAT_LABELS,
  VERKOPER_VIA_LABELS,
  DOCUMENT_TYPE_LABELS,
  INDEXATIE_BASIS_LABELS,
  AANBIEDINGSWIJZE_LABELS,
  OBJECT_STATUS_LABELS,
} from '@/data/mock-data';

import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';
import {
  ArrowLeft, MapPin, Pencil, Trash2, EyeOff, Star,
  FileText, Download, Building2, Phone, Mail,
  Sparkles, Send, StickyNote, Upload, ChevronRight,
  Activity, Calculator, FolderOpen, Users, LineChart,
  Info, Calendar, Target, AlertCircle, ArrowUpRight, Coins,
} from 'lucide-react';
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  tone?: 'default' | 'positive' | 'warning';
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">
        {label}
      </p>
      <p className={`mt-1.5 text-base sm:text-lg font-semibold font-mono-data leading-none break-words ${toneCls}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}

/** Header chip for hero metadata strip */
function HeaderChip({ icon: Icon, children }: { icon?: any; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 bg-background/60 backdrop-blur border border-border/50 rounded-full px-2.5 py-1">
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

/** Sticky section nav (cockpit subnav) */
const SECTIONS = [
  { id: 'overzicht', label: 'Overzicht', icon: Info },
  { id: 'financieel', label: 'Financieel', icon: LineChart },
  { id: 'kandidaten', label: 'Kandidaten', icon: Users },
  { id: 'dealflow', label: 'Dealflow', icon: Activity },
  { id: 'biedingen', label: 'Biedingen', icon: Coins },
  { id: 'documenten', label: 'Documenten', icon: FolderOpen },
  { id: 'vastgoedrekenen', label: 'Vastgoedrekenen', icon: Calculator },
  { id: 'activiteit', label: 'Activiteit', icon: Target },
];

/** Mobile-only sectiebar items — op desktop staan deze al in de rechter sidebar */
const MOBILE_ONLY_SECTIONS = [
  { id: 'deal-cockpit', label: 'Cockpit', icon: Target },
  { id: 'next-action', label: 'Next action', icon: Calendar },
  { id: 'quick-actions', label: 'Quick actions', icon: Sparkles },
];



function SectionNav({ active }: { active: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const el = tabRefs.current[active];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (elLeft < viewLeft + 16) {
      scroller.scrollTo({ left: Math.max(0, elLeft - 16), behavior: 'smooth' });
    } else if (elRight > viewRight - 16) {
      scroller.scrollTo({ left: elRight - scroller.clientWidth + 16, behavior: 'smooth' });
    }
  }, [active]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    const subNav = navRef.current?.getBoundingClientRect().height ?? 52;
    const buffer = 8;

    // Scroll de main-container (overflow-y-auto) of window — pak de dichtstbijzijnde scrollende parent
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

    // Als de scrollParent een element is, zit de topbar ER BUITEN — dan alleen subNav compenseren.
    // Bij window-scroll moet de topbar wél meegerekend worden.
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
      window.scrollTo({ top, behavior: 'smooth' });
    } else {
      const parent = scrollParent as HTMLElement;
      const top = target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - (subNav + buffer);
      parent.scrollTo({ top, behavior: 'smooth' });
    }

    // Update hash zonder browser-jump
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      ref={navRef}
      data-object-section-nav="true"
      className="sticky top-0 z-20 -mx-3 sm:-mx-8 lg:-mx-10 px-3 sm:px-8 lg:px-10 pt-2 pb-2.5 bg-background/95 backdrop-blur-md border-b border-border/40"
    >
      <div
        ref={scrollerRef}
        className="glass-topbar rounded-xl border border-border/60 shadow-sm px-2 py-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap flex items-stretch gap-1 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {SECTIONS.map((s) => {
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
  const [archiefOpen, setArchiefOpen] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string>('overzicht');
  const [kandidaatDialogOpen, setKandidaatDialogOpen] = useState(false);
  const [notitieDialogOpen, setNotitieDialogOpen] = useState(false);
  const [taakDialogOpen, setTaakDialogOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<any>(null);
  const [dossierOpenRequest, setDossierOpenRequest] = useState<{ tab: DossierTab; token: number } | null>(null);
  const scrollLockRef = useRef<number>(0);

  const performScroll = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return false;

    const sectionNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
    const sectionNavHeight = sectionNav?.getBoundingClientRect().height ?? 60;
    const buffer = 12;

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

    if (scrollParent === window) {
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
    } else {
      const parent = scrollParent as HTMLElement;
      const top = target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - (sectionNavHeight + buffer);
      parent.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    return true;
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    scrollLockRef.current = Date.now() + 700; // lock scrollspy briefly
    // Voer scroll meerdere keren uit zodat layout-shifts (tab-switch, lazy mount)
    // niet leiden tot een halve scroll → één klik is altijd genoeg.
    requestAnimationFrame(() => {
      performScroll(id);
      requestAnimationFrame(() => performScroll(id));
      setTimeout(() => { performScroll(id); scrollLockRef.current = Date.now() + 500; }, 180);
      setTimeout(() => { performScroll(id); scrollLockRef.current = Date.now() + 300; }, 420);
    });
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  };

  const openDossierTab = (tab: DossierTab) => {
    setDossierOpenRequest({ tab, token: Date.now() });
    scrollToSection('documenten');
  };


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

  // Scroll-spy: kies de sectie wiens top het dichtst onder de sticky sectiebar ligt.
  // Wanneer near bottom: forceer laatste zichtbare sectie. Respecteert scrollLockRef.
  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    const sectionsToObserve = isDesktop ? SECTIONS : [...SECTIONS, ...MOBILE_ONLY_SECTIONS];

    const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
      let el: HTMLElement | null = node?.parentElement ?? null;
      while (el) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
      }
      return window;
    };

    const compute = () => {
      if (Date.now() < scrollLockRef.current) return;
      const subNav = document.querySelector<HTMLElement>('[data-object-section-nav="true"]');
      const subNavBottom = subNav?.getBoundingClientRect().bottom ?? 60;
      const offsetLine = subNavBottom + 16;

      // Verzamel alle bestaande secties met hun rect
      const present = sectionsToObserve
        .map(s => {
          const el = document.getElementById(s.id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { id: s.id, top: rect.top, bottom: rect.bottom };
        })
        .filter((x): x is { id: string; top: number; bottom: number } => x !== null);

      if (present.length === 0) return;

      // Detect near-bottom → forceer laatste sectie
      const firstEl = document.getElementById(present[0].id);
      const parent = firstEl ? getScrollParent(firstEl) : window;
      const nearBottom = parent === window
        ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24
        : (() => {
            const p = parent as HTMLElement;
            return p.scrollTop + p.clientHeight >= p.scrollHeight - 24;
          })();

      if (nearBottom) {
        setActiveSection(present[present.length - 1].id);
        return;
      }

      // 1) Sectie die offsetLine bevat → kies de laatste (meest recente in DOM-volgorde)
      const containing = present.filter(s => s.top <= offsetLine && s.bottom > offsetLine);
      if (containing.length > 0) {
        setActiveSection(containing[containing.length - 1].id);
        return;
      }

      // 2) Anders: laatste sectie wiens top de offsetLine al gepasseerd is
      const passed = present.filter(s => s.top <= offsetLine);
      if (passed.length > 0) {
        setActiveSection(passed[passed.length - 1].id);
        return;
      }

      // 3) Anders: eerste sectie (we zitten boven alles)
      setActiveSection(present[0].id);
    };

    const firstEl = document.getElementById(sectionsToObserve[0]?.id);
    const parent = firstEl ? getScrollParent(firstEl) : window;
    const target: HTMLElement | Window = parent;
    target.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    compute();
    return () => {
      target.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [object?.id]);

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
  const huurMetrics = store.getHuurMetrics(object.id);
  const deals = store.getDealsByObject(object.id);
  const matches = getMatchesForObjectFromData(object, store.zoekprofielen);
  const objectTaken = store.getTakenByObject(object.id);
  const kandidatenPipeline = store.getPipelineVoorObject(object.id);
  const parentObject = object.parentObjectId ? store.getObjectById(object.parentObjectId) : null;
  const reedsGekoppeldRelaties = new Set<string>(kandidatenPipeline.map(k => k.relatieId));
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

  const barEffect = object.brutoAanvangsrendement
    ?? (object.huurinkomsten && object.vraagprijs
      ? (object.huurinkomsten / object.vraagprijs) * 100
      : null);

  const factor = object.huurinkomsten && object.vraagprijs
    ? object.vraagprijs / object.huurinkomsten
    : null;

  const m2VoorBerekening = object.oppervlakteVvo ?? object.oppervlakte;
  const prijsPerM2Str = formatEurPerM2(object.vraagprijs, m2VoorBerekening);
  const huurPerM2Berekend = object.huurPerM2
    ?? eurPerM2(object.huurinkomsten, m2VoorBerekening);
  const huurPerM2Str = huurPerM2Berekend != null
    ? `€${Math.round(huurPerM2Berekend).toLocaleString('nl-NL')}/m²/jr`
    : '—';

  // Lead deal voor cockpit
  const leadDeal = (() => {
    if (!deals.length) return null;
    const sorted = [...deals].sort((a, b) => {
      const ka = (b.commissieBedrag ?? 0) - (a.commissieBedrag ?? 0);
      return ka;
    });
    return sorted[0];
  })();

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
  const verborgenImSecties = Object.entries(object.imSectiesZichtbaar ?? {})
    .filter(([, zichtbaar]) => zichtbaar === false)
    .map(([key]) => key);
  const locatieLabel = [
    object.adres,
    [object.postcode, object.plaats].filter(Boolean).join(' '),
    object.provincie,
  ].filter(Boolean).join(', ') || object.publiekeRegio || object.plaats || object.provincie || 'Locatie onbekend';

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
      <header className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        {/* Banner */}
        <div className="relative aspect-[21/9] sm:aspect-[24/8] lg:aspect-[28/8] bg-muted">
          {heroUrl ? (
            <img src={heroUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-muted to-accent/10 flex items-center justify-center">
              <Building2 className="h-16 w-16 text-muted-foreground/40" />
            </div>
          )}
          {/* Gradient scrim voor leesbaarheid */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/30" />
        </div>

        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
          {/* Top: badges + actions */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
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

            {/* Quick actions cluster */}
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
                  onClick={async () => {
                    try {
                      await store.unarchiveObject(object.id);
                      toast.success('Object teruggezet naar Actief');
                    } catch (err: any) {
                      toast.error(`Terugzetten mislukt: ${err.message ?? 'onbekende fout'}`);
                    }
                  }}
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="inline-flex items-center justify-center px-2 py-1.5 text-[12px] bg-background/70 backdrop-blur border border-destructive/40 rounded-md hover:bg-destructive/10 transition text-destructive" aria-label="Verwijderen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Object verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>Verwijdert {object.titel} uit alle lijsten (soft delete). Het record blijft in de database staan voor herstel.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Bottom: title + metadata */}
          <div className="min-w-0 mt-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-semibold text-foreground tracking-tight leading-[1.05] break-words drop-shadow-sm">
              {object.titel}
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              <HeaderChip icon={MapPin}>{locatieLabel}</HeaderChip>
              <HeaderChip icon={Building2}>{propertyTypeLabel}</HeaderChip>
              {subtypeLabel && <HeaderChip>{subtypeLabel}</HeaderChip>}
              {object.internReferentienummer && (
                <HeaderChip>{object.internReferentienummer}</HeaderChip>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =================================================
          HERO KPI STRIP — institutional underwriting overview
          ================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        <MetricTile label="Vraagprijs" value={formatCurrency(object.vraagprijs)} accent />
        <MetricTile label="€ / m²" value={prijsPerM2Str} />
        <MetricTile
          label="BAR"
          value={barEffect != null ? formatPercent(barEffect, 2) : '—'}
          tone={barEffect != null && barEffect >= 6 ? 'positive' : 'default'}
        />
        <MetricTile
          label="Factor"
          value={factor != null ? `${factor.toFixed(1)}×` : '—'}
        />
        <MetricTile
          label="Huur / jr"
          value={object.huurinkomsten ? formatCurrencyCompact(object.huurinkomsten) : '—'}
          hint={huurPerM2Berekend != null ? huurPerM2Str : undefined}
        />
        <MetricTile
          label="Oppervlakte"
          value={object.oppervlakte ? formatM2(object.oppervlakte) : '—'}
        />
      </div>

      {/* WALT/WALB strip (alleen als huurders) */}
      {huurMetrics && huurMetrics.aantalHuurders > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          <MetricTile label="Huurders" value={huurMetrics.aantalHuurders.toString()} />
          <MetricTile label="Totale jaarhuur" value={formatCurrencyCompact(huurMetrics.totaleJaarhuur)} />
          <MetricTile label="WALT" value={huurMetrics.waltJaren != null ? `${huurMetrics.waltJaren} jr` : '—'} />
          <MetricTile label="WALB" value={huurMetrics.walbJaren != null ? `${huurMetrics.walbJaren} jr` : '—'} />
        </div>
      )}

      {/* =================================================
          STICKY SECTION NAV
          ================================================= */}
      <SectionNav active={activeSection} />

      {/* =================================================
          MAIN GRID — content + sticky deal cockpit
          ================================================= */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 xl:gap-8 min-w-0 items-start">
        {/* LEFT — content */}
        <div className="space-y-6 lg:space-y-8 min-w-0 max-w-full">

          {/* ============ 1. OVERZICHT ============ */}
          <SectionAnchor id="overzicht" eyebrow="01 — Asset" title="Overzicht">
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
                    <Field label="Anonimiteit">{object.anoniem ? 'Anoniem presenteren' : 'Volledig zichtbaar'}</Field>
                    {object.publiekeNaam && <Field label="Publieke naam">{object.publiekeNaam}</Field>}
                    {object.bron && <Field label="Bron">{object.bron}</Field>}
                    <Field label="Exclusiviteit">{object.exclusief ? 'Exclusief aangeboden' : 'Niet exclusief'}</Field>
                    <Field label="Portefeuille">{object.isPortefeuille ? 'Ja' : 'Nee'}</Field>
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

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 hairline pt-5">
                <Field label="Type vastgoed">{propertyTypeLabel}</Field>
                {subtypeLabel && <Field label="Subtype">{subtypeLabel}</Field>}
                {dealTypeLabels.length > 0 && <Field label="Dealtype / propositie">{dealTypeLabels.join(', ')}</Field>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-4 hairline pt-5">
                <Field label="Verhuurstatus"><span className="capitalize">{object.verhuurStatus}</span></Field>
                {object.aantalHuurders != null && (
                  <Field label="Aantal huurders"><span className="tabular-nums">{object.aantalHuurders}</span></Field>
                )}
                {object.leegstandPct != null && (
                  <Field label="Leegstand"><span className="font-mono-data">{formatPercent(object.leegstandPct)}</span></Field>
                )}
                {object.aanbiedingswijze && (
                  <Field label="Aanbiedingswijze">{AANBIEDINGSWIJZE_LABELS[object.aanbiedingswijze]}</Field>
                )}
                {object.beschikbaarVanaf && (
                  <Field label="Beschikbaar vanaf"><span className="tabular-nums">{formatDate(object.beschikbaarVanaf)}</span></Field>
                )}
                <Field label="Bouwjaar"><span className="tabular-nums">{object.bouwjaar ?? '—'}</span></Field>
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
                {object.huidigGebruik && (<Field label="Huidig gebruik">{object.huidigGebruik}</Field>)}
                <Field label="Ontwikkelpotentie">{object.ontwikkelPotentie ? 'Ja' : 'Nee'}</Field>
                <Field label="Transformatie">{object.transformatiePotentie ? 'Ja' : 'Nee'}</Field>
                {object.asbestinventarisatieAanwezig && (<Field label="Asbest">Aanwezig</Field>)}
                {object.bron && <Field label="Bron">{object.bron}</Field>}
                <Field label="Documentatie beschikbaar">{object.documentenBeschikbaar ? 'Ja' : 'Nee'}</Field>
                <Field label="Toegevoegd"><span className="tabular-nums">{formatDate(object.datumToegevoegd)}</span></Field>
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

              {(object.samenvatting || object.investeringsthese || object.risicos || object.onderscheidendeKenmerken || object.opmerkingen) && (
                <div className="space-y-4 hairline pt-5">
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
                </div>
              )}

              {object.interneOpmerkingen && (
                <div className="bg-warning/5 border border-warning/20 rounded-md p-3.5">
                  <p className="field-label text-warning">Interne opmerking</p>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{object.interneOpmerkingen}</p>
                </div>
              )}
            </div>

            {/* Juridisch + Verkoper als sub-cards */}
            {((object.eigendomssituatie || object.erfpachtinformatie || object.bestemmingsinformatie || object.kadastraalNummer) ||
              (object.verkoperNaam || object.verkoperEmail || object.verkoperTelefoon)) && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                {(object.eigendomssituatie || object.erfpachtinformatie || object.bestemmingsinformatie || object.kadastraalNummer) && (
                  <div className="section-card p-5 space-y-3">
                    <h3 className="section-title">Juridisch & kadastraal</h3>
                    <div className="space-y-3">
                      {object.eigendomssituatie && <Field label="Eigendomssituatie">{object.eigendomssituatie}</Field>}
                      {(object.kadastraleGemeente || object.kadastraalNummer) && (
                        <Field label="Kadaster">
                          {[object.kadastraleGemeente, object.kadastraleSectie, object.kadastraalNummer].filter(Boolean).join(' ')}
                        </Field>
                      )}
                      {object.erfpachtinformatie && <Field label="Erfpacht">{object.erfpachtinformatie}</Field>}
                      {object.bestemmingsinformatie && <Field label="Bestemming">{object.bestemmingsinformatie}</Field>}
                    </div>
                  </div>
                )}
                {(object.verkoperNaam || object.verkoperEmail || object.verkoperTelefoon) && (
                  <div className="section-card p-5 space-y-3">
                    <h3 className="section-title">Verkoper</h3>
                    <div className="space-y-3">
                      {object.verkoperNaam && (
                        <Field label="Naam">
                          {object.verkoperNaam}
                          {object.verkoperRol && <span className="text-muted-foreground"> · {object.verkoperRol}</span>}
                        </Field>
                      )}
                      <Field label="Via">{VERKOPER_VIA_LABELS[object.verkoperVia ?? 'onbekend']}</Field>
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
              </div>
            )}

            {/* Aanbieding & proces — commerciële/processtukken uit edit */}
            {(object.propositie || object.objectomschrijving || object.locatieOmschrijving ||
              object.technischeStaatOmschrijving || object.procesVoorwaarden || object.dataroomUrl ||
              documentatieStatusRows.length > 0 || verborgenImSecties.length > 0) && (
              <div className="section-card p-5 sm:p-6 space-y-4 mt-4">
                <h3 className="section-title">Aanbieding & proces</h3>
                <div className="space-y-4">
                  {object.propositie && <Field label="Propositie"><pre className="whitespace-pre-wrap font-sans text-sm">{object.propositie}</pre></Field>}
                  {object.objectomschrijving && <Field label="Objectomschrijving"><pre className="whitespace-pre-wrap font-sans text-sm">{object.objectomschrijving}</pre></Field>}
                  {object.locatieOmschrijving && <Field label="Locatie"><pre className="whitespace-pre-wrap font-sans text-sm">{object.locatieOmschrijving}</pre></Field>}
                  {object.technischeStaatOmschrijving && <Field label="Technische staat"><pre className="whitespace-pre-wrap font-sans text-sm">{object.technischeStaatOmschrijving}</pre></Field>}
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
                    <Field label="Verborgen IM-secties">{verborgenImSecties.join(', ')}</Field>
                  )}
                </div>
              </div>
            )}

            {/* Onderhoud & investeringen */}
            {(object.recenteInvesteringen || object.achterstalligOnderhoud) && (
              <div className="section-card p-5 sm:p-6 space-y-3 mt-4">
                <h3 className="section-title">Onderhoud & investeringen</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {object.recenteInvesteringen && <Field label="Recente investeringen"><pre className="whitespace-pre-wrap font-sans text-sm">{object.recenteInvesteringen}</pre></Field>}
                  {object.achterstalligOnderhoud && <Field label="Achterstallig onderhoud"><pre className="whitespace-pre-wrap font-sans text-sm">{object.achterstalligOnderhoud}</pre></Field>}
                </div>
              </div>
            )}

            {/* Contactpersoon object (publiek) */}
            {(object.contactNaam || object.contactEmail || object.contactTelefoon) && (
              <div className="section-card p-5 sm:p-6 space-y-3 mt-4">
                <h3 className="section-title">Contactpersoon</h3>
                <div className="grid sm:grid-cols-2 gap-4">
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
          </SectionAnchor>


          {/* ============ 2. FINANCIEEL ============ */}
          <SectionAnchor id="financieel" eyebrow="02 — Financials" title="Financieel">
            <div className="section-card p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                <MetricTile label="Vraagprijs" value={formatCurrency(object.vraagprijs)} accent />
                <MetricTile label="BAR" value={barEffect != null ? formatPercent(barEffect, 2) : '—'} />
                {object.nettoAanvangsrendement != null && (
                  <MetricTile label="NAR" value={formatPercent(object.nettoAanvangsrendement, 2)} />
                )}
                <MetricTile label="Factor" value={factor != null ? `${factor.toFixed(1)}×` : '—'} />
                {object.huurinkomsten != null && (
                  <MetricTile label="Huur / jr" value={formatCurrency(object.huurinkomsten)} />
                )}
                {object.noi != null && (
                  <MetricTile label="NOI" value={formatCurrency(object.noi)} tone="positive" />
                )}
                {object.servicekostenJaar != null && (
                  <MetricTile label="Servicekosten" value={formatCurrency(object.servicekostenJaar)} />
                )}
                <MetricTile label="€ / m²" value={prijsPerM2Str} />
                <MetricTile label="Huur / m²" value={huurPerM2Str} />
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

              {/* Financiële scenario's */}
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
                  <button type="button" onClick={() => scrollToSection('vastgoedrekenen')} className="text-accent hover:underline font-medium">open vastgoedrekenen →</button>
                </span>
              </div>
            </div>


            {/* HUURDERS als sub-card binnen financieel */}
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

            {object.referentieanalyseZichtbaar !== false && (
              <div className="mt-4">
                <ObjectReferentieAnalyseSectie object={object} />
              </div>
            )}
          </SectionAnchor>

          {/* ============ 3. KANDIDATEN / MATCHING ============ */}
          <SectionAnchor
            id="kandidaten"
            eyebrow="03 — Candidates"
            title={`Top kandidaten · ${matches.length}`}
          >
            <div className="section-card overflow-hidden">
              {matches.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted-foreground text-center">Geen matches gevonden.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {matches.slice(0, 10).map((m, i) => {
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

            {/* Bestaande deals binnen kandidaten-context */}
            {deals.length > 0 && (
              <div className="section-card mt-4">
                <header className="section-header">
                  <h3 className="section-title">Gekoppelde deals ({deals.length})</h3>
                </header>
                <div className="divide-y divide-border/60">
                  {deals.map(deal => {
                    const rel = store.getRelatieById(deal.relatieId);
                    return (
                      <Link key={deal.id} to={`/deals/${deal.id}`} className="row-hover block px-5 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{rel?.bedrijfsnaam}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {deal.commissieBedrag != null && `Commissie: ${formatCurrency(deal.commissieBedrag)}`}
                            </p>
                          </div>
                          <DealFaseBadge fase={deal.fase} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionAnchor>

          {/* ============ 4. DEALFLOW TIMELINE ============ */}
          <SectionAnchor id="dealflow" eyebrow="04 — Dealflow" title="Dealflow">
            <ObjectPipelineFaseSectie object={object} />
            <div className="mt-4">
              <ObjectPipelineSectie objectId={object.id} />
            </div>
          </SectionAnchor>

          {/* ============ 5. BIEDINGEN ============ */}
          <SectionAnchor id="biedingen" eyebrow="05 — Negotiations" title="Biedingen">
            <BiedingenSection
              scope={{ objectId: object.id }}
              vraagprijs={object.vraagprijs ?? null}
              defaults={{ objectId: object.id }}
              toonObject={false}
            />
          </SectionAnchor>


          {/* ============ 6. DOCUMENTEN / DATA ROOM ============ */}
          <SectionAnchor
            id="documenten"
            eyebrow="06 — Data room"
            title={`Documenten · ${documenten.length}`}
          >
            <ObjectDossierCard
              objectId={object.id}
              objectRecord={object as unknown as Record<string, unknown>}
              openTabRequest={dossierOpenRequest}
            />

            {documenten.length > 0 ? (
              <div className="section-card p-5 sm:p-6 mt-4">
                <h3 className="section-title mb-3">Bestanden in data room</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {documenten.map(doc => (
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
                  ))}
                </div>
              </div>
            ) : (
              <div className="section-card p-8 text-center mt-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nog geen bestanden in de data room. Open de tab Documenten hierboven om te uploaden.</p>
              </div>
            )}

            {/* Foto's */}
            {fotos.length > 1 && (
              <div className="section-card p-5 sm:p-6 mt-4">
                <h3 className="section-title mb-3">Foto's ({fotos.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {fotos.map(foto => (
                    <div key={foto.id} className="relative aspect-[4/3] bg-muted rounded-md overflow-hidden group">
                      {fotoUrls[foto.storagePath] ? (
                        <img src={fotoUrls[foto.storagePath]} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                      {foto.isHoofdfoto && (
                        <div className="absolute top-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                          <Star className="h-2.5 w-2.5 fill-current" /> Hoofd
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </SectionAnchor>

          {/* ============ 7. UNDERWRITING / VASTGOEDREKENEN ============ */}
          <SectionAnchor
            id="vastgoedrekenen"
            eyebrow="07 — Underwriting"
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

          {/* ============ 8. ACTIVITEIT ============ */}
          <SectionAnchor id="activiteit" eyebrow="08 — Activity" title="Activiteit & notities">
            <Timeline objectId={object.id} />
          </SectionAnchor>
        </div>

        {/* RIGHT — sticky deal cockpit */}
        <aside className="lg:sticky lg:top-[88px] space-y-3 min-w-0">
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
                  <div className="hairline pt-3">
                    <p className="field-label">Verwachte fee</p>
                    <p className="font-mono-data text-xl font-semibold text-foreground mt-0.5">
                      {formatCurrency(leadDeal.commissieBedrag)}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 hairline pt-3">
                  <div>
                    <p className="field-label">Deals</p>
                    <p className="font-mono-data text-sm font-semibold mt-0.5">{deals.length}</p>
                  </div>
                  <div>
                    <p className="field-label">Kandidaten</p>
                    <p className="font-mono-data text-sm font-semibold mt-0.5">{matches.length}</p>
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
              onClick={() => openDossierTab('documenten')}
              className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-muted-foreground" /> Document uploaden
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            {activeSection === 'vastgoedrekenen' ? (
              <div
                aria-current="true"
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm rounded-md bg-accent/10 text-accent border border-accent/20"
              >
                <Calculator className="h-3.5 w-3.5" /> Huidige sectie: Vastgoedrekenen
              </div>
            ) : (
              <button
                type="button"
                onClick={() => scrollToSection('vastgoedrekenen')}
                className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-foreground rounded-md cursor-pointer"
              >
                <Calculator className="h-3.5 w-3.5 text-muted-foreground" /> Vastgoedrekenen openen
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </button>
            )}
          </div>
        </aside>
      </div>

      <ObjectFormDialog open={editOpen} onOpenChange={setEditOpen} object={object} />
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
