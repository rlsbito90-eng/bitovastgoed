import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Bieding } from '@/lib/biedingen/types';
import { fmtEur } from '@/lib/biedingen/format';

interface Props {
  bieding: Bieding;
  onOpenChange: (open: boolean) => void;
  onConfirm: (toelichting: string) => Promise<void>;
}

/** Statusregistratie: verstuurt zelf geen bericht aan koper. */
export default function BiedboekAangepastBodDialog({ bieding, onOpenChange, onConfirm }: Props) {
  const [toelichting, setToelichting] = useState('');
  const [bezig, setBezig] = useState(false);

  const opslaan = async () => {
    if (bezig) return;
    setBezig(true);
    try {
      await onConfirm(toelichting.trim());
      toast.success('Aangepast bod gevraagd geregistreerd');
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Registreren is mislukt.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aangepast kopersbod gevraagd</DialogTitle>
          <DialogDescription>
            Registreer dat je de koper al hebt gevraagd het bod van {fmtEur(bieding.bedrag)} aan te passen.
            Het oorspronkelijke bod blijft bewaard en de onderhandeling blijft open.
            De CRM verstuurt zelf geen bericht.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="biedaanpassing-toelichting">Toelichting (optioneel)</Label>
          <Textarea id="biedaanpassing-toelichting" rows={2} value={toelichting}
            placeholder="Bijvoorbeeld: verkoper verwacht hogere prijs"
            onChange={e => setToelichting(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={bezig} onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button disabled={bezig} onClick={() => void opslaan()}>{bezig ? 'Opslaan…' : 'Verzoek registreren'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
