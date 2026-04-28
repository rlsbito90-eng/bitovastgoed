import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatCurrencyCompact, formatDate, getAllMatchesFromData } from '@/data/mock-data';
import type { DealFase } from '@/data/mock-data';
import { LeadStatusBadge, DealFaseBadge, ObjectStatusBadge, PrioriteitBadge, MatchScoreBadge } from '@/components/StatusBadges';
import PageHeader from '@/components/PageHeader';
import { CheckSquare, TrendingUp, Zap, Flame, ArrowRight } from 'lucide-react';
import CommissieWidget from '@/components/dashboard/CommissieWidget';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';

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
  const { relaties, objecten, deals, taken } = store;

  const warmeRelaties = relaties.filter(r => r.leadStatus === 'warm' || r.leadStatus === 'actief');
  const actieveObjecten = objecten.filter(o => o.status === 'off-market' || o.status === 'in_onderzoek' || o.status === 'beschikbaar');
  const openTaken = taken.filter(t => t.status !== 'afgerond');
  const actieveDeals = deals.filter(d => !['afgerond', 'afgevallen'].includes(d.fase));
  const matches = getAllMatchesFromData(store.zoekprofielen, store.objecten);

  const dealWaarde = actieveDeals.reduce((sum, d) => {
    const obj = store.getObjectById(d.objectId);
    return sum + (obj?.vraagprijs || 0);
  }, 0);

  const dealsPerFase = pipelineFases.map(fase => ({
    fase,
    aantal: deals.filter(d => d.fase === fase).length,
  }));
  const maxAantal = Math.max(1, ...dealsPerFase.map(f => f.aantal));

  const vandaag = new Date();
  const overEenWeek = new Date(); overEenWeek.setDate(vandaag.getDate() + 7);
  const opvolging = openTaken
    .filter(t => t.deadline && new Date(t.deadline) <= overEenWeek)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="page-shell">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            {matches.length} actieve matches · {opvolging.length} taken vereisen opvolging deze week
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
              <div key={taak.id} className="px-5 py-3 row-with-action">
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
            );
          })}
          {opvolging.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Geen taken vereisen opvolging deze week.</p>}
        </FocusList>

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
