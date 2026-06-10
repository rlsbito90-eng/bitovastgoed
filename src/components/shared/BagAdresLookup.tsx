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
import { useState } from 'react';
import { MapPin, Search, AlertCircle, Loader2 } from 'lucide-react';
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

  const kanZoeken = !!(straat.trim() || postcode.trim()) && !!huisnummer.trim();

  async function zoeken() {
    if (!kanZoeken || bezig) return;
    setBezig(true);
    setFout(null);
    setResultaten(null);
    try {
      const r = await zoekBagAdressen({
        straat: straat.trim() || null,
        huisnummer: huisnummer.trim() || null,
        plaats: plaats.trim() || null,
        postcode: postcode.trim() || null,
      });
      setResultaten(r);
      if (r.length === 0) {
        setFout('Geen officiële BAG-match gevonden. Vul postcode en huisnummer handmatig in.');
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'BAG-lookup mislukt');
    } finally {
      setBezig(false);
    }
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
          <Label className="text-[11px] text-muted-foreground">Postcode (optioneel — versnelt match)</Label>
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

      {resultaten && resultaten.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-card max-h-64 overflow-auto">
          {resultaten.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{r.weergavenaam}</p>
                <p className="text-[10px] text-muted-foreground font-mono-data truncate">
                  {[r.postcode, r.huisnummer && `${r.huisnummer}${r.huisletter ?? ''}${r.huisnummertoevoeging ? '-' + r.huisnummertoevoeging : ''}`, r.woonplaats].filter(Boolean).join(' · ')}
                  {r.nummeraanduiding_id ? ` · BAG ${r.nummeraanduiding_id}` : ''}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => onKies(r)}>
                Gebruik dit adres
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground">
        Kadaster gebruikt uiteindelijk postcode + huisnummer. Adres zoeken helpt
        om deze gegevens officieel aan te vullen.
      </p>
    </div>
  );
}
