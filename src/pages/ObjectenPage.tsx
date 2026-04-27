import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency } from '@/data/mock-data';
import { ObjectStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronRight } from 'lucide-react';
import type { ObjectStatus } from '@/data/mock-data';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import PageHeader from '@/components/PageHeader';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { PropertyTypeBadge, SubtypeBadges, DealtypeBadges } from '@/components/TaxonomieBadges';

export default function ObjectenPage() {
  const { objecten } = useDataStore();
  const { propertyTypes, propertySubtypes, dealTypes, subtypesForType } = usePropertyTaxonomie();
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(''); // property_type_id
  const [subtypeFilter, setSubtypeFilter] = useState<string>('');
  const [dealtypeFilter, setDealtypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ObjectStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = objecten.filter(o => {
    const matchZoek = !zoek
      || o.titel.toLowerCase().includes(zoek.toLowerCase())
      || o.plaats.toLowerCase().includes(zoek.toLowerCase());
    const matchType = !typeFilter || o.propertyTypeId === typeFilter;
    const matchSub = !subtypeFilter || (o.propertySubtypeIds ?? []).includes(subtypeFilter);
    const matchDeal = !dealtypeFilter || (o.dealTypeIds ?? []).includes(dealtypeFilter);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchZoek && matchType && matchSub && matchDeal && matchStatus;
  });

  const beschikbareSubs = typeFilter ? subtypesForType(typeFilter) : propertySubtypes;

  return (
    <div className="page-shell">
      <PageHeader
        title="Objecten"
        subtitle={`${objecten.length} objecten in beheer`}
        actions={
          <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Nieuw object
          </button>
        }
      />

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
            <option value="off-market">Off-market</option>
            <option value="in_onderzoek">In onderzoek</option>
            <option value="beschikbaar">Beschikbaar</option>
            <option value="onder_optie">Onder optie</option>
            <option value="verkocht">Verkocht</option>
            <option value="ingetrokken">Ingetrokken</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Geen objecten gevonden.</p>
        </div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filtered.map(obj => {
                    const rendement = obj.huurinkomsten && obj.vraagprijs ? ((obj.huurinkomsten / obj.vraagprijs) * 100).toFixed(1) : null;
                    return (
                      <tr key={obj.id} className="group hover:bg-muted/40 transition-colors cursor-pointer">
                        <td className="px-5 py-3.5">
                          <Link to={`/objecten/${obj.id}`} className="block">
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{obj.titel}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{obj.plaats}, {obj.provincie}</p>
                          </Link>
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
