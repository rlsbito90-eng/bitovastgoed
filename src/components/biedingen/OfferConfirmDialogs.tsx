import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useBiedingen } from '@/hooks/useBiedingen';
import type { Bieding } from '@/lib/biedingen/types';

export function OfferAcceptDialog({ open, onOpenChange, bieding }: {
  open: boolean; onOpenChange: (o: boolean) => void; bieding: Bieding | null;
}) {
  const { acceptOffer } = useBiedingen(bieding ? { objectId: bieding.objectId } : { all: true });
  const [wijsAndereAf, setWijsAndereAf] = useState(false);
  const [bezig, setBezig] = useState(false);

  if (!bieding) return null;

  const handle = async () => {
    setBezig(true);
    try {
      await acceptOffer(bieding.id, { wijsAndereAf });
      toast.success('Bieding geaccepteerd. Pas eventueel de dealfase aan (Onderhandeling / LOI / Koopovereenkomst).');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally { setBezig(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bieding accepteren?</AlertDialogTitle>
          <AlertDialogDescription>
            Weet je zeker dat je deze bieding wilt accepteren? Andere open biedingen op dit object blijven standaard open.
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
            {bezig ? 'Bezig…' : 'Accepteren'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OfferRejectDialog({ open, onOpenChange, bieding }: {
  open: boolean; onOpenChange: (o: boolean) => void; bieding: Bieding | null;
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
          <AlertDialogTitle>Bieding afwijzen</AlertDialogTitle>
          <AlertDialogDescription>Geef kort aan waarom dit bod wordt afgewezen.</AlertDialogDescription>
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
