import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatDate } from '@/data/mock-data';
import { LeadStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import type { LeadStatus, PartijType } from '@/data/mock-data';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';

export default function RelatiesPage() {
  const { relaties } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<PartijType | ''>('');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = relaties.filter(r => {
    const matchZoek = !zoek || r.bedrijfsnaam.toLowerCase().includes(zoek.toLowerCase()) || r.contactpersoon.toLowerCase().includes(zoek.toLowerCase());
    const matchStatus = !statusFilter || r.leadStatus === statusFilter;
    const matchType = !typeFilter || r.type === typeFilter;
    return matchZoek && matchStatus && matchType;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Relaties</h1>
          <p className="text-sm text-muted-foreground mt-1">{relaties.length} contacten</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
          <Plus className="h-4 w-4" /> Nieuwe relatie
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam of bedrijf..." className="pl-9" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatus | '')}>
          <option value="">Alle statussen</option>
          <option value="koud">Koud</option>
          <option value="lauw">Lauw</option>
          <option value="warm">Warm</option>
          <option value="actief">Actief</option>
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value as PartijType | '')}>
          <option value="">Alle typen</option>
          <option value="belegger">Belegger</option>
          <option value="ontwikkelaar">Ontwikkelaar</option>
          <option value="eigenaar">Eigenaar</option>
          <option value="makelaar">Makelaar</option>
          <option value="partner">Partner</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Bedrijf</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Regio</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Laatste contact</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3">
                    <Link to={`/relaties/${r.id}`} className="block">
                      <p className="font-medium text-foreground">{r.bedrijfsnaam}</p>
                      <p className="text-xs text-muted-foreground">{r.contactpersoon}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-muted-foreground capitalize">{r.type}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-muted-foreground">{r.regio.join(', ')}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-muted-foreground">{formatDate(r.laatsteContact)}</td>
                  <td className="px-5 py-3"><LeadStatusBadge status={r.leadStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RelatieFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
