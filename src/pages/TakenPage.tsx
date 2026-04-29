import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { formatDateTime } from '@/data/mock-data';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import type { TaakPrioriteit, TaakStatus, Taak } from '@/data/mock-data';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';

export default function TakenPage() {
  const { taken, getRelatieById, getDealById, getObjectById, updateTaak, contactpersonen } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [prioriteitFilter, setPrioriteitFilter] = useState<TaakPrioriteit | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTaak, setEditTaak] = useState<Taak | null>(null);
  const [toonAfgerond, setToonAfgerond] = useState(false);

  const filterFn = (t: Taak) => {
    const matchZoek = !zoek || t.titel.toLowerCase().includes(zoek.toLowerCase());
    const matchPrioriteit = !prioriteitFilter || t.prioriteit === prioriteitFilter;
    return matchZoek && matchPrioriteit;
  };

  const open = taken.filter(t => t.status !== 'afgerond').filter(filterFn);
  const afgerond = taken.filter(t => t.status === 'afgerond').filter(filterFn);
  const vandaag = new Date();

  const togglAfvinken = async (e: React.MouseEvent, taak: Taak) => {
    e.stopPropagation();
    const nieuweStatus: TaakStatus = taak.status === 'afgerond' ? 'open' : 'afgerond';
    try {
      await updateTaak(taak.id, { status: nieuweStatus });
      toast.success(nieuweStatus === 'afgerond' ? 'Taak afgerond' : 'Taak heropend');
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const renderTaak = (taak: Taak) => {
    const rel = taak.relatieId ? getRelatieById(taak.relatieId) : null;
    const deal = taak.dealId ? getDealById(taak.dealId) : null;
    const obj = deal ? getObjectById(deal.objectId) : null;
    const isOverdue = taak.deadline && taak.status !== 'afgerond' && new Date(taak.deadline) < vandaag;
    const isAfgerond = taak.status === 'afgerond';

    return (
      <div
        key={taak.id}
        onClick={() => { setEditTaak(taak); setFormOpen(true); }}
        className="px-4 sm:px-5 py-3.5 flex items-start sm:items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <button
          onClick={(e) => togglAfvinken(e, taak)}
          className="shrink-0 mt-0.5 sm:mt-0 text-muted-foreground hover:text-accent transition-colors"
          aria-label={isAfgerond ? 'Heropenen' : 'Afronden'}
        >
          {isAfgerond ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${isAfgerond ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{taak.titel}</p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {rel && <span className="truncate max-w-[180px]">{getRelatieNaamCompact(rel, contactpersonen)}</span>}
            {obj && <><span aria-hidden>·</span><span className="truncate max-w-[180px]">{obj.titel}</span></>}
            {taak.type && <><span aria-hidden>·</span><span className="capitalize">{taak.type}</span></>}
            {taak.deadline && (
              <>
                <span aria-hidden>·</span>
                <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                  {formatDateTime(taak.deadline, taak.deadlineTijd)}{isOverdue ? ' · te laat' : ''}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-[40%] sm:max-w-none">
          <PrioriteitBadge prioriteit={taak.prioriteit} />
          {!isAfgerond && <TaakStatusBadge status={taak.status} />}
        </div>
      </div>
    );
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Taken"
        subtitle={`${open.length} open · ${afgerond.length} afgerond`}
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
        <select className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={prioriteitFilter} onChange={e => setPrioriteitFilter(e.target.value as TaakPrioriteit | '')}>
          <option value="">Alle prioriteiten</option>
          <option value="urgent">Urgent</option>
          <option value="hoog">Hoog</option>
          <option value="normaal">Normaal</option>
          <option value="laag">Laag</option>
        </select>
      </div>

      {/* Open taken */}
      {open.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Geen open taken.</p>
        </div>
      ) : (
        <div className="section-card overflow-hidden">
          <header className="section-header">
            <h2 className="section-title">Open</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{open.length}</span>
          </header>
          <div className="divide-y divide-border/70">
            {open.map(renderTaak)}
          </div>
        </div>
      )}

      {/* Afgeronde taken (inklapbaar) */}
      {afgerond.length > 0 && (
        <div className="section-card overflow-hidden">
          <button
            onClick={() => setToonAfgerond(v => !v)}
            className="w-full section-header hover:bg-muted/30 transition-colors text-left"
          >
            <h2 className="section-title flex items-center gap-2">
              Afgerond <span className="text-xs text-muted-foreground tabular-nums font-normal">({afgerond.length})</span>
            </h2>
            {toonAfgerond ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {toonAfgerond && (
            <div className="divide-y divide-border/70 bg-muted/20">
              {afgerond.map(renderTaak)}
            </div>
          )}
        </div>
      )}

      <TaakFormDialog open={formOpen} onOpenChange={setFormOpen} taak={editTaak} />
    </div>
  );
}
