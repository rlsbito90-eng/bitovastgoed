import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Users, Calendar, Lock } from 'lucide-react';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { PIPELINE_FASES, type PipelineFase } from '@/data/mock-data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const fmtBedrag = (n?: number) =>
  n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '';
const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM', { locale: nl }) : '';

const FASE_ORDER: Record<PipelineFase, number> =
  PIPELINE_FASES.reduce((acc, f, i) => ({ ...acc, [f.key]: i }), {} as Record<PipelineFase, number>);
const FASE_LABEL_MAP: Record<PipelineFase, string> =
  PIPELINE_FASES.reduce((acc, f) => ({ ...acc, [f.key]: f.label }), {} as Record<PipelineFase, string>);

export default function ObjectPipelineKanban() {
  const {
    objecten, pipelineKandidaten, getDefaultObjectPipeline, getStagesVoorPipeline,
    setObjectPipelineStage,
  } = useDataStore();
  const { propertyTypes, dealTypes } = usePropertyTaxonomie();

  const pipeline = getDefaultObjectPipeline();
  const stages = pipeline ? getStagesVoorPipeline(pipeline.id) : [];

  const [zoek, setZoek] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [dealTypeFilter, setDealTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kandidaatFilter, setKandidaatFilter] = useState<'' | 'met' | 'zonder'>('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return objecten.filter(o => {
      if (q) {
        const hay = `${o.titel} ${o.plaats} ${o.adres ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (propertyTypeFilter && o.propertyTypeId !== propertyTypeFilter) return false;
      if (dealTypeFilter && !(o.dealTypeIds ?? []).includes(dealTypeFilter)) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (kandidaatFilter) {
        const heeftKandidaten = pipelineKandidaten.some(k => k.objectId === o.id);
        if (kandidaatFilter === 'met' && !heeftKandidaten) return false;
        if (kandidaatFilter === 'zonder' && heeftKandidaten) return false;
      }
      return true;
    });
  }, [objecten, pipelineKandidaten, zoek, propertyTypeFilter, dealTypeFilter, statusFilter, kandidaatFilter]);

  const perStage = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    stages.forEach(s => map.set(s.id, []));
    const eersteStageId = stages[0]?.id;
    filtered.forEach(o => {
      const sid = o.pipelineStageId ?? eersteStageId;
      if (sid && map.has(sid)) map.get(sid)!.push(o);
    });
    return map;
  }, [filtered, stages]);

  const handleDrop = async (stageId: string) => {
    if (!dragId) return;
    const obj = objecten.find(o => o.id === dragId);
    setDragId(null); setOverStage(null);
    if (!obj || obj.pipelineStageId === stageId) return;
    try {
      await setObjectPipelineStage(dragId, stageId, { manual: true });
      toast.success('Fase bijgewerkt');
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  if (!pipeline || stages.length === 0) {
    return (
      <div className="section-card p-12 text-center text-sm text-muted-foreground">
        Geen actieve Object Pipeline gevonden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="section-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <Input placeholder="Zoek object…" value={zoek} onChange={e => setZoek(e.target.value)} />
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={propertyTypeFilter} onChange={e => setPropertyTypeFilter(e.target.value)}>
          <option value="">Elk type vastgoed</option>
          {propertyTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={dealTypeFilter} onChange={e => setDealTypeFilter(e.target.value)}>
          <option value="">Elke propositie</option>
          {dealTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Elke objectstatus</option>
          {['off-market','in_onderzoek','beschikbaar','onder_optie','verkocht','ingetrokken'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={kandidaatFilter} onChange={e => setKandidaatFilter(e.target.value as any)}>
          <option value="">Met of zonder kandidaten</option>
          <option value="met">Alleen met kandidaten</option>
          <option value="zonder">Alleen zonder kandidaten</option>
        </select>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3 min-w-max">
          {stages.map(s => {
            const items = perStage.get(s.id) ?? [];
            const isOver = overStage === s.id;
            return (
              <div
                key={s.id}
                onDragOver={e => { e.preventDefault(); setOverStage(s.id); }}
                onDragLeave={() => setOverStage(prev => prev === s.id ? null : prev)}
                onDrop={() => handleDrop(s.id)}
                className={`w-72 shrink-0 rounded-lg p-2 flex flex-col transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/40' : 'bg-muted/30'}`}
              >
                <div className="flex items-center justify-between px-1.5 py-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full" style={s.color ? { borderColor: s.color, color: s.color } : undefined}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color ?? 'currentColor' }} />
                    {s.name}
                  </span>
                  <span className="text-xs font-mono-data text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2 mt-1 min-h-[40px]">
                  {items.map(o => {
                    const kandidaten = pipelineKandidaten.filter(k => k.objectId === o.id);
                    const hoogste = kandidaten.reduce<PipelineFase | null>((acc, k) =>
                      acc == null || FASE_ORDER[k.pipelineFase] > FASE_ORDER[acc] ? k.pipelineFase : acc, null);
                    const opensteActies = kandidaten.filter(k => !!k.volgendeActie).length;
                    const propType = propertyTypes.find(p => p.id === o.propertyTypeId);
                    const dt = (o.dealTypeIds ?? []).map(id => dealTypes.find(d => d.id === id)?.name).filter(Boolean);

                    return (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={() => setDragId(o.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null); }}
                        className={`bg-background border border-border rounded-md p-2.5 hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${dragId === o.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <Link to={`/objecten/${o.id}`} className="text-sm font-medium hover:text-primary truncate flex items-center gap-1 min-w-0">
                            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            <span className="truncate">{o.titel}</span>
                          </Link>
                          {o.pipelineStageLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Handmatig vastgezet" />}
                        </div>
                        {o.plaats && <p className="text-[11px] text-muted-foreground mb-1.5 ml-5 truncate">{o.plaats}</p>}
                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          {propType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{propType.name}</span>}
                          {dt.slice(0, 2).map((n, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{n}</span>)}
                        </div>
                        {o.vraagprijs != null && (
                          <div className="text-[11px] font-mono-data text-foreground mb-1">{fmtBedrag(o.vraagprijs)}</div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {kandidaten.length}
                            {opensteActies > 0 && <span className="text-warning">· {opensteActies} actie{opensteActies === 1 ? '' : 's'}</span>}
                          </span>
                          {hoogste && (
                            <span className="truncate max-w-[110px]" title={FASE_LABEL_MAP[hoogste]}>{FASE_LABEL_MAP[hoogste]}</span>
                          )}
                        </div>
                        {o.pipelineUpdatedAt && (
                          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {fmtDatum(o.pipelineUpdatedAt)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-center text-[11px] text-muted-foreground py-3">Geen objecten</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
