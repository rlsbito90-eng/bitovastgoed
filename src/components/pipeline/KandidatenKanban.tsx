// Kandidaten-pipeline kanban met drag & drop tussen fases.
// Gebruikt object_pipeline records (object × relatie kandidaatopvolging).
// Bij verplaatsen wordt updatePipelineKandidaat aangeroepen, wat
// — via useDataStore — automatisch de bovenliggende objectfase vooruit kan zetten
// (zolang object niet pipelineStageLocked is).

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Calendar } from 'lucide-react';
import {
  PIPELINE_FASES, INTERESSE_LABELS, VOLGENDE_ACTIE_LABELS,
  type PipelineFase, type InteresseNiveau, type VolgendeActieType, type PipelineKandidaat,
} from '@/data/mock-data';
import { PipelineFaseBadge, InteresseNiveauBadge } from '@/components/pipeline/PipelineBadges';
import PipelineKandidaatDialog from '@/components/pipeline/PipelineKandidaatDialog';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const fmtBedrag = (n?: number) =>
  n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '';
const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM', { locale: nl }) : '';

export default function KandidatenKanban() {
  const { pipelineKandidaten, getObjectById, getRelatieById, updatePipelineKandidaat } = useDataStore();
  const { propertyTypes, dealTypes } = usePropertyTaxonomie();

  const [zoek, setZoek] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [relatieFilter, setRelatieFilter] = useState('');
  const [interesseFilter, setInteresseFilter] = useState<InteresseNiveau | ''>('');
  const [actieFilter, setActieFilter] = useState<VolgendeActieType | ''>('');
  const [actieDeadlineDagen, setActieDeadlineDagen] = useState<string>('');
  const [openstaandFilter, setOpenstaandFilter] = useState(false);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [dealTypeFilter, setDealTypeFilter] = useState('');
  const [bewerken, setBewerken] = useState<PipelineKandidaat | null>(null);

  // drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [overFase, setOverFase] = useState<PipelineFase | null>(null);
  // optimistische lokale override per kandidaat
  const [optimistischeFase, setOptimistischeFase] = useState<Record<string, PipelineFase>>({});

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const drempelDagen = actieDeadlineDagen ? Number(actieDeadlineDagen) : null;
    const nu = new Date(); nu.setHours(0, 0, 0, 0);

    return pipelineKandidaten.filter(k => {
      const obj = getObjectById(k.objectId);
      const rel = getRelatieById(k.relatieId);
      if (q) {
        const hay = `${obj?.titel ?? ''} ${obj?.plaats ?? ''} ${rel?.bedrijfsnaam ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (objectFilter && k.objectId !== objectFilter) return false;
      if (relatieFilter && k.relatieId !== relatieFilter) return false;
      if (interesseFilter && k.interesseNiveau !== interesseFilter) return false;
      if (actieFilter && k.volgendeActie !== actieFilter) return false;
      if (openstaandFilter && !k.volgendeActie) return false;
      if (drempelDagen != null && k.volgendeActieDatum) {
        const d = new Date(k.volgendeActieDatum); d.setHours(0, 0, 0, 0);
        const diff = Math.round((d.getTime() - nu.getTime()) / 86400000);
        if (diff > drempelDagen) return false;
      } else if (drempelDagen != null && !k.volgendeActieDatum) {
        return false;
      }
      if (propertyTypeFilter && obj?.propertyTypeId !== propertyTypeFilter) return false;
      if (dealTypeFilter && !(obj?.dealTypeIds ?? []).includes(dealTypeFilter)) return false;
      return true;
    });
  }, [
    pipelineKandidaten, zoek, objectFilter, relatieFilter,
    interesseFilter, actieFilter, actieDeadlineDagen, openstaandFilter,
    propertyTypeFilter, dealTypeFilter,
    getObjectById, getRelatieById,
  ]);

  const perFase = useMemo(() => {
    const map = new Map<PipelineFase, PipelineKandidaat[]>();
    PIPELINE_FASES.forEach(f => map.set(f.key, []));
    filtered.forEach(k => {
      const effFase = optimistischeFase[k.id] ?? k.pipelineFase;
      const arr = map.get(effFase);
      if (arr) arr.push(k);
    });
    return map;
  }, [filtered, optimistischeFase]);

  const resetFilters = () => {
    setZoek(''); setObjectFilter(''); setRelatieFilter('');
    setInteresseFilter(''); setActieFilter(''); setActieDeadlineDagen('');
    setOpenstaandFilter(false); setPropertyTypeFilter(''); setDealTypeFilter('');
  };

  const objectOpties = useMemo(() => {
    const ids = Array.from(new Set(pipelineKandidaten.map(k => k.objectId)));
    return ids.map(id => ({ id, titel: getObjectById(id)?.titel ?? '(onbekend)' }))
      .sort((a, b) => a.titel.localeCompare(b.titel, 'nl'));
  }, [pipelineKandidaten, getObjectById]);

  const relatieOpties = useMemo(() => {
    const ids = Array.from(new Set(pipelineKandidaten.map(k => k.relatieId)));
    return ids.map(id => ({ id, naam: getRelatieById(id)?.bedrijfsnaam ?? '(onbekend)' }))
      .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  }, [pipelineKandidaten, getRelatieById]);

  const handleDrop = async (fase: PipelineFase) => {
    const id = dragId;
    setDragId(null); setOverFase(null);
    if (!id) return;
    const kandidaat = pipelineKandidaten.find(k => k.id === id);
    if (!kandidaat || kandidaat.pipelineFase === fase) return;

    // optimistische update
    setOptimistischeFase(prev => ({ ...prev, [id]: fase }));
    try {
      await updatePipelineKandidaat(id, { pipelineFase: fase });
      toast.success('Fase bijgewerkt');
      // bij volgende render zit de echte fase in pipelineKandidaten
      setOptimistischeFase(prev => {
        const c = { ...prev }; delete c[id]; return c;
      });
    } catch (err: any) {
      // rollback
      setOptimistischeFase(prev => {
        const c = { ...prev }; delete c[id]; return c;
      });
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* FILTERS */}
      <div className="section-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input placeholder="Zoek op object, plaats of relatie…" value={zoek} onChange={e => setZoek(e.target.value)} />
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={objectFilter} onChange={e => setObjectFilter(e.target.value)}>
            <option value="">Alle objecten</option>
            {objectOpties.map(o => <option key={o.id} value={o.id}>{o.titel}</option>)}
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={relatieFilter} onChange={e => setRelatieFilter(e.target.value)}>
            <option value="">Alle relaties</option>
            {relatieOpties.map(r => <option key={r.id} value={r.id}>{r.naam}</option>)}
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={interesseFilter} onChange={e => setInteresseFilter(e.target.value as InteresseNiveau | '')}>
            <option value="">Elk interesse-niveau</option>
            {(Object.keys(INTERESSE_LABELS) as InteresseNiveau[]).map(n => <option key={n} value={n}>{INTERESSE_LABELS[n]}</option>)}
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={actieFilter} onChange={e => setActieFilter(e.target.value as VolgendeActieType | '')}>
            <option value="">Elke volgende actie</option>
            {(Object.keys(VOLGENDE_ACTIE_LABELS) as VolgendeActieType[]).map(t => <option key={t} value={t}>{VOLGENDE_ACTIE_LABELS[t]}</option>)}
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={actieDeadlineDagen} onChange={e => setActieDeadlineDagen(e.target.value)}>
            <option value="">Geen deadline-filter</option>
            <option value="0">Vandaag of eerder</option>
            <option value="3">Binnen 3 dagen</option>
            <option value="7">Binnen 7 dagen</option>
            <option value="14">Binnen 14 dagen</option>
            <option value="30">Binnen 30 dagen</option>
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={propertyTypeFilter} onChange={e => setPropertyTypeFilter(e.target.value)}>
            <option value="">Elk type vastgoed</option>
            {propertyTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={dealTypeFilter} onChange={e => setDealTypeFilter(e.target.value)}>
            <option value="">Elke propositie</option>
            {dealTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={openstaandFilter} onChange={e => setOpenstaandFilter(e.target.checked)} />
            Alleen met openstaande actie
          </label>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">Reset filters</Button>
          <span className="text-muted-foreground">{filtered.length} van {pipelineKandidaten.length} kandidaten</span>
        </div>
      </div>

      {/* KANBAN */}
      {filtered.length === 0 ? (
        <div className="section-card p-12 text-center text-sm text-muted-foreground">
          Geen kandidaten in de pipeline {zoek || objectFilter || relatieFilter ? 'die aan de filters voldoen' : 'nog'}.
          Voeg ze toe vanuit een objectdetail-pagina.
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_FASES.map(f => {
              const items = perFase.get(f.key) ?? [];
              const isOver = overFase === f.key;
              return (
                <div
                  key={f.key}
                  onDragOver={e => { e.preventDefault(); setOverFase(f.key); }}
                  onDragLeave={() => setOverFase(prev => prev === f.key ? null : prev)}
                  onDrop={() => handleDrop(f.key)}
                  className={`w-72 shrink-0 rounded-lg p-2 flex flex-col transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/40' : 'bg-muted/30'}`}
                >
                  <div className="flex items-center justify-between px-1.5 py-1.5 sticky top-0">
                    <PipelineFaseBadge fase={f.key} />
                    <span className="text-xs font-mono-data text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2 mt-1 min-h-[40px]">
                    {items.map(k => {
                      const obj = getObjectById(k.objectId);
                      const rel = getRelatieById(k.relatieId);
                      return (
                        <div
                          key={k.id}
                          draggable
                          onDragStart={() => setDragId(k.id)}
                          onDragEnd={() => { setDragId(null); setOverFase(null); }}
                          onClick={() => setBewerken(k)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBewerken(k); } }}
                          className={`bg-background border border-border rounded-md p-2.5 hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${dragId === k.id ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <Link
                              to={`/objecten/${k.objectId}`}
                              onClick={e => e.stopPropagation()}
                              draggable={false}
                              onDragStart={e => e.preventDefault()}
                              className="text-sm font-medium hover:text-primary truncate flex items-center gap-1 min-w-0"
                            >
                              <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              <span className="truncate">{obj?.titel ?? '—'}</span>
                            </Link>
                            {k.matchscore != null && (
                              <span className="text-[10px] font-mono-data text-muted-foreground shrink-0">{k.matchscore}%</span>
                            )}
                          </div>
                          <Link
                            to={`/relaties/${k.relatieId}`}
                            onClick={e => e.stopPropagation()}
                            draggable={false}
                            onDragStart={e => e.preventDefault()}
                            className="block text-xs text-muted-foreground hover:text-primary truncate mb-2"
                          >
                            {rel?.bedrijfsnaam ?? '(verwijderde relatie)'}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <InteresseNiveauBadge niveau={k.interesseNiveau} />
                            {k.biedingBedrag != null && (
                              <span className="text-[11px] font-mono-data text-foreground">{fmtBedrag(k.biedingBedrag)}</span>
                            )}
                          </div>
                          {k.volgendeActie && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {VOLGENDE_ACTIE_LABELS[k.volgendeActie]}
                                {k.volgendeActieDatum && ` · ${fmtDatum(k.volgendeActieDatum)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="text-center text-[11px] text-muted-foreground py-3">Geen kandidaten</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bewerken && (
        <PipelineKandidaatDialog
          open={!!bewerken}
          onOpenChange={o => { if (!o) setBewerken(null); }}
          kandidaat={bewerken}
        />
      )}
    </div>
  );
}
