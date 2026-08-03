import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  open: boolean;
  aantal: number;
  bezig: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function BagHandmatigePromotieDialog({
  open, aantal, bezig, onOpenChange, onConfirm,
}: Props) {
  const [bevestigd, setBevestigd] = useState(false);
  const wijzigOpen = (volgendeOpen: boolean) => {
    if (!volgendeOpen) setBevestigd(false);
    onOpenChange(volgendeOpen);
  };

  return <AlertDialog open={open} onOpenChange={wijzigOpen}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{aantal} BAG-pand{aantal === 1 ? '' : 'en'} handmatig toevoegen?</AlertDialogTitle>
        <AlertDialogDescription>
          Dit maakt uitsluitend Vastgoedkansen met status te beoordelen. Er worden geen Objecten of Deals gemaakt en er start geen Kadaster-, eigenaar-, brief- of andere vervolgactie.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
        <Checkbox checked={bevestigd} onCheckedChange={value => setBevestigd(Boolean(value))}/>
        <span>Ik heb de groene preflight gecontroleerd en wil deze selectie nu expliciet aan Vastgoedkansen toevoegen.</span>
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
        <AlertDialogAction disabled={!bevestigd || bezig} onClick={onConfirm}>
          {bezig ? 'Toevoegen…' : 'Ja, handmatig toevoegen'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
