// V2 — "Gecombineerde brief-PDF" voor de Off-Market Acquisitieselectie.
// Volledig mutatievrij: previewen of downloaden creëert geen briefrecord,
// geen printbatchrecord, geen event en wijzigt geen verzendstatus.

import { useEffect, useMemo, useState } from 'react';
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
import { buildBriefViewModel } from '@/lib/offMarket/brief';
import { sorteerPrintItems } from '@/lib/offMarket/acquisitie/printVolgorde';
import GecombineerdeBrievenPDF from '@/components/offmarket/GecombineerdeBrievenPDF';
import { isVolledigPostadres } from '@/lib/offMarket/acquisitie/readiness';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Geselecteerde signalen in vaste volgorde. */
  signalen: OffMarketSignaal[];
  /** ISO-toegevoegd_op per signaal (uit acquisitieselectie). */
  toegevoegdOpPerSignaal: Map<string, string | null>;
  /** Alle actieve brieven van die signalen. */
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
  const signaalIndex = useMemo(() => {
    const m = new Map<string, OffMarketSignaal>();
    for (const s of signalen) m.set(s.id, s);
    return m;
  }, [signalen]);

  /** Alleen actieve postconcepten met geldig adres komen in aanmerking. */
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
        brief: b, signaal: s,
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

  // Selectie van brief-IDs voor de bundel (default: alle printbare).
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    setSelectie(new Set(gesorteerd.filter(k => k.printbaar).map(k => k.brief.id)));
  }, [open, gesorteerd]);

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

  const overgeslagen = useMemo(
    () => gesorteerd.filter(k => !k.printbaar),
    [gesorteerd],
  );

  const uniekeSignalen = useMemo(() => {
    const s = new Set<string>();
    for (const k of teGenereren) s.add(k.signaal.id);
    return s.size;
  }, [teGenereren]);

  const uniekeGeadresseerden = useMemo(() => {
    const s = new Set<string>();
    for (const k of teGenereren) s.add(`${k.signaal.id}|${k.brief.geadresseerde_key ?? k.brief.id}`);
    return s.size;
  }, [teGenereren]);

  const [bezig, setBezig] = useState(false);

  async function download() {
    if (teGenereren.length === 0) {
      toast.error('Geen printbare brieven geselecteerd.');
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
      // GEEN database-mutatie — alleen blob bouwen en downloaden.
      const blob = await pdf(<GecombineerdeBrievenPDF items={items} />).toBlob();
      const datum = new Date().toISOString().slice(0, 10);
      const filename = `bito-vastgoed-brieven-${datum}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Gecombineerde PDF gegenereerd (${items.length} brieven).`);
    } catch (e: any) {
      console.error('Gecombineerde PDF mislukt', e);
      toast.error(`PDF genereren mislukt: ${e?.message ?? 'onbekend'}`);
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-3xl max-w-[95vw] p-0 overflow-hidden"
        data-testid="combined-pdf-dialog"
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle>Gecombineerde brief-PDF</DialogTitle>
            <DialogDescription>
              Bundel printklare conceptbrieven in één PDF in vaste printvolgorde.
              Genereren wijzigt niets in de database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <Stat label="Brieven" value={teGenereren.length} />
              <Stat label="Signalen" value={uniekeSignalen} />
              <Stat label="Geadresseerden" value={uniekeGeadresseerden} />
            </div>

            <ul className="rounded-md border divide-y text-sm" data-testid="combined-pdf-lijst">
              {gesorteerd.map((k) => (
                <li
                  key={k.brief.id}
                  className="p-3 flex items-start gap-3"
                  data-printbaar={k.printbaar}
                  data-testid="combined-pdf-rij"
                >
                  <Checkbox
                    checked={selectie.has(k.brief.id)}
                    disabled={!k.printbaar}
                    onCheckedChange={() => toggle(k.brief.id)}
                    aria-label="Selecteer brief voor bundel"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-medium break-words">
                      {k.brief.eigenaar_naam ?? k.brief.eigenaar_bedrijfsnaam ?? '(zonder naam)'}
                    </p>
                    <p className="text-[11px] text-muted-foreground break-words">
                      Object: {k.signaal.adres ?? k.signaal.titel ?? '—'}
                      {k.brief.campagne_stap ? ` · ${k.brief.campagne_stap}` : ''}
                    </p>
                    {k.reden && (
                      <p className="text-[11px] text-destructive">⚠ {k.reden}</p>
                    )}
                  </div>
                </li>
              ))}
              {gesorteerd.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  Geen postconcepten beschikbaar voor de geselecteerde signalen.
                </li>
              )}
            </ul>

            {overgeslagen.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {overgeslagen.length} brieven worden overgeslagen omdat adres of naam ontbreekt.
              </p>
            )}
          </div>

          <div
            className="border-t bg-background/95 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-end gap-2"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={bezig}>
              Sluiten
            </Button>
            <Button
              type="button" size="sm" onClick={download}
              disabled={bezig || teGenereren.length === 0}
              data-testid="combined-pdf-download"
            >
              {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Download gecombineerde PDF
            </Button>
          </div>
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
