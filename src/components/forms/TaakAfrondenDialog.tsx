// src/components/forms/TaakAfrondenDialog.tsx
// Wordt getoond bij het afvinken van een taak. De gebruiker kan optioneel
// een contactmoment loggen. Alleen 'echte communicatie'-uitkomsten werken
// "Laatste contact" bij. 'Geen gehoor' wordt als activiteit gelogd, maar
// telt niet als laatste contact (zie src/lib/relatieContact.ts).

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDataStore } from '@/hooks/useDataStore';
import { toast } from 'sonner';
import type { Taak } from '@/data/mock-data';
import type { ContactMomentType, ContactMomentDirection } from '@/lib/contactMoments';

type UitkomstKey =
  | 'geen'           // geen contactmoment, alleen taak afronden
  | 'gesproken'
  | 'geen_gehoor'
  | 'whatsapp'
  | 'email'
  | 'linkedin'
  | 'anders';

interface UitkomstOptie {
  key: UitkomstKey;
  label: string;
  /** Wanneer null → geen contactmoment loggen. */
  type: ContactMomentType | null;
  direction: ContactMomentDirection;
  /** 'Geen gehoor' wordt wel gelogd, maar als type 'algemeen' (= activiteit, niet 'echt contact'). */
  defaultTitel: string;
}

const OPTIES: UitkomstOptie[] = [
  { key: 'geen',        label: 'Geen contactmoment',     type: null,                 direction: 'n_v_t',    defaultTitel: '' },
  { key: 'gesproken',   label: 'Gesproken',              type: 'telefoon',           direction: 'uitgaand', defaultTitel: 'Telefonisch gesproken' },
  { key: 'geen_gehoor', label: 'Geen gehoor',            type: 'algemeen',           direction: 'uitgaand', defaultTitel: 'Gebeld — geen gehoor' },
  { key: 'whatsapp',    label: 'WhatsApp gestuurd',      type: 'whatsapp',           direction: 'uitgaand', defaultTitel: 'WhatsApp gestuurd' },
  { key: 'email',       label: 'E-mail gestuurd',        type: 'email',              direction: 'uitgaand', defaultTitel: 'E-mail gestuurd' },
  { key: 'linkedin',    label: 'LinkedIn bericht',       type: 'linkedin',           direction: 'uitgaand', defaultTitel: 'LinkedIn bericht gestuurd' },
  { key: 'anders',      label: 'Anders',                 type: 'algemeen',           direction: 'n_v_t',    defaultTitel: 'Contactmoment' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taak: Taak | null;
}

export default function TaakAfrondenDialog({ open, onOpenChange, taak }: Props) {
  const { updateTaak, addContactMoment } = useDataStore();
  const [uitkomst, setUitkomst] = useState<UitkomstKey>('geen');
  const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false);

  const reset = () => { setUitkomst('geen'); setNotitie(''); };

  const submit = async () => {
    if (!taak) return;
    setBezig(true);
    try {
      await updateTaak(taak.id, { status: 'afgerond' });

      const opt = OPTIES.find(o => o.key === uitkomst)!;
      if (opt.type) {
        const today = new Date().toISOString().slice(0, 10);
        await addContactMoment({
          momentDate: today,
          type: opt.type,
          direction: opt.direction,
          title: notitie.trim() || opt.defaultTitel || 'Contactmoment',
          description: notitie.trim() || undefined,
          followUpRequired: false,
          relatieId: taak.relatieId,
          objectId: taak.objectId,
          dealId: taak.dealId,
          taakId: taak.id,
        });
      }

      toast.success('Taak afgerond');
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Afronden mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Taak afronden</DialogTitle>
          <DialogDescription>
            {taak?.titel ?? ''}
            <br />
            Wil je hier ook een contactmoment bij loggen?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            {OPTIES.map(o => (
              <button
                key={o.key}
                type="button"
                onClick={() => setUitkomst(o.key)}
                className={`text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                  uitkomst === o.key
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {uitkomst !== 'geen' && (
            <div className="space-y-1.5">
              <Label htmlFor="taak-afronden-notitie" className="text-xs">Korte notitie (optioneel)</Label>
              <Textarea
                id="taak-afronden-notitie"
                value={notitie}
                onChange={e => setNotitie(e.target.value)}
                placeholder="Bijv. korte uitkomst of vervolgafspraak"
                rows={3}
              />
              {uitkomst === 'geen_gehoor' && (
                <p className="text-[11px] text-muted-foreground">
                  Wordt als activiteit gelogd, maar telt niet als 'Laatste contact'.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={bezig}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Taak afronden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
