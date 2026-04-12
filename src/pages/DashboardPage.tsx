import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatDate, getAllMatches } from '@/data/mock-data';
import { LeadStatusBadge, DealFaseBadge, ObjectStatusBadge, PrioriteitBadge, MatchScoreBadge } from '@/components/StatusBadges';
import { Users, Handshake, CheckSquare, TrendingUp, Zap, Building2 } from 'lucide-react';

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

export default function DashboardPage() {
  const store = useDataStore();
  const { relaties, objecten, deals, taken } = store;

  const warmeRelaties = relaties.filter(r => r.leadStatus === 'warm' || r.leadStatus === 'actief');
  const actieveObjecten = objecten.filter(o => o.status === 'off-market' || o.status === 'in_onderzoek');
  const openTaken = taken.filter(t => t.status !== 'afgerond');
  const actieveDeals = deals.filter(d => !['afgerond', 'afgevallen'].includes(d.fase));
  const matches = getAllMatches();

  const dealWaarde = actieveDeals.reduce((sum, d) => {
    const obj = store.getObjectById(d.objectId);
    return sum + (obj?.vraagprijs || 0);
  }, 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Goedemorgen. Er zijn {matches.length} actieve matches en {openTaken.length} open taken.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Actieve deals" value={formatCurrency(dealWaarde)} icon={TrendingUp} accent />
        <KPICard label="Nieuwe matches" value={matches.length} icon={Zap} accent />
        <KPICard label="Open taken" value={openTaken.length} icon={CheckSquare} />
        <KPICard label="Warme relaties" value={warmeRelaties.length} icon={Users} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Focuslijst — deze week</h2>
            <Link to="/taken" className="text-xs text-accent hover:underline">Alle taken →</Link>
          </div>
          <div className="divide-y divide-border">
            {openTaken.slice(0, 5).map(taak => {
              const relatie = taak.relatieId ? store.getRelatieById(taak.relatieId) : null;
              return (
                <div key={taak.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{taak.titel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {relatie?.bedrijfsnaam} · {formatDate(taak.deadline)}
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
            <h2 className="text-sm font-semibold text-foreground">Lopende deals</h2>
            <Link to="/deals" className="text-xs text-accent hover:underline">Alle deals →</Link>
          </div>
          <div className="divide-y divide-border">
            {actieveDeals.map(deal => {
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
            <h2 className="text-sm font-semibold text-foreground">Recente matches</h2>
          </div>
          <div className="divide-y divide-border">
            {matches.slice(0, 5).map((match, i) => {
              const relatie = store.getRelatieById(match.relatieId);
              const object = store.getObjectById(match.objectId);
              return (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{object?.titel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">→ {relatie?.bedrijfsnaam}</p>
                  </div>
                  <MatchScoreBadge score={match.score} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Actieve objecten</h2>
            <Link to="/objecten" className="text-xs text-accent hover:underline">Alle objecten →</Link>
          </div>
          <div className="divide-y divide-border">
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
