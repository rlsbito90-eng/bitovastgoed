// Dialog: markeer brief als verstuurd op een specifieke postdatum.
// De follow-up wordt berekend vanaf postdatum + 21 dagen.
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';
import { useMarkBriefVerstuurd, type OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useDataStore } from '@/hooks/useDataStore';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';

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

  const followUp = berekenFollowUpDeadline(postdatum);

  const uitvoeren = async () => {
    if (!brief) return;
    setBezig(true);
    try {
      // Maak eerst de opvolgtaak aan (dedupe), zodat we het taak-id meteen
      // kunnen koppelen aan de brief in dezelfde mutation-keten.
      let taakId: string | null = null;
      const eigenaarKey = (brief.eigenaar_naam ?? brief.eigenaar_bedrijfsnaam ?? '').trim().toLowerCase();
      const bestaande = (taken ?? []).find((t: any) =>
        t?.offMarketSignaalId === signaalId
        && t?.status === 'open'
        && typeof t?.titel === 'string'
        && /brief\s*2|brief opvolgen/i.test(t.titel)
        && (!eigenaarKey || (t.notities ?? '').toLowerCase().includes(eigenaarKey)),
      );
      if (bestaande) {
        taakId = (bestaande as any).id ?? null;
      } else {
        try {
          const nieuw = await addTaak({
            titel: 'Brief 2 voorbereiden / opvolgen',
            type: 'Follow-up',
            deadline: followUp,
            prioriteit: 'normaal',
            status: 'open',
            offMarketSignaalId: signaalId,
            relatieId: relatieId ?? undefined,
            notities: `Opvolging voor brief aan ${brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam || 'eigenaar'} · post ${postdatum} · deadline ${followUp}.`,
          } as any);
          taakId = nieuw?.id ?? null;
        } catch (e) { console.warn('Opvolgtaak aanmaken mislukt', e); }
      }

      await markeer.mutateAsync({ id: brief.id, postdatum, gekoppelde_taak_id: taakId });

      try {
        await logSystemContactMoment({
          type: 'notitie',
          title: 'Brief verzonden',
          description: `Postdatum ${postdatum}; opvolging gepland op ${followUp}.`,
          offMarketSignaalId: signaalId,
          relatieId: relatieId ?? null,
          systemKey: `off_market_brief_verstuurd:${brief.id}`,
        });
      } catch (e) { console.warn('Contactmoment loggen mislukt', e); }

      toast.success('Brief gemarkeerd als verstuurd');
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
            <Send className="h-4 w-4" /> Markeer als verstuurd
          </DialogTitle>
          <DialogDescription>
            Vul de postdatum in. De opvolging wordt berekend op postdatum + 21 dagen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="postdatum">Postdatum</Label>
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
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
          <Button onClick={uitvoeren} disabled={bezig || !postdatum} data-testid="markeer-verstuurd-bevestig">
            <Send className="h-4 w-4" /> Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
