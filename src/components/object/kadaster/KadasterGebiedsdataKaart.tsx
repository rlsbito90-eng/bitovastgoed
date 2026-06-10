// KadasterGebiedsdataKaart — Kadaster Objectinformatie-flow (V1.1).
//
// Belangrijke regels (zie Fase 4K.2-correctie):
//   - Eén knop: "Kadastergegevens ophalen". Standalone gratis aanvragen
//     worden door Kadaster geweigerd ("minimaal één betaald product
//     vereist"), dus die optie biedt de UI niet meer aan.
//   - Postcodes worden zowel met als zonder spatie geaccepteerd; vóór de
//     edge-function-call altijd genormaliseerd naar `3273AV` (geen spatie,
//     uppercase). UI toont de aanvraagwaarde expliciet zodat de gebruiker
//     ziet wat er naar Kadaster gaat.
//   - Knoppen blijven uitgeschakeld zolang postcode niet voldoet aan
//     4 cijfers + 2 letters of het huisnummer ontbreekt.
//   - Geen automatische calls; kostenconfirmatie verplicht vóór elke
//     betaalde aanvraag.
//   - Geen hardgecodeerde prijs; UI toont "prijs volgens Kadaster".
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileSearch, Coins, MapPin, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useKadasterObjectinformatie, KadasterApiError } from '@/hooks/useKadasterObjectinformatie';
import { parseObjectAdres } from '@/lib/kadaster/adres';
import type {
  KadasterAdresInput, KadasterDebug, KadasterPreview, KadasterProductCode, KadasterRequestInput,
} from '@/lib/kadaster/types';
import KadasterPreviewDialog from './KadasterPreviewDialog';

interface Props {
  objectId: string;
  adres: string | null | undefined;
  postcode: string | null | undefined;
  plaats: string | null | undefined;
  typeVastgoed?: string | null;
  onOvernemenBouwjaar?: (jaar: number) => void;
  onOvernemenWozWaarde?: (waarde: number, peildatum?: string) => void;
}

/**
 * Normaliseer postcode strikt naar API-formaat: "3273AV".
 * Geeft null wanneer het niet voldoet aan 4 cijfers + 2 letters.
 */
function normaliseerPostcodeStrikt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? compact : null;
}

/** Mensleesbare weergave "3273 AV" — alleen voor UI. */
function formatPostcodeMens(api: string): string {
  return `${api.slice(0, 4)} ${api.slice(4)}`;
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

  // UI mag spaties bevatten; we accepteren beide vormen. Bron is altijd
  // het gestructureerde `postcode`-veld; pas terug naar parser-resultaat
  // als dat leeg is.
  const [postcodeInput, setPostcodeInput] = useState<string>(
    (postcode ?? parsed.postcode ?? '').toString(),
  );
  const [huisnummerKeuze, setHuisnummerKeuze] = useState<string>(
    parsed.huisnummers[0]?.label ?? '',
  );
  const [handmatigHuisnummer, setHandmatigHuisnummer] = useState<string>('');
  const [handmatigLetter, setHandmatigLetter] = useState<string>('');
  const [handmatigToevoeging, setHandmatigToevoeging] = useState<string>('');

  // Adres-zoekmodus (V1): UI-helper om de gebruiker te helpen bij invoer.
  // De API-call gebruikt nóóit straat/plaats — Kadaster verwacht uiteindelijk
  // postcode+huisnummer of een BAG-ID.
  const [zoekModus, setZoekModus] = useState<'postcode' | 'adres'>('postcode');
  const [adresStraat, setAdresStraat] = useState<string>('');
  const [adresPlaats, setAdresPlaats] = useState<string>(plaats ?? '');
  const [adresHuisnummer, setAdresHuisnummer] = useState<string>('');
  const [adresLetter, setAdresLetter] = useState<string>('');
  const [adresToevoeging, setAdresToevoeging] = useState<string>('');

  // Productselectie in de kostenconfirmatie. `lasten`/`buurt` worden in V1
  // niet aangeboden: ze zijn niet bevestigd via Kadaster's /products
  // endpoint en eerdere /report-aanvragen retourneerden HTTP 409
  // "onbekende producten". Pas aanzetten als /products ze expliciet teruggeeft.
  const [selObject, setSelObject] = useState(true);
  const [selWaarde, setSelWaarde] = useState(true);

  const [kostenOpen, setKostenOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<KadasterPreview | null>(null);
  const [laatsteFout, setLaatsteFout] = useState<{
    msg: string; httpStatus?: number; debug?: KadasterDebug | null;
  } | null>(null);

  const mutation = useKadasterObjectinformatie();
  const gebiedsVariant = useMemo(() => gebiedsVariantVoor(typeVastgoed), [typeVastgoed]);

  // Genormaliseerde postcode (API-formaat) — bron voor zowel validatie als
  // request. Null = ongeldig.
  const postcodeApi = useMemo(
    () => normaliseerPostcodeStrikt(postcodeInput),
    [postcodeInput],
  );

  /**
   * Bouw het uiteindelijke adres-payload op basis van de actieve modus.
   * In adresmodus is `postcode` formeel nog steeds vereist — Kadaster
   * accepteert geen straat/plaats. De adresvelden zijn een UI-helper om
   * de gebruiker te helpen het juiste pand te identificeren.
   */
  function bouwAdresInput(): KadasterAdresInput | null {
    if (!postcodeApi) return null;

    if (zoekModus === 'adres') {
      const nr = adresHuisnummer.trim();
      if (!nr) return null;
      return {
        postalcode: postcodeApi,
        houseNumber: nr,
        houseLetter: adresLetter.trim() || null,
        houseNumberAddition: adresToevoeging.trim() || null,
      };
    }

    if (handmatigHuisnummer.trim()) {
      return {
        postalcode: postcodeApi,
        houseNumber: handmatigHuisnummer.trim(),
        houseLetter: handmatigLetter.trim() || null,
        houseNumberAddition: handmatigToevoeging.trim() || null,
      };
    }
    const gekozen = parsed.huisnummers.find(h => h.label === huisnummerKeuze);
    if (!gekozen) return null;
    return {
      postalcode: postcodeApi,
      houseNumber: gekozen.huisnummer,
      houseLetter: gekozen.huisletter ?? null,
      houseNumberAddition: gekozen.toevoeging ?? null,
    };
  }

  const adresInput = bouwAdresInput();
  const adresKlaar = !!adresInput;
  const heeftBetaaldProduct = selObject || selWaarde;

  function geselecteerdeProducten(): KadasterProductCode[] {
    const out: KadasterProductCode[] = [];
    if (selObject) out.push('object');
    if (selWaarde) out.push('waarde');
    return out;
  }

  async function voerCallUit() {
    if (!adresInput) {
      toast.error('Vul een geldige postcode (4 cijfers + 2 letters) en huisnummer in.');
      return;
    }
    if (!heeftBetaaldProduct) {
      toast.error('Selecteer minimaal één betaald product (WOZ-object of Koopsom).');
      return;
    }
    setLaatsteFout(null);
    const input: KadasterRequestInput = {
      modus: 'kadaster',
      adres: adresInput,
      producten: geselecteerdeProducten(),
      context: { object_id: objectId },
    };
    try {
      const resp = await mutation.mutateAsync(input);
      setPreview(resp);
      setPreviewOpen(true);
      const aantal = resp.producten.filter(p => p.beschikbaar).length;
      toast.success(`Kadastergegevens opgehaald (${aantal} product${aantal === 1 ? '' : 'en'})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kadaster-aanvraag mislukt';
      const apiErr = e instanceof KadasterApiError ? e : null;
      setLaatsteFout({
        msg,
        httpStatus: apiErr?.httpStatus,
        debug: apiErr?.debug ?? null,
      });
      toast.error(msg);
    }
  }

  function startCall() {
    if (!adresKlaar) {
      toast.error('Vul een geldige postcode (4 cijfers + 2 letters) en huisnummer in.');
      return;
    }
    setKostenOpen(true);
  }

  const meerdere = parsed.huisnummers.length > 1;
  const adresLabel = adresInput
    ? [
        adresInput.postalcode,
        adresInput.houseNumber + (adresInput.houseLetter ?? ''),
        adresInput.houseNumberAddition,
      ].filter(Boolean).join(' ')
    : '—';
  const postcodeHint = postcodeApi
    ? `${formatPostcodeMens(postcodeApi)} → ${postcodeApi}`
    : 'Voer postcode in (4 cijfers + 2 letters)';

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
            Gratis gebiedsdata wordt alleen meegeleverd bij een betaalde
            Kadaster-aanvraag.
          </p>
        </div>
      </div>

      {/* Zoekadres-blok met modus-tabs */}
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Zoekadres voor Kadaster</span>
        </div>

        <Tabs value={zoekModus} onValueChange={(v) => setZoekModus(v as 'postcode' | 'adres')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="postcode">Postcode + huisnummer</TabsTrigger>
            <TabsTrigger value="adres">Adres</TabsTrigger>
          </TabsList>

          <TabsContent value="postcode" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Postcode</Label>
                <Input
                  value={postcodeInput}
                  onChange={(e) => setPostcodeInput(e.target.value)}
                  placeholder="1234 AB"
                  className="font-mono-data"
                />
                <p className="text-[10px] text-muted-foreground font-mono-data">{postcodeHint}</p>
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

            {(parsed.huisnummers.length === 0 || !parsed.betrouwbaar) && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  {parsed.huisnummers.length === 0
                    ? 'Geen huisnummer herkend — vul handmatig in:'
                    : 'Adres niet betrouwbaar herkend — vul handmatig in:'}
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
          </TabsContent>

          <TabsContent value="adres" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] text-muted-foreground">Straatnaam</Label>
                <Input value={adresStraat} onChange={(e) => setAdresStraat(e.target.value)} placeholder="Bijv. Prins Willem Alexanderlaan" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Huisnummer</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={adresHuisnummer}
                    onChange={(e) => setAdresHuisnummer(e.target.value.replace(/\D/g, ''))}
                    placeholder="30"
                    className="font-mono-data"
                  />
                  <Input
                    value={adresLetter}
                    onChange={(e) => setAdresLetter(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase())}
                    placeholder="L"
                    className="font-mono-data"
                    maxLength={1}
                  />
                  <Input
                    value={adresToevoeging}
                    onChange={(e) => setAdresToevoeging(e.target.value.slice(0, 8))}
                    placeholder="Toev."
                    className="font-mono-data"
                    maxLength={8}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Plaats</Label>
                <Input value={adresPlaats} onChange={(e) => setAdresPlaats(e.target.value)} placeholder="Westmaas" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] text-muted-foreground">Postcode (vereist voor Kadaster)</Label>
                <Input
                  value={postcodeInput}
                  onChange={(e) => setPostcodeInput(e.target.value)}
                  placeholder="1234 AB"
                  className="font-mono-data"
                />
                <p className="text-[10px] text-muted-foreground font-mono-data">{postcodeHint}</p>
              </div>
            </div>
            {!postcodeApi && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Voor Kadaster is uiteindelijk een postcode + huisnummer nodig.
                Vul de postcode aan of gebruik een gekoppelde adreszoekservice.
                Straat en plaats helpen alleen bij identificatie en worden niet
                naar Kadaster gestuurd.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground">
          Aanvraag gebruikt: <span className="font-mono-data">{adresLabel}</span>
        </p>
      </div>

      {/* Foutmelding met veilige debug-info */}
      {laatsteFout && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">{laatsteFout.msg}</p>
              {laatsteFout.debug?.zoekadres?.waarde && (
                <p className="text-[11px] text-muted-foreground font-mono-data">
                  Gecontroleerd zoekadres: {laatsteFout.debug.zoekadres.waarde}
                </p>
              )}
            </div>
          </div>
          {laatsteFout.debug && (
            <Collapsible>
              <CollapsibleTrigger className="text-[11px] text-muted-foreground underline">
                Technische details
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-[10px] bg-muted/40 rounded p-2 mt-1 overflow-x-auto font-mono-data">
{JSON.stringify({
  http_status: laatsteFout.httpStatus,
  endpoint: laatsteFout.debug.endpoint,
  base_url: laatsteFout.debug.base_url,
  request_preview: laatsteFout.debug.request_preview,
  product_codes: laatsteFout.debug.product_codes,
  upstream_status: laatsteFout.debug.upstream_status,
  upstream_message: laatsteFout.debug.upstream_message,
  upstream_identifier: laatsteFout.debug.upstream_identifier,
  upstream_snippet: laatsteFout.debug.upstream_snippet,
}, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}


      {/* Eén knop — gratis gebiedsdata wordt meegeleverd binnen deze aanvraag. */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          className="flex-1"
          disabled={!adresKlaar || mutation.isPending}
          onClick={startCall}
        >
          <Coins className="h-4 w-4 mr-2" />
          {mutation.isPending ? 'Bezig…' : 'Kadastergegevens ophalen'}
        </Button>
      </div>

      {/* Kostenconfirmatie-dialog met productselectie */}
      <Dialog open={kostenOpen} onOpenChange={setKostenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4" /> Producten en kosten bevestigen
            </DialogTitle>
            <DialogDescription>
              Deze aanvraag wordt door Kadaster in rekening gebracht.
              Gratis producten worden alleen meegeleverd binnen een betaalde
              aanvraag — selecteer daarom minimaal één betaald product.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Zoekadres</span>
                <span className="font-mono-data">{adresLabel}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Betaalde producten (minimaal één)
              </p>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={selObject}
                    onCheckedChange={(v) => setSelObject(v === true)}
                  />
                  <span>WOZ-object</span>
                </span>
                <span className="text-xs text-muted-foreground">prijs volgens Kadaster</span>
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={selWaarde}
                    onCheckedChange={(v) => setSelWaarde(v === true)}
                  />
                  <span>Koopsom</span>
                </span>
                <span className="text-xs text-muted-foreground">prijs volgens Kadaster</span>
              </label>

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground pt-1">
                Gratis meegeleverd
              </p>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={selLasten}
                    onCheckedChange={(v) => setSelLasten(v === true)}
                  />
                  <span>Gemeentelijke lasten</span>
                </span>
                <span className="text-xs text-muted-foreground">€ 0,00</span>
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={selBuurt}
                    onCheckedChange={(v) => setSelBuurt(v === true)}
                  />
                  <span>Buurtstatistieken</span>
                </span>
                <span className="text-xs text-muted-foreground">€ 0,00</span>
              </label>
            </div>

            {!heeftBetaaldProduct && (
              <p className="text-xs text-destructive">
                Selecteer minimaal één betaald product om de aanvraag te kunnen
                starten.
              </p>
            )}

            <p className="text-[11px] text-muted-foreground">
              Totaalprijs volgens Kadaster wordt na de aanvraag zichtbaar.
              Ontbrekende producten blokkeren de overige niet
              (deliver = withoutProduct).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKostenOpen(false)}
              disabled={mutation.isPending}>
              Annuleren
            </Button>
            <Button
              disabled={mutation.isPending || !heeftBetaaldProduct}
              onClick={async () => {
                setKostenOpen(false);
                await voerCallUit();
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
