// Herbruikbare BAG/PDOK adreslookup voor Kadaster-zoekadres.
//
// Doel: straat + huisnummer + plaats → officiële BAG-match → postcode +
// huisnummer (+ huisletter/toevoeging) klaar voor Kadasteraanvraag.
//
// Belangrijk:
//   - Geen Kadaster-call. Lookup is gratis (PDOK Locatieserver, publiek).
//   - Geen automatische zoekactie; gebruiker klikt "Adres zoeken".
//   - Eerste resultaat wordt NOOIT automatisch gekozen.
//   - Na keuze: parent ontvangt de genormaliseerde velden via `onKies`.
import { useMemo, useState } from 'react';
import { MapPin, Search, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  zoekBagAdressen, type BagAdresResultaat,
} from '@/lib/bag/pdokLookup';

interface Props {
  /** Prefill straatnaam (bijv. uit object/signaal). */
  initieleStraat?: string | null;
  initieelHuisnummer?: string | null;
  initielePlaats?: string | null;
  initielePostcode?: string | null;
  /** Wordt aangeroepen zodra gebruiker een resultaat kiest. */
  onKies: (r: BagAdresResultaat) => void;
}

/** Compact label voor "9-H" / "9-1" / "9" weergave. */
function formatHuisnummerLabel(r: BagAdresResultaat): string {
  const base = r.huisnummer ?? '';
  const letter = r.huisletter ?? '';
  const toev = r.huisnummertoevoeging ?? '';
  if (!base) return '';
  if (letter && toev) return `${base}-${letter}${toev}`;
  if (letter) return `${base}-${letter}`;
  if (toev) return `${base}-${toev}`;
  return base;
}

function formatPostcodeWeergave(pc: string | null): string {
  if (!pc) return '';
  return pc.length === 6 ? `${pc.slice(0, 4)} ${pc.slice(4)}` : pc;
}

function formatAanvraag(r: BagAdresResultaat): string {
  const pc = r.postcode ?? '';
  const hn = formatHuisnummerLabel(r);
  return [pc, hn].filter(Boolean).join(' ');
}

/** Sorteer: exacte straatnaam-match eerst, daarna exact huisnummer, daarna toevoegingen. */
function sorteerResultaten(
  resultaten: BagAdresResultaat[],
  input: { straat?: string | null; huisnummer?: string | null },
): BagAdresResultaat[] {
  const straatNorm = (input.straat ?? '').trim().toLowerCase();
  const hnNorm = (input.huisnummer ?? '').trim();
  return [...resultaten].sort((a, b) => {
    const aStraat = (a.straat ?? '').toLowerCase() === straatNorm ? 0 : 1;
    const bStraat = (b.straat ?? '').toLowerCase() === straatNorm ? 0 : 1;
    if (aStraat !== bStraat) return aStraat - bStraat;
    const aHn = (a.huisnummer ?? '') === hnNorm ? 0 : 1;
    const bHn = (b.huisnummer ?? '') === hnNorm ? 0 : 1;
    if (aHn !== bHn) return aHn - bHn;
    // Geen toevoeging vóór wel toevoeging
    const aT = (a.huisletter || a.huisnummertoevoeging) ? 1 : 0;
    const bT = (b.huisletter || b.huisnummertoevoeging) ? 1 : 0;
    if (aT !== bT) return aT - bT;
    return formatHuisnummerLabel(a).localeCompare(formatHuisnummerLabel(b), 'nl', { numeric: true });
  });
}

export default function BagAdresLookup({
  initieleStraat, initieelHuisnummer, initielePlaats, initielePostcode, onKies,
}: Props) {
  const [straat, setStraat] = useState<string>(initieleStraat ?? '');
  const [huisnummer, setHuisnummer] = useState<string>(initieelHuisnummer ?? '');
  const [plaats, setPlaats] = useState<string>(initielePlaats ?? '');
  const [postcode, setPostcode] = useState<string>(initielePostcode ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [resultaten, setResultaten] = useState<BagAdresResultaat[] | null>(null);
  const [gekozen, setGekozen] = useState<BagAdresResultaat | null>(null);

  const kanZoeken = !!(straat.trim() || postcode.trim()) && !!huisnummer.trim();

  const gesorteerd = useMemo(
    () => (resultaten ? sorteerResultaten(resultaten, { straat, huisnummer }) : null),
    [resultaten, straat, huisnummer],
  );

  async function zoeken() {
    if (!kanZoeken || bezig) return;
    setBezig(true);
    setFout(null);
    setResultaten(null);
    setGekozen(null);
    try {
      const r = await zoekBagAdressen({
        straat: straat.trim() || null,
        huisnummer: huisnummer.trim() || null,
        plaats: plaats.trim() || null,
        postcode: postcode.trim() || null,
      });
      setResultaten(r);
      if (r.length === 0) {
        setFout('Geen officiële BAG-match gevonden. Controleer straatnaam, huisnummer en plaats of vul postcode handmatig in.');
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'BAG-lookup mislukt');
    } finally {
      setBezig(false);
    }
  }

  function kies(r: BagAdresResultaat) {
    setGekozen(r);
    onKies(r);
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/10 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        <span>BAG-adres zoeken (PDOK)</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Zoek een officieel BAG-adres om postcode en huisnummer voor Kadaster te
        vullen. Deze zoekopdracht is gratis en doet geen Kadasteraanvraag.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Straatnaam</Label>
          <Input value={straat} onChange={(e) => setStraat(e.target.value)} placeholder="Bijv. Prins Willem Alexanderlaan" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Huisnummer</Label>
          <Input
            value={huisnummer}
            onChange={(e) => setHuisnummer(e.target.value.replace(/[^0-9A-Za-z\- ]/g, ''))}
            placeholder="30"
            className="font-mono-data"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Plaats</Label>
          <Input value={plaats} onChange={(e) => setPlaats(e.target.value)} placeholder="Westmaas" />
        </div>
        <div className="space-y-1 sm:col-span-4">
          <Label className="text-[11px] text-muted-foreground">Postcode (optioneel — versnelt match; BAG-resultaat is leidend)</Label>
          <Input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="3273 AV"
            className="font-mono-data"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="secondary" disabled={!kanZoeken || bezig} onClick={zoeken}>
          {bezig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Adres zoeken
        </Button>
      </div>

      {fout && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>{fout}</p>
        </div>
      )}

      {gesorteerd && gesorteerd.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">
              {gesorteerd.length === 1
                ? '1 adres gevonden'
                : `${gesorteerd.length} adressen gevonden`}
            </p>
            <p className="text-[10px] text-muted-foreground">Kies het juiste officiële BAG-adres</p>
          </div>
          <ul className="space-y-2">
            {gesorteerd.map((r) => {
              const adresregel = `${r.straat ?? ''}${formatHuisnummerLabel(r) ? ' ' + formatHuisnummerLabel(r) : ''}`.trim();
              const subregel = [formatPostcodeWeergave(r.postcode), r.woonplaats].filter(Boolean).join(' ');
              const isGekozen = gekozen?.id === r.id;
              return (
                <li
                  key={r.id}
                  className={`rounded-md border bg-card p-3 transition-colors ${
                    isGekozen ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium break-words">{adresregel || r.weergavenaam}</p>
                      {subregel && (
                        <p className="text-xs text-muted-foreground font-mono-data break-words">{subregel}</p>
                      )}
                      {r.nummeraanduiding_id && (
                        <p className="text-[10px] text-muted-foreground/70 font-mono-data truncate">
                          BAG {r.nummeraanduiding_id}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isGekozen ? 'default' : 'outline'}
                      onClick={() => kies(r)}
                      className="w-full sm:w-auto min-h-[44px] sm:min-h-0 shrink-0"
                    >
                      {isGekozen ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Geselecteerd
                        </>
                      ) : (
                        'Gebruik dit adres'
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {gekozen && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1">
          <div className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-medium break-words">
                Adres geselecteerd: {gekozen.straat} {formatHuisnummerLabel(gekozen)},{' '}
                {formatPostcodeWeergave(gekozen.postcode)} {gekozen.woonplaats}
              </p>
              <p className="text-muted-foreground font-mono-data">
                Aanvraag gebruikt: {formatAanvraag(gekozen)}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Kadaster gebruikt uiteindelijk postcode + huisnummer. Adres zoeken helpt
        om deze gegevens officieel aan te vullen.
      </p>
    </div>
  );
}
