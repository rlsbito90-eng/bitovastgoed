// V3 — "Adreslabels PDF" voor de Off-Market Acquisitieselectie.
// Volledig mutatievrij: openen, previewen of downloaden creëert geen
// briefrecord, geen printbatch, geen event en wijzigt geen status.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ModalActionBar } from '@/components/ui/modal-action-bar';
import { FileDown, Loader2 } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { sorteerPrintItems } from '@/lib/offMarket/acquisitie/printVolgorde';
import {
  bouwAdresLabel, briefNaarLabelBron,
  INHOUD_BREEDTE_MM, LABEL_BREEDTE_MM, LABEL_HOOGTE_MM,
  type AdresLabel,
} from '@/lib/offMarket/acquisitie/adreslabel';
import GecombineerdeAdreslabelsPDF from './GecombineerdeAdreslabelsPDF';

interface Props {
  open: boolean;
  onClose: () => void;
  signalen: OffMarketSignaal[];
  toegevoegdOpPerSignaal: Map<string, string | null>;
  brieven: OffMarketBrief[];
}

export default function AdreslabelsPdfDialog({
  open, onClose, signalen, toegevoegdOpPerSignaal, brieven,
}: Props) {
  const signaalIndex = useMemo(() => {
    const m = new Map<string, OffMarketSignaal>();
    for (const s of signalen) m.set(s.id, s);
    return m;
  }, [signalen]);

  /** Eén label per actief postconcept of -verstuurde brief. */
  const labels = useMemo<AdresLabel[]>(() => {
    const items = brieven
      .filter(b => !b.archived_at && (b.kanaal ?? 'post') === 'post')
      .map(b => ({
        signaalId: b.signaal_id,
        toegevoegdOp: toegevoegdOpPerSignaal.get(b.signaal_id) ?? null,
        geadresseerdeKey: b.geadresseerde_key ?? null,
        geadresseerdeLabel: b.eigenaar_bedrijfsnaam ?? b.eigenaar_naam ?? null,
        campagneStap: b.campagne_stap ?? null,
        payload: b,
      }));
    const sorted = sorteerPrintItems(items);
    return sorted.map(i => bouwAdresLabel(briefNaarLabelBron(
      i.payload as OffMarketBrief,
      i.toegevoegdOp,
    )));
  }, [brieven, toegevoegdOpPerSignaal]);

  const geldig = useMemo(() => labels.filter(l => l.geldig), [labels]);
  const geblokkeerd = useMemo(() => labels.filter(l => !l.geldig), [labels]);
  const metWaarschuwing = useMemo(
    () => geldig.filter(l => !!l.overflowWaarschuwing),
    [geldig],
  );

  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) setBezig(false);
  }, [open]);

  async function download() {
    if (geldig.length === 0) {
      toast.error('Geen geldige labels om te downloaden.');
      return;
    }
    setBezig(true);
    try {
      // GEEN database-mutatie — alleen blob bouwen en downloaden.
      const blob = await pdf(<GecombineerdeAdreslabelsPDF labels={geldig} />).toBlob();
      const datum = new Date().toISOString().slice(0, 10);
      const filename = `bito-vastgoed-adreslabels-${datum}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Adreslabels-PDF gegenereerd (${geldig.length} labels).`);
    } catch (e: any) {
      console.error('Adreslabels-PDF mislukt', e);
      toast.error(`PDF genereren mislukt: ${e?.message ?? 'onbekend'}`);
    } finally {
      setBezig(false);
    }
  }

  // Visuele preview-schaal: vaste breedte 320px, verhouding 90:29.
  const previewBreedtePx = 320;
  const previewHoogtePx = Math.round(previewBreedtePx * (LABEL_HOOGTE_MM / LABEL_BREEDTE_MM));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-3xl max-w-[95vw] p-0 overflow-hidden"
        data-testid="adreslabels-dialog"
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle>Adreslabels (Brother QL-710W)</DialogTitle>
            <DialogDescription>
              Eén label per pagina, exact 90 × 29 mm liggend, 3 mm veilige marge.
              Genereren wijzigt niets in de database. Volgorde gelijk aan de
              gecombineerde brief-PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Stat label="Labels" value={geldig.length} />
              <Stat label="Geblokkeerd" value={geblokkeerd.length}
                tone={geblokkeerd.length > 0 ? 'warn' : 'default'} />
              <Stat label="Overflow" value={metWaarschuwing.length}
                tone={metWaarschuwing.length > 0 ? 'warn' : 'default'} />
              <Stat label="Totaal" value={labels.length} />
            </div>

            <p
              className="text-[11px] text-muted-foreground"
              data-testid="adreslabels-volgorde-melding"
            >
              Volgorde van de labels is gelijk aan de volgorde in de gecombineerde
              brief-PDF (toegevoegd_op → geadresseerde → campagne-stap).
            </p>

            <ul className="space-y-2" data-testid="adreslabels-lijst">
              {labels.map((label) => (
                <li
                  key={label.bron.briefId}
                  data-testid="adreslabels-rij"
                  data-geldig={label.geldig}
                  className="rounded-md border bg-card p-3 flex flex-col sm:flex-row sm:items-start gap-3"
                >
                  <div
                    className="rounded border bg-white text-[9px] text-black overflow-hidden shrink-0"
                    style={{
                      width: previewBreedtePx, height: previewHoogtePx,
                      padding: `${(3 / LABEL_HOOGTE_MM) * previewHoogtePx}px ${(3 / LABEL_BREEDTE_MM) * previewBreedtePx}px`,
                    }}
                    aria-label="Labelvoorbeeld op schaal"
                    data-testid="adreslabels-preview"
                  >
                    {label.geldig ? label.regels.map((r, i) => (
                      <div key={i} style={{ lineHeight: 1.2 }}>{r}</div>
                    )) : (
                      <div className="text-destructive">{label.blokkadeReden}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="font-medium break-words">
                      {label.bron.eigenaarNaam ?? label.bron.eigenaarBedrijfsnaam ?? '(zonder naam)'}
                    </p>
                    <p className="text-[11px] text-muted-foreground break-words">
                      {label.bron.campagneStap ?? 'brief_?'} · {INHOUD_BREEDTE_MM} mm bruikbaar
                    </p>
                    {!label.geldig && (
                      <p className="text-[11px] text-destructive" data-testid="adreslabels-blokkade">
                        ⚠ {label.blokkadeReden}
                      </p>
                    )}
                    {label.overflowWaarschuwing && (
                      <p className="text-[11px] text-amber-700" data-testid="adreslabels-overflow">
                        ⚠ {label.overflowWaarschuwing}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {labels.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground border rounded-md">
                  Geen brieven in de selectie om labels voor te bouwen.
                </li>
              )}
            </ul>
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
              disabled={bezig || geldig.length === 0}
              data-testid="adreslabels-download"
            >
              {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Download adreslabels-PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label, value, tone = 'default',
}: { label: string; value: number; tone?: 'default' | 'warn' }) {
  const cls = tone === 'warn'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    : 'border-border bg-card text-foreground';
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold font-mono-data leading-none">{value}</p>
    </div>
  );
}
