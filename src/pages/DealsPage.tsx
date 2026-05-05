import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatDate } from '@/data/mock-data';
import { DealFaseBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronRight, Star, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { DealFase } from '@/data/mock-data';
import DealFormDialog from '@/components/forms/DealFormDialog';
import PageHeader from '@/components/PageHeader';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';

type ArchiefView = 'actief' | 'archief' | 'alles';

const faseOptions: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing', 'afgerond', 'afgevallen'];

function Sterren({ aantal }: { aantal: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < aantal ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

export default function DealsPage() {
  const { deals, getRelatieById, getObjectById, contactpersonen, unarchiveDeal } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [faseFilter, setFaseFilter] = useState<DealFase | ''>('');
  const [archiefView, setArchiefView] = useState<ArchiefView>('actief');
  const [formOpen, setFormOpen] = useState(false);

  const aantalArchief = deals.filter(d => d.isArchived).length;
  const aantalActief = deals.length - aantalArchief;

  const filtered = deals.filter(d => {
    if (archiefView === 'actief' && d.isArchived) return false;
    if (archiefView === 'archief' && !d.isArchived) return false;
    const obj = getObjectById(d.objectId);
    const rel = getRelatieById(d.relatieId);
    const matchZoek = !zoek || obj?.titel.toLowerCase().includes(zoek.toLowerCase()) || (rel?.bedrijfsnaam ?? '').toLowerCase().includes(zoek.toLowerCase()) || getRelatieNaamCompact(rel, contactpersonen).toLowerCase().includes(zoek.toLowerCase());
    const matchFase = !faseFilter || d.fase === faseFilter;
    return matchZoek && matchFase;
  });

  const handleHerstel = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await unarchiveDeal(id);
      toast.success('Deal teruggezet naar Actief');
    } catch (err: any) {
      toast.error(`Herstellen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const tabs: { key: ArchiefView; label: string; count: number }[] = [
    { key: 'actief', label: 'Actief', count: aantalActief },
    { key: 'archief', label: 'Archief', count: aantalArchief },
    { key: 'alles', label: 'Alles', count: deals.length },
  ];
  const isArchiefView = archiefView === 'archief';

  return (
    <div className="page-shell">
      <PageHeader
        title="Deals"
        subtitle={`${aantalActief} actief · ${aantalArchief} gearchiveerd`}
        actions={
          <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Nieuwe deal
          </button>
        }
      />

      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setArchiefView(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              archiefView === t.key
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label} <span className="text-xs text-muted-foreground">({t.count})</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op object of relatie..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={faseFilter} onChange={e => setFaseFilter(e.target.value as DealFase | '')}>
          <option value="">Alle fases</option>
          {faseOptions.map(f => <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Geen deals gevonden.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(deal => {
              const obj = getObjectById(deal.objectId);
              const rel = getRelatieById(deal.relatieId);
              return (
                <Link key={deal.id} to={`/deals/${deal.id}`} className="section-card block p-4 active:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{obj?.titel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{getRelatieNaamCompact(rel, contactpersonen)} · {obj?.plaats}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-mono-data text-foreground">{formatCurrency(obj?.vraagprijs)}</span>
                        <Sterren aantal={deal.interessegraad} />
                      </div>
                      {deal.isArchived && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Archive className="h-3 w-3" /> {deal.archivedReason ?? 'Gearchiveerd'}
                            {deal.archivedAt && <span>· {formatDate(deal.archivedAt)}</span>}
                          </span>
                          <button onClick={(e) => handleHerstel(deal.id, e)} className="inline-flex items-center gap-1 text-accent hover:underline">
                            <RotateCcw className="h-3 w-3" /> Terugzetten
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DealFaseBadge fase={deal.fase} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block section-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 field-label">Object</th>
                    <th className="text-left px-5 py-3 field-label">Relatie</th>
                    <th className="text-right px-5 py-3 field-label hidden lg:table-cell">Waarde</th>
                    <th className="text-center px-5 py-3 field-label hidden lg:table-cell">Interesse</th>
                    <th className="text-left px-5 py-3 field-label">Fase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filtered.map(deal => {
                    const obj = getObjectById(deal.objectId);
                    const rel = getRelatieById(deal.relatieId);
                    return (
                      <tr key={deal.id} className="group hover:bg-muted/40 transition-colors cursor-pointer">
                        <td className="px-5 py-3.5">
                          <Link to={`/deals/${deal.id}`} className="block">
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{obj?.titel}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{obj?.plaats}</p>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-foreground truncate max-w-[200px]">{getRelatieNaamCompact(rel, contactpersonen)}</td>
                        <td className="px-5 py-3.5 text-right hidden lg:table-cell font-mono-data text-foreground">{formatCurrency(obj?.vraagprijs)}</td>
                        <td className="px-5 py-3.5 text-center hidden lg:table-cell">
                          <Sterren aantal={deal.interessegraad} />
                        </td>
                        <td className="px-5 py-3.5"><DealFaseBadge fase={deal.fase} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <DealFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
