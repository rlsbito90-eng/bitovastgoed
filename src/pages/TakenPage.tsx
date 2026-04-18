import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { formatDate } from '@/data/mock-data';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import type { TaakPrioriteit, TaakStatus } from '@/data/mock-data';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import PageHeader from '@/components/PageHeader';

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

  const vandaag = new Date();

  return (
    <div className="page-shell">
      <PageHeader
        title="Taken"
        subtitle={`${taken.filter(t => t.status !== 'afgerond').length} open taken`}
        actions={
          <button onClick={() => { setEditTaak(null); setFormOpen(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Nieuwe taak
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op taak..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <div className="flex gap-2.5">
          <select className="flex-1 sm:flex-none h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaakStatus | '')}>
            <option value="">Alle statussen</option>
            <option value="open">Open</option>
            <option value="in_uitvoering">In uitvoering</option>
            <option value="afgerond">Afgerond</option>
          </select>
          <select className="flex-1 sm:flex-none h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value as TaakPrioriteit | '')}>
            <option value="">Alle prioriteiten</option>
            <option value="urgent">Urgent</option>
            <option value="hoog">Hoog</option>
            <option value="normaal">Normaal</option>
            <option value="laag">Laag</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Geen taken gevonden.</p>
        </div>
      ) : (
        <div className="section-card overflow-hidden">
          <div className="divide-y divide-border/70">
            {filtered.map(taak => {
              const rel = taak.relatieId ? getRelatieById(taak.relatieId) : null;
              const deal = taak.dealId ? getDealById(taak.dealId) : null;
              const obj = deal ? getObjectById(deal.objectId) : null;
              const isOverdue = taak.deadline && taak.status !== 'afgerond' && new Date(taak.deadline) < vandaag;
              return (
                <div
                  key={taak.id}
                  onClick={() => { setEditTaak(taak); setFormOpen(true); }}
                  className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{taak.titel}</p>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      {rel && <span className="truncate max-w-[180px]">{rel.bedrijfsnaam}</span>}
                      {obj && <><span aria-hidden>·</span><span className="truncate max-w-[180px]">{obj.titel}</span></>}
                      {taak.type && <><span aria-hidden>·</span><span className="capitalize">{taak.type}</span></>}
                      {taak.deadline && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                            {formatDate(taak.deadline)}{isOverdue ? ' · te laat' : ''}
                          </span>
                        </>
                      )}
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
      )}

      <TaakFormDialog open={formOpen} onOpenChange={setFormOpen} taak={editTaak} />
    </div>
  );
}
