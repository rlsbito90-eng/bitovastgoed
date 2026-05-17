import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatCurrencyCompact, formatDate, getAllMatchesFromData } from '@/data/mock-data';
import type { DealFase } from '@/data/mock-data';
import { LeadStatusBadge, DealFaseBadge, ObjectStatusBadge, PrioriteitBadge, MatchScoreBadge } from '@/components/StatusBadges';
import PageHeader from '@/components/PageHeader';
import { CheckSquare, TrendingUp, Zap, Flame, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import CommissieWidget from '@/components/dashboard/CommissieWidget';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import GeenActieBadge, { isVerlopen as datumVerlopen } from '@/components/GeenActieBadge';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { targetIsActief } from '@/lib/acquisitie';

function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative section-card overflow-hidden p-5 flex flex-col gap-3 min-w-0 ${
        highlight ? 'accent-rule' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight break-words min-w-0">
          {label}
        </span>
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${highlight ? 'text-accent' : 'text-muted-foreground/70'}`} />
      </div>
      <p className="text-xl sm:text-2xl lg:text-[28px] font-semibold text-foreground font-mono-data leading-none break-words min-w-0">
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground break-words sm:truncate">{hint}</p>}
    </div>
  );
}

const pipelineFases: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing'];

export default function DashboardPage() {
  const store = useDataStore();
  const { relaties, objecten, deals, taken, pipelineKandidaten } = store;

  const warmeRelaties = relaties.filter(r => r.leadStatus === 'warm' || r.leadStatus === 'actief');
  const actieveObjecten = objecten.filter(o => !o.isArchived);
  const openTaken = taken.filter(t => t.status !== 'afgerond');
  const actieveDeals = deals.filter(d => !d.isArchived && !['afgerond', 'afgevallen'].includes(d.fase));
  const matches = getAllMatchesFromData(store.zoekprofielen, store.objecten);

  const dealWaarde = actieveDeals.reduce((sum, d) => {
    const obj = store.getObjectById(d.objectId);
    return sum + (obj?.vraagprijs || 0);
  }, 0);

  const dealsPerFase = pipelineFases.map(fase => ({
    fase,
    aantal: deals.filter(d => !d.isArchived && d.fase === fase).length,
  }));
  const maxAantal = Math.max(1, ...dealsPerFase.map(f => f.aantal));

  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const overEenWeek = new Date(); overEenWeek.setDate(vandaag.getDate() + 7);
  const opvolging = openTaken
    .filter(t => t.deadline && new Date(t.deadline) <= overEenWeek && new Date(t.deadline) >= vandaag)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const verlopen = openTaken
    .filter(t => t.deadline && new Date(t.deadline) < vandaag)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const dealsZonderActie = actieveDeals.filter(d => !d.datumFollowUp);
  const kandidatenZonderActie = pipelineKandidaten.filter(k => {
    const obj = store.getObjectById(k.objectId);
    if (!obj || obj.isArchived) return false;
    return !k.volgendeActie && !k.volgendeActieDatum;
  });
  const totaalZonderActie = dealsZonderActie.length + kandidatenZonderActie.length;

  return (
    <div className="page-shell-wide">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            {matches.length} actieve matches · {opvolging.length} taken deze week
            {verlopen.length > 0 && <span className="text-destructive"> · {verlopen.length} verlopen</span>}
          </>
        }
      />


      {/* KPI rij — op mobiel compacte bedragen, op desktop volledig */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard
          label="Actieve dealwaarde"
          value={
            <>
              <span className="sm:hidden">{formatCurrencyCompact(dealWaarde)}</span>
              <span className="hidden sm:inline">{formatCurrency(dealWaarde)}</span>
            </>
          }
          hint={`${actieveDeals.length} lopende deals`}
          icon={TrendingUp}
          highlight
        />
        <KPICard label="Nieuwe matches" value={matches.length} hint="Op basis van zoekprofielen" icon={Zap} highlight />
        <KPICard label="Open taken" value={openTaken.length} hint={`${opvolging.length} deze week`} icon={CheckSquare} />
        <KPICard label="Warme leads" value={warmeRelaties.length} hint="Warm + actief" icon={Flame} />
      </div>

      {/* Commissie & successen */}
      <CommissieWidget />

      {/* Pipeline funnel */}
      <section className="section-card">
        <header className="section-header">
          <h2 className="section-title">Deals per fase</h2>
          <Link to="/deals" className="section-link inline-flex items-center gap-1">
            Alle deals <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-5">
          {dealsPerFase.map(({ fase, aantal }) => (
            <div key={fase} className="space-y-2 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider capitalize truncate">{fase}</span>
                <span className="text-base font-semibold text-foreground font-mono-data">{aantal}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(aantal / maxAantal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Twee belangrijke focus-lijsten */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <FocusList
          title="Open opvolging — komende 7 dagen"
          link={{ to: '/taken', label: 'Alle taken' }}
          empty="Geen taken vereisen opvolging deze week."
        >
          {opvolging.slice(0, 6).map(taak => {
            const relatie = taak.relatieId ? store.getRelatieById(taak.relatieId) : null;
            const isOverdue = new Date(taak.deadline) < vandaag;
            return (
              <Link key={taak.id} to="/taken" className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="row-with-action">
                  <div className="row-flex">
                    <p className="text-sm text-foreground truncate">{taak.titel}</p>
                    <p className={`text-xs mt-0.5 truncate ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {relatie ? `${getRelatieNaamCompact(relatie, store.contactpersonen)} · ` : ''}{formatDate(taak.deadline)}{isOverdue ? ' · te laat' : ''}
                    </p>
                  </div>
                  <div className="row-action">
                    <PrioriteitBadge prioriteit={taak.prioriteit} />
                  </div>
                </div>
              </Link>
            );
          })}
          {opvolging.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Geen taken vereisen opvolging deze week.</p>}
        </FocusList>

        {verlopen.length > 0 && (
          <section className="section-card border-destructive/40 bg-destructive/5">
            <header className="section-header">
              <h2 className="section-title flex items-center gap-2 text-destructive">
                <Clock className="h-4 w-4" /> Verlopen acties ({verlopen.length})
              </h2>
              <Link to="/taken" className="section-link inline-flex items-center gap-1">
                Alle taken <ArrowRight className="h-3 w-3" />
              </Link>
            </header>
            <div className="divide-y divide-border/70">
              {verlopen.slice(0, 5).map(t => {
                const rel = t.relatieId ? store.getRelatieById(t.relatieId) : null;
                return (
                  <Link key={t.id} to="/taken" className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="row-with-action">
                      <div className="row-flex">
                        <p className="text-sm text-foreground truncate">{t.titel}</p>
                        <p className="text-xs text-destructive mt-0.5 truncate">
                          {rel ? `${getRelatieNaamCompact(rel, store.contactpersonen)} · ` : ''}{formatDate(t.deadline)} · te laat
                        </p>
                      </div>
                      <div className="row-action">
                        <PrioriteitBadge prioriteit={t.prioriteit} />
                      </div>
                    </div>
                  </Link>
                );
              })}
              {verlopen.length > 5 && (
                <p className="px-5 py-2 text-xs text-muted-foreground">+ {verlopen.length - 5} meer…</p>
              )}
            </div>
          </section>
        )}

        {totaalZonderActie > 0 && (
          <section className="section-card border-warning/40">
            <header className="section-header">
              <h2 className="section-title flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" /> Zonder volgende actie ({totaalZonderActie})
              </h2>
            </header>
            <div className="divide-y divide-border/70">
              {dealsZonderActie.slice(0, 4).map(d => {
                const obj = store.getObjectById(d.objectId);
                const rel = store.getRelatieById(d.relatieId);
                return (
                  <Link key={d.id} to={`/deals/${d.id}`} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="row-with-action">
                      <div className="row-flex">
                        <p className="text-sm text-foreground truncate">{obj?.titel ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Deal · {rel ? getRelatieNaamCompact(rel, store.contactpersonen) : '—'}
                        </p>
                      </div>
                      <div className="row-action"><GeenActieBadge /></div>
                    </div>
                  </Link>
                );
              })}
              {kandidatenZonderActie.slice(0, 4).map(k => {
                const obj = store.getObjectById(k.objectId);
                const rel = store.getRelatieById(k.relatieId);
                return (
                  <Link key={k.id} to={`/objecten/${k.objectId}`} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="row-with-action">
                      <div className="row-flex">
                        <p className="text-sm text-foreground truncate">{obj?.titel ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Kandidaat · {rel ? getRelatieNaamCompact(rel, store.contactpersonen) : '—'}
                        </p>
                      </div>
                      <div className="row-action"><GeenActieBadge /></div>
                    </div>
                  </Link>
                );
              })}
              {totaalZonderActie > 8 && (
                <p className="px-5 py-2 text-xs text-muted-foreground">+ {totaalZonderActie - 8} meer…</p>
              )}
            </div>
          </section>
        )}

        <FocusList
          title="Warme leads"
          link={{ to: '/relaties', label: 'Alle relaties' }}
          empty="Geen warme of actieve leads."
        >
          {warmeRelaties.slice(0, 6).map(rel => {
            const namen = getRelatieNaamCompact(rel, store.contactpersonen);
            return (
              <Link key={rel.id} to={`/relaties/${rel.id}`} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="row-with-action">
                  <div className="row-flex">
                    <p className="text-sm text-foreground truncate">{namen}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {rel.volgendeActie || 'Geen actie gepland'}
                    </p>
                  </div>
                  <div className="row-action">
                    <LeadStatusBadge status={rel.leadStatus} />
                  </div>
                </div>
              </Link>
            );
          })}
          {warmeRelaties.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Geen warme of actieve leads.</p>}
        </FocusList>

        <FocusList
          title="Lopende deals"
          link={{ to: '/deals', label: 'Alle deals' }}
          empty="Geen lopende deals."
        >
          {actieveDeals.slice(0, 5).map(deal => {
            const relatie = store.getRelatieById(deal.relatieId);
            const object = store.getObjectById(deal.objectId);
            return (
              <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="row-with-action">
                  <div className="row-flex">
                    <p className="text-sm text-foreground truncate">{object?.titel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {relatie ? getRelatieNaamCompact(relatie, store.contactpersonen) : '—'} · <span className="font-mono-data">{object?.vraagprijs ? formatCurrency(object.vraagprijs) : '—'}</span>
                    </p>
                  </div>
                  <div className="row-action">
                    <DealFaseBadge fase={deal.fase} />
                  </div>
                </div>
              </Link>
            );
          })}
          {actieveDeals.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Geen lopende deals.</p>}
        </FocusList>

        <FocusList
          title="Nieuwe matches"
          empty="Nog geen matches. Voeg objecten en zoekprofielen toe."
        >
          {matches.slice(0, 5).map((match, i) => {
            const relatie = store.getRelatieById(match.relatieId);
            const object = store.getObjectById(match.objectId);
            return (
              <Link key={i} to={`/objecten/${match.objectId}`} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="row-with-action">
                  <div className="row-flex">
                    <p className="text-sm text-foreground truncate">{object?.titel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">→ {relatie ? getRelatieNaamCompact(relatie, store.contactpersonen) : '—'}</p>
                  </div>
                  <div className="row-action">
                    <MatchScoreBadge score={match.score} />
                  </div>
                </div>
              </Link>
            );
          })}
          {matches.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Nog geen matches.</p>}
        </FocusList>

        <div className="lg:col-span-2">
          <FocusList
            title="Actieve objecten"
            link={{ to: '/objecten', label: 'Alle objecten' }}
            empty="Geen actieve objecten."
          >
            {actieveObjecten.slice(0, 5).map(obj => (
              <Link key={obj.id} to={`/objecten/${obj.id}`} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="row-with-action">
                  <div className="row-flex">
                    <p className="text-sm text-foreground truncate">{obj.titel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {obj.plaats} · <span className="font-mono-data">{formatCurrency(obj.vraagprijs)}</span>
                    </p>
                  </div>
                  <div className="row-action">
                    <ObjectStatusBadge status={obj.status} />
                  </div>
                </div>
              </Link>
            ))}
            {actieveObjecten.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Geen actieve objecten.</p>}
          </FocusList>
        </div>
      </div>

      <AcquisitieDashboardSectie />
    </div>
  );
}

function AcquisitieDashboardSectie() {
  const { targets, campagnes } = useAcquisitie();
  const nu = new Date();
  const startMaand = new Date(nu.getFullYear(), nu.getMonth(), 1);

  const actief = targets.filter(targetIsActief);
  const zonderActie = actief.filter(t => !t.volgendeActieDatum);
  const verlopen = actief.filter(t => datumVerlopen(t.volgendeActieDatum));
  const reactiesMaand = targets.filter(t => t.status === 'reactie_ontvangen' && new Date(t.updatedAt) >= startMaand);
  const warm = targets.filter(t => t.status === 'verkoopbereidheid_peilen' || t.status === 'potentiele_verkooppositie');
  const objectenUitAcq = targets.filter(t => t.status === 'object_aangemaakt');

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
        <h2 className="section-title">Acquisitie</h2>
        <Link to="/acquisitie" className="section-link inline-flex items-center gap-1">
          Naar acquisitie <ArrowRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <MiniStat label="Actieve targets" value={actief.length} />
        <MiniStat label="Zonder volgende actie" value={zonderActie.length} tone={zonderActie.length > 0 ? 'warning' : 'normal'} />
        <MiniStat label="Verlopen acties" value={verlopen.length} tone={verlopen.length > 0 ? 'destructive' : 'normal'} />
        <MiniStat label="Reacties deze maand" value={reactiesMaand.length} />
        <MiniStat label="Warme leads" value={warm.length} />
        <MiniStat label="Objecten uit acq." value={objectenUitAcq.length} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Beste campagne</p>
          <p className="text-sm font-medium text-foreground truncate mt-1">{besteCampagne?.naam ?? '—'}</p>
          {besteCampagne && <p className="text-xs text-muted-foreground">{besteCampagne.aantal} reacties</p>}
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone = 'normal' }: { label: string; value: number; tone?: 'normal' | 'warning' | 'destructive' }) {
  const cls = tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold font-mono-data mt-1 ${cls}`}>{value}</p>
    </div>
  );
}

function FocusList({
  title,
  link,
  empty,
  children,
}: {
  title: string;
  link?: { to: string; label: string };
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-card flex flex-col">
      <header className="section-header">
        <h2 className="section-title">{title}</h2>
        {link && (
          <Link to={link.to} className="section-link inline-flex items-center gap-1">
            {link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      <div className="divide-y divide-border/70">{children}</div>
    </section>
  );
}
