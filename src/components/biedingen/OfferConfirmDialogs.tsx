import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useBiedingen } from '@/hooks/useBiedingen';
import type { Bieding } from '@/lib/biedingen/types';

export function OfferAcceptDialog({ open, onOpenChange, bieding, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; bieding: Bieding | null;
  onSaved?: () => void | Promise<void>;
}) {
  const { acceptOffer } = useBiedingen(bieding ? { objectId: bieding.objectId } : { all: true });
  const [wijsAndereAf, setWijsAndereAf] = useState(false);
  const [bezig, setBezig] = useState(false);

  if (!bieding) return null;

  const handle = async () => {
    setBezig(true);
    try {
      await acceptOffer(bieding.id, { wijsAndereAf });
      await onSaved?.();
      toast.success('Bieding geaccepteerd. De transactie-Deal is gestart en het object staat nu op Preferred bidder / exclusiviteit.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally { setBezig(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bieding accepteren en Deal starten?</AlertDialogTitle>
          <AlertDialogDescription>
            Hiermee wordt deze koper de preferred bidder. Het object gaat naar de trajectfase
            “Preferred bidder / exclusiviteit” en de gekoppelde transactie-Deal wordt automatisch
            aangemaakt of hergebruikt. Je hoeft de fase niet nogmaals bij Deals bij te werken.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-2 py-2">
          <Checkbox id="wijsAf" checked={wijsAndereAf} onCheckedChange={v => setWijsAndereAf(!!v)} />
          <Label htmlFor="wijsAf" className="text-sm leading-tight">
            Markeer alle andere open biedingen op dit object als afgewezen
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={handle} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Accepteren & Deal starten'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OfferRejectDialog({ open, onOpenChange, bieding, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; bieding: Bieding | null;
  onSaved?: () => void | Promise<void>;
}) {
  const { rejectOffer } = useBiedingen(bieding ? { objectId: bieding.objectId } : { all: true });
  const [reden, setReden] = useState('');
  const [bezig, setBezig] = useState(false);

  if (!bieding) return null;

  const handle = async () => {
    if (!reden.trim()) { toast.error('Geef een reden op.'); return; }
    setBezig(true);
    try {
      await rejectOffer(bieding.id, reden.trim());
      await onSaved?.();
      toast.success('Bieding afgewezen');
      setReden('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally { setBezig(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{bieding.richting === 'van_koper' ? 'Kopersbod afwijzen' : 'Verkopersvoorstel afwijzen'}</AlertDialogTitle>
          <AlertDialogDescription>
            {bieding.richting === 'van_koper'
              ? 'Leg vast dat de verkoper dit kopersbod afwijst. De huidige onderhandeling wordt afgesloten. Wil de verkoper verder onderhandelen, gebruik dan Tegenvoorstel of Aangepast bod gevraagd.'
              : 'Leg vast dat de koper het verkopersvoorstel heeft afgewezen. De huidige onderhandeling wordt afgesloten. Bij een nieuw bod kun je het traject opnieuw openen.'}
            De afwijzingsreden blijft bewaard in het biedboek.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea value={reden} onChange={e => setReden(e.target.value)} placeholder="Bv. te laag, voorwaarden onaanvaardbaar…" rows={3} />
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={handle} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Afwijzen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
