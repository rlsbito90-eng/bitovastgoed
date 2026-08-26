// V4 — conceptcontrole + formele productiewerkbank voor de Acquisitieselectie.
// Conceptdownload blijft mutatievrij; BR/BAT zijn afzonderlijke expliciete stappen.

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ModalActionBar } from '@/components/ui/modal-action-bar';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDown, Loader2 } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { buildBriefViewModel } from '@/lib/offMarket/brief';
import { sorteerPrintItems } from '@/lib/offMarket/acquisitie/printVolgorde';
import GecombineerdeBrievenPDF from '@/components/offmarket/GecombineerdeBrievenPDF';
import { isVolledigPostadres } from '@/lib/offMarket/acquisitie/readiness';
import { bouwCanoniekeRadarSelectieScope } from '@/lib/offMarket/acquisitie/bulkBrief';
import ProductiewerkbankBulkPane from './ProductiewerkbankBulkPane';
import ProductiewerkbankBulkPrintbatchActies from './ProductiewerkbankBulkPrintbatchActies';

interface Props {
  open: boolean;
  onClose: () => void;
  signalen: OffMarketSignaal[];
  toegevoegdOpPerSignaal: Map<string, string | null>;
  brieven: OffMarketBrief[];
}

interface Kandidaat {
  brief: OffMarketBrief;
  signaal: OffMarketSignaal;
  toegevoegdOp: string | null;
  printbaar: boolean;
  reden: string | null;
}

export default function GecombineerdeBrievenPdfDialog({
  open, onClose, signalen, toegevoegdOpPerSignaal, brieven,
}: Props) {
  const { data: acquisitieSelecties = [] } = useAcquisitieSelectie();
  const canoniekeScope = useMemo(
    () => bouwCanoniekeRadarSelectieScope(signalen, brieven),
    [signalen, brieven],
  );
  useEffect(() => {
    if (!open || canoniekeScope.nietGereed.length === 0) return;
    console.info('[Radar-productie] Niet-gereed binnen geselecteerde scope', {
      geselecteerdeSignaalIds: canoniekeScope.signaalIds,
      regels: canoniekeScope.nietGereed.map(({ signaalId, briefId, reden }) => ({
        signaalId,
        briefId,
        reden,
      })),
    });
  }, [open, canoniekeScope]);
  const signaalIndex = useMemo(() => {
    const m = new Map<string, OffMarketSignaal>();
    for (const s of signalen) m.set(s.id, s);
    return m;
  }, [signalen]);

  const kandidaten = useMemo<Kandidaat[]>(() => {
    const out: Kandidaat[] = [];
    for (const b of brieven) {
      if (b.archived_at) continue;
      if ((b.kanaal ?? 'post') !== 'post') continue;
      if (b.status !== 'concept') continue;
      const s = signaalIndex.get(b.signaal_id);
      if (!s) continue;
      const adresOk = isVolledigPostadres(b.verzendadres);
      const heeftNaam = !!((b.eigenaar_naam ?? '').trim() || (b.eigenaar_bedrijfsnaam ?? '').trim());
      const reden = !adresOk ? 'Verzendadres onvolledig.'
        : !heeftNaam ? 'Geen naam of bedrijfsnaam.'
        : null;
      out.push({
        brief: b,
        signaal: s,
        toegevoegdOp: toegevoegdOpPerSignaal.get(b.signaal_id) ?? null,
        printbaar: reden === null,
        reden,
      });
    }
    return out;
  }, [brieven, signaalIndex, toegevoegdOpPerSignaal]);

  const gesorteerd = useMemo(() => {
    const items = kandidaten.map(k => ({
      signaalId: k.signaal.id,
      toegevoegdOp: k.toegevoegdOp,
      geadresseerdeKey: k.brief.geadresseerde_key,
      geadresseerdeLabel: k.brief.eigenaar_bedrijfsnaam ?? k.brief.eigenaar_naam ?? null,
      campagneStap: k.brief.campagne_stap,
      payload: k,
    }));
    return sorteerPrintItems(items).map(i => i.payload as Kandidaat);
  }, [kandidaten]);

  // De formele scope is de unie van controleerbare concepten én reeds definitieve
  // postbrieven binnen de geselecteerde signalen. Daardoor verdwijnen definitieve
  // brieven in een gemengde selectie nooit uit de preflight/BAT-route.
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const scopeGeinitialiseerd = useRef(false);
  useEffect(() => {
    if (!open) {
      scopeGeinitialiseerd.current = false;
      setSelectie(new Set());
      return;
    }
    if (scopeGeinitialiseerd.current) return;

    const conceptIds = gesorteerd.filter(k => k.printbaar).map(k => k.brief.id);
    const definitieveIds = brieven
      .filter((b) => !b.archived_at
        && (b.kanaal ?? 'post') === 'post'
        && b.status === 'definitief'
        && signaalIndex.has(b.signaal_id))
      .map((b) => b.id);
    const formeleScope = [...new Set([...conceptIds, ...definitieveIds])];

    if (formeleScope.length === 0 && gesorteerd.length === 0) return;
    setSelectie(new Set(formeleScope));
    scopeGeinitialiseerd.current = true;
  }, [open, gesorteerd, brieven, signaalIndex]);

  function toggle(id: string) {
    setSelectie(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const teGenereren = useMemo(
    () => gesorteerd.filter(k => selectie.has(k.brief.id) && k.printbaar),
    [gesorteerd, selectie],
  );
  const overgeslagen = useMemo(() => gesorteerd.filter(k => !k.printbaar), [gesorteerd]);

  const productieScopeBrieven = useMemo(
    () => canoniekeScope.actievePostbrieven,
    [canoniekeScope],
  );
  const productieScopeSignaalIds = useMemo(
    () => new Set(canoniekeScope.signaalIds),
    [canoniekeScope],
  );
  const definitieveBriefIds = useMemo(
    () => productieScopeBrieven
      .filter((b) => (b.kanaal ?? 'post') === 'post' && b.status === 'definitief')
      .map((b) => b.id)
      .sort(),
    [productieScopeBrieven],
  );
  const definitieveSignalen = useMemo(
    () => new Set(productieScopeBrieven.filter((b) => b.status === 'definitief').map((b) => b.signaal_id)).size,
    [productieScopeBrieven],
  );

  const [bezig, setBezig] = useState(false);
  async function download() {
    if (teGenereren.length === 0) {
      toast.error('Geen controleerbare conceptbrieven geselecteerd.');
      return;
    }
    setBezig(true);
    try {
      const items = teGenereren.map((k) => {
        const b = k.brief;
        const vm = buildBriefViewModel({
          eigenaarNaam: b.eigenaar_naam ?? '',
          eigenaarBedrijfsnaam: b.eigenaar_bedrijfsnaam ?? '',
          verzendadres: b.verzendadres ?? '',
          objectomschrijving: b.objectomschrijving ?? '',
          onderwerp: b.onderwerp ?? '',
          brieftekst: b.brieftekst ?? '',
        });
        return { key: b.id, vm };
      });
      const blob = await pdf(
        <GecombineerdeBrievenPDF items={items} title="Bito Vastgoed — conceptbrieven" watermerk="CONCEPT" />,
      ).toBlob();
      const datum = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bito-vastgoed-CONCEPT-brieven-${datum}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Concept-PDF gegenereerd (${items.length} brieven).`);
    } catch (e: any) {
      console.error('Concept-PDF mislukt', e);
      toast.error(`Concept-PDF genereren mislukt: ${e?.message ?? 'onbekend'}`);
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] p-0 overflow-hidden" data-testid="combined-pdf-dialog">
        <div className="flex flex-col max-h-[92vh]">
          <DialogHeader className="p-4 pr-10 sm:p-5 sm:pr-10 pb-3 border-b">
            <DialogTitle>Conceptbrieven & productie</DialogTitle>
            <DialogDescription>
              Controleer eerst de conceptbrieven met zichtbaar “CONCEPT”-watermerk. Definitief maken, BAT, print en post zijn daarna afzonderlijke formele stappen.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4">
            <section className="space-y-3" aria-label="Conceptcontrole">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">1. Concept controleren</p>
                  <p className="text-[11px] text-muted-foreground">Conceptbestanden zijn uitsluitend voor controle en nooit de officiële printbron.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={download}
                  disabled={bezig || teGenereren.length === 0}
                  data-testid="combined-pdf-download"
                  className="w-full shrink-0 sm:w-auto"
                >
                  {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Conceptbrieven downloaden
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm" data-testid="radar-productie-canonieke-telling">
                <Stat label="Geselecteerde signalen" value={canoniekeScope.telling.signalen} />
                <Stat label="Geadresseerden" value={canoniekeScope.telling.geadresseerden} />
                <Stat label="Conceptbrieven gereed" value={teGenereren.length} />
                <Stat label="Niet gereed" value={canoniekeScope.telling.nietGereed} />
              </div>

              {canoniekeScope.nietGereed.length > 0 && (
                <ul className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" data-testid="radar-productie-niet-gereed">
                  {canoniekeScope.nietGereed.map((regel) => (
                    <li key={`${regel.signaalId}|${regel.briefId ?? 'zonder-brief'}`}>
                      Signaal {regel.signaalId}: {regel.reden === 'geen_actief_postconcept'
                        ? 'geen actief postconcept'
                        : regel.reden === 'postadres_onvolledig'
                          ? 'postadres ontbreekt of is onvolledig'
                          : 'geadresseerde ontbreekt'}.
                    </li>
                  ))}
                </ul>
              )}

              <ul className="rounded-md border divide-y text-sm" data-testid="combined-pdf-lijst">
                {gesorteerd.map((k) => (
                  <li key={k.brief.id} className="p-3 flex items-start gap-3" data-printbaar={k.printbaar} data-testid="combined-pdf-rij">
                    <Checkbox
                      checked={selectie.has(k.brief.id)}
                      disabled={!k.printbaar}
                      onCheckedChange={() => toggle(k.brief.id)}
                      aria-label="Selecteer conceptbrief voor controle en productie"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 dark:text-amber-300">
                          CONCEPT
                        </span>
                        <p className="min-w-0 font-medium break-words">
                          {k.brief.eigenaar_bedrijfsnaam ?? k.brief.eigenaar_naam ?? '(zonder naam)'}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground break-words">
                        Object: {k.signaal.adres ?? k.signaal.titel ?? '—'}
                        {k.brief.campagne_stap ? ` · ${k.brief.campagne_stap}` : ''}
                      </p>
                      {k.reden && <p className="text-[11px] text-destructive">⚠ {k.reden}</p>}
                    </div>
                  </li>
                ))}
                {gesorteerd.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    Geen nieuwe postconcepten in deze scope. Reeds definitieve brieven blijven hieronder zichtbaar in de formele productiescope.
                  </li>
                )}
              </ul>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                {overgeslagen.length > 0 && (
                  <p>{overgeslagen.length} conceptbrief{overgeslagen.length === 1 ? '' : 'ven'} vereisen aandacht en zijn niet geselecteerd voor productie.</p>
                )}
                {definitieveBriefIds.length > 0 && (
                  <p>
                    Daarnaast bevat deze scope {definitieveBriefIds.length} reeds definitieve {definitieveBriefIds.length === 1 ? 'brief' : 'brieven'} uit {definitieveSignalen} {definitieveSignalen === 1 ? 'signaal' : 'signalen'}; die worden niet als concept geteld maar blijven wél in preflight en BAT zichtbaar.
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3 border-t pt-4" aria-label="Formaliseren">
              <div>
                <p className="text-sm font-semibold">2. Definitief maken</p>
                <p className="text-[11px] text-muted-foreground">Preflight bepaalt per brief wat gereed is, wat aandacht vereist en wat al verwerkt is.</p>
              </div>
              {productieScopeBrieven.length > 0 ? (
                <ProductiewerkbankBulkPane
                  geselecteerdeSignaalIds={productieScopeSignaalIds}
                  selecties={acquisitieSelecties}
                  brieven={productieScopeBrieven}
                />
              ) : (
                <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Geen formele briefscope beschikbaar. Los eerst de aandachtspunten bij de concepten op.
                </p>
              )}
            </section>

            <section className="space-y-3 border-t pt-4" aria-label="Printproductie">
              <div>
                <p className="text-sm font-semibold">3. Formele printbatch</p>
                <p className="text-[11px] text-muted-foreground">BAT en productiebestanden ontstaan uitsluitend uit definitieve BR-brieven.</p>
              </div>
              {definitieveBriefIds.length > 0 ? (
                <ProductiewerkbankBulkPrintbatchActies briefIds={definitieveBriefIds} />
              ) : (
                <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground" data-testid="productiewerkbank-geen-definitieve-brieven">
                  Nog geen definitieve BR-brieven in deze scope. Deze fase wordt pas actief nadat een brief definitief is gemaakt.
                </p>
              )}
            </section>
          </div>

          <ModalActionBar onCancel={onClose} cancelLabel="Sluiten" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold font-mono-data leading-none">{value}</p>
    </div>
  );
}
