// KadasterGebiedsdataKaart — main UI voor Kadaster & gebiedsdata-flow.
// - Twee knoppen: "Gebiedsdata ophalen (gratis)" en "Kadastergegevens
//   ophalen (€ 0,20)".
// - Bij meerdere huisnummers: dropdown om er één te kiezen vóór de call.
// - Bij betaalde call: kostenconfirmatie-dialog vooraf.
// - Geen automatische call bij render/load/save/adreswijziging.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileSearch, Coins, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useKadasterObjectinformatie } from '@/hooks/useKadasterObjectinformatie';
import { parseObjectAdres, normaliseerPostcode } from '@/lib/kadaster/adres';
import type { KadasterAdresInput, KadasterPreview, KadasterRequestInput } from '@/lib/kadaster/types';
import KadasterPreviewDialog from './KadasterPreviewDialog';

interface Props {
  objectId: string;
  adres: string | null | undefined;
  postcode: string | null | undefined;
  plaats: string | null | undefined;
  typeVastgoed?: string | null;
  /** Optioneel: callback voor handmatige overname van losse velden. */
  onOvernemenBouwjaar?: (jaar: number) => void;
  onOvernemenWozWaarde?: (waarde: number, peildatum?: string) => void;
}

function gebiedsVariantVoor(type?: string | null): 'buurtprofiel' | 'gebiedscontext' {
  if (!type) return 'gebiedscontext';
  const t = type.toLowerCase();
  if (t === 'wonen' || t === 'mixed_use' || t === 'ontwikkellocatie' || t === 'zorgvastgoed') {
    return 'buurtprofiel';
  }
  return 'gebiedscontext';
}

export default function KadasterGebiedsdataKaart({
  objectId, adres, postcode, plaats, typeVastgoed,
  onOvernemenBouwjaar, onOvernemenWozWaarde,
}: Props) {
  const parsed = useMemo(() => parseObjectAdres(adres, postcode, plaats),
    [adres, postcode, plaats]);

  // Lokale state: gekozen zoekadres. Default = eerste herkende huisnummer.
  const [postcodeInput, setPostcodeInput] = useState<string>(parsed.postcode ?? '');
  const [huisnummerKeuze, setHuisnummerKeuze] = useState<string>(
    parsed.huisnummers[0]?.label ?? ''
  );
  const [handmatigHuisnummer, setHandmatigHuisnummer] = useState<string>('');
  const [handmatigLetter, setHandmatigLetter] = useState<string>('');
  const [handmatigToevoeging, setHandmatigToevoeging] = useState<string>('');

  const [kostenOpen, setKostenOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<KadasterPreview | null>(null);

  const mutation = useKadasterObjectinformatie();
  const gebiedsVariant = useMemo(() => gebiedsVariantVoor(typeVastgoed), [typeVastgoed]);

  /** Bouw het uiteindelijke adres-payload op basis van keuzes. */
  function bouwAdresInput(): KadasterAdresInput | null {
    const pc = normaliseerPostcode(postcodeInput);
    if (!pc) return null;

    // Handmatig overschrijft de keuze als ingevuld
    if (handmatigHuisnummer.trim()) {
      return {
        postalcode: pc,
        houseNumber: handmatigHuisnummer.trim(),
        houseLetter: handmatigLetter.trim() || null,
        houseNumberAddition: handmatigToevoeging.trim() || null,
      };
    }
    const gekozen = parsed.huisnummers.find(h => h.label === huisnummerKeuze);
    if (!gekozen) return null;
    return {
      postalcode: pc,
      houseNumber: gekozen.huisnummer,
      houseLetter: gekozen.huisletter ?? null,
      houseNumberAddition: gekozen.toevoeging ?? null,
    };
  }

  const adresInput = bouwAdresInput();
  const adresKlaar = !!adresInput;

  async function voerCallUit(modus: 'gebiedsdata' | 'kadaster') {
    if (!adresInput) {
      toast.error('Vul postcode + huisnummer in voor de Kadaster-aanvraag.');
      return;
    }
    const input: KadasterRequestInput = {
      modus,
      adres: adresInput,
      context: { object_id: objectId },
    };
    try {
      const resp = await mutation.mutateAsync(input);
      setPreview(resp);
      setPreviewOpen(true);
      const aantal = resp.producten.filter(p => p.beschikbaar).length;
      toast.success(
        modus === 'gebiedsdata'
          ? `Gebiedsdata opgehaald (${aantal} product${aantal === 1 ? '' : 'en'})`
          : `Kadastergegevens opgehaald (${aantal} product${aantal === 1 ? '' : 'en'})`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kadaster-aanvraag mislukt';
      toast.error(msg);
    }
  }

  function startBetaaldeCall() {
    if (!adresKlaar) {
      toast.error('Vul postcode + huisnummer in voor de Kadaster-aanvraag.');
      return;
    }
    setKostenOpen(true);
  }

  const meerdere = parsed.huisnummers.length > 1;
  const adresLabel = adresInput
    ? [adresInput.postalcode, adresInput.houseNumber + (adresInput.houseLetter ?? ''),
       adresInput.houseNumberAddition].filter(Boolean).join(' ')
    : '—';

  return (
    <div className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            Kadaster & gebiedsdata
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Handmatig opvragen. Geen automatische bevraging. Resultaat eerst
            previewen — objectvelden worden nooit automatisch overschreven.
          </p>
        </div>
      </div>

      {/* Zoekadres-blok */}
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Zoekadres voor Kadaster</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Postcode</Label>
            <Input
              value={postcodeInput}
              onChange={(e) => setPostcodeInput(e.target.value)}
              placeholder="1234 AB"
              className="font-mono-data"
            />
          </div>
          {meerdere && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">
                Huisnummer (meerdere herkend — kies één)
              </Label>
              <Select value={huisnummerKeuze} onValueChange={setHuisnummerKeuze}>
                <SelectTrigger><SelectValue placeholder="Kies huisnummer" /></SelectTrigger>
                <SelectContent>
                  {parsed.huisnummers.map(h => (
                    <SelectItem key={h.label} value={h.label}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!meerdere && parsed.huisnummers.length === 1 && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Huisnummer</Label>
              <Input value={parsed.huisnummers[0].label} disabled className="font-mono-data" />
            </div>
          )}
        </div>

        {!parsed.betrouwbaar && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Adres niet betrouwbaar herkend — vul handmatig in:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={handmatigHuisnummer}
                onChange={(e) => setHandmatigHuisnummer(e.target.value.replace(/\D/g, ''))}
                placeholder="Huisnr"
                className="font-mono-data"
              />
              <Input
                value={handmatigLetter}
                onChange={(e) => setHandmatigLetter(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase())}
                placeholder="Letter"
                className="font-mono-data"
                maxLength={1}
              />
              <Input
                value={handmatigToevoeging}
                onChange={(e) => setHandmatigToevoeging(e.target.value.slice(0, 8))}
                placeholder="Toevoeging"
                className="font-mono-data"
                maxLength={8}
              />
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Aanvraag gebruikt: <span className="font-mono-data">{adresLabel}</span>
        </p>
      </div>

      {/* Knoppen */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={!adresKlaar || mutation.isPending}
          onClick={() => voerCallUit('gebiedsdata')}
        >
          <MapPin className="h-4 w-4 mr-2" />
          {mutation.isPending && mutation.variables?.modus === 'gebiedsdata'
            ? 'Bezig…' : 'Gebiedsdata ophalen (gratis)'}
        </Button>
        <Button
          className="flex-1"
          disabled={!adresKlaar || mutation.isPending}
          onClick={startBetaaldeCall}
        >
          <Coins className="h-4 w-4 mr-2" />
          {mutation.isPending && mutation.variables?.modus === 'kadaster'
            ? 'Bezig…' : 'Kadastergegevens ophalen (€ 0,20)'}
        </Button>
      </div>

      {/* Kostenconfirmatie-dialog (alleen betaalde call) */}
      <Dialog open={kostenOpen} onOpenChange={setKostenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4" /> Kosten bevestigen
            </DialogTitle>
            <DialogDescription>
              Deze aanvraag wordt door Kadaster in rekening gebracht.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zoekadres</span>
                <span className="font-mono-data">{adresLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">WOZ-object</span>
                <span className="font-mono-data">± € 0,10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Koopsom</span>
                <span className="font-mono-data">± € 0,10</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1 font-medium">
                <span>Geschatte kosten</span>
                <span className="font-mono-data">± € 0,20</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bij ontbrekend product wordt de overige informatie alsnog geleverd
              (deliver = withoutProduct).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKostenOpen(false)}
              disabled={mutation.isPending}>
              Annuleren
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={async () => {
                setKostenOpen(false);
                await voerCallUit('kadaster');
              }}
            >
              {mutation.isPending ? 'Bezig…' : 'Ophalen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KadasterPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        gebiedsVariant={gebiedsVariant}
        onOvernemenBouwjaar={onOvernemenBouwjaar}
        onOvernemenWozWaarde={onOvernemenWozWaarde}
      />
    </div>
  );
}
