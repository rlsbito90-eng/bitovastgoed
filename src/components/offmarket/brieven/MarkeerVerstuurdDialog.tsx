// Dialog: markeer brief/e-mail als verstuurd op een specifieke datum.
// Voor post: opvolging = postdatum + 21 dagen.
// Voor e-mail: opvolging = verzenddatum + 7 dagen (V2.2).
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import ModalActionBar from '@/components/ui/modal-action-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';
import { useMarkBriefVerstuurd, type OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useDataStore } from '@/hooks/useDataStore';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';
import { defaultFollowupDagen } from '@/lib/offMarket/email/emailProfielen';
import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';

export default function MarkeerVerstuurdDialog({
  open, onOpenChange, brief, signaalId, relatieId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brief: OffMarketBrief | null;
  signaalId: string;
  relatieId?: string | null;
}) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const [postdatum, setPostdatum] = useState(vandaag);
  const [bezig, setBezig] = useState(false);
  const markeer = useMarkBriefVerstuurd();
  const { addTaak, taken } = useDataStore();

  const kanaal: Kanaal = ((brief?.kanaal as Kanaal | undefined) ?? 'post');
  const isEmail = kanaal === 'email';
  const dagen = defaultFollowupDagen(kanaal);
  const followUp = berekenFollowUpDeadline(postdatum, dagen);

  const uitvoeren = async () => {
    if (!brief) return;
    setBezig(true);
    try {
      const geadresseerdeLabel =
        brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam || 'eigenaar';
      const stap = (brief.campagne_stap ?? '') as string;
      const stapNr = stap.endsWith('_2') ? 2 : stap.endsWith('_3') ? 3 : 1;
      const taakTitel = isEmail
        ? `E-mail opvolgen — ${geadresseerdeLabel} — E-mail ${stapNr}`
        : 'Brief 2 voorbereiden / opvolgen';
      const taakRegex = isEmail ? /e-mail opvolgen/i : /brief\s*2|brief opvolgen/i;

      let taakId: string | null = null;
      const eigenaarKey = (brief.eigenaar_naam ?? brief.eigenaar_bedrijfsnaam ?? '').trim().toLowerCase();
      const bestaande = (taken ?? []).find((t: any) =>
        t?.offMarketSignaalId === signaalId
        && t?.status === 'open'
        && typeof t?.titel === 'string'
        && taakRegex.test(t.titel)
        && (!eigenaarKey || (t.notities ?? '').toLowerCase().includes(eigenaarKey)),
      );
      if (bestaande) {
        taakId = (bestaande as any).id ?? null;
      } else {
        try {
          const nieuw = await addTaak({
            titel: taakTitel,
            type: 'Follow-up',
            deadline: followUp,
            prioriteit: 'normaal',
            status: 'open',
            offMarketSignaalId: signaalId,
            relatieId: relatieId ?? undefined,
            notities: `Opvolging voor ${isEmail ? 'e-mail' : 'brief'} aan ${geadresseerdeLabel} · ${isEmail ? 'verzenddatum' : 'post'} ${postdatum} · deadline ${followUp}.`,
          } as any);
          taakId = nieuw?.id ?? null;
        } catch (e) { console.warn('Opvolgtaak aanmaken mislukt', e); }
      }

      await markeer.mutateAsync({
        id: brief.id, postdatum, gekoppelde_taak_id: taakId, kanaal,
      });

      try {
        await logSystemContactMoment({
          type: isEmail ? 'email' : 'notitie',
          title: isEmail ? 'E-mail verzonden' : 'Brief verzonden',
          description: `${isEmail ? 'Verzenddatum' : 'Postdatum'} ${postdatum}; opvolging gepland op ${followUp}.`,
          offMarketSignaalId: signaalId,
          relatieId: relatieId ?? null,
          systemKey: `off_market_brief_verstuurd:${brief.id}`,
        });
      } catch (e) { console.warn('Contactmoment loggen mislukt', e); }

      toast.success(isEmail ? 'E-mail gemarkeerd als verzonden' : 'Brief gemarkeerd als verstuurd');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Markeren als verstuurd mislukt');
    } finally {
      setBezig(false);
    }
  };


  const fmt = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {isEmail ? 'Markeer e-mail als verzonden' : 'Markeer als verstuurd'}
          </DialogTitle>
          <DialogDescription>
            {isEmail
              ? `Vul de verzenddatum in. De opvolging wordt berekend op verzenddatum + ${dagen} dagen.`
              : `Vul de postdatum in. De opvolging wordt berekend op postdatum + ${dagen} dagen.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="postdatum">{isEmail ? 'Verzenddatum' : 'Postdatum'}</Label>
            <Input
              id="postdatum"
              type="date"
              value={postdatum}
              onChange={(e) => setPostdatum(e.target.value)}
              data-testid="postdatum-input"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Opvolging wordt gepland op <span className="font-medium text-foreground">{fmt(followUp)}</span>.
          </p>
        </div>
        <ModalActionBar
          onCancel={() => onOpenChange(false)}
          cancelLabel="Annuleren"
          primary={
            <Button onClick={uitvoeren} disabled={bezig || !postdatum} data-testid="markeer-verstuurd-bevestig">
              <Send className="h-4 w-4" /> Bevestigen
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
