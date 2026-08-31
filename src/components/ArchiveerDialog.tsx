// Generieke archiveer-modal voor Object en Deal.
// Vrije tekst blijft bewaard, maar nieuwe registraties gebruiken een compacte
// canonieke set zodat verliesanalyse betrouwbaar kan aggregeren.

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type ArchiveerKind = 'object' | 'deal';

const OBJECT_REDENEN = [
  'Verkocht via Bito Vastgoed',
  'Verkocht extern / aan derde',
  'Ingetrokken door eigenaar',
  'Prijs / waarderingsverschil',
  'Investment case niet haalbaar',
  'Geen passende koper / kandidaat',
  'Publiek op markt / niet langer off-market',
  'Onvoldoende informatie',
  'Proces / timing',
  'Handmatig gearchiveerd',
  'Anders',
] as const;

const DEAL_REDENEN = [
  'Succesvol afgerond',
  'Koper / kandidaat afgehaakt',
  'Prijs / waarderingsverschil',
  'Investment case niet haalbaar',
  'Object verkocht aan andere partij',
  'Object ingetrokken door eigenaar',
  'Onvoldoende informatie',
  'Proces / timing',
  'Handmatig gearchiveerd',
  'Anders',
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ArchiveerKind;
  /** Default reden uit een bestaande flow. Legacy waarden blijven zichtbaar. */
  defaultReason?: string;
  /** Toon ook "Niet archiveren" knop (alleen relevant in form-flow). */
  showSkip?: boolean;
  /** Aanvullende uitleg boven het formulier. */
  triggerHint?: string;
  onConfirm: (data: { reason: string; note?: string }) => void | Promise<void>;
  onSkip?: () => void;
}

export default function ArchiveerDialog({
  open, onOpenChange, kind, defaultReason, showSkip = false, triggerHint,
  onConfirm, onSkip,
}: Props) {
  const canoniekeRedenen = kind === 'object' ? OBJECT_REDENEN : DEAL_REDENEN;
  const redenen = useMemo(() => {
    // Een historische/default vrije-tekstreden mag nooit stil worden vervangen.
    // Staat hij niet in de nieuwe lijst, toon hem dan als legacy-keuze bovenaan.
    if (defaultReason && !canoniekeRedenen.includes(defaultReason as never)) {
      return [defaultReason, ...canoniekeRedenen];
    }
    return [...canoniekeRedenen];
  }, [canoniekeRedenen, defaultReason]);

  const [reason, setReason] = useState<string>(defaultReason ?? redenen[0]);
  const [note, setNote] = useState<string>('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(defaultReason ?? redenen[0]);
      setNote('');
    }
  }, [open, defaultReason, redenen]);

  const isAnders = reason === 'Anders';
  const isLegacy = !!defaultReason
    && defaultReason === reason
    && !canoniekeRedenen.includes(reason as never);
  const canConfirm = !!reason && (!isAnders || note.trim().length > 0);

  const handleConfirm = async () => {
    if (!canConfirm || bezig) return;
    setBezig(true);
    try {
      await onConfirm({
        reason: isAnders ? (note.trim() || 'Anders') : reason,
        note: note.trim() || undefined,
      });
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
              : `Plaats deze ${kind === 'object' ? 'objectkaart' : 'Deal'} in het archief. Het record en de historie blijven bewaard.`}
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
              {redenen.map(r => (
                <option key={r} value={r}>
                  {r}{defaultReason === r && !canoniekeRedenen.includes(r as never) ? ' (legacy)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Nieuwe redenen zijn gestandaardiseerd voor funnelanalyse. Bestaande vrije tekst wordt niet overschreven.
            </p>
            {isLegacy && (
              <p className="text-[11px] text-warning">
                Dit is een bestaande legacy-reden. Je kunt hem behouden of bewust vervangen door een gestandaardiseerde categorie.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="archief-notitie">
              Toelichting {isAnders && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="archief-notitie"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isAnders ? 'Geef een korte concrete reden' : 'Optionele context voor latere analyse'}
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
