import { useMemo, useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  formatCurrency,
  type ReferentieObject,
} from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Link2Off, BarChart3, Search } from 'lucide-react';
import { toast } from 'sonner';
import ReferentieObjectFormDialog from '@/components/forms/ReferentieObjectFormDialog';

interface Props {
  dealId: string;
}

function mediaan(getallen: number[]): number | undefined {
  if (getallen.length === 0) return undefined;
  const sorted = [...getallen].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function DealReferentieAnalyseSectie({ dealId }: Props) {
  const store = useDataStore();
  const gekoppeld = store.getReferentiesVoorDeal(dealId);
  const koppelingen = store.dealReferenties.filter(x => x.dealId === dealId);

  const [koppelOpen, setKoppelOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const [nieuwOpen, setNieuwOpen] = useState(false);

  const stats = useMemo(() => {
    const perM2 = gekoppeld
      .map(r => r.prijsPerM2)
      .filter((v): v is number => v != null && !Number.isNaN(v));
    const huurPerM2Jaar = gekoppeld
      .map(r => (r.huurprijsPerJaar != null && r.m2 > 0 ? r.huurprijsPerJaar / r.m2 : undefined))
      .filter((v): v is number => v != null && !Number.isNaN(v));

    const gem = (arr: number[]) =>
      arr.length === 0 ? undefined : arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      gemiddeld: gem(perM2),
      mediaan: mediaan(perM2),
      huurGemiddeld: gem(huurPerM2Jaar),
      huurMediaan: mediaan(huurPerM2Jaar),
    };
  }, [gekoppeld]);

  const beschikbaar = useMemo(() => {
    const gekoppeldIds = new Set(gekoppeld.map(r => r.id));
    const q = zoek.trim().toLowerCase();
    return store.referentieObjecten
      .filter(r => !gekoppeldIds.has(r.id))
      .filter(r => !q || `${r.adres} ${r.plaats} ${r.postcode}`.toLowerCase().includes(q));
  }, [store.referentieObjecten, gekoppeld, zoek]);

  const handleKoppel = async (ref: ReferentieObject) => {
    try {
      await store.koppelReferentieAanDeal(dealId, ref.id);
      toast.success('Referentie gekoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Koppelen mislukt');
    }
  };

  const handleOntkoppel = async (refId: string) => {
    const koppeling = koppelingen.find(k => k.referentieObjectId === refId);
    if (!koppeling) return;
    try {
      await store.ontkoppelReferentieVanDeal(koppeling.id);
      toast.success('Referentie ontkoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Ontkoppelen mislukt');
    }
  };

  // Na succesvol aanmaken via het inline form: direct koppelen aan deze deal.
  const handleNieuwAangemaakt = async (saved: ReferentieObject) => {
    try {
      await store.koppelReferentieAanDeal(dealId, saved.id);
      toast.success('Nieuw referentieobject aangemaakt en gekoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Koppelen mislukt');
    }
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="section-title flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" /> Referentieanalyse
        </h2>
        <Button size="sm" variant="outline" onClick={() => setKoppelOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Referentieobject koppelen
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-muted/40 rounded-md">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gekoppeld</p>
          <p className="text-base font-semibold font-mono-data mt-0.5">{gekoppeld.length}</p>
        </div>
        <div className="p-3 bg-muted/40 rounded-md">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gemiddeld € / m²</p>
          <p className="text-base font-semibold font-mono-data mt-0.5">
            {stats.gemiddeld != null ? formatCurrency(Math.round(stats.gemiddeld)) : '—'}
          </p>
        </div>
        <div className="p-3 bg-muted/40 rounded-md">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mediaan € / m²</p>
          <p className="text-base font-semibold font-mono-data mt-0.5">
            {stats.mediaan != null ? formatCurrency(Math.round(stats.mediaan)) : '—'}
          </p>
        </div>
      </div>

      {/* LIJST */}
      {gekoppeld.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nog geen referentieobjecten gekoppeld. Koppel referenties om een prijsanalyse op te bouwen.
        </p>
      ) : (
        <div className="hairline pt-3 space-y-2">
          {gekoppeld.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border hover:border-accent/40 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {r.adres} <span className="text-muted-foreground font-normal">· {r.plaats}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ASSET_CLASS_LABELS[r.assetClass]} · bouwjaar {r.bouwjaar}
                  {r.energielabel ? ` · label ${r.energielabel}` : ''}
                </p>
                <div className="mt-1.5 flex items-center gap-4 text-xs font-mono-data text-foreground/80">
                  <span>{r.m2.toLocaleString('nl-NL')} m²</span>
                  <span>{formatCurrency(r.vraagprijs)}</span>
                  <span className="text-accent">
                    {r.prijsPerM2 != null ? `${formatCurrency(Math.round(r.prijsPerM2))} / m²` : '— / m²'}
                  </span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleOntkoppel(r.id)}
                aria-label="Ontkoppelen"
              >
                <Link2Off className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* KOPPEL DIALOG */}
      <Dialog open={koppelOpen} onOpenChange={setKoppelOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Referentieobject koppelen</DialogTitle>
            <DialogDescription>
              Kies een bestaand referentieobject of maak direct een nieuwe aan.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op adres, plaats of postcode..."
                className="pl-9"
                value={zoek}
                onChange={e => setZoek(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setNieuwOpen(true)} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Nieuw
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
            {beschikbaar.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {store.referentieObjecten.length === 0
                  ? 'Er zijn nog geen referentieobjecten. Klik op "Nieuw" om er direct één aan te maken.'
                  : 'Geen beschikbare referentieobjecten. Maak een nieuwe aan of wijzig je zoekopdracht.'}
              </p>
            ) : (
              beschikbaar.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleKoppel(r)}
                  className="w-full text-left p-3 rounded-md border border-border hover:border-accent/40 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.adres} <span className="text-muted-foreground font-normal">· {r.plaats}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ASSET_CLASS_LABELS[r.assetClass]} · {r.m2.toLocaleString('nl-NL')} m² · {formatCurrency(r.vraagprijs)}
                    {r.prijsPerM2 != null ? ` · ${formatCurrency(Math.round(r.prijsPerM2))}/m²` : ''}
                  </p>
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setKoppelOpen(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INLINE: NIEUW REFERENTIEOBJECT */}
      <ReferentieObjectFormDialog
        open={nieuwOpen}
        onOpenChange={setNieuwOpen}
        onSaved={handleNieuwAangemaakt}
      />
    </section>
  );
}
