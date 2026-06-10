// SignaalKadasterKaart — Fase 4K.4D
//
// Kadasterkaart op Off Market Signaal-detail. In V1 ondersteunt deze kaart
// alleen:
//   - `rechten` (Rechten/eigendomsinformatie)  — extra privacy-bevestiging
//   - `waarde`  (Koopsom)                       — disclaimer "geen marktwaarde"
//
// WOZ-object / product `object` wordt bewust NIET aangeboden in de
// signaalfase; dat is voorbehouden aan Objecten/Aanbod.
//
// Resultaten worden direct opgeslagen in `kadaster_data_records` met
// `signaal_id`. Geen automatische call, geen relatie-/eigenaarkoppeling,
// geen AI-herberekening.
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileSearch, Coins, MapPin, AlertCircle, Archive, ChevronDown, ChevronUp,
} from 'lucide-react';
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useKadasterObjectinformatie, KadasterApiError } from '@/hooks/useKadasterObjectinformatie';
import { useKadasterProductCatalogus } from '@/hooks/useKadasterProductCatalogus';
import {
  useKadasterDataRecordsForSignaal, laatsteRecordsPerProduct,
  type KadasterDataRecord,
} from '@/hooks/useKadasterDataRecords';
import {
  useKadasterDocumentenForSignaal, documentenPerRecord,
  type KadasterDocument,
} from '@/hooks/useKadasterDocumenten';
import KadasterPdfKnop from '@/components/object/kadaster/KadasterPdfKnop';
import KadasterPreviewDialog from '@/components/object/kadaster/KadasterPreviewDialog';
import KadasterHistorieLijst from '@/components/object/kadaster/KadasterHistorieLijst';
import BagAdresLookup from '@/components/shared/BagAdresLookup';
import type { BagAdresResultaat } from '@/lib/bag/pdokLookup';
import { parseObjectAdres } from '@/lib/kadaster/adres';
import type {
  KadasterAdresInput, KadasterDebug, KadasterPreview,
  KadasterProductCode, KadasterRequestInput,
} from '@/lib/kadaster/types';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

/** In Off Market Radar V1 alleen rechten + waarde toegestaan. */
export const SIGNAAL_ALLOWED_PRODUCTS: KadasterProductCode[] = ['rechten', 'waarde'];

function normaliseerPostcodeStrikt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? compact : null;
}
function formatPostcodeMens(api: string): string {
  return `${api.slice(0, 4)} ${api.slice(4)}`;
}
function fmtDatum(iso: string): string {
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}
function fmtEur(n: number | null): string {
  return n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('nl-NL', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
      }).format(n);
}
function fmtZoekadres(z: Record<string, unknown>): string {
  const w = z && typeof (z as { waarde?: unknown }).waarde === 'string'
    ? (z as { waarde: string }).waarde : null;
  return w ?? '—';
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-data text-right">
        {value === null || value === undefined || value === '' ? '—' : value}
      </span>
    </div>
  );
}

function PdfRegel({ doc }: { doc: KadasterDocument | undefined }) {
  if (!doc) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1.5 mt-1.5">
      <span className="text-[11px] text-muted-foreground">Kadasterbericht opgeslagen</span>
      <KadasterPdfKnop document={doc} label="Kadasterbericht openen" />
    </div>
  );
}

function WaardeRecordBlok({ r, pdf }: { r: KadasterDataRecord; pdf?: KadasterDocument }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
      <p className="text-sm font-medium">Kadaster-koopsom</p>
      <p className="text-[11px] text-muted-foreground">
        Historische transactie volgens Kadaster — geen marktwaarde, vraagprijs
        of taxatiewaarde.
      </p>
      <Row label="Koopsom" value={fmtEur(r.koopsom)} />
      <Row label="Koopjaar" value={r.koopjaar} />
      <Row label="Valuta" value={r.koopsom_valuta} />
      <Row
        label="Meer onroerend goed"
        value={r.meer_onroerend_goed === null ? null : (r.meer_onroerend_goed ? 'Ja' : 'Nee')}
      />
      <PdfRegel doc={pdf} />
    </div>
  );
}

function RechtenRecordBlok({ r, pdf }: { r: KadasterDataRecord; pdf?: KadasterDocument }) {
  const sam = r.rechten_samenvatting ?? {};
  const aantal = typeof (sam as { aantal_rechthebbenden?: unknown }).aantal_rechthebbenden === 'number'
    ? (sam as { aantal_rechthebbenden: number }).aantal_rechthebbenden : null;
  const heeftVelden = !!(r.rechthebbende_naam || r.rechtsoort
    || r.aandeel || r.kadastrale_aanduiding);
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
      <p className="text-sm font-medium">Rechthebbende volgens Kadaster</p>
      <p className="text-[11px] text-muted-foreground">
        Intern opgeslagen als Kadasterrecord. Niet automatisch gekoppeld aan
        relaties, eigenaar of verkoper.
      </p>
      {!heeftVelden ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
          {pdf
            ? 'Rechten geleverd. Rechthebbendevelden niet herkend in JSON, maar Kadasterbericht is opgeslagen.'
            : 'Rechten geleverd, maar rechthebbende-velden nog niet herkend. Bekijk technische details in de historie.'}
        </p>
      ) : (
        <>
          <Row label="Aantal rechthebbenden" value={aantal} />
          <Row label="Naam" value={r.rechthebbende_naam} />
          <Row label="Type" value={r.rechthebbende_type} />
          <Row label="Rechtsoort" value={r.rechtsoort} />
          <Row label="Aandeel" value={r.aandeel} />
          <Row label="Kadastrale aanduiding" value={r.kadastrale_aanduiding} />
        </>
      )}
      <PdfRegel doc={pdf} />
    </div>
  );
}

function RecordKaart({ r, pdf }: { r: KadasterDataRecord; pdf?: KadasterDocument }) {
  if (r.status !== 'geleverd' && r.status !== 'gedeeltelijk') {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {r.product_code === 'waarde' ? 'Kadaster-koopsom'
              : r.product_code === 'rechten' ? 'Rechthebbende volgens Kadaster'
              : r.product_code}
          </p>
          <span className="text-[10px] text-muted-foreground">{r.status}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Eerder geprobeerd voor dit adres — geen gegevens geleverd door Kadaster.
        </p>
      </div>
    );
  }
  if (r.product_code === 'waarde') return <WaardeRecordBlok r={r} pdf={pdf} />;
  if (r.product_code === 'rechten') return <RechtenRecordBlok r={r} pdf={pdf} />;
  return null;
}

export default function SignaalKadasterKaart({ signaal }: Props) {
  const a = signaal as unknown as {
    adres?: string | null; postcode?: string | null;
  };
  const parsed = useMemo(
    () => parseObjectAdres(a.adres ?? signaal.titel ?? '', a.postcode ?? null, signaal.plaats ?? null),
    [a.adres, a.postcode, signaal.plaats, signaal.titel],
  );

  const [postcodeInput, setPostcodeInput] = useState<string>(
    (a.postcode ?? parsed.postcode ?? '').toString(),
  );
  const [huisnummerKeuze, setHuisnummerKeuze] = useState<string>(
    parsed.huisnummers[0]?.label ?? '',
  );
  const [handmatigHuisnummer, setHandmatigHuisnummer] = useState<string>('');
  const [handmatigLetter, setHandmatigLetter] = useState<string>('');
  const [handmatigToevoeging, setHandmatigToevoeging] = useState<string>('');

  // Off Market Radar V1: alleen rechten + waarde. `object` (WOZ) wordt bewust
  // niet aangeboden — daar focust de signaalfase niet op.
  const [selWaarde, setSelWaarde] = useState(true);
  const [selRechten, setSelRechten] = useState(false);

  const [kostenOpen, setKostenOpen] = useState(false);
  const [rechtenPrivacyOpen, setRechtenPrivacyOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<KadasterPreview | null>(null);
  const [laatsteFout, setLaatsteFout] = useState<{
    msg: string; httpStatus?: number; debug?: KadasterDebug | null;
  } | null>(null);
  const [techOpen, setTechOpen] = useState(false);

  // Fase 4K.5 — checkbox "Kadasterbericht/PDF intern opslaan".
  const [selPdf, setSelPdf] = useState(false);

  const mutation = useKadasterObjectinformatie();
  const queryClient = useQueryClient();
  const records = useKadasterDataRecordsForSignaal(signaal.id);
  const recordList = useMemo(() => records.data ?? [], [records.data]);
  const laatsteMap = useMemo(() => laatsteRecordsPerProduct(recordList), [recordList]);
  const meest = recordList[0] ?? null;
  const { data: pdfs } = useKadasterDocumentenForSignaal(signaal.id);
  const pdfList = useMemo(() => pdfs ?? [], [pdfs]);
  const pdfPerRecord = useMemo(() => documentenPerRecord(pdfList), [pdfList]);

  // Productlijst wordt pas opgehaald als de kostenconfirmatie opent.
  const catalogus = useKadasterProductCatalogus(kostenOpen);
  // Toon alleen producten die /products bevestigt EN die we in Off Market
  // toestaan (rechten, waarde).
  const beschikbaar = useMemo(() => {
    const live = catalogus.data?.products ?? [];
    const map = new Map(live.map(p => [p.code, p]));
    return SIGNAAL_ALLOWED_PRODUCTS
      .filter(c => map.has(c))
      .map(c => map.get(c)!);
  }, [catalogus.data]);
  const waardeItem = beschikbaar.find(p => p.code === 'waarde') ?? null;
  const rechtenItem = beschikbaar.find(p => p.code === 'rechten') ?? null;
  const waardeBeschikbaar = !!waardeItem;
  const rechtenBeschikbaar = !!rechtenItem;

  const postcodeApi = useMemo(
    () => normaliseerPostcodeStrikt(postcodeInput),
    [postcodeInput],
  );

  function bouwAdresInput(): KadasterAdresInput | null {
    if (!postcodeApi) return null;
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
  const heeftBetaaldProduct =
    (selWaarde && waardeBeschikbaar) || (selRechten && rechtenBeschikbaar);

  function geselecteerdeProducten(): KadasterProductCode[] {
    const out: KadasterProductCode[] = [];
    if (selWaarde && waardeBeschikbaar) out.push('waarde');
    if (selRechten && rechtenBeschikbaar) out.push('rechten');
    return out;
  }

  async function voerCallUit() {
    if (!adresInput) {
      toast.error('Vul een geldige postcode (4 cijfers + 2 letters) en huisnummer in.');
      return;
    }
    if (!heeftBetaaldProduct) {
      toast.error('Selecteer minimaal één Kadaster-product (Koopsom of Rechten).');
      return;
    }
    setLaatsteFout(null);
    const input: KadasterRequestInput = {
      modus: 'kadaster',
      adres: adresInput,
      producten: geselecteerdeProducten(),
      context: { signaal_id: signaal.id },
      persist: true,
    };
    try {
      const resp = await mutation.mutateAsync(input);
      setPreview(resp);
      setPreviewOpen(true);
      const aantal = resp.producten.filter(p => p.beschikbaar).length;
      toast.success(
        `Kadastergegevens opgehaald (${aantal} product${aantal === 1 ? '' : 'en'})`,
      );
      if (resp.persist?.requested) {
        if (resp.persist.ok) {
          toast.success('Kadastergegevens opgeslagen bij dit signaal.');
          queryClient.invalidateQueries({
            queryKey: ['kadaster_data_records', 'signaal', signaal.id],
          });
        } else {
          toast.warning(
            'Kadastergegevens opgehaald, maar opslaan is mislukt. ' +
            'Maak geen nieuwe aanvraag voordat dit is gecontroleerd.' +
            (resp.persist.error ? ` (${resp.persist.error})` : ''),
            { duration: 12_000 },
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kadaster-aanvraag mislukt';
      const apiErr = e instanceof KadasterApiError ? e : null;
      setLaatsteFout({
        msg, httpStatus: apiErr?.httpStatus, debug: apiErr?.debug ?? null,
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
    <section
      data-testid="signaal-kadaster-kaart"
      className="section-card p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            Kadaster &amp; eigenaarsonderzoek
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Handmatig Kadastergegevens opvragen voor dit signaal. In de
            signaalfase ondersteunen we Koopsom en Rechten/eigendomsinformatie.
            WOZ-objectkenmerken worden pas na promotie naar Object opgevraagd.
          </p>
        </div>
      </div>

      {/* Zoekadres */}
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Zoekadres voor Kadaster</span>
        </div>

        <BagAdresLookup
          initieleStraat={parsed.straat ?? signaal.titel ?? null}
          initieelHuisnummer={handmatigHuisnummer || parsed.huisnummers[0]?.huisnummer || null}
          initielePlaats={signaal.plaats ?? null}
          initielePostcode={postcodeInput}
          onKies={(r: BagAdresResultaat) => {
            if (r.postcode) setPostcodeInput(`${r.postcode.slice(0, 4)} ${r.postcode.slice(4)}`);
            if (r.huisnummer) setHandmatigHuisnummer(r.huisnummer);
            setHandmatigLetter(r.huisletter ?? '');
            setHandmatigToevoeging(r.huisnummertoevoeging ?? '');
          }}
        />

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

        <p className="text-[11px] text-muted-foreground">
          Aanvraag gebruikt: <span className="font-mono-data">{adresLabel}</span>
        </p>
      </div>

      {/* Status laatste aanvraag */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-0.5">
        {recordList.length === 0 ? (
          <p className="italic">Nog geen Kadastergegevens opgehaald voor dit signaal.</p>
        ) : meest ? (
          <>
            <p>
              Status: <span className="font-mono-data">
                {meest.status === 'geleverd' || meest.status === 'gedeeltelijk'
                  ? 'Opgehaald'
                  : meest.status === 'niet_geleverd' ? 'Niet geleverd' : 'Fout'}
              </span>
            </p>
            <p>
              Laatst opgehaald: <span className="font-mono-data">{fmtDatum(meest.fetched_at)}</span>
            </p>
            <p>
              Zoekadres: <span className="font-mono-data">{fmtZoekadres(meest.zoekadres)}</span>
            </p>
            <p>
              Producten: <span className="font-mono-data">
                {Array.from(laatsteMap.keys()).join(', ') || '—'}
              </span>
              {' · '}Bron: <span className="font-mono-data">Kadaster Objectinformatie API</span>
            </p>
          </>
        ) : null}
      </div>

      {/* Foutmelding */}
      {laatsteFout && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="font-medium">{laatsteFout.msg}</p>
          </div>
        </div>
      )}

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

      {/* Opgeslagen records */}
      {recordList.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Opgeslagen bij dit signaal
            </p>
          </div>
          {(['waarde', 'rechten'] as const).map(code => {
            const r = laatsteMap.get(code);
            if (!r) return null;
            return <RecordKaart key={code} r={r} />;
          })}
          <KadasterHistorieLijst records={recordList} />

          <Collapsible open={techOpen} onOpenChange={setTechOpen}>
            <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              {techOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Technische details ({recordList.length} record{recordList.length === 1 ? '' : 's'})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 overflow-auto max-h-64 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify(recordList.map(r => ({
  id: r.id,
  product_code: r.product_code,
  status: r.status,
  fetched_at: r.fetched_at,
  zoekadres: r.zoekadres,
  raw_limited_keys: Object.keys(r.raw_limited ?? {}),
  raw_limited_rechten: (r.raw_limited as Record<string, unknown> | null | undefined)?.rechten ?? null,
})), null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Kostenconfirmatie */}
      <Dialog open={kostenOpen} onOpenChange={setKostenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4" /> Producten en kosten bevestigen
            </DialogTitle>
            <DialogDescription>
              Deze aanvraag wordt door Kadaster in rekening gebracht. Selecteer
              minimaal één product.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Zoekadres</span>
                <span className="font-mono-data">{adresLabel}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Producten (minimaal één)
              </p>

              {waardeBeschikbaar && (
                <label className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
                  <span className="flex items-start gap-2">
                    <Checkbox
                      checked={selWaarde}
                      onCheckedChange={(v) => setSelWaarde(v === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block">
                        {waardeItem?.name?.trim() || 'Koopsom'}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        Kadaster-koopsom is geen marktwaarde, vraagprijs of
                        taxatiewaarde.
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {waardeItem?.priceEur != null
                      ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })
                          .format(waardeItem.priceEur)
                      : 'prijs volgens Kadaster'}
                  </span>
                </label>
              )}

              {rechtenBeschikbaar && (
                <label className="flex items-start justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2">
                  <span className="flex items-start gap-2">
                    <Checkbox
                      checked={selRechten}
                      onCheckedChange={(v) => setSelRechten(v === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block">
                        {rechtenItem?.name?.trim() || 'Rechten / eigendomsinformatie'}
                      </span>
                      <span className="block text-[10px] text-amber-900/80">
                        Gevoelig product — bevat naam/bedrijfsnaam van rechthebbende.
                        Aparte privacy-bevestiging vereist.
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {rechtenItem?.priceEur != null
                      ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })
                          .format(rechtenItem.priceEur)
                      : 'prijs volgens Kadaster'}
                  </span>
                </label>
              )}

              {!waardeBeschikbaar && !rechtenBeschikbaar && (
                <p className="text-[11px] text-muted-foreground">
                  {catalogus.isLoading
                    ? 'Productlijst wordt opgehaald…'
                    : 'Geen ondersteunde producten beschikbaar voor deze API-key. WOZ-object wordt in de signaalfase bewust niet aangeboden.'}
                </p>
              )}

              <p className="text-[11px] text-muted-foreground pt-1">
                WOZ-object wordt in de signaalfase bewust niet aangeboden. Dat
                product is voorbehouden aan Objecten/Aanbod na promotie.
              </p>
            </div>

            {!heeftBetaaldProduct && (waardeBeschikbaar || rechtenBeschikbaar) && (
              <p className="text-xs text-destructive">
                Selecteer minimaal één product om de aanvraag te starten.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setKostenOpen(false)}
              disabled={mutation.isPending}
            >
              Annuleren
            </Button>
            <Button
              disabled={mutation.isPending || !heeftBetaaldProduct}
              onClick={async () => {
                if (selRechten && rechtenBeschikbaar) {
                  setKostenOpen(false);
                  setRechtenPrivacyOpen(true);
                  return;
                }
                setKostenOpen(false);
                await voerCallUit();
              }}
            >
              {mutation.isPending ? 'Bezig…' : 'Kadastergegevens ophalen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aparte privacy/kostenbevestiging voor rechten */}
      <AlertDialog open={rechtenPrivacyOpen} onOpenChange={setRechtenPrivacyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechten / eigendomsinformatie bevestigen</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Deze aanvraag kan eigendoms- of rechthebbendeninformatie
                  bevatten en brengt kosten met zich mee volgens Kadaster.
                  Gebruik deze informatie zorgvuldig en alleen voor dit signaal/object.
                </p>
                <p>
                  Bij een succesvolle aanvraag wordt het resultaat intern
                  opgeslagen als Kadasterrecord, maar er wordt geen relatie,
                  eigenaar of verkoper automatisch aangemaakt of gekoppeld.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={async () => {
                setRechtenPrivacyOpen(false);
                await voerCallUit();
              }}
            >
              Rechten ophalen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KadasterPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        gebiedsVariant="gebiedscontext"
      />
    </section>
  );
}
