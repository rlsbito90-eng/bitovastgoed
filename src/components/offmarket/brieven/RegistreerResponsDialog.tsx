// Dialog: registreer of wijzig een reactie van een geadresseerde op een (verstuurde) brief.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ModalActionBar from '@/components/ui/modal-action-bar';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
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
  RESPONS_LABEL, RESPONS_VOLGORDE, responsVervangtStandaardOpvolging,
  type Responsstatus,
} from '@/lib/offMarket/brieven/respons';
import { KANAAL_LABEL, type Kanaal } from '@/lib/offMarket/brieven/verzendstatus';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { useDataStore } from '@/hooks/useDataStore';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

export interface ResponsVervolgtaakVoorstel {
  titel: string;
  type: string;
  prioriteit: 'laag' | 'normaal' | 'hoog' | 'urgent';
  notities: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brief: OffMarketBrief | null;
  signaalId: string;
  relatieId?: string | null;
  /** Vooraf ingestelde responsstatus (bij snelle actieknoppen). */
  initialResponsstatus?: Responsstatus;
  /** Open na succesvolle responsregistratie de normale taakdialoog met deze prefill. */
  onVervolgtaakAanvragen?: (voorstel: ResponsVervolgtaakVoorstel) => void;
}

const KANAAL_OPTIES: Kanaal[] = ['post', 'email', 'telefoon', 'whatsapp', 'linkedin', 'anders'];

export default function RegistreerResponsDialog({
  open, onOpenChange, brief, signaalId, relatieId,
  initialResponsstatus = 'reactie_ontvangen',
  onVervolgtaakAanvragen,
}: Props) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const isBestaandeRespons = !!brief?.responsstatus;
  const standaardKanaal: Kanaal = ((brief?.kanaal as Kanaal | undefined) ?? 'email');

  const [responsstatus, setResponsstatus] = useState<Responsstatus>(initialResponsstatus);
  const [responsdatum, setResponsdatum] = useState(vandaag);
  const [respons_kanaal, setRespons_kanaal] = useState<Kanaal>(standaardKanaal);
  const [samenvatting, setSamenvatting] = useState('');
  const [maakContactmoment, setMaakContactmoment] = useState(true);
  const [maakVervolgtaak, setMaakVervolgtaak] = useState(false);
  const [bezig, setBezig] = useState(false);

  const registreer = useRegistreerRespons();
  const { updateTaak, taken } = useDataStore();

  const vulFormulier = () => {
    const bestaand = brief?.responsstatus as Responsstatus | null | undefined;
    const bestaandKanaal = brief?.respons_kanaal as Kanaal | null | undefined;
    setResponsstatus(bestaand ?? initialResponsstatus);
    setResponsdatum(brief?.responsdatum || vandaag);
    setRespons_kanaal(bestaandKanaal ?? standaardKanaal);
    setSamenvatting(brief?.respons_samenvatting ?? '');
    // Bij wijzigen geen dubbel contactmoment of dubbele taak voorstellen.
    setMaakContactmoment(!bestaand);
    setMaakVervolgtaak(false);
  };

  useEffect(() => {
    if (open) vulFormulier();
    // De state moet juist opnieuw worden opgebouwd wanneer een andere brief wordt geopend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brief?.id, brief?.responsstatus, brief?.responsdatum, brief?.respons_kanaal, brief?.respons_samenvatting, initialResponsstatus]);

  const rondStandaardOpvolgingAf = async () => {
    if (!brief?.gekoppelde_taak_id || !responsVervangtStandaardOpvolging(responsstatus)) return false;
    const taak = taken.find((t) => t.id === brief.gekoppelde_taak_id);
    if (!taak || taak.status === 'afgerond') return false;

    const reden = `Automatisch afgerond: er is op ${responsdatum} een reactie geregistreerd (${RESPONS_LABEL[responsstatus]}). De responsworkflow vervangt de oorspronkelijke briefopvolging.`;
    await updateTaak(taak.id, {
      status: 'afgerond',
      notities: [taak.notities, reden].filter(Boolean).join('\n\n'),
    } as any);
    return true;
  };

  const bouwVervolgtaakVoorstel = (): ResponsVervolgtaakVoorstel => ({
    titel: `Vervolg op reactie — ${brief?.eigenaar_bedrijfsnaam || brief?.eigenaar_naam || 'geadresseerde'}`,
    type: 'Follow-up',
    prioriteit: 'normaal',
    notities: `Vervolg op respons "${RESPONS_LABEL[responsstatus]}" via ${KANAAL_LABEL[respons_kanaal]}.${samenvatting.trim() ? `\n\n${samenvatting.trim()}` : ''}`,
  });

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

      let standaardOpvolgingAfgerond = false;
      try {
        standaardOpvolgingAfgerond = await rondStandaardOpvolgingAf();
      } catch (e) {
        console.warn('Oorspronkelijke briefopvolging afronden mislukt', e);
        toast.warning('Reactie is opgeslagen, maar de oude opvolgtaak kon niet automatisch worden afgerond.');
      }

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

      toast.success(isBestaandeRespons ? 'Reactie bijgewerkt' : 'Reactie geregistreerd', {
        description: maakVervolgtaak
          ? 'Stel nu de vervolgtaak in.'
          : standaardOpvolgingAfgerond
            ? 'De oorspronkelijke briefopvolging is afgerond; de respons is nu leidend.'
            : undefined,
      });

      // Eerst de responsdialoog sluiten; de oudercomponent opent vervolgens
      // de normale taakdialoog. Er wordt hier bewust géén taak stil aangemaakt.
      onOpenChange(false);
      if (maakVervolgtaak) onVervolgtaakAanvragen?.(bouwVervolgtaakVoorstel());
    } catch (e: any) {
      toast.error(e?.message ?? (isBestaandeRespons ? 'Reactie aanpassen mislukt' : 'Reactie registreren mislukt'));
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="registreer-respons-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {isBestaandeRespons ? 'Reactie aanpassen' : 'Reactie registreren'}
          </DialogTitle>
          <DialogDescription>
            {isBestaandeRespons
              ? 'Controleer of wijzig de reeds vastgelegde reactie. Bestaande gegevens zijn vooraf ingevuld.'
              : 'Leg vast hoe deze geadresseerde heeft gereageerd. Wordt opgeslagen op de brief en in het briefevent-logboek.'}
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

          {brief?.gekoppelde_taak_id && responsVervangtStandaardOpvolging(responsstatus) && (
            <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-foreground">
              De bestaande briefopvolging wordt bij opslaan automatisch afgerond. De geregistreerde reactie wordt daarna de leidende processtap.
            </div>
          )}

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox" checked={maakContactmoment}
                onChange={(e) => setMaakContactmoment(e.target.checked)}
                data-testid="respons-maak-contactmoment"
              />
              {isBestaandeRespons ? 'Nieuw contactmoment loggen' : 'Contactmoment loggen'}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox" checked={maakVervolgtaak}
                onChange={(e) => setMaakVervolgtaak(e.target.checked)}
                data-testid="respons-maak-vervolgtaak"
              />
              Vervolgtaak instellen na opslaan
            </label>
            {maakVervolgtaak && (
              <p className="pl-5 text-[11px] text-muted-foreground">
                Na het opslaan opent de taakdialoog. De taak wordt pas aangemaakt nadat je daar onder meer de deadline hebt gecontroleerd en bevestigd.
              </p>
            )}
          </div>
        </div>

        <ModalActionBar
          onCancel={() => onOpenChange(false)}
          cancelLabel="Annuleren"
          primary={
            <Button onClick={uitvoeren} disabled={bezig || !brief} data-testid="respons-bevestigen">
              {isBestaandeRespons ? 'Wijzigingen opslaan' : 'Bevestigen'}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
