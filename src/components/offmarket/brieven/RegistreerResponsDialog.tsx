// Dialog: registreer een reactie van een geadresseerde op een (verstuurde) brief.
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MessageSquare } from 'lucide-react';
import { useRegistreerRespons } from '@/hooks/useRegistreerRespons';
import {
  RESPONS_LABEL, RESPONS_VOLGORDE, type Responsstatus,
} from '@/lib/offMarket/brieven/respons';
import { KANAAL_LABEL, type Kanaal } from '@/lib/offMarket/brieven/verzendstatus';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { useDataStore } from '@/hooks/useDataStore';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brief: OffMarketBrief | null;
  signaalId: string;
  relatieId?: string | null;
  /** Vooraf ingestelde responsstatus (bij snelle actieknoppen). */
  initialResponsstatus?: Responsstatus;
}

const KANAAL_OPTIES: Kanaal[] = ['post', 'email', 'telefoon', 'whatsapp', 'linkedin', 'anders'];

export default function RegistreerResponsDialog({
  open, onOpenChange, brief, signaalId, relatieId,
  initialResponsstatus = 'reactie_ontvangen',
}: Props) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const [responsstatus, setResponsstatus] = useState<Responsstatus>(initialResponsstatus);
  const [responsdatum, setResponsdatum] = useState(vandaag);
  // V2.2 — default-responskanaal volgt het kanaal van de brief.
  const defaultKanaal: Kanaal = ((brief?.kanaal as Kanaal | undefined) ?? 'email');
  const [respons_kanaal, setRespons_kanaal] = useState<Kanaal>(defaultKanaal);
  const [samenvatting, setSamenvatting] = useState('');
  const [maakContactmoment, setMaakContactmoment] = useState(true);
  const [maakVervolgtaak, setMaakVervolgtaak] = useState(false);
  const [bezig, setBezig] = useState(false);

  const registreer = useRegistreerRespons();
  const { addTaak } = useDataStore();

  // Reset wanneer dialog opent met andere brief/initiële status
  const reset = () => {
    setResponsstatus(initialResponsstatus);
    setResponsdatum(vandaag);
    setRespons_kanaal(((brief?.kanaal as Kanaal | undefined) ?? 'email'));
    setSamenvatting('');
    setMaakContactmoment(true);
    setMaakVervolgtaak(false);
  };

  const uitvoeren = async () => {
    if (!brief) return;
    setBezig(true);
    try {
      await registreer.mutateAsync({
        brief_id: brief.id,
        signaal_id: signaalId,
        geadresseerde_key: brief.geadresseerde_key ?? null,
        campagne_stap: (brief.campagne_stap as any) ?? null,
        responsstatus,
        responsdatum,
        respons_kanaal,
        respons_samenvatting: samenvatting.trim() || null,
      });

      if (maakContactmoment) {
        try {
          await logSystemContactMoment({
            type: respons_kanaal === 'email' ? 'email'
                : respons_kanaal === 'telefoon' ? 'telefoon'
                : 'notitie',
            title: `Reactie: ${RESPONS_LABEL[responsstatus]}`,
            description: samenvatting.trim()
              || `Reactie van ${brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam || 'geadresseerde'} via ${KANAAL_LABEL[respons_kanaal]}.`,
            offMarketSignaalId: signaalId,
            relatieId: relatieId ?? null,
            systemKey: `off_market_respons:${brief.id}:${responsdatum}`,
          });
        } catch (e) { console.warn('Contactmoment loggen mislukt', e); }
      }

      if (maakVervolgtaak) {
        try {
          await addTaak({
            titel: `Vervolg op reactie — ${brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam || 'geadresseerde'}`,
            type: 'Follow-up',
            deadline: vandaag,
            prioriteit: 'normaal',
            status: 'open',
            offMarketSignaalId: signaalId,
            relatieId: relatieId ?? undefined,
            notities: `Vervolg op respons "${RESPONS_LABEL[responsstatus]}" via ${KANAAL_LABEL[respons_kanaal]}.${samenvatting.trim() ? `\n\n${samenvatting.trim()}` : ''}`,
          } as any);
        } catch (e) { console.warn('Vervolgtaak aanmaken mislukt', e); }
      }

      toast.success('Reactie geregistreerd');
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? 'Reactie registreren mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}
    >
      <DialogContent className="max-w-md" data-testid="registreer-respons-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Reactie registreren
          </DialogTitle>
          <DialogDescription>
            Leg vast hoe deze geadresseerde heeft gereageerd. Wordt opgeslagen
            op de brief en in het briefevent-logboek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Responsstatus</Label>
            <Select value={responsstatus} onValueChange={(v) => setResponsstatus(v as Responsstatus)}>
              <SelectTrigger data-testid="respons-status-trigger"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESPONS_VOLGORDE.map((s) => (
                  <SelectItem key={s} value={s}>{RESPONS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsdatum">Datum</Label>
              <Input
                id="responsdatum" type="date" value={responsdatum}
                onChange={(e) => setResponsdatum(e.target.value)}
                data-testid="respons-datum-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kanaal</Label>
              <Select value={respons_kanaal} onValueChange={(v) => setRespons_kanaal(v as Kanaal)}>
                <SelectTrigger data-testid="respons-kanaal-trigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KANAAL_OPTIES.map((k) => (
                    <SelectItem key={k} value={k}>{KANAAL_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="respons-samenvatting">Samenvatting (optioneel)</Label>
            <Textarea
              id="respons-samenvatting"
              value={samenvatting}
              onChange={(e) => setSamenvatting(e.target.value)}
              rows={4}
              data-testid="respons-samenvatting-input"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox" checked={maakContactmoment}
                onChange={(e) => setMaakContactmoment(e.target.checked)}
                data-testid="respons-maak-contactmoment"
              />
              Contactmoment loggen
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox" checked={maakVervolgtaak}
                onChange={(e) => setMaakVervolgtaak(e.target.checked)}
                data-testid="respons-maak-vervolgtaak"
              />
              Vervolgtaak aanmaken
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>
            Annuleren
          </Button>
          <Button onClick={uitvoeren} disabled={bezig || !brief} data-testid="respons-bevestigen">
            Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
