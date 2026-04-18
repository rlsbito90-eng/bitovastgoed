import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency } from '@/data/mock-data';
import { ObjectStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronRight } from 'lucide-react';
import type { AssetClass, ObjectStatus } from '@/data/mock-data';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import PageHeader from '@/components/PageHeader';

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
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam of plaats..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <div className="flex gap-2.5">
          <select className="flex-1 sm:flex-none h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value as AssetClass | '')}>
            <option value="">Alle typen</option>
            <option value="wonen">Wonen</option>
            <option value="winkels">Winkels</option>
            <option value="kantoren">Kantoren</option>
            <option value="logistiek">Logistiek</option>
            <option value="bedrijfshallen">Bedrijfshallen</option>
            <option value="industrieel">Industrieel</option>
            <option value="hotels">Hotels</option>
          </select>
          <select className="flex-1 sm:flex-none h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ObjectStatus | '')}>
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
                <Link key={obj.id} to={`/objecten/${obj.id}`} className="section-card block p-4 active:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{obj.titel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{obj.plaats}, {obj.provincie} · <span className="capitalize">{obj.type}</span></p>
                      <p className="text-xs mt-1 truncate">
                        <span className="text-foreground font-mono-data">{formatCurrency(obj.vraagprijs)}</span>
                        {rendement && <span className="text-success ml-2 font-mono-data">{rendement}%</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ObjectStatusBadge status={obj.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </div>
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
                    <th className="text-left px-5 py-3 field-label hidden lg:table-cell">Type</th>
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
                        <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground capitalize">{obj.type}</td>
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
