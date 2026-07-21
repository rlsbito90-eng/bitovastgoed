// Brother P-touch adreslabels — CSV-export dialog.
// Vervangt de vorige Adreslabels-PDF. Volledig mutatievrij: openen,
// previewen of downloaden creëert geen briefrecord, geen printbatch,
// geen event en wijzigt geen status.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  brievenNaarBrotherRijen,
  bouwBrotherCsv,
  brotherCsvBestandsnaam,
  UTF8_BOM,
  type BrotherLabelRij,
} from '@/lib/offMarket/acquisitie/brotherCsv';

interface Props {
  open: boolean;
  onClose: () => void;
  signalen: OffMarketSignaal[];
  toegevoegdOpPerSignaal: Map<string, string | null>;
  brieven: OffMarketBrief[];
}

export default function BrotherAdreslabelsCsvDialog({
  open, onClose, toegevoegdOpPerSignaal, brieven,
}: Props) {
  /** Eén rij per actief postconcept of -verstuurde brief, in printvolgorde. */
  const rijen = useMemo<BrotherLabelRij[]>(() => {
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
    return brievenNaarBrotherRijen(sorted.map(i => i.payload as OffMarketBrief));
  }, [brieven, toegevoegdOpPerSignaal]);

  const geldig = useMemo(() => rijen.filter(r => r.geldig), [rijen]);
  const geblokkeerd = useMemo(() => rijen.filter(r => !r.geldig), [rijen]);

  const [bezig, setBezig] = useState(false);
  useEffect(() => { if (!open) setBezig(false); }, [open]);

  async function download() {
    if (rijen.length === 0) {
      toast.error('Geen brieven geselecteerd om te exporteren.');
      return;
    }
    if (geldig.length === 0) {
      toast.error('Geen geldige adressen om te exporteren. Corrigeer eerst de geadresseerde-/adresgegevens.');
      return;
    }
    setBezig(true);
    try {
      // Volgnummer opnieuw uitdelen ná filter (alleen geldige rijen worden geëxporteerd).
      const geëxporteerd: BrotherLabelRij[] = geldig.map((r, i) => ({ ...r, nummer: i + 1 }));
      const csv = UTF8_BOM + bouwBrotherCsv(geëxporteerd);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const filename = brotherCsvBestandsnaam();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Brother-CSV gegenereerd (${geëxporteerd.length} labels).`);
    } catch (e: any) {
      console.error('Brother CSV-export mislukt', e);
      toast.error(`CSV genereren mislukt: ${e?.message ?? 'onbekend'}`);
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-3xl max-w-[95vw] p-0 overflow-hidden"
        data-testid="brother-csv-dialog"
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle>Brother-adreslabels exporteren</DialogTitle>
            <DialogDescription>
              Download een CSV-database voor Brother P-touch Editor. Eén record
              per te printen brief; volgorde gelijk aan de gecombineerde brief-PDF.
              Genereren wijzigt niets in de database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Labels" value={geldig.length} />
              <Stat label="Geblokkeerd" value={geblokkeerd.length}
                tone={geblokkeerd.length > 0 ? 'warn' : 'default'} />
              <Stat label="Totaal" value={rijen.length} />
            </div>

            {geblokkeerd.length > 0 && (
              <div
                className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-1 text-[12px]"
                data-testid="brother-csv-blokkades"
              >
                <p className="font-medium text-amber-800">
                  {geblokkeerd.length} geadresseerde(n) met onvolledige gegevens
                </p>
                <ul className="list-disc pl-4 text-amber-900">
                  {geblokkeerd.map(r => (
                    <li key={r.briefId} data-testid="brother-csv-blokkade-rij">
                      {r.geadresseerdeLabel} — {r.blokkadeReden}
                    </li>
                  ))}
                </ul>
                <p className="text-amber-900">
                  Deze worden niet meegenomen in het CSV-bestand. Corrigeer de
                  adresgegevens en genereer opnieuw.
                </p>
              </div>
            )}

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-[12px]" data-testid="brother-csv-preview-tabel">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold w-10">#</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Regel 1</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Regel 2</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Regel 3</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Regel 4</th>
                  </tr>
                </thead>
                <tbody>
                  {geldig.map((r, i) => (
                    <tr key={r.briefId} className="border-t" data-testid="brother-csv-rij">
                      <td className="px-2 py-1 font-mono-data text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1">{r.regel1}</td>
                      <td className="px-2 py-1">{r.regel2}</td>
                      <td className="px-2 py-1">{r.regel3}</td>
                      <td className="px-2 py-1">{r.regel4}</td>
                    </tr>
                  ))}
                  {geldig.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        Geen geldige adressen om te exporteren.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ModalActionBar
            onCancel={onClose}
            cancelLabel="Sluiten"
            primary={
              <Button
                type="button" size="sm" onClick={download}
                disabled={bezig || geldig.length === 0}
                data-testid="brother-csv-download"
              >
                {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Download Brother-CSV
              </Button>
            }
          />
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
