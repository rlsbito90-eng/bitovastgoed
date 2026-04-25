import { useMemo, useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  formatCurrency,
  formatCurrencyCompact,
  vindVergelijkbareReferenties,
  type ReferentieObject,
} from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Link2Off, BarChart3, Search, TrendingUp, Info, Sparkles, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import ReferentieObjectFormDialog from '@/components/forms/ReferentieObjectFormDialog';

interface Props {
  dealId: string;
  /** Oppervlakte (m²) van het object van deze deal — gebruikt voor marktwaarde-indicatie. */
  objectM2?: number;
  /** Object voor auto-matching van referenties. */
  objectVoorMatching?: {
    type?: any;
    plaats?: string;
    bouwjaar?: number;
    oppervlakte?: number;
  };
}

function mediaan(getallen: number[]): number | undefined {
  if (getallen.length === 0) return undefined;
  const sorted = [...getallen].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function DealReferentieAnalyseSectie({ dealId, objectM2, objectVoorMatching }: Props) {
  const store = useDataStore();
  const gekoppeld = store.getReferentiesVoorDeal(dealId);
  const koppelingen = store.dealReferenties.filter(x => x.dealId === dealId);

  const [koppelOpen, setKoppelOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [suggestiesUitgeklapt, setSuggestiesUitgeklapt] = useState(false);

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
      perM2,
      gemiddeld: gem(perM2),
      mediaan: mediaan(perM2),
      min: perM2.length ? Math.min(...perM2) : undefined,
      max: perM2.length ? Math.max(...perM2) : undefined,
      huurGemiddeld: gem(huurPerM2Jaar),
      huurMediaan: mediaan(huurPerM2Jaar),
    };
  }, [gekoppeld]);

  // MARKTWAARDE-INDICATIE
  // Mediaan-first: we tonen de mediaan als hoofdgetal, ondergrens en
  // bovengrens als context. De mediaan is robuuster bij kleine datasets en
  // onbeïnvloed door uitschieters (zeg een penthouse onder kleine objecten).
  const marktwaarde = useMemo(() => {
    if (!objectM2 || objectM2 <= 0) return null;
    if (stats.perM2.length < 2) return null;
    if (stats.min == null || stats.mediaan == null || stats.max == null) return null;
    return {
      onder: stats.min * objectM2,
      mediaan: stats.mediaan * objectM2,
      boven: stats.max * objectM2,
    };
  }, [objectM2, stats]);

  // AUTO-SUGGESTIES — vergelijkbare referenties die nog niet gekoppeld zijn
  const suggesties = useMemo(() => {
    if (!objectVoorMatching?.type) return [];
    const gekoppeldIds = new Set(gekoppeld.map(r => r.id));
    return vindVergelijkbareReferenties(
      objectVoorMatching,
      store.referentieObjecten,
      gekoppeldIds,
      50, // drempel
    );
  }, [objectVoorMatching, store.referentieObjecten, gekoppeld]);

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
      {/* Header — gebruikt row-with-action pattern voor mobile */}
      <div className="row-with-action">
        <h2 className="section-title flex items-center gap-2 row-flex">
          <BarChart3 className="h-4 w-4 text-accent shrink-0" />
          <span>Referentieanalyse</span>
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setKoppelOpen(true)}
          className="gap-1.5 row-action"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Referentieobject koppelen</span>
          <span className="sm:hidden">Koppel</span>
        </Button>
      </div>

      {/* AUTO-SUGGESTIES — alleen tonen als er suggesties zijn */}
      {suggesties.length > 0 && (
        <div className="border border-accent/20 bg-accent/[0.04] rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setSuggestiesUitgeklapt(v => !v)}
            className="w-full row-with-action px-3 sm:px-4 py-2.5 hover:bg-accent/[0.06] transition-colors"
          >
            <div className="row-flex flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-xs font-medium text-foreground">
                {suggesties.length} voorgestelde referentie{suggesties.length === 1 ? '' : 's'}
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                op basis van type, plaats, bouwjaar en oppervlakte
              </span>
            </div>
            <span className="row-action text-[11px] text-accent">
              {suggestiesUitgeklapt ? 'Verberg' : 'Toon'}
            </span>
          </button>
          {suggestiesUitgeklapt && (
            <div className="px-3 sm:px-4 pb-3 space-y-1.5">
              {suggesties.slice(0, 5).map(({ referentie: r, matchScore, matchRedenen }) => (
                <div key={r.id} className="row-with-action p-2.5 bg-card rounded-md border border-border">
                  <div className="row-flex">
                    <div className="row-with-action mb-0.5">
                      <p className="row-flex text-sm font-medium text-foreground truncate">
                        {r.adres} <span className="text-muted-foreground font-normal">· {r.plaats}</span>
                      </p>
                      <span className={`row-action inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        matchScore >= 80 ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : matchScore >= 65 ? 'bg-accent/15 text-accent'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {matchScore}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {matchRedenen.slice(0, 2).join(' · ')}
                    </p>
                    <p className="text-[11px] text-foreground/70 font-mono-data mt-0.5">
                      {r.m2.toLocaleString('nl-NL')} m² · {formatCurrency(r.vraagprijs)}
                      {r.prijsPerM2 != null ? ` · ${formatCurrency(Math.round(r.prijsPerM2))}/m²` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="row-action h-7 px-2 text-accent hover:bg-accent/10"
                    onClick={() => handleKoppel(r)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Koppel
                  </Button>
                </div>
              ))}
              {suggesties.length > 5 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  +{suggesties.length - 5} meer · klik op "Referentieobject koppelen" voor alle
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* STATS — mobile-first stack op smal scherm */}
      {gekoppeld.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-muted/40 rounded-md min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gekoppeld</p>
            <p className="text-base font-semibold font-mono-data mt-0.5">{gekoppeld.length}</p>
          </div>
          <div className="p-2.5 sm:p-3 bg-muted/40 rounded-md min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Mediaan €/m²</p>
            <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
              {stats.mediaan != null ? formatCurrencyCompact(Math.round(stats.mediaan)) : '—'}
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-muted/40 rounded-md min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Gemiddeld €/m²</p>
            <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
              {stats.gemiddeld != null ? formatCurrencyCompact(Math.round(stats.gemiddeld)) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* HUUR-STATS — alleen tonen als er huur-data beschikbaar is */}
      {(stats.huurGemiddeld != null || stats.huurMediaan != null) && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-muted/40 rounded-md min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Mediane huur €/m²/jr</p>
            <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
              {stats.huurMediaan != null ? formatCurrencyCompact(Math.round(stats.huurMediaan)) : '—'}
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-muted/40 rounded-md min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Gem. huur €/m²/jr</p>
            <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
              {stats.huurGemiddeld != null ? formatCurrencyCompact(Math.round(stats.huurGemiddeld)) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* MARKTWAARDE-INDICATIE */}
      <div className="hairline pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent shrink-0" />
            <span>Marktwaarde-indicatie</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indicatieve marktwaarde op basis van mediaan €/m² × oppervlakte
          </p>
        </div>

        {!objectM2 || objectM2 <= 0 ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Vul de oppervlakte (m²) van het object in om een marktwaarde-indicatie te tonen.</span>
          </div>
        ) : marktwaarde == null ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Te weinig referentieobjecten voor een indicatie. Koppel minimaal 2 referenties met een prijs per m².</span>
          </div>
        ) : (
          <>
            {/* Mediaan PROMINENT (groot) — ondergrens/bovengrens als context */}
            <div className="p-4 rounded-md border-2 border-accent/40 bg-accent/[0.06]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Indicatieve marktwaarde (mediaan)</p>
              <p className="text-2xl sm:text-3xl font-semibold font-mono-data text-accent mt-1 break-all">
                {formatCurrency(Math.round(marktwaarde.mediaan))}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Op basis van {stats.perM2.length} referentie{stats.perM2.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Onder/boven als kleinere context-tegels onder de hoofdindicatie */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-3 rounded-md border border-border min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ondergrens</p>
                <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
                  {formatCurrencyCompact(Math.round(marktwaarde.onder))}
                </p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-md border border-border min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bovengrens</p>
                <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
                  {formatCurrencyCompact(Math.round(marktwaarde.boven))}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground/70">Onderbouwing</p>
              <p>
                Mediaan {stats.mediaan != null ? formatCurrency(Math.round(stats.mediaan)) : '—'}/m² ·
                {' '}gemiddeld {stats.gemiddeld != null ? formatCurrency(Math.round(stats.gemiddeld)) : '—'}/m² ·
                {' '}toegepast op {objectM2.toLocaleString('nl-NL')} m².
              </p>
              <p className="italic">
                Indicatief — gebruikt mediaan als hoofdwaarde en min/max als onder-/bovengrens. Geen vervanging voor een taxatie.
              </p>
            </div>
          </>
        )}
      </div>

      {/* GEKOPPELDE REFERENTIES — lijst */}
      {gekoppeld.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nog geen referentieobjecten gekoppeld. Koppel referenties om een prijsanalyse op te bouwen.
        </p>
      ) : (
        <div className="hairline pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Gekoppelde referenties
          </p>
          {gekoppeld.map(r => {
            const huurPerM2Jaar =
              r.huurprijsPerJaar != null && r.m2 > 0 ? r.huurprijsPerJaar / r.m2 : undefined;
            return (
              <div key={r.id} className="row-with-action p-3 rounded-md border border-border hover:border-accent/40 transition-colors">
                <div className="row-flex">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.adres} <span className="text-muted-foreground font-normal">· {r.plaats}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ASSET_CLASS_LABELS[r.assetClass]} · bouwjaar {r.bouwjaar}
                    {r.energielabel ? ` · label ${r.energielabel}` : ''}
                    {r.huurstatus ? ` · ${r.huurstatus.replace('_', ' ')}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono-data text-foreground/80">
                    <span>{r.m2.toLocaleString('nl-NL')} m²</span>
                    <span>{formatCurrency(r.vraagprijs)}</span>
                    <span className="text-accent">
                      {r.prijsPerM2 != null ? `${formatCurrency(Math.round(r.prijsPerM2))}/m²` : '—/m²'}
                    </span>
                    {r.huurprijsPerJaar != null && (
                      <span className="text-muted-foreground w-full sm:w-auto">
                        huur {formatCurrencyCompact(r.huurprijsPerJaar)}/jr
                        {huurPerM2Jaar != null ? ` · ${formatCurrency(Math.round(huurPerM2Jaar))}/m²/jr` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="row-action text-muted-foreground hover:text-destructive"
                  onClick={() => handleOntkoppel(r.id)}
                  aria-label="Ontkoppelen"
                >
                  <Link2Off className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* KOPPEL DIALOG */}
      <Dialog open={koppelOpen} onOpenChange={setKoppelOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
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

          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5 min-h-0">
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
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
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

      <ReferentieObjectFormDialog
        open={nieuwOpen}
        onOpenChange={setNieuwOpen}
        onSaved={handleNieuwAangemaakt}
      />
    </section>
  );
}
