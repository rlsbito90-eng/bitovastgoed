import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const REDENEN = [
  'Niet interessant',
  'Eigenaar niet bereikbaar',
  'Geen verkoopbereidheid',
  'Reeds elders verkocht',
  'Dubbele invoer / dedupe',
  'Andere reden',
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reden: string) => void | Promise<void>;
}

export default function OffMarketArchiveDialog({ open, onOpenChange, onConfirm }: Props) {
  const [reden, setReden] = useState(REDENEN[0]);
  const [toelichting, setToelichting] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (open) { setReden(REDENEN[0]); setToelichting(''); }
  }, [open]);

  const isAnders = reden === 'Andere reden';
  const canConfirm = !!reden && (!isAnders || toelichting.trim().length > 0);

  const handle = async () => {
    if (!canConfirm || bezig) return;
    setBezig(true);
    try {
      const final = isAnders ? toelichting.trim() : (toelichting.trim() ? `${reden} — ${toelichting.trim()}` : reden);
      await onConfirm(final);
      onOpenChange(false);
    } finally { setBezig(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Signaal archiveren?</DialogTitle>
          <DialogDescription>
            Het signaal blijft bewaard maar verdwijnt uit de actieve lijst.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Reden</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={reden} onChange={e => setReden(e.target.value)}
            >
              {REDENEN.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Toelichting {isAnders && <span className="text-destructive">*</span>}</Label>
            <Textarea rows={3} value={toelichting} onChange={e => setToelichting(e.target.value)}
              placeholder={isAnders ? 'Geef een korte toelichting' : 'Optionele toelichting'} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
          <Button onClick={handle} disabled={!canConfirm || bezig}>{bezig ? 'Bezig…' : 'Archiveren'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
