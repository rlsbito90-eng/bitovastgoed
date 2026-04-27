import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Calendar, GitBranch } from 'lucide-react';
import {
  PIPELINE_FASES, INTERESSE_LABELS, VOLGENDE_ACTIE_LABELS,
  type PipelineFase, type InteresseNiveau, type VolgendeActieType, type PipelineKandidaat,
} from '@/data/mock-data';
import { PipelineFaseBadge, InteresseNiveauBadge } from '@/components/pipeline/PipelineBadges';
import PipelineKandidaatDialog from '@/components/pipeline/PipelineKandidaatDialog';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const fmtBedrag = (n?: number) =>
  n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '';
const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM', { locale: nl }) : '';

export default function PipelinePage() {
  const { pipelineKandidaten, getObjectById, getRelatieById } = useDataStore();
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
      const arr = map.get(k.pipelineFase);
      if (arr) arr.push(k);
    });
    return map;
  }, [filtered]);

  const resetFilters = () => {
    setZoek(''); setObjectFilter(''); setRelatieFilter('');
    setInteresseFilter(''); setActieFilter(''); setActieDeadlineDagen('');
    setOpenstaandFilter(false); setPropertyTypeFilter(''); setDealTypeFilter('');
  };

  // Verzamel unieke objecten/relaties uit de actuele pipeline voor de selects
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

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-5 max-w-[1600px]">
      <PageHeader
        title="Pipeline"
        subtitle={`${filtered.length} van ${pipelineKandidaten.length} kandidaten`}
      />

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
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={interesseFilter} onChange={e => setInteresseFilter(e.target.value as any)}>
            <option value="">Elk interesse-niveau</option>
            {(Object.keys(INTERESSE_LABELS) as InteresseNiveau[]).map(n => <option key={n} value={n}>{INTERESSE_LABELS[n]}</option>)}
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={actieFilter} onChange={e => setActieFilter(e.target.value as any)}>
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
              return (
                <div key={f.key} className="w-72 shrink-0 bg-muted/30 rounded-lg p-2 flex flex-col">
                  <div className="flex items-center justify-between px-1.5 py-1.5 sticky top-0">
                    <PipelineFaseBadge fase={f.key} />
                    <span className="text-xs font-mono-data text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2 mt-1">
                    {items.map(k => {
                      const obj = getObjectById(k.objectId);
                      const rel = getRelatieById(k.relatieId);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => setBewerken(k)}
                          className="w-full text-left bg-background border border-border rounded-md p-2.5 hover:border-primary/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <Link to={`/objecten/${k.objectId}`} onClick={e => e.stopPropagation()} className="text-sm font-medium hover:text-primary truncate flex items-center gap-1 min-w-0">
                              <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              <span className="truncate">{obj?.titel ?? '—'}</span>
                            </Link>
                            {k.matchscore != null && (
                              <span className="text-[10px] font-mono-data text-muted-foreground shrink-0">{k.matchscore}%</span>
                            )}
                          </div>
                          <Link to={`/relaties/${k.relatieId}`} onClick={e => e.stopPropagation()} className="block text-xs text-muted-foreground hover:text-primary truncate mb-2">
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
                        </button>
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
