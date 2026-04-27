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
import { Plus, Search, Pencil, Trash2, Link2, ExternalLink, ArrowUpDown, X } from 'lucide-react';
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
  const [bouwjaarMin, setBouwjaarMin] = useState('');
  const [bouwjaarMax, setBouwjaarMax] = useState('');
  const [m2Min, setM2Min] = useState('');
  const [m2Max, setM2Max] = useState('');
  const [prijsMin, setPrijsMin] = useState('');
  const [prijsMax, setPrijsMax] = useState('');
  const [energielabelFilter, setEnergielabelFilter] = useState('');
  const [huurstatusFilter, setHuurstatusFilter] = useState('');
  type SortKey =
    | 'recent' | 'oudst'
    | 'adres_az' | 'adres_za'
    | 'plaats_az' | 'plaats_za'
    | 'postcode_az' | 'postcode_za'
    | 'm2_asc' | 'm2_desc'
    | 'vraagprijs_asc' | 'vraagprijs_desc'
    | 'prijs_per_m2_asc' | 'prijs_per_m2_desc'
    | 'huur_asc' | 'huur_desc'
    | 'bouwjaar_asc' | 'bouwjaar_desc'
    | 'kwaliteit_desc' | 'kwaliteit_asc';
  const [sortKey, setSortKey] = useState<SortKey>('recent');
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
        <>
          {/* Mobile cards (md en kleiner) */}
          <div className="md:hidden space-y-2">
            {filtered.map(r => {
              const gekoppeldeDeals = dealsPerReferentie.get(r.id) ?? [];
              const huurPerM2Jaar =
                r.huurprijsPerJaar != null && r.m2 > 0 ? r.huurprijsPerJaar / r.m2 : undefined;
              return (
                <div
                  key={r.id}
                  onClick={() => handleEdit(r)}
                  className="section-card p-4 active:bg-muted/40 transition-colors cursor-pointer min-w-0"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground break-words leading-snug">{r.adres}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">
                        {r.postcode} {r.plaats} · {ASSET_CLASS_LABELS[r.assetClass]}
                      </p>
                    </div>
                    <div className="shrink-0"><KwaliteitChip obj={r} /></div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">m²</dt>
                      <dd className="font-mono-data text-foreground truncate">{r.m2.toLocaleString('nl-NL')}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Vraagprijs</dt>
                      <dd className="font-mono-data text-foreground truncate">{formatCurrency(r.vraagprijs)}</dd>
                    </div>
                    {r.prijsPerM2 != null && (
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">€ / m²</dt>
                        <dd className="font-mono-data text-foreground truncate">{formatCurrency(Math.round(r.prijsPerM2))}</dd>
                      </div>
                    )}
                    {r.huurprijsPerJaar != null && (
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Huur/jaar</dt>
                        <dd className="font-mono-data text-foreground truncate">{formatCurrency(r.huurprijsPerJaar)}</dd>
                      </div>
                    )}
                    {huurPerM2Jaar != null && (
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Huur €/m²/jr</dt>
                        <dd className="font-mono-data text-foreground truncate">{formatCurrency(Math.round(huurPerM2Jaar))}</dd>
                      </div>
                    )}
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Bouwjaar</dt>
                      <dd className="font-mono-data text-foreground">{r.bouwjaar}</dd>
                    </div>
                    {r.energielabel && (
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Energielabel</dt>
                        <dd className="text-foreground">{r.energielabel}</dd>
                      </div>
                    )}
                    {r.huurstatus && (
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Huurstatus</dt>
                        <dd className="text-foreground capitalize">{r.huurstatus.replace('_', ' ')}</dd>
                      </div>
                    )}
                  </dl>

                  <div
                    className="mt-3 pt-3 border-t border-border/70 flex items-center justify-between gap-2"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-xs text-muted-foreground">
                      {gekoppeldeDeals.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <Link2 className="h-3.5 w-3.5 text-accent" />
                          {gekoppeldeDeals.length} gekoppelde deal{gekoppeldeDeals.length === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span>Geen gekoppelde deals</span>
                      )}
                    </div>
                    <div className="inline-flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(r)} aria-label="Bewerken">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Verwijderen">
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
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop tabel — horizontaal scrollbaar binnen de card */}
          <div className="hidden md:block section-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adres</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Plaats</TableHead>
                    <TableHead>Asset class</TableHead>
                    <TableHead className="text-right">m²</TableHead>
                    <TableHead className="text-right">Vraagprijs</TableHead>
                    <TableHead className="text-right">€ / m²</TableHead>
                    <TableHead className="text-right">Huur / jaar</TableHead>
                    <TableHead className="text-right">Huur €/m²/jr</TableHead>
                    <TableHead>Huurstatus</TableHead>
                    <TableHead className="text-right">Bouwjaar</TableHead>
                    <TableHead>Energielabel</TableHead>
                    <TableHead>Kwaliteit</TableHead>
                    <TableHead className="text-center">In deals</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const gekoppeldeDeals = dealsPerReferentie.get(r.id) ?? [];
                    const huurPerM2Jaar =
                      r.huurprijsPerJaar != null && r.m2 > 0 ? r.huurprijsPerJaar / r.m2 : undefined;
                    return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => handleEdit(r)}>
                      <TableCell className="font-medium text-foreground">{r.adres}</TableCell>
                      <TableCell className="text-muted-foreground font-mono-data">{r.postcode}</TableCell>
                      <TableCell className="text-muted-foreground">{r.plaats}</TableCell>
                      <TableCell className="text-muted-foreground">{ASSET_CLASS_LABELS[r.assetClass]}</TableCell>
                      <TableCell className="text-right font-mono-data">{r.m2.toLocaleString('nl-NL')}</TableCell>
                      <TableCell className="text-right font-mono-data">{formatCurrency(r.vraagprijs)}</TableCell>
                      <TableCell className="text-right font-mono-data">
                        {r.prijsPerM2 != null ? formatCurrency(Math.round(r.prijsPerM2)) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono-data">
                        {r.huurprijsPerJaar != null ? formatCurrency(r.huurprijsPerJaar) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono-data">
                        {huurPerM2Jaar != null ? formatCurrency(Math.round(huurPerM2Jaar)) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {r.huurstatus ? r.huurstatus.replace('_', ' ') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono-data">{r.bouwjaar}</TableCell>
                      <TableCell className="text-muted-foreground">{r.energielabel ?? '—'}</TableCell>
                      <TableCell><KwaliteitChip obj={r} /></TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        {gekoppeldeDeals.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 gap-1.5 text-xs font-medium"
                                aria-label={`${gekoppeldeDeals.length} gekoppelde deals tonen`}
                              >
                                <Link2 className="h-3.5 w-3.5 text-accent" />
                                <span className="font-mono-data">{gekoppeldeDeals.length}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="center" className="w-72 p-2">
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-1.5">
                                Gekoppeld aan {gekoppeldeDeals.length} deal{gekoppeldeDeals.length === 1 ? '' : 's'}
                              </p>
                              <div className="space-y-0.5">
                                {gekoppeldeDeals.map(d => (
                                  <Link
                                    key={d.dealId}
                                    to={`/deals/${d.dealId}`}
                                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                        {d.label}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{d.fase}</p>
                                    </div>
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                                  </Link>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <ReferentieObjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        referentie={editObj}
      />
    </div>
  );
}
