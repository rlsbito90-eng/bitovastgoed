// Generieke archiveer-modal voor Object en Deal.
// Wordt gebruikt vóór opslaan bij eindstatussen, of vanaf detailpagina's.

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OBJECT_ARCHIEF_REDENEN, DEAL_ARCHIEF_REDENEN } from '@/data/mock-data';

export type ArchiveerKind = 'object' | 'deal';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ArchiveerKind;
  /** Default reden — als bv. status="verkocht" automatisch "Verkocht via Bito Vastgoed" voorinvult */
  defaultReason?: string;
  /** Toon ook "Niet archiveren" knop (alleen relevant in form-flow) */
  showSkip?: boolean;
  /** Aanvullende uitleg boven het formulier (bv. fase-naam) */
  triggerHint?: string;
  onConfirm: (data: { reason: string; note?: string }) => void | Promise<void>;
  onSkip?: () => void;
}

export default function ArchiveerDialog({
  open, onOpenChange, kind, defaultReason, showSkip = false, triggerHint,
  onConfirm, onSkip,
}: Props) {
  const redenen = kind === 'object' ? OBJECT_ARCHIEF_REDENEN : DEAL_ARCHIEF_REDENEN;
  const [reason, setReason] = useState<string>(defaultReason ?? redenen[0]);
  const [note, setNote] = useState<string>('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(defaultReason ?? redenen[0]);
      setNote('');
    }
  }, [open, defaultReason]);

  const isAnders = reason === 'Anders';
  const canConfirm = !!reason && (!isAnders || note.trim().length > 0);

  const handleConfirm = async () => {
    if (!canConfirm || bezig) return;
    setBezig(true);
    try {
      await onConfirm({ reason: isAnders ? (note.trim() || 'Anders') : reason, note: note.trim() || undefined });
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === 'object' ? 'Object archiveren?' : 'Deal archiveren?'}</DialogTitle>
          <DialogDescription>
            {triggerHint
              ? triggerHint
              : `Plaats deze ${kind === 'object' ? 'objectkaart' : 'deal'} in het archief. Het record blijft bewaard en is terug te zetten.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="archief-reden">Reden</Label>
            <select
              id="archief-reden"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              {redenen.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="archief-notitie">
              Notitie {isAnders && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="archief-notitie"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isAnders ? 'Geef een korte toelichting' : 'Optionele toelichting'}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>
            Annuleren
          </Button>
          {showSkip && onSkip && (
            <Button
              variant="outline"
              onClick={() => { onSkip(); onOpenChange(false); }}
              disabled={bezig}
            >
              Niet archiveren
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={!canConfirm || bezig}>
            {bezig ? 'Bezig…' : 'Archiveren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
