import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatDate, getAllMatchesFromData } from '@/data/mock-data';
import type { DealFase } from '@/data/mock-data';
import { LeadStatusBadge, DealFaseBadge, ObjectStatusBadge, PrioriteitBadge, MatchScoreBadge } from '@/components/StatusBadges';
import { CheckSquare, TrendingUp, Zap, Flame } from 'lucide-react';

function KPICard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? 'text-accent' : 'text-muted-foreground'}`} />
      </div>
      <p className="text-2xl font-semibold text-foreground font-mono-data">{value}</p>
    </div>
  );
}

const pipelineFases: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing'];

export default function DashboardPage() {
  const store = useDataStore();
  const { relaties, objecten, deals, taken } = store;

  const warmeRelaties = relaties.filter(r => r.leadStatus === 'warm' || r.leadStatus === 'actief');
  const actieveObjecten = objecten.filter(o => o.status === 'off-market' || o.status === 'in_onderzoek');
  const openTaken = taken.filter(t => t.status !== 'afgerond');
  const actieveDeals = deals.filter(d => !['afgerond', 'afgevallen'].includes(d.fase));
  const matches = getAllMatchesFromData(store.zoekprofielen, store.objecten);

  const dealWaarde = actieveDeals.reduce((sum, d) => {
    const obj = store.getObjectById(d.objectId);
    return sum + (obj?.vraagprijs || 0);
  }, 0);

  // Deals per fase
  const dealsPerFase = pipelineFases.map(fase => ({
    fase,
    aantal: deals.filter(d => d.fase === fase).length,
  }));
  const maxAantal = Math.max(1, ...dealsPerFase.map(f => f.aantal));

  // Open opvolging: taken met deadline binnen 7 dagen of overdue
  const vandaag = new Date();
  const overEenWeek = new Date(); overEenWeek.setDate(vandaag.getDate() + 7);
  const opvolging = openTaken
    .filter(t => t.deadline && new Date(t.deadline) <= overEenWeek)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {matches.length} actieve matches · {opvolging.length} taken vereisen opvolging deze week
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Actieve dealwaarde" value={formatCurrency(dealWaarde)} icon={TrendingUp} accent />
        <KPICard label="Nieuwe matches" value={matches.length} icon={Zap} accent />
        <KPICard label="Open taken" value={openTaken.length} icon={CheckSquare} />
        <KPICard label="Warme leads" value={warmeRelaties.length} icon={Flame} />
      </div>

      {/* Dealflow funnel */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Deals per fase</h2>
          <Link to="/deals" className="text-xs text-accent hover:underline">Alle deals →</Link>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {dealsPerFase.map(({ fase, aantal }) => (
            <div key={fase} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground capitalize">{fase}</span>
                <span className="text-lg font-semibold text-foreground font-mono-data">{aantal}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${(aantal / maxAantal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Open opvolging — komende 7 dagen</h2>
            <Link to="/taken" className="text-xs text-accent hover:underline">Alle taken →</Link>
          </div>
          <div className="divide-y divide-border">
            {opvolging.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Geen taken vereisen opvolging deze week.</p>
            )}
            {opvolging.slice(0, 6).map(taak => {
              const relatie = taak.relatieId ? store.getRelatieById(taak.relatieId) : null;
              const isOverdue = new Date(taak.deadline) < vandaag;
              return (
                <div key={taak.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{taak.titel}</p>
                    <p className={`text-xs mt-0.5 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {relatie?.bedrijfsnaam ? `${relatie.bedrijfsnaam} · ` : ''}{formatDate(taak.deadline)}{isOverdue ? ' (te laat)' : ''}
                    </p>
                  </div>
                  <PrioriteitBadge prioriteit={taak.prioriteit} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Warme leads</h2>
            <Link to="/relaties" className="text-xs text-accent hover:underline">Alle relaties →</Link>
          </div>
          <div className="divide-y divide-border">
            {warmeRelaties.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Geen warme of actieve leads.</p>
            )}
            {warmeRelaties.slice(0, 6).map(rel => (
              <Link key={rel.id} to={`/relaties/${rel.id}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{rel.bedrijfsnaam}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {rel.contactpersoon} · {rel.volgendeActie || 'Geen actie gepland'}
                    </p>
                  </div>
                  <LeadStatusBadge status={rel.leadStatus} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Lopende deals</h2>
            <Link to="/deals" className="text-xs text-accent hover:underline">Alle deals →</Link>
          </div>
          <div className="divide-y divide-border">
            {actieveDeals.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Geen lopende deals.</p>
            )}
            {actieveDeals.slice(0, 5).map(deal => {
              const relatie = store.getRelatieById(deal.relatieId);
              const object = store.getObjectById(deal.objectId);
              return (
                <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{object?.titel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {relatie?.bedrijfsnaam} · {object?.vraagprijs ? formatCurrency(object.vraagprijs) : '—'}
                      </p>
                    </div>
                    <DealFaseBadge fase={deal.fase} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Nieuwe matches</h2>
          </div>
          <div className="divide-y divide-border">
            {matches.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nog geen matches. Voeg objecten en zoekprofielen toe.</p>
            )}
            {matches.slice(0, 5).map((match, i) => {
              const relatie = store.getRelatieById(match.relatieId);
              const object = store.getObjectById(match.objectId);
              return (
                <Link key={i} to={`/objecten/${match.objectId}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{object?.titel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">→ {relatie?.bedrijfsnaam}</p>
                    </div>
                    <MatchScoreBadge score={match.score} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg lg:col-span-2">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Actieve objecten</h2>
            <Link to="/objecten" className="text-xs text-accent hover:underline">Alle objecten →</Link>
          </div>
          <div className="divide-y divide-border">
            {actieveObjecten.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Geen actieve objecten.</p>
            )}
            {actieveObjecten.slice(0, 5).map(obj => (
              <Link key={obj.id} to={`/objecten/${obj.id}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{obj.titel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {obj.plaats} · <span className="font-mono-data">{formatCurrency(obj.vraagprijs)}</span>
                    </p>
                  </div>
                  <ObjectStatusBadge status={obj.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
