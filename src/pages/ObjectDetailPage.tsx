import { useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { useSubcategorieen } from '@/hooks/useSubcategorieen';
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
} from '@/data/mock-data';
import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';
import {
  ArrowLeft, MapPin, Pencil, Trash2, EyeOff, Star,
  FileText, Download, Building2, Phone, Mail,
  Sparkles, Send, StickyNote, Upload, ChevronRight,
  Activity, Calculator, FolderOpen, Users, LineChart,
  Info, Calendar, Target, AlertCircle, ArrowUpRight,
} from 'lucide-react';
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
import ObjectDossierCard from '@/components/object/dossier/ObjectDossierCard';

/* ============================================================
 * Local presentational primitives — institutional dealroom look
 * ============================================================ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="field-label">{label}</p>
      <div className="text-sm text-foreground mt-1 break-words">{children}</div>
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
    <section id={id} className={`scroll-mt-24 ${className ?? ''}`}>
      <div className="flex items-end justify-between gap-3 mb-3">
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
  { id: 'documenten', label: 'Documenten', icon: FolderOpen },
  { id: 'vastgoedrekenen', label: 'Underwriting', icon: Calculator },
  { id: 'activiteit', label: 'Activiteit', icon: Target },
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

    // Bepaal sticky offset op basis van actuele topbar + sub-nav hoogte
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
    const subNav = navRef.current?.getBoundingClientRect().height ?? 52;
    const buffer = 8;
    const stickyOffset = topbar + subNav + buffer;

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
    if (scrollParent === window) {
      const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
      window.scrollTo({ top, behavior: 'smooth' });
    } else {
      const parent = scrollParent as HTMLElement;
      const top = target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - stickyOffset;
      parent.scrollTo({ top, behavior: 'smooth' });
    }

    // Update hash zonder browser-jump
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-20 -mx-3 sm:-mx-8 lg:-mx-10 px-3 sm:px-8 lg:px-10 pt-2 pb-2 bg-background/90 backdrop-blur-md"
    >
      <div
        ref={scrollerRef}
        className="glass-topbar rounded-xl border border-border/50 px-2 py-1.5 overflow-x-auto whitespace-nowrap flex gap-1 scrollbar-none"
      >
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => handleClick(e, s.id)}
              ref={(el) => { tabRefs.current[s.id] = el; }}
              className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                isActive
                  ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.25)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
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
  const object = store.getObjectById(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [archiefOpen, setArchiefOpen] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string>('overzicht');

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

  // Scroll-spy
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach(e => {
            if (e.isIntersecting) setActiveSection(s.id);
          });
        },
        { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
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
  const leadDeal = useMemo(() => {
    if (!deals.length) return null;
    const sorted = [...deals].sort((a, b) => {
      const ka = (b.commissieBedrag ?? 0) - (a.commissieBedrag ?? 0);
      return ka;
    });
    return sorted[0];
  }, [deals]);

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

  const locatieLabel = object.anoniem
    ? (object.publiekeRegio ?? `${object.provincie}`)
    : `${object.plaats}, ${object.provincie}`;

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
              <HeaderChip icon={Building2}>{ASSET_CLASS_LABELS[object.type]}</HeaderChip>
              {subcatLabel && <HeaderChip>{subcatLabel}</HeaderChip>}
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
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 min-w-0 items-start">
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-4 hairline pt-5">
                <Field label="Verhuurstatus"><span className="capitalize">{object.verhuurStatus}</span></Field>
                {object.leegstandPct != null && (
                  <Field label="Leegstand"><span className="font-mono-data">{formatPercent(object.leegstandPct)}</span></Field>
                )}
                <Field label="Bouwjaar"><span className="tabular-nums">{object.bouwjaar ?? '—'}</span></Field>
                {object.energielabelV2 && (
                  <Field label="Energielabel"><span className="font-semibold">{object.energielabelV2}</span></Field>
                )}
                {object.onderhoudsstaatNiveau && (
                  <Field label="Onderhoudsstaat">{ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau]}</Field>
                )}
                {object.aantalVerdiepingen != null && (<Field label="Verdiepingen">{object.aantalVerdiepingen}</Field>)}
                {object.aantalUnits != null && (<Field label="Units">{object.aantalUnits}</Field>)}
                {object.huidigGebruik && (<Field label="Huidig gebruik">{object.huidigGebruik}</Field>)}
                <Field label="Ontwikkelpotentie">{object.ontwikkelPotentie ? 'Ja' : 'Nee'}</Field>
                <Field label="Transformatie">{object.transformatiePotentie ? 'Ja' : 'Nee'}</Field>
                {object.asbestinventarisatieAanwezig && (<Field label="Asbest">Aanwezig</Field>)}
                {object.bron && <Field label="Bron">{object.bron}</Field>}
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

              {!object.anoniem && (object.adres || object.postcode) && (
                <div className="hairline pt-5">
                  <Field label="Adres">
                    {[object.adres, object.postcode, object.plaats].filter(Boolean).join(', ')}
                  </Field>
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
          </SectionAnchor>

          {/* ============ 2. FINANCIEEL ============ */}
          <SectionAnchor id="financieel" eyebrow="02 — Underwriting" title="Financieel">
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
              </div>

              <div className="hairline pt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>
                  Voor scenario-analyse en gevoeligheid:&nbsp;
                  <a href="#vastgoedrekenen" className="text-accent hover:underline font-medium">open underwriting →</a>
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
            eyebrow="03 — Demand"
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
          <SectionAnchor id="dealflow" eyebrow="04 — Transaction" title="Dealflow">
            <ObjectPipelineFaseSectie object={object} />
            <div className="mt-4">
              <ObjectPipelineSectie objectId={object.id} />
            </div>
          </SectionAnchor>

          {/* ============ 5. DOCUMENTEN ============ */}
          <SectionAnchor
            id="documenten"
            eyebrow="05 — Data room"
            title={`Documenten · ${documenten.length}`}
          >
            {documenten.length > 0 ? (
              <div className="section-card p-5 sm:p-6">
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
              <div className="section-card p-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nog geen documenten in de data room.</p>
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

            {/* Dossier card (aanbieding) */}
            <div className="mt-4">
              <ObjectDossierCard
                objectId={object.id}
                objectRecord={object as unknown as Record<string, unknown>}
              />
            </div>
          </SectionAnchor>

          {/* ============ 6. VASTGOEDREKENEN / UNDERWRITING ============ */}
          <SectionAnchor
            id="vastgoedrekenen"
            eyebrow="06 — Underwriting"
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

          {/* ============ 7. ACTIVITEIT ============ */}
          <SectionAnchor id="activiteit" eyebrow="07 — Ops" title="Activiteit & notities">
            <div className="section-card p-6 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Activiteit-stream (calls, mails, taken) wordt in een volgende iteratie aan dit object gekoppeld.
              </p>
            </div>
          </SectionAnchor>
        </div>

        {/* RIGHT — sticky deal cockpit */}
        <aside className="lg:sticky lg:top-[88px] space-y-3 min-w-0">
          {/* Deal status cockpit */}
          <div className="section-card p-5 space-y-4">
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

          {/* Volgende actie / alerts */}
          <div className="section-card p-5 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Volgende actie
            </p>
            <div className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <Calendar className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {matches.length > 0
                    ? `Teaser sturen naar ${matches.length} kandidaat${matches.length > 1 ? 'en' : ''}`
                    : 'Object onder de aandacht brengen'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Vandaag</p>
              </div>
            </div>
            {object.interneOpmerkingen && (
              <div className="hairline pt-3 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground line-clamp-3">{object.interneOpmerkingen}</p>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="section-card p-5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent mb-2">
              Quick actions
            </p>
            <button className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-foreground rounded-md">
              <Users className="h-3.5 w-3.5 text-muted-foreground" /> Kandidaat toevoegen
            </button>
            <button className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-foreground rounded-md">
              <Send className="h-3.5 w-3.5 text-muted-foreground" /> Teaser sturen
            </button>
            <button className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-foreground rounded-md">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> Notitie toevoegen
            </button>
            <button className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-foreground rounded-md">
              <Upload className="h-3.5 w-3.5 text-muted-foreground" /> Document uploaden
            </button>
            <a
              href="#vastgoedrekenen"
              className="row-hover w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-foreground rounded-md"
            >
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" /> Underwriting openen
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </a>
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
    </div>
  );
}
