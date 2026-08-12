import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{aantal} BAG-pand{aantal === 1 ? '' : 'en'} toevoegen aan Vastgoedkansen?</AlertDialogTitle>
        <AlertDialogDescription>
          Dit maakt uitsluitend Vastgoedkansen met status te beoordelen. Er worden geen Objecten of Deals gemaakt en er start geen Kadaster-, eigenaar-, brief- of andere vervolgactie.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
        <AlertDialogAction disabled={bezig} onClick={onConfirm}>
          {bezig ? 'Toevoegen…' : `${aantal} pand${aantal === 1 ? '' : 'en'} toevoegen aan Vastgoedkansen`}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
