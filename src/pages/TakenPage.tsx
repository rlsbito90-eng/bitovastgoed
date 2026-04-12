import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { formatDate } from '@/data/mock-data';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import type { TaakPrioriteit, TaakStatus } from '@/data/mock-data';
import TaakFormDialog from '@/components/forms/TaakFormDialog';

export default function TakenPage() {
  const { taken, getRelatieById, getDealById, getObjectById } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaakStatus | ''>('');
  const [prioriteitFilter, setPrioriteitFilter] = useState<TaakPrioriteit | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<typeof taken[0] | null>(null);

  const filtered = taken.filter(t => {
    const matchZoek = !zoek || t.titel.toLowerCase().includes(zoek.toLowerCase());
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchPrioriteit = !prioriteitFilter || t.prioriteit === prioriteitFilter;
    return matchZoek && matchStatus && matchPrioriteit;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Taken</h1>
          <p className="text-sm text-muted-foreground mt-1">{taken.filter(t => t.status !== 'afgerond').length} open taken</p>
        </div>
        <button onClick={() => { setEditTaak(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
          <Plus className="h-4 w-4" /> Nieuwe taak
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op taak..." className="pl-9" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaakStatus | '')}>
          <option value="">Alle statussen</option>
          <option value="open">Open</option>
          <option value="in_uitvoering">In uitvoering</option>
          <option value="afgerond">Afgerond</option>
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground" value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value as TaakPrioriteit | '')}>
          <option value="">Alle prioriteiten</option>
          <option value="urgent">Urgent</option>
          <option value="hoog">Hoog</option>
          <option value="normaal">Normaal</option>
          <option value="laag">Laag</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.map(taak => {
            const rel = taak.relatieId ? getRelatieById(taak.relatieId) : null;
            const deal = taak.dealId ? getDealById(taak.dealId) : null;
            const obj = deal ? getObjectById(deal.objectId) : null;
            return (
              <div key={taak.id} onClick={() => { setEditTaak(taak); setFormOpen(true); }} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{taak.titel}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    {rel && <span>{rel.bedrijfsnaam}</span>}
                    {obj && <span>· {obj.titel}</span>}
                    <span>· {taak.type}</span>
                    <span>· Deadline: {formatDate(taak.deadline)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PrioriteitBadge prioriteit={taak.prioriteit} />
                  <TaakStatusBadge status={taak.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaakFormDialog open={formOpen} onOpenChange={setFormOpen} taak={editTaak} />
    </div>
  );
}
