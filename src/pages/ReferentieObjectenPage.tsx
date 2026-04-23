import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  DEAL_FASE_LABELS,
  REFERENTIE_KWALITEIT_LABELS,
  berekenReferentieKwaliteit,
  formatCurrency,
  type AssetClass,
  type ReferentieObject,
} from '@/data/mock-data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Search, Pencil, Trash2, Link2, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ReferentieObjectFormDialog from '@/components/forms/ReferentieObjectFormDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type Tone = 'emerald' | 'amber' | 'crimson' | 'neutral';
const KWALITEIT_TONE: Record<string, Tone> = {
  zeer_sterk: 'emerald',
  goed: 'emerald',
  bruikbaar: 'amber',
  zwak: 'crimson',
};
const TONE_STYLES: Record<Tone, string> = {
  emerald: 'bg-success/10 text-success border-success/25',
  amber: 'bg-warning/10 text-warning border-warning/25',
  crimson: 'bg-destructive/10 text-destructive border-destructive/25',
  neutral: 'bg-muted/60 text-muted-foreground border-border',
};

function KwaliteitChip({ obj }: { obj: ReferentieObject }) {
  const k = berekenReferentieKwaliteit(obj);
  const tone = KWALITEIT_TONE[k.kwaliteit];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${TONE_STYLES[tone]}`}>
      <span className="font-mono-data">{k.qualityScore}</span>
      <span className="opacity-80">·</span>
      {REFERENTIE_KWALITEIT_LABELS[k.kwaliteit]}
    </span>
  );
}

export default function ReferentieObjectenPage() {
  const store = useDataStore();
  const [zoek, setZoek] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetClass | ''>('');
  const [plaatsFilter, setPlaatsFilter] = useState('');
  const [postcodeFilter, setPostcodeFilter] = useState('');
  const [kwaliteitFilter, setKwaliteitFilter] = useState<'' | 'zeer_sterk' | 'goed' | 'bruikbaar' | 'zwak'>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editObj, setEditObj] = useState<ReferentieObject | undefined>(undefined);

  // Map: referentieObjectId → array van gekoppelde deals (incl. object voor labelen)
  const dealsPerReferentie = useMemo(() => {
    const map = new Map<string, Array<{ dealId: string; label: string; fase: string }>>();
    for (const koppeling of store.dealReferenties) {
      const deal = store.deals.find(d => d.id === koppeling.dealId);
      if (!deal) continue;
      const obj = store.objecten.find(o => o.id === deal.objectId);
      const label = obj?.titel ?? obj?.adres ?? 'Onbekende deal';
      const arr = map.get(koppeling.referentieObjectId) ?? [];
      arr.push({ dealId: deal.id, label, fase: DEAL_FASE_LABELS[deal.fase] ?? deal.fase });
      map.set(koppeling.referentieObjectId, arr);
    }
    return map;
  }, [store.dealReferenties, store.deals, store.objecten]);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return store.referentieObjecten.filter(r => {
      if (assetFilter && r.assetClass !== assetFilter) return false;
      if (plaatsFilter && !r.plaats.toLowerCase().includes(plaatsFilter.toLowerCase())) return false;
      if (postcodeFilter && !r.postcode.toLowerCase().includes(postcodeFilter.toLowerCase())) return false;
      if (kwaliteitFilter) {
        const k = berekenReferentieKwaliteit(r);
        if (k.kwaliteit !== kwaliteitFilter) return false;
      }
      if (q) {
        const hay = `${r.adres} ${r.plaats} ${r.postcode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [store.referentieObjecten, zoek, assetFilter, plaatsFilter, postcodeFilter, kwaliteitFilter]);

  const handleNieuw = () => {
    setEditObj(undefined);
    setFormOpen(true);
  };

  const handleEdit = (obj: ReferentieObject) => {
    setEditObj(obj);
    setFormOpen(true);
  };

  const handleDelete = async (obj: ReferentieObject) => {
    try {
      await store.deleteReferentieObject(obj.id);
      toast.success('Referentieobject verwijderd');
    } catch (e: any) {
      toast.error(e?.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Referentieobjecten"
        subtitle={`${store.referentieObjecten.length} referenties beschikbaar`}
        actions={
          <Button onClick={handleNieuw} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nieuw referentieobject
          </Button>
        }
      />

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op adres, plaats of postcode..."
            className="pl-9 h-10"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
          />
        </div>
        <select
          className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
          value={assetFilter}
          onChange={e => setAssetFilter(e.target.value as AssetClass | '')}
        >
          <option value="">Alle asset classes</option>
          {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map(ac => (
            <option key={ac} value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
          ))}
        </select>
        <Input
          placeholder="Plaats"
          className="h-10 w-full sm:w-40"
          value={plaatsFilter}
          onChange={e => setPlaatsFilter(e.target.value)}
        />
        <Input
          placeholder="Postcode"
          className="h-10 w-full sm:w-32"
          value={postcodeFilter}
          onChange={e => setPostcodeFilter(e.target.value)}
        />
        <select
          className="h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground"
          value={kwaliteitFilter}
          onChange={e => setKwaliteitFilter(e.target.value as any)}
        >
          <option value="">Alle kwaliteiten</option>
          <option value="zeer_sterk">Zeer sterk (90+)</option>
          <option value="goed">Goed (75–89)</option>
          <option value="bruikbaar">Bruikbaar (60–74)</option>
          <option value="zwak">Zwak (&lt;60)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="section-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {store.referentieObjecten.length === 0
              ? 'Nog geen referentieobjecten. Voeg er een toe om je dealanalyses te onderbouwen.'
              : 'Geen referentieobjecten gevonden met deze filters.'}
          </p>
        </div>
      ) : (
        <div className="section-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adres</TableHead>
                <TableHead>Plaats</TableHead>
                <TableHead>Asset class</TableHead>
                <TableHead className="text-right">m²</TableHead>
                <TableHead className="text-right">Vraagprijs</TableHead>
                <TableHead className="text-right">€ / m²</TableHead>
                <TableHead className="text-right">Bouwjaar</TableHead>
                <TableHead>Energielabel</TableHead>
                <TableHead>Kwaliteit</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => handleEdit(r)}>
                  <TableCell className="font-medium text-foreground">{r.adres}</TableCell>
                  <TableCell className="text-muted-foreground">{r.plaats}</TableCell>
                  <TableCell className="text-muted-foreground">{ASSET_CLASS_LABELS[r.assetClass]}</TableCell>
                  <TableCell className="text-right font-mono-data">{r.m2.toLocaleString('nl-NL')}</TableCell>
                  <TableCell className="text-right font-mono-data">{formatCurrency(r.vraagprijs)}</TableCell>
                  <TableCell className="text-right font-mono-data">
                    {r.prijsPerM2 != null ? formatCurrency(Math.round(r.prijsPerM2)) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono-data">{r.bouwjaar}</TableCell>
                  <TableCell className="text-muted-foreground">{r.energielabel ?? '—'}</TableCell>
                  <TableCell><KwaliteitChip obj={r} /></TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(r)} aria-label="Bewerken">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Verwijderen">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Referentieobject verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {r.adres}, {r.plaats}. Deze actie kan niet worden teruggedraaid.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(r)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Verwijderen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ReferentieObjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        referentie={editObj}
      />
    </div>
  );
}
