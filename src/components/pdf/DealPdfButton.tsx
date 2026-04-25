// src/components/pdf/DealPdfButton.tsx
//
// PDF-download knop voor deal-detail pagina. Genereert een deal-status PDF
// voor de investeerder (relatie). Dialog opent met opties:
// - Marktwaarde-indicatie meenemen (alleen indien beschikbaar uit referentieanalyse)
// - Indicatief bod tonen (default uit — gevoelig)

import { useState, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import type { Deal, ObjectVastgoed, Relatie } from '@/data/mock-data';
import DealStatusPDF from '@/components/pdf/DealStatusPDF';

interface Props {
  deal: Deal;
  object: ObjectVastgoed;
  relatie: Relatie;
}

export default function DealPdfButton({ deal, object, relatie }: Props) {
  const store = useDataStore();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const [includeMarktwaarde, setIncludeMarktwaarde] = useState(false);
  const [toonBod, setToonBod] = useState(false);

  // Bereken marktwaarde-indicatie uit gekoppelde referenties
  const marktwaardeMediaan = useMemo(() => {
    const gekoppeld = store.getReferentiesVoorDeal(deal.id);
    if (gekoppeld.length < 2) return undefined;
    const m2 = object.oppervlakteVvo ?? object.oppervlakte;
    if (!m2 || m2 <= 0) return undefined;

    const perM2 = gekoppeld
      .map(r => r.prijsPerM2)
      .filter((v): v is number => v != null && !Number.isNaN(v))
      .sort((a, b) => a - b);
    if (perM2.length < 2) return undefined;

    const mid = Math.floor(perM2.length / 2);
    const mediaan = perM2.length % 2 === 0
      ? (perM2[mid - 1] + perM2[mid]) / 2
      : perM2[mid];
    return Math.round(mediaan * m2);
  }, [store, deal.id, object]);

  const handleGenereer = async () => {
    setBezig(true);
    try {
      const doc = (
        <DealStatusPDF
          deal={deal}
          object={object}
          relatie={relatie}
          marktwaardeMediaan={includeMarktwaarde ? marktwaardeMediaan : undefined}
          toonBod={toonBod}
        />
      );
      const blob = await pdf(doc).toBlob();

      const titelClean = (object.anoniem && object.publiekeNaam ? object.publiekeNaam : object.titel)
        .replace(/[^a-zA-Z0-9 \-_]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40);
      const datum = new Date().toISOString().split('T')[0];
      const filename = `Bito-Deal-Status-${titelClean}-${datum}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Deal-status PDF gegenereerd');
      setOpen(false);
    } catch (err: any) {
      console.error('PDF generatie fout:', err);
      toast.error(`PDF genereren mislukt: ${err?.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <FileDown className="h-4 w-4" />
        <span>Status PDF</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => !bezig && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deal-status PDF</DialogTitle>
            <DialogDescription>
              Genereer een statusupdate voor {relatie.bedrijfsnaam}. Bevat geen commissie-informatie of interne notities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Opties</p>

            <label className={`flex items-start gap-2 p-2.5 rounded-md cursor-pointer transition-colors ${
              marktwaardeMediaan != null
                ? 'bg-muted/30 hover:bg-muted/40'
                : 'bg-muted/20 cursor-not-allowed opacity-60'
            }`}>
              <input
                type="checkbox"
                checked={includeMarktwaarde}
                onChange={e => setIncludeMarktwaarde(e.target.checked)}
                disabled={marktwaardeMediaan == null}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">Marktwaarde-indicatie meenemen</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {marktwaardeMediaan != null
                    ? 'Mediaanwaarde uit referentieanalyse'
                    : 'Geen indicatie beschikbaar — koppel minimaal 2 referenties met €/m²'}
                </p>
              </div>
            </label>

            {deal.indicatiefBod != null && (
              <label className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={toonBod}
                  onChange={e => setToonBod(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">Indicatief bod tonen</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Standaard uit — alleen aanzetten als bod gedeeld mag worden met de geadresseerde.
                  </p>
                </div>
              </label>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md">
            <p className="font-medium text-foreground/80 mb-1">Wat staat NIET in deze PDF:</p>
            <p>Commissie, fee-structuur, andere kandidaten, interne notities, afwijzingsredenen.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={bezig}>
              Annuleren
            </Button>
            <Button onClick={handleGenereer} disabled={bezig} className="gap-1.5">
              {bezig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Bezig…
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" /> Genereer PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
