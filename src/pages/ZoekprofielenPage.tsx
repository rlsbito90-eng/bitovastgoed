import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, ASSET_CLASS_LABELS } from '@/data/mock-data';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ZoekprofielFormDialog from '@/components/forms/ZoekprofielFormDialog';
import type { Zoekprofiel } from '@/data/mock-data';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { PropertyTypeBadges, SubtypeBadges, DealtypeBadges } from '@/components/TaxonomieBadges';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';

export default function ZoekprofielenPage() {
  const { zoekprofielen, getRelatieById, deleteZoekprofiel, contactpersonen } = useDataStore();
  const { propertyTypes, propertySubtypes, dealTypes, subtypesForType } = usePropertyTaxonomie();
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [subtypeFilter, setSubtypeFilter] = useState<string>('');
  const [dealtypeFilter, setDealtypeFilter] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Zoekprofiel | null>(null);

  const filtered = zoekprofielen.filter(z => {
    const rel = getRelatieById(z.relatieId);
    const matchZoek = !zoek
      || z.naam.toLowerCase().includes(zoek.toLowerCase())
      || getRelatieNaamCompact(rel, contactpersonen).toLowerCase().includes(zoek.toLowerCase());
    const ptIds = (z as any).propertyTypeIds as string[] | undefined ?? [];
    const psIds = (z as any).propertySubtypeIds as string[] | undefined ?? [];
    const dtIds = (z as any).dealTypeIds as string[] | undefined ?? [];
    const matchType = !typeFilter || ptIds.includes(typeFilter);
    const matchSub  = !subtypeFilter || psIds.includes(subtypeFilter);
    const matchDeal = !dealtypeFilter || dtIds.includes(dealtypeFilter);
    return matchZoek && matchType && matchSub && matchDeal;
  });

  const beschikbareSubs = typeFilter ? subtypesForType(typeFilter) : propertySubtypes;

  const openNieuw = () => { setEditing(null); setFormOpen(true); };
  const openBewerk = (z: Zoekprofiel) => { setEditing(z); setFormOpen(true); };
  const handleDelete = async (id: string) => {
    try {
      await deleteZoekprofiel(id);
      toast.success('Zoekprofiel verwijderd');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Zoekprofielen"
        subtitle={`${zoekprofielen.length} zoekprofielen`}
        actions={
          <button onClick={openNieuw} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Nieuw zoekprofiel
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op profiel of relatie..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <select
            className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setSubtypeFilter(''); }}
          >
            <option value="">Alle typen vastgoed</option>
            {propertyTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
            value={subtypeFilter}
            onChange={e => setSubtypeFilter(e.target.value)}
            disabled={beschikbareSubs.length === 0}
          >
            <option value="">Alle subcategorieën</option>
            {beschikbareSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
            value={dealtypeFilter}
            onChange={e => setDealtypeFilter(e.target.value)}
          >
            <option value="">Alle dealtypes</option>
            {dealTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {zoekprofielen.length === 0
              ? 'Nog geen zoekprofielen aangemaakt. Klik op "Nieuw zoekprofiel" om er een toe te voegen.'
              : 'Geen zoekprofielen gevonden voor deze zoekopdracht.'}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {filtered.map(zp => {
          const rel = getRelatieById(zp.relatieId);
          const isActief = zp.status === 'actief';
          return (
            <div key={zp.id} className="section-card p-5 flex flex-col gap-3.5 min-w-0">
              {/* Header: titel mag wrappen, status-badge blijft compact rechts */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  {/* break-words ipv truncate — zo wrapt lange titel netjes */}
                  <p className="text-sm font-semibold text-foreground break-words leading-snug">
                    {zp.naam}
                  </p>
                  {rel && (
                    <Link
                      to={`/relaties/${zp.relatieId}`}
                      className="text-xs text-accent hover:underline break-words inline-block max-w-full mt-0.5"
                    >
                      {getRelatieNaamCompact(rel, contactpersonen)}
                    </Link>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full ${
                    isActief
                      ? 'bg-success/10 text-success border-success/25'
                      : 'bg-muted/60 text-muted-foreground border-border'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isActief ? 'bg-success' : 'bg-muted-foreground/50'}`} />
                    {zp.status}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono-data">
                    P{zp.prioriteit}
                  </span>
                </div>
              </div>

              {/* Nieuwe taxonomie: type + subcategorie + dealtype */}
              <div className="space-y-1.5">
                <PropertyTypeBadges
                  ids={(zp as any).propertyTypeIds}
                  fallbackAssetClasses={zp.typeVastgoed}
                  max={3}
                  showEmpty={false}
                />
                <SubtypeBadges ids={(zp as any).propertySubtypeIds} max={3} showEmpty={false} />
                <DealtypeBadges ids={(zp as any).dealTypeIds} max={3} showEmpty={false} />
              </div>

              {/* Details */}
              <div className="text-xs space-y-1.5 hairline pt-3">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Regio</span>
                  <span className="text-foreground text-right break-words min-w-0">{zp.regio.join(', ') || '—'}</span>
                </div>
                {zp.prijsMax && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Budget</span>
                    <span className="text-foreground font-mono-data text-right">{formatCurrency(zp.prijsMin)} – {formatCurrency(zp.prijsMax)}</span>
                  </div>
                )}
                {zp.oppervlakteMin && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Min. opp.</span>
                    <span className="text-foreground font-mono-data text-right">{zp.oppervlakteMin.toLocaleString('nl-NL')} m²</span>
                  </div>
                )}
                {zp.rendementseis && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Rendement</span>
                    <span className="text-foreground font-mono-data text-right">≥ {zp.rendementseis}%</span>
                  </div>
                )}
                {zp.energielabelMin && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Energielabel min.</span>
                    <span className="text-foreground font-semibold text-right">{zp.energielabelMin}</span>
                  </div>
                )}
                {zp.waltMin != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">WALT min.</span>
                    <span className="text-foreground font-mono-data text-right">{zp.waltMin} jr</span>
                  </div>
                )}
              </div>

              {(zp.ontwikkelPotentie || zp.transformatiePotentie) && (
                <div className="flex flex-wrap gap-1.5">
                  {zp.ontwikkelPotentie && <Badge variant="outline" className="text-[11px]">Ontwikkeling</Badge>}
                  {zp.transformatiePotentie && <Badge variant="outline" className="text-[11px]">Transformatie</Badge>}
                </div>
              )}

              <div className="flex items-center gap-1 hairline pt-3 mt-auto">
                <button onClick={() => openBewerk(zp)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                  <Pencil className="h-3 w-3" /> Bewerken
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                      <Trash2 className="h-3 w-3" /> Verwijder
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zoekprofiel verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>Weet je zeker dat je {zp.naam} wilt verwijderen?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(zp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
      </div>

      <ZoekprofielFormDialog open={formOpen} onOpenChange={setFormOpen} zoekprofiel={editing} />
    </div>
  );
}
