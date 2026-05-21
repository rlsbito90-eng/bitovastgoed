import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  formatCurrency,
  formatCurrencyCompact,
  getAllMatchesFromData,
  berekenCommissieStats,
  isDealActief,
  isDealGerealiseerd,
  getDealRealisatieDatum,
  FASE_KANS,
  DEAL_FASE_LABELS,
} from '@/data/mock-data';
import type { DealFase } from '@/data/mock-data';
import {
  LeadStatusBadge,
  DealFaseBadge,
  PrioriteitBadge,
  MatchScoreBadge,
} from '@/components/StatusBadges';
import PageHeader from '@/components/PageHeader';
import {
  CheckSquare,
  TrendingUp,
  Zap,
  Flame,
  ArrowRight,
  Clock,
  AlertTriangle,
  Target,
  Banknote,
  Building2,
  ChevronRight,
  Sparkles,
  Activity,
} from 'lucide-react';
import CommissieWidget from '@/components/dashboard/CommissieWidget';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { isVerlopen as datumVerlopen } from '@/components/GeenActieBadge';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { targetIsActief } from '@/lib/acquisitie';
import {
  isTaakTeLaat,
  isTaakVandaag,
  isTaakDezeWeek,
  deadlineLabel,
  sorteerTaken,
} from '@/lib/taakHelpers';

/* ------------------------------------------------------------------ */
/* Executive snapshot — premium KPI                                    */
/* ------------------------------------------------------------------ */

type KPITone = 'primary' | 'accent' | 'success' | 'muted' | 'warning';

function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  trend,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ElementType;
  tone?: KPITone;
  trend?: { value: string; up?: boolean };
  href?: string;
}) {
  const toneClasses: Record<KPITone, string> = {
    primary: 'bg-primary text-primary-foreground',
    accent:  'bg-accent/15 text-accent',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    muted:   'bg-muted text-muted-foreground',
  };
  const toneGlow: Record<KPITone, string> = {
    primary: 'before:from-primary/40',
    accent:  'before:from-accent/60',
    success: 'before:from-success/50',
    warning: 'before:from-warning/60',
    muted:   'before:from-muted-foreground/30',
  };
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value value-in">{value}</p>
        </div>
        <span className={`kpi-badge ${toneClasses[tone]}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 min-h-[18px]">
        {hint && <p className="kpi-hint">{hint}</p>}
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold font-mono-data px-1.5 py-0.5 rounded-md ring-1 ${
              trend.up === false
                ? 'text-destructive bg-destructive/8 ring-destructive/15'
                : 'text-success bg-success/8 ring-success/15'
            }`}
          >
            {trend.up === false ? '▾' : '▴'} {trend.value}
          </span>
        )}
      </div>
    </>
  );
  const className = `kpi-card group ${toneGlow[tone]}`;
  if (href) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}


/* ------------------------------------------------------------------ */
/* Pipeline stages (operationele dealflow)                             */
/* ------------------------------------------------------------------ */

const pipelineFases: DealFase[] = [
  'lead',
  'introductie',
  'interesse',
  'bezichtiging',
  'bieding',
  'onderhandeling',
  'closing',
];

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const store = useDataStore();
  const { relaties, objecten, deals, taken } = store;
  const nu = new Date();

  // --- Core selections ---
  const actieveObjecten = useMemo(() => objecten.filter(o => !o.isArchived), [objecten]);
  const actieveDeals    = useMemo(() => deals.filter(isDealActief), [deals]);
  const openTaken       = useMemo(
    () => taken.filter(t => t.status !== 'afgerond' && t.status !== 'geannuleerd'),
    [taken],
  );
  const warmeRelaties = useMemo(
    () => relaties.filter(r => r.leadStatus === 'warm' || r.leadStatus === 'actief'),
    [relaties],
  );

  // --- Matches ---
  const matches = useMemo(
    () => getAllMatchesFromData(store.zoekprofielen, store.objecten),
    [store.zoekprofielen, store.objecten],
  );
  const sterkeMatches = useMemo(() => matches.filter(m => m.score >= 70), [matches]);

  // --- Pipeline value & weighted fee ---
  const commissieStats = useMemo(
    () =>
      berekenCommissieStats(
        deals,
        (oid) => store.getObjectById(oid)?.vraagprijs,
        nu.getFullYear(),
      ),
    [deals, store, nu],
  );

  const pipelineWaardeTotaal = useMemo(
    () => actieveDeals.reduce((s, d) => s + (store.getObjectById(d.objectId)?.vraagprijs ?? 0), 0),
    [actieveDeals, store],
  );

  // --- Closing-fase deals (bieding → closing) ---
  const closingDeals = useMemo(
    () => actieveDeals.filter(d => d.fase === 'bieding' || d.fase === 'onderhandeling' || d.fase === 'closing'),
    [actieveDeals],
  );

  // --- Task buckets ---
  const taakVerlopen = useMemo(
    () => sorteerTaken(openTaken.filter(t => isTaakTeLaat(t, nu)), nu),
    [openTaken, nu],
  );
  const taakVandaag = useMemo(
    () => sorteerTaken(openTaken.filter(t => isTaakVandaag(t, nu) && !isTaakTeLaat(t, nu)), nu),
    [openTaken, nu],
  );
  const taakDezeWeek = useMemo(
    () => sorteerTaken(
      openTaken.filter(t => isTaakDezeWeek(t, nu) && !isTaakTeLaat(t, nu) && !isTaakVandaag(t, nu)),
      nu,
    ),
    [openTaken, nu],
  );
  const taakWacht = useMemo(
    () => sorteerTaken(openTaken.filter(t => t.status === 'wacht_op_reactie'), nu),
    [openTaken, nu],
  );
  const urgentCount = taakVerlopen.length + taakVandaag.length;

  // --- Pipeline per fase ---
  const pipelinePerFase = useMemo(() => {
    return pipelineFases.map(fase => {
      const facetDeals = actieveDeals.filter(d => d.fase === fase);
      const waarde = facetDeals.reduce((s, d) => s + (store.getObjectById(d.objectId)?.vraagprijs ?? 0), 0);
      const fee = facetDeals.reduce((s, d) => s + (d.commissieBedrag ?? 0), 0);
      const gewogen = fee * FASE_KANS[fase];
      return { fase, aantal: facetDeals.length, waarde, fee, gewogen };
    });
  }, [actieveDeals, store]);
  const totaalActieveDeals = pipelinePerFase.reduce((s, x) => s + x.aantal, 0) || 1;
  const maxAantal = Math.max(1, ...pipelinePerFase.map(x => x.aantal));
  const maxGewogen = Math.max(0, ...pipelinePerFase.map(x => x.gewogen));


  // --- Forecast 30/60/90 (gewogen fee uit verwachteClosingdatum) ---
  const forecast = useMemo(() => {
    const buckets = [30, 60, 90].map(d => ({ days: d, bedrag: 0, count: 0 }));
    const today = nu.getTime();
    for (const d of actieveDeals) {
      if (!d.verwachteClosingdatum || !d.commissieBedrag) continue;
      const dt = new Date(d.verwachteClosingdatum).getTime();
      const diff = (dt - today) / (1000 * 60 * 60 * 24);
      if (diff < 0 || diff > 90) continue;
      const gewogen = d.commissieBedrag * FASE_KANS[d.fase];
      for (const b of buckets) {
        if (diff <= b.days) { b.bedrag += gewogen; b.count += 1; }
      }
    }
    return buckets;
  }, [actieveDeals, nu]);

  // --- Active deals (top moving) ---
  const topDeals = useMemo(() => {
    const fasePrio: Record<DealFase, number> = {
      closing: 0, onderhandeling: 1, bieding: 2, bezichtiging: 3,
      interesse: 4, introductie: 5, lead: 6, afgerond: 9, afgevallen: 9,
    };
    return [...actieveDeals]
      .sort((a, b) => (fasePrio[a.fase] ?? 9) - (fasePrio[b.fase] ?? 9))
      .slice(0, 6);
  }, [actieveDeals]);

  // --- Health strip ---
  const beschikbareObjecten = actieveObjecten.filter(o => o.status === 'beschikbaar').length;
  const objectenZonderKandidaten = actieveObjecten.filter(o => !o.isArchived).filter(o => {
    return !deals.some(d => d.objectId === o.id && isDealActief(d));
  }).length;
  const dealsZonderActiviteit = actieveDeals.filter(d => {
    if (!d.datumFollowUp) return true;
    const last = new Date(d.datumFollowUp).getTime();
    return (nu.getTime() - last) / (1000 * 60 * 60 * 24) > 7;
  }).length;

  return (
    <div className="page-shell-wide">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            {actieveDeals.length} actieve deals · {formatCurrencyCompact(pipelineWaardeTotaal)} pipeline
            {urgentCount > 0 && (
              <span className="text-destructive"> · {urgentCount} urgente acties</span>
            )}
          </>
        }
      />

      {/* ============== SECTIE 1 — EXECUTIVE SNAPSHOT ============== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <KPICard
          label="Pipeline waarde"
          value={
            <>
              <span className="sm:hidden">{formatCurrencyCompact(pipelineWaardeTotaal)}</span>
              <span className="hidden sm:inline">{formatCurrencyCompact(pipelineWaardeTotaal)}</span>
            </>
          }
          hint={`${actieveDeals.length} actieve deals`}
          icon={Building2}
          tone="primary"
          href="/deals"
        />
        <KPICard
          label="Weighted fee"
          value={formatCurrencyCompact(commissieStats.pipelineBedragGewogen)}
          hint={`${formatCurrencyCompact(commissieStats.pipelineBedragTotaal)} ongewogen`}
          icon={Banknote}
          tone="accent"
          href="/rapportage"
        />
        <KPICard
          label="Deals in closing"
          value={closingDeals.length}
          hint="Bieding → closing"
          icon={Target}
          tone="success"
          href="/deals?fase=closing"
        />
        <KPICard
          label="Urgente acties"
          value={urgentCount}
          hint={`${taakVerlopen.length} verlopen · ${taakVandaag.length} vandaag`}
          icon={AlertTriangle}
          tone={urgentCount > 0 ? 'warning' : 'muted'}
          href="/taken"
        />
        <KPICard
          label="Nieuwe matches"
          value={sterkeMatches.length}
          hint={`${matches.length} totaal · score ≥ 70`}
          icon={Sparkles}
          tone="accent"
        />
      </div>

      {/* ============== SECTIE 2 — PIPELINE MOMENTUM ============== */}
      <section className="section-card">
        <header className="section-header">
          <div className="min-w-0">
            <h2 className="section-title flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Pipeline momentum
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">
              Live overzicht van transactiefases — klik voor detail
            </p>
          </div>
          <Link to="/deals" className="section-link inline-flex items-center gap-1 group">
            Alle deals <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>
        <div className="p-5 lg:p-6">
          <div className="hidden md:flex items-stretch gap-1.5 mb-2">
            {pipelinePerFase.map(({ fase, aantal, waarde, gewogen }, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === pipelinePerFase.length - 1;
              const intensity = 0.06 + (idx / Math.max(1, pipelinePerFase.length - 1)) * 0.26;
              const heightPct = (aantal / maxAantal) * 100;
              const pct = Math.round((aantal / totaalActieveDeals) * 100);
              const isHotspot = gewogen > 0 && gewogen === maxGewogen;
              return (
                <Link
                  key={fase}
                  to={`/deals?fase=${fase}`}
                  className={`pipeline-stage rounded-sm ${
                    isFirst ? 'chevron-step-first' : isLast ? 'chevron-step-last' : 'chevron-step'
                  } ${isHotspot ? 'pipeline-stage--active' : ''}`}
                  style={{ backgroundColor: `hsl(var(--accent) / ${intensity})` }}
                  title={`${DEAL_FASE_LABELS[fase]}: ${aantal} · ${formatCurrencyCompact(waarde)} · fee ${formatCurrencyCompact(gewogen)}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70 truncate">
                      {DEAL_FASE_LABELS[fase]}
                    </p>
                    {isHotspot && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.18)]" aria-hidden />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-[22px] font-semibold font-mono-data text-foreground leading-none tracking-tight">{aantal}</span>
                    <span className="text-[10px] font-mono-data text-muted-foreground">{pct}%</span>
                  </div>
                  <p className="text-[10px] font-mono-data text-muted-foreground mt-0.5 truncate">
                    {formatCurrencyCompact(waarde)}
                  </p>
                  <div className="mt-2 h-1 bg-foreground/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full bar-fill"
                      style={{ width: `${Math.max(4, heightPct)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 truncate" title="Weighted fee">
                    fee ~ <span className="font-mono-data text-foreground/80 font-medium">{formatCurrencyCompact(gewogen)}</span>
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Mobiel */}
          <div className="md:hidden grid grid-cols-2 gap-2.5">
            {pipelinePerFase.map(({ fase, aantal, waarde }) => {
              const pct = Math.round((aantal / totaalActieveDeals) * 100);
              return (
                <Link
                  key={fase}
                  to={`/deals?fase=${fase}`}
                  className="rounded-lg border border-border/70 px-3 py-2.5 hover:border-accent/40 transition-colors"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    {DEAL_FASE_LABELS[fase]}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-lg font-semibold font-mono-data text-foreground">{aantal}</span>
                    <span className="text-[10px] font-mono-data text-muted-foreground">{pct}%</span>
                  </div>
                  <p className="text-[10px] font-mono-data text-muted-foreground mt-0.5">
                    {formatCurrencyCompact(waarde)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== SECTIE 3 — ACTION CENTER + ACTIVE DEALS ============== */}
      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4 lg:gap-6">
        <ActionCenter
          verlopen={taakVerlopen}
          vandaag={taakVandaag}
          dezeWeek={taakDezeWeek}
          wacht={taakWacht}
        />

        <section className="section-card flex flex-col">
          <header className="section-header">
            <div className="min-w-0">
              <h2 className="section-title">Actieve deals</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {topDeals.length} van {actieveDeals.length} — meest gevorderd
              </p>
            </div>
            <Link to="/deals" className="section-link inline-flex items-center gap-1">
              Alle deals <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="divide-y divide-border/60">
            {topDeals.map(deal => {
              const relatie = store.getRelatieById(deal.relatieId);
              const object  = store.getObjectById(deal.objectId);
              return (
                <Link
                  key={deal.id}
                  to={`/deals/${deal.id}`}
                  className="row-hover block px-5 py-3.5 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[14px] font-semibold text-foreground truncate tracking-tight">
                          {object?.titel ?? '—'}
                        </p>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                      </div>
                      <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                        {relatie ? getRelatieNaamCompact(relatie, store.contactpersonen) : '—'}
                        {object?.plaats ? <span className="text-muted-foreground/60"> · {object.plaats}</span> : null}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {object?.vraagprijs != null && (
                          <span className="text-[11px] font-mono-data text-muted-foreground">
                            {formatCurrencyCompact(object.vraagprijs)}
                          </span>
                        )}
                        {deal.commissieBedrag != null && (
                          <span className="text-[11px] font-mono-data font-semibold text-accent bg-accent/8 ring-1 ring-accent/15 px-1.5 py-0.5 rounded-md">
                            fee {formatCurrencyCompact(deal.commissieBedrag)}
                          </span>
                        )}
                      </div>
                    </div>
                    <DealFaseBadge fase={deal.fase} />
                  </div>
                </Link>
              );
            })}
            {topDeals.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">Geen actieve deals.</p>
            )}
          </div>
        </section>
      </div>


      {/* ============== SECTIE 4 — MATCHES + DEALFLOW HEALTH ============== */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <section className="section-card flex flex-col">
          <header className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Nieuwe kansen
            </h2>
            <Link to="/objecten" className="section-link inline-flex items-center gap-1">
              Alle matches <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="divide-y divide-border/70">
            {matches.slice(0, 6).map((m, i) => {
              const relatie = store.getRelatieById(m.relatieId);
              const object  = store.getObjectById(m.objectId);
              return (
                <Link
                  key={i}
                  to={`/objecten/${m.objectId}`}
                  className="block px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="row-with-action">
                    <div className="row-flex">
                      <p className="text-sm text-foreground truncate">{object?.titel ?? '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        → {relatie ? getRelatieNaamCompact(relatie, store.contactpersonen) : '—'}
                      </p>
                    </div>
                    <div className="row-action">
                      <MatchScoreBadge score={m.score} />
                    </div>
                  </div>
                </Link>
              );
            })}
            {matches.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">Nog geen matches.</p>
            )}
          </div>
        </section>

        <section className="section-card flex flex-col">
          <header className="section-header">
            <h2 className="section-title">Dealflow health</h2>
            <Link to="/rapportage" className="section-link inline-flex items-center gap-1">
              Rapportage <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-4">
            <MiniStat label="Warme leads" value={warmeRelaties.length} hint="Warm + actief" />
            <MiniStat label="Actieve objecten" value={actieveObjecten.length} />
            <MiniStat label="Beschikbare objecten" value={beschikbareObjecten} />
            <MiniStat
              label="Zonder kandidaten"
              value={objectenZonderKandidaten}
              tone={objectenZonderKandidaten > 0 ? 'warning' : 'normal'}
            />
            <MiniStat
              label="Stagnatie > 7d"
              value={dealsZonderActiviteit}
              tone={dealsZonderActiviteit > 0 ? 'warning' : 'normal'}
              hint="Deals zonder follow-up"
            />
            <MiniStat label="Sterke matches" value={sterkeMatches.length} hint="Score ≥ 70" />
          </div>
          <div className="px-5 pb-5 pt-1 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Warme relaties</p>
            <div className="space-y-1.5">
              {warmeRelaties.slice(0, 3).map(rel => (
                <Link
                  key={rel.id}
                  to={`/relaties/${rel.id}`}
                  className="flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm text-foreground truncate min-w-0">
                    {getRelatieNaamCompact(rel, store.contactpersonen)}
                  </p>
                  <LeadStatusBadge status={rel.leadStatus} />
                </Link>
              ))}
              {warmeRelaties.length === 0 && (
                <p className="text-xs text-muted-foreground">Geen warme leads.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ============== SECTIE 5 — REVENUE & FORECASTING ============== */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 lg:gap-6">
        <CommissieWidget />
        <ForecastWidget forecast={forecast} deals={deals} />
      </div>

      {/* Acquisitie compact strip */}
      <AcquisitieDashboardSectie />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action Center                                                       */
/* ------------------------------------------------------------------ */

type Bucket = 'verlopen' | 'vandaag' | 'week' | 'wacht';

function ActionCenter({
  verlopen, vandaag, dezeWeek, wacht,
}: {
  verlopen: ReturnType<typeof sorteerTaken>;
  vandaag: ReturnType<typeof sorteerTaken>;
  dezeWeek: ReturnType<typeof sorteerTaken>;
  wacht: ReturnType<typeof sorteerTaken>;
}) {
  const store = useDataStore();
  const nu = new Date();

  const initial: Bucket =
    verlopen.length > 0 ? 'verlopen' :
    vandaag.length > 0 ? 'vandaag' :
    dezeWeek.length > 0 ? 'week' : 'wacht';

  const [bucket, setBucket] = useState<Bucket>(initial);

  const tabs: { key: Bucket; label: string; count: number; tone: string }[] = [
    { key: 'verlopen', label: 'Verlopen',  count: verlopen.length, tone: 'text-destructive' },
    { key: 'vandaag',  label: 'Vandaag',   count: vandaag.length,  tone: 'text-foreground' },
    { key: 'week',     label: 'Deze week', count: dezeWeek.length, tone: 'text-foreground' },
    { key: 'wacht',    label: 'Wacht',     count: wacht.length,    tone: 'text-foreground' },
  ];

  const items =
    bucket === 'verlopen' ? verlopen :
    bucket === 'vandaag'  ? vandaag  :
    bucket === 'week'     ? dezeWeek : wacht;

  const isUrgent = bucket === 'verlopen';

  return (
    <section className={`section-card flex flex-col ${isUrgent && verlopen.length > 0 ? 'border-destructive/40' : ''}`}>
      <header className="section-header">
        <h2 className="section-title flex items-center gap-2">
          {isUrgent && verlopen.length > 0 ? (
            <Clock className="h-4 w-4 text-destructive" />
          ) : (
            <CheckSquare className="h-4 w-4 text-accent" />
          )}
          Action center
        </h2>
        <Link to="/taken" className="section-link inline-flex items-center gap-1">
          Alle taken <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="px-5 pt-3 pb-2 flex items-center gap-1 border-b border-border/60 overflow-x-auto">
        {tabs.map(t => {
          const active = t.key === bucket;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setBucket(t.key)}
              className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors whitespace-nowrap ${
                active
                  ? 'bg-foreground text-background'
                  : `hover:bg-muted/60 ${t.tone}`
              }`}
            >
              {t.label}
              <span className={`font-mono-data text-[10px] px-1.5 py-0.5 rounded-full ${
                active ? 'bg-background/15' : 'bg-muted/80 text-muted-foreground'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-border/70 max-h-[420px] overflow-y-auto">
        {items.slice(0, 8).map(taak => {
          const relatie = taak.relatieId ? store.getRelatieById(taak.relatieId) : null;
          const subKlasse = bucket === 'verlopen' ? 'text-destructive' : 'text-muted-foreground';
          return (
            <Link
              key={taak.id}
              to="/taken"
              className="block px-5 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="row-with-action">
                <div className="row-flex">
                  <p className="text-sm text-foreground truncate">{taak.titel}</p>
                  <p className={`text-xs mt-0.5 truncate ${subKlasse}`}>
                    {relatie ? `${getRelatieNaamCompact(relatie, store.contactpersonen)} · ` : ''}
                    {deadlineLabel(taak, nu)}
                    {bucket === 'verlopen' ? ' · te laat' : ''}
                  </p>
                </div>
                <div className="row-action">
                  <PrioriteitBadge prioriteit={taak.prioriteit} />
                </div>
              </div>
            </Link>
          );
        })}
        {items.length === 0 && (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            Geen acties in deze categorie.
          </p>
        )}
        {items.length > 8 && (
          <p className="px-5 py-2 text-[11px] text-muted-foreground">+ {items.length - 8} meer…</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Forecast widget — 30/60/90                                          */
/* ------------------------------------------------------------------ */

function ForecastWidget({
  forecast,
  deals,
}: {
  forecast: { days: number; bedrag: number; count: number }[];
  deals: ReturnType<typeof useDataStore>['deals'];
}) {
  // Maandbalkjes — laatste 6 maanden gerealiseerd
  const maanden = useMemo(() => {
    const arr: { label: string; bedrag: number; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const eind = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const bucket = deals.filter(deal => {
        if (!isDealGerealiseerd(deal)) return false;
        const dt = getDealRealisatieDatum(deal);
        if (!dt) return false;
        const t = new Date(dt).getTime();
        return t >= d.getTime() && t < eind.getTime();
      });
      arr.push({
        label: d.toLocaleDateString('nl-NL', { month: 'short' }),
        bedrag: bucket.reduce((s, x) => s + (x.commissieBedrag ?? 0), 0),
        count: bucket.length,
      });
    }
    return arr;
  }, [deals]);
  const maxMaand = Math.max(1, ...maanden.map(m => m.bedrag));
  const maxForecast = Math.max(1, ...forecast.map(b => b.bedrag));

  return (
    <section className="section-card flex flex-col">
      <header className="section-header">
        <h2 className="section-title flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          Fee forecast
        </h2>
      </header>

      <div className="p-5 space-y-5">
        {/* 30/60/90 */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Verwachte fee (gewogen)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {forecast.map(b => (
              <div key={b.days} className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  ≤ {b.days} dagen
                </p>
                <p className="text-lg font-semibold font-mono-data text-foreground leading-tight">
                  {formatCurrencyCompact(b.bedrag)}
                </p>
                <p className="text-[10px] text-muted-foreground">{b.count} deal{b.count === 1 ? '' : 's'}</p>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(4, (b.bedrag / maxForecast) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maand-bars */}
        <div className="pt-4 border-t border-border/60">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Gerealiseerde fee · laatste 6 maanden
          </p>
          <div className="flex items-end gap-2 h-24">
            {maanden.map(m => {
              const pct = (m.bedrag / maxMaand) * 100;
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-accent/80 to-accent/40 rounded-sm transition-all duration-700"
                      style={{ height: `${Math.max(4, pct)}%` }}
                      title={`${m.label}: ${formatCurrency(m.bedrag)}`}
                    />
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate w-full text-center">
                    {m.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Acquisitie strip                                                    */
/* ------------------------------------------------------------------ */

function AcquisitieDashboardSectie() {
  const { targets, campagnes } = useAcquisitie();
  const nu = new Date();
  const startMaand = new Date(nu.getFullYear(), nu.getMonth(), 1);

  const actief   = targets.filter(targetIsActief);
  const verlopen = actief.filter(t => datumVerlopen(t.volgendeActieDatum));
  const reactiesMaand = targets.filter(t => t.status === 'reactie_ontvangen' && new Date(t.updatedAt) >= startMaand);
  const warm     = targets.filter(t => t.status === 'verkoopbereidheid_peilen' || t.status === 'potentiele_verkooppositie');
  const objectenUit = targets.filter(t => t.status === 'object_aangemaakt');

  const reactiesPerCampagne = new Map<string, number>();
  targets.filter(t => t.status === 'reactie_ontvangen' && t.campagneId).forEach(t => {
    reactiesPerCampagne.set(t.campagneId!, (reactiesPerCampagne.get(t.campagneId!) ?? 0) + 1);
  });
  let besteCampagne: { naam: string; aantal: number } | null = null;
  for (const [cid, n] of reactiesPerCampagne) {
    if (!besteCampagne || n > besteCampagne.aantal) {
      const c = campagnes.find(x => x.id === cid);
      if (c) besteCampagne = { naam: c.naam, aantal: n };
    }
  }

  return (
    <section className="section-card">
      <header className="section-header">
        <h2 className="section-title flex items-center gap-2">
          <Flame className="h-4 w-4 text-accent" />
          Acquisitie
        </h2>
        <Link to="/acquisitie" className="section-link inline-flex items-center gap-1">
          Naar acquisitie <ArrowRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
        <MiniStat label="Actieve targets" value={actief.length} />
        <MiniStat label="Verlopen acties" value={verlopen.length} tone={verlopen.length > 0 ? 'destructive' : 'normal'} />
        <MiniStat label="Reacties / mnd" value={reactiesMaand.length} />
        <MiniStat label="Warme leads" value={warm.length} />
        <MiniStat label="Objecten uit acq." value={objectenUit.length} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Beste campagne</p>
          <p className="text-sm font-medium text-foreground truncate mt-1">{besteCampagne?.naam ?? '—'}</p>
          {besteCampagne && <p className="text-[11px] text-muted-foreground">{besteCampagne.aantal} reacties</p>}
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  label, value, tone = 'normal', hint,
}: {
  label: string;
  value: number | string;
  tone?: 'normal' | 'warning' | 'destructive';
  hint?: string;
}) {
  const cls =
    tone === 'destructive' ? 'text-destructive' :
    tone === 'warning'     ? 'text-warning'     : 'text-foreground';
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold font-mono-data mt-1 leading-none ${cls}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1 truncate">{hint}</p>}
    </div>
  );
}
