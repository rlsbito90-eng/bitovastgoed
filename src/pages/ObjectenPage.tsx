import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency } from '@/data/mock-data';
import { ObjectStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import type { AssetClass, ObjectStatus } from '@/data/mock-data';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';

export default function ObjectenPage() {
  const { objecten } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetClass | ''>('');
  const [statusFilter, setStatusFilter] = useState<ObjectStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = objecten.filter(o => {
    const matchZoek = !zoek || o.titel.toLowerCase().includes(zoek.toLowerCase()) || o.plaats.toLowerCase().includes(zoek.toLowerCase());
    const matchType = !typeFilter || o.type === typeFilter;
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchZoek && matchType && matchStatus;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Objecten</h1>
          <p className="text-sm text-muted-foreground mt-1">{objecten.length} objecten in beheer</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
          <Plus className="h-4 w-4" /> Nieuw object
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam of plaats..." className="pl-9" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value as AssetClass | '')}>
          <option value="">Alle typen</option>
          <option value="wonen">Wonen</option>
          <option value="winkels">Winkels</option>
          <option value="kantoren">Kantoren</option>
          <option value="logistiek">Logistiek</option>
          <option value="bedrijfshallen">Bedrijfshallen</option>
          <option value="industrieel">Industrieel</option>
          <option value="hotels">Hotels</option>
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ObjectStatus | '')}>
          <option value="">Alle statussen</option>
          <option value="off-market">Off-market</option>
          <option value="in_onderzoek">In onderzoek</option>
          <option value="onder_optie">Onder optie</option>
          <option value="verkocht">Verkocht</option>
          <option value="ingetrokken">Ingetrokken</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Object</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Prijs</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Rendement</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(obj => {
                const rendement = obj.huurinkomsten && obj.vraagprijs ? ((obj.huurinkomsten / obj.vraagprijs) * 100).toFixed(1) : null;
                return (
                  <tr key={obj.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3">
                      <Link to={`/objecten/${obj.id}`} className="block">
                        <p className="font-medium text-foreground">{obj.titel}</p>
                        <p className="text-xs text-muted-foreground">{obj.plaats}, {obj.provincie}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right hidden md:table-cell font-mono-data text-foreground">{formatCurrency(obj.vraagprijs)}</td>
                    <td className="px-5 py-3 text-right hidden lg:table-cell font-mono-data">
                      {rendement ? <span className="text-success">{rendement}%</span> : '—'}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell text-muted-foreground capitalize">{obj.type}</td>
                    <td className="px-5 py-3"><ObjectStatusBadge status={obj.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ObjectFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
