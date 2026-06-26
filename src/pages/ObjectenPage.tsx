import { useEffect, useMemo, useState } from 'react';
import { saveListContext } from '@/lib/listNavigation';
import { Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatDate } from '@/data/mock-data';
import { ObjectStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronRight, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { ObjectStatus, ObjectVastgoed } from '@/data/mock-data';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import PageHeader from '@/components/PageHeader';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { PropertyTypeBadge, SubtypeBadges, DealtypeBadges } from '@/components/TaxonomieBadges';
import SortDropdown from '@/components/SortDropdown';
import { useSortPreference } from '@/hooks/useSortPreference';
import { byDate, byNumber, byString, combine } from '@/lib/sorting/comparators';
import { smartObjectCompare } from '@/lib/sorting/urgency';
import type { SortOption } from '@/lib/sorting/types';

type ArchiefView = 'actief' | 'archief' | 'alles';

export default function ObjectenPage() {
  const navigate = useNavigate();
  const { objecten, unarchiveObject, pipelineKandidaten } = useDataStore();
  const { propertyTypes, propertySubtypes, dealTypes, subtypesForType } = usePropertyTaxonomie();
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [subtypeFilter, setSubtypeFilter] = useState<string>('');
  const [dealtypeFilter, setDealtypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ObjectStatus | ''>('');
  const [archiefView, setArchiefView] = useState<ArchiefView>('actief');
  const [formOpen, setFormOpen] = useState(false);

  const aantalArchief = objecten.filter(o => o.isArchived).length;
  const aantalActief = objecten.length - aantalArchief;

  const kandidatenPerObject = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of pipelineKandidaten) m.set(k.objectId, (m.get(k.objectId) ?? 0) + 1);
    return m;
  }, [pipelineKandidaten]);

  const sortOptions = useMemo<SortOption<ObjectVastgoed>[]>(() => [
    { value: 'slim', label: 'Slimme volgorde', compare: smartObjectCompare(kandidatenPerObject) },
    { value: 'nieuwste', label: 'Nieuwste eerst', compare: byDate<ObjectVastgoed>(o => o.datumToegevoegd, 'desc') },
    { value: 'gewijzigd', label: 'Laatst gewijzigd', compare: byDate<ObjectVastgoed>(o => (o as any).updatedAt ?? o.datumToegevoegd, 'desc') },
    { value: 'prijs_hl', label: 'Vraagprijs hoog-laag', compare: byNumber<ObjectVastgoed>(o => o.vraagprijs, 'desc') },
    { value: 'prijs_lh', label: 'Vraagprijs laag-hoog', compare: byNumber<ObjectVastgoed>(o => o.vraagprijs, 'asc') },
    { value: 'plaats', label: 'Plaats A-Z', compare: byString<ObjectVastgoed>(o => o.plaats) },
    { value: 'status', label: 'Status', compare: combine(byString<ObjectVastgoed>(o => o.status), byString<ObjectVastgoed>(o => o.titel)) },
    { value: 'type', label: 'Type vastgoed', compare: combine(byString<ObjectVastgoed>(o => propertyTypes.find(p => p.id === o.propertyTypeId)?.name ?? o.type ?? ''), byString<ObjectVastgoed>(o => o.titel)) },
    { value: 'kandidaten', label: 'Aantal kandidaten', compare: byNumber<ObjectVastgoed>(o => kandidatenPerObject.get(o.id) ?? 0, 'desc') },
  ], [kandidatenPerObject, propertyTypes]);

  const [sortValue, setSortValue] = useSortPreference('objecten', 'slim', sortOptions.map(o => o.value));
  const activeSort = sortOptions.find(o => o.value === sortValue) ?? sortOptions[0];

  const filtered = useMemo(() => {
    const list = objecten.filter(o => {
      if (archiefView === 'actief' && o.isArchived) return false;
      if (archiefView === 'archief' && !o.isArchived) return false;
      const matchZoek = !zoek
        || o.titel.toLowerCase().includes(zoek.toLowerCase())
        || o.plaats.toLowerCase().includes(zoek.toLowerCase());
      const matchType = !typeFilter || o.propertyTypeId === typeFilter;
      const matchSub = !subtypeFilter || (o.propertySubtypeIds ?? []).includes(subtypeFilter);
      const matchDeal = !dealtypeFilter || (o.dealTypeIds ?? []).includes(dealtypeFilter);
      const matchStatus = !statusFilter || o.status === statusFilter;
      return matchZoek && matchType && matchSub && matchDeal && matchStatus;
    });
    return [...list].sort(activeSort.compare);
  }, [objecten, zoek, typeFilter, subtypeFilter, dealtypeFilter, statusFilter, archiefView, activeSort]);

  useEffect(() => {
    saveListContext('objecten', filtered.map(o => o.id));
  }, [filtered]);

  const beschikbareSubs = typeFilter ? subtypesForType(typeFilter) : propertySubtypes;

  const handleHerstel = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await unarchiveObject(id);
      toast.success('Object teruggezet naar Actief');
    } catch (err: any) {
      toast.error(`Herstellen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const tabs: { key: ArchiefView; label: string; count: number }[] = [
    { key: 'actief', label: 'Actief', count: aantalActief },
    { key: 'archief', label: 'Archief', count: aantalArchief },
    { key: 'alles', label: 'Alles', count: objecten.length },
  ];

  const isArchiefView = archiefView === 'archief';

  return (
    <div className="page-shell-wide">
      <PageHeader
        title="Objecten"
        subtitle={`${aantalActief} actief · ${aantalArchief} gearchiveerd`}
        actions={
          <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Nieuw object
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
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam of plaats..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
          <select
            className="flex-1 sm:flex-none min-w-0 h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setSubtypeFilter(''); }}
          >
            <option value="">Alle typen vastgoed</option>
            {propertyTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            className="flex-1 sm:flex-none min-w-0 h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
            value={subtypeFilter}
            onChange={e => setSubtypeFilter(e.target.value)}
            disabled={beschikbareSubs.length === 0}
          >
            <option value="">Alle subcategorieën</option>
            {beschikbareSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            className="flex-1 sm:flex-none min-w-0 h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
            value={dealtypeFilter}
            onChange={e => setDealtypeFilter(e.target.value)}
          >
            <option value="">Alle dealtypes</option>
            {dealTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="flex-1 sm:flex-none min-w-0 h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ObjectStatus | '')}>
            <option value="">Alle statussen</option>
            <option value="te_beoordelen">Te beoordelen</option>
            <option value="beschikbaar">Beschikbaar</option>
            <option value="on_hold">On hold</option>
            <option value="onder_optie">Onder optie</option>
            <option value="verkocht">Verkocht</option>
            <option value="ingetrokken">Ingetrokken</option>
            <option value="afgevallen">Afgevallen</option>
          </select>
        </div>
        <div className="sm:ml-auto">
          <SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="Geen objecten gevonden"
          description="Pas je filters of zoekopdracht aan, of voeg een nieuw object toe om te beginnen."
          action={
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nieuw object
            </button>
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(obj => {
              const rendement = obj.huurinkomsten && obj.vraagprijs ? ((obj.huurinkomsten / obj.vraagprijs) * 100).toFixed(1) : null;
              return (
                <Link key={obj.id} to={`/objecten/${obj.id}`} className="section-card block p-3.5 active:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground text-sm leading-snug min-w-0 flex-1 break-words">
                      {obj.titel}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <ObjectStatusBadge status={obj.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {[obj.plaats, obj.provincie].filter(Boolean).join(', ')}
                  </p>
                  {obj.isArchived && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Archive className="h-3 w-3" /> {obj.archivedReason ?? 'Gearchiveerd'}
                        {obj.archivedAt && <span>· {formatDate(obj.archivedAt)}</span>}
                      </span>
                      <button onClick={(e) => handleHerstel(obj.id, e)} className="inline-flex items-center gap-1 text-accent hover:underline">
                        <RotateCcw className="h-3 w-3" /> Terugzetten
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <PropertyTypeBadge id={obj.propertyTypeId} fallbackAssetClass={obj.type} variant="compact" showEmpty={false} />
                    <SubtypeBadges ids={obj.propertySubtypeIds} max={2} variant="compact" showEmpty={false} />
                    <DealtypeBadges ids={obj.dealTypeIds} max={1} variant="compact" showEmpty={false} />
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-2 pt-2 border-t border-border/60">
                    <span className="text-sm text-foreground font-mono-data truncate">
                      {formatCurrency(obj.vraagprijs)}
                    </span>
                    {rendement && (
                      <span className="text-xs text-success font-mono-data shrink-0">
                        {rendement}%
                      </span>
                    )}
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
                    <th className="text-right px-5 py-3 field-label">Prijs</th>
                    <th className="text-right px-5 py-3 field-label hidden lg:table-cell">Rendement</th>
                    <th className="text-left px-5 py-3 field-label hidden lg:table-cell">Classificatie</th>
                    <th className="text-left px-5 py-3 field-label">Status</th>
                    {isArchiefView && <th className="text-left px-5 py-3 field-label">Archief</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filtered.map(obj => {
                    const rendement = obj.huurinkomsten && obj.vraagprijs ? ((obj.huurinkomsten / obj.vraagprijs) * 100).toFixed(1) : null;
                    return (
                      <tr
                        key={obj.id}
                        onClick={() => navigate(`/objecten/${obj.id}`)}
                        className="group hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">{obj.titel}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{obj.plaats}, {obj.provincie}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono-data text-foreground">{formatCurrency(obj.vraagprijs)}</td>
                        <td className="px-5 py-3.5 text-right hidden lg:table-cell font-mono-data">
                          {rendement ? <span className="text-success">{rendement}%</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            <PropertyTypeBadge id={obj.propertyTypeId} fallbackAssetClass={obj.type} variant="compact" showEmpty={false} />
                            <SubtypeBadges ids={obj.propertySubtypeIds} max={2} variant="compact" showEmpty={false} />
                            <DealtypeBadges ids={obj.dealTypeIds} max={2} variant="compact" showEmpty={false} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><ObjectStatusBadge status={obj.status} /></td>
                        {isArchiefView && (
                          <td className="px-5 py-3.5 text-xs">
                            {obj.isArchived ? (
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">
                                  {obj.archivedReason ?? '—'}
                                  {obj.archivedAt && <span className="ml-1">· {formatDate(obj.archivedAt)}</span>}
                                </span>
                                <button onClick={(e) => handleHerstel(obj.id, e)} className="inline-flex items-center gap-1 text-accent hover:underline">
                                  <RotateCcw className="h-3 w-3" /> Terugzetten
                                </button>
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ObjectFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
