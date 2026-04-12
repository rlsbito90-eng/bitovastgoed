import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency } from '@/data/mock-data';
import { DealFaseBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import type { DealFase } from '@/data/mock-data';
import DealFormDialog from '@/components/forms/DealFormDialog';

const faseOptions: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing', 'afgerond', 'afgevallen'];

export default function DealsPage() {
  const { deals, getRelatieById, getObjectById } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [faseFilter, setFaseFilter] = useState<DealFase | ''>('');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = deals.filter(d => {
    const obj = getObjectById(d.objectId);
    const rel = getRelatieById(d.relatieId);
    const matchZoek = !zoek || obj?.titel.toLowerCase().includes(zoek.toLowerCase()) || rel?.bedrijfsnaam.toLowerCase().includes(zoek.toLowerCase());
    const matchFase = !faseFilter || d.fase === faseFilter;
    return matchZoek && matchFase;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">{deals.length} deals in de pipeline</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
          <Plus className="h-4 w-4" /> Nieuwe deal
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op object of relatie..." className="pl-9" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={faseFilter} onChange={e => setFaseFilter(e.target.value as DealFase | '')}>
          <option value="">Alle fases</option>
          {faseOptions.map(f => <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Object</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Relatie</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Waarde</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Interesse</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(deal => {
                const obj = getObjectById(deal.objectId);
                const rel = getRelatieById(deal.relatieId);
                return (
                  <tr key={deal.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3">
                      <Link to={`/deals/${deal.id}`} className="block">
                        <p className="font-medium text-foreground">{obj?.titel}</p>
                        <p className="text-xs text-muted-foreground">{obj?.plaats}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-foreground">{rel?.bedrijfsnaam}</td>
                    <td className="px-5 py-3 text-right hidden lg:table-cell font-mono-data text-foreground">{formatCurrency(obj?.vraagprijs)}</td>
                    <td className="px-5 py-3 text-center hidden lg:table-cell">
                      <span className="text-foreground">{'★'.repeat(deal.interessegraad)}{'☆'.repeat(5 - deal.interessegraad)}</span>
                    </td>
                    <td className="px-5 py-3"><DealFaseBadge fase={deal.fase} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DealFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
