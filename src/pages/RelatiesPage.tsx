import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatDate } from '@/data/mock-data';
import { LeadStatusBadge } from '@/components/StatusBadges';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronRight, Upload } from 'lucide-react';
import type { LeadStatus, PartijType } from '@/data/mock-data';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import BulkRelatieImportDialog from '@/components/forms/BulkRelatieImportDialog';
import PageHeader from '@/components/PageHeader';
import { PropertyTypeBadges, SubtypeBadges, DealtypeBadges } from '@/components/TaxonomieBadges';

export default function RelatiesPage() {
  const { relaties } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<PartijType | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const filtered = relaties.filter(r => {
    const matchZoek = !zoek || r.bedrijfsnaam.toLowerCase().includes(zoek.toLowerCase()) || r.contactpersoon.toLowerCase().includes(zoek.toLowerCase());
    const matchStatus = !statusFilter || r.leadStatus === statusFilter;
    const matchType = !typeFilter || r.type === typeFilter;
    return matchZoek && matchStatus && matchType;
  });

  return (
    <div className="page-shell">
      <PageHeader
        title="Relaties"
        subtitle={`${relaties.length} contacten`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-border text-foreground rounded-md hover:bg-muted transition-colors">
              <Upload className="h-4 w-4" /> Bulk importeren
            </button>
            <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
              <Plus className="h-4 w-4" /> Nieuwe relatie
            </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam of bedrijf..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <div className="flex gap-2.5">
          <select className="flex-1 sm:flex-none h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatus | '')}>
            <option value="">Alle statussen</option>
            <option value="koud">Koud</option>
            <option value="lauw">Lauw</option>
            <option value="warm">Warm</option>
            <option value="actief">Actief</option>
          </select>
          <select className="flex-1 sm:flex-none h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground" value={typeFilter} onChange={e => setTypeFilter(e.target.value as PartijType | '')}>
            <option value="">Alle typen</option>
            <option value="belegger">Belegger</option>
            <option value="ontwikkelaar">Ontwikkelaar</option>
            <option value="eigenaar">Eigenaar</option>
            <option value="makelaar">Makelaar</option>
            <option value="partner">Partner</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Geen relaties gevonden.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(r => (
              <Link key={r.id} to={`/relaties/${r.id}`} className="section-card block p-4 active:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{r.bedrijfsnaam || '(geen naam)'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.contactpersoon || '—'} · <span className="capitalize">{r.type}</span></p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <PropertyTypeBadges
                        ids={r.propertyTypeIds}
                        fallbackAssetClasses={r.assetClasses}
                        max={2}
                        variant="compact"
                        showEmpty={false}
                      />
                      <SubtypeBadges ids={r.propertySubtypeIds} max={2} variant="compact" showEmpty={false} />
                      <DealtypeBadges ids={r.dealTypeIds} max={2} variant="compact" showEmpty={false} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {r.regio.length > 0 ? r.regio.join(', ') : '—'} · laatst {formatDate(r.laatsteContact)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <LeadStatusBadge status={r.leadStatus} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block section-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 field-label">Bedrijf</th>
                    <th className="text-left px-5 py-3 field-label">Type</th>
                    <th className="text-left px-5 py-3 field-label hidden lg:table-cell">Vastgoedvoorkeur</th>
                    <th className="text-left px-5 py-3 field-label hidden lg:table-cell">Laatste contact</th>
                    <th className="text-left px-5 py-3 field-label">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filtered.map(r => (
                    <tr key={r.id} className="group hover:bg-muted/40 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <Link to={`/relaties/${r.id}`} className="block">
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">{r.bedrijfsnaam || '(geen naam)'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.contactpersoon || '—'}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground capitalize">{r.type}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          <PropertyTypeBadges
                            ids={r.propertyTypeIds}
                            fallbackAssetClasses={r.assetClasses}
                            max={2}
                            variant="compact"
                            showEmpty={false}
                          />
                          <SubtypeBadges ids={r.propertySubtypeIds} max={1} variant="compact" showEmpty={false} />
                          <DealtypeBadges ids={r.dealTypeIds} max={1} variant="compact" showEmpty={false} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground tabular-nums">{formatDate(r.laatsteContact)}</td>
                      <td className="px-5 py-3.5"><LeadStatusBadge status={r.leadStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <RelatieFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <BulkRelatieImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}
