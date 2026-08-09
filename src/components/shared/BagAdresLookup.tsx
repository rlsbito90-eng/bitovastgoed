// Herbruikbare BAG/PDOK adresresolver voor Kadaster-zoekadres.
// Gratis PDOK lookup; doet NOOIT zelf een Kadasteraanvraag.
import { useEffect, useMemo, useState } from 'react';
import { MapPin, Search, AlertCircle, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleList } from '@/components/ui/collapsible-list';
import { zoekBagAdressen, type BagAdresResultaat } from '@/lib/bag/pdokLookup';

interface Props {
  initieleStraat?: string | null;
  initieelHuisnummer?: string | null;
  initielePlaats?: string | null;
  initielePostcode?: string | null;
  /** Volledig label uit het signaal, bv. 174-2. Exacte toevoeging heeft altijd voorrang. */
  voorkeursHuisnummerLabel?: string | null;
  onKies: (r: BagAdresResultaat) => void;
}

const norm = (v: string | null | undefined) => (v ?? '')
  .trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
const pcCompact = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, '').toUpperCase();

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
  return [r.postcode ?? '', formatHuisnummerLabel(r)].filter(Boolean).join(' ');
}

function kernMatch(r: BagAdresResultaat, straat: string, huisnummer: string, plaats: string): boolean {
  return (!straat || norm(r.straat) === norm(straat))
    && (!huisnummer || String(r.huisnummer ?? '') === huisnummer.trim())
    && (!plaats || norm(r.woonplaats) === norm(plaats));
}

/**
 * Zakelijke voorkeursregel voor een BAG-hoofdadres bij meerdere subadressen:
 * 1. exacte toevoeging uit het signaal (bv. 174-2)
 * 2. H
 * 3. 1
 * 4. A
 * 5. overige toevoegingen
 * 6. kaal huisnummer
 */
function voorkeurScore(r: BagAdresResultaat, explicietLabel: string | null | undefined): number {
  const label = formatHuisnummerLabel(r).toUpperCase();
  const exact = (explicietLabel ?? '').trim().toUpperCase();
  if (exact && label === exact) return 0;

  const suffix = label.includes('-') ? label.slice(label.indexOf('-') + 1) : '';
  if (suffix === 'H') return 10;
  if (suffix === '1') return 20;
  if (suffix === 'A') return 30;
  if (suffix) return 40;
  return 50;
}

function sorteerResultaten(
  resultaten: BagAdresResultaat[],
  input: { straat: string; huisnummer: string; plaats: string; postcode: string; explicietLabel?: string | null },
): BagAdresResultaat[] {
  return [...resultaten].sort((a, b) => {
    const aKern = kernMatch(a, input.straat, input.huisnummer, input.plaats) ? 0 : 1;
    const bKern = kernMatch(b, input.straat, input.huisnummer, input.plaats) ? 0 : 1;
    if (aKern !== bKern) return aKern - bKern;

    const pref = voorkeurScore(a, input.explicietLabel) - voorkeurScore(b, input.explicietLabel);
    if (pref !== 0) return pref;

    // Opgeslagen postcode is alleen tie-breaker; PDOK-adres blijft leidend.
    const pc = pcCompact(input.postcode);
    const aPc = pc && pcCompact(a.postcode) === pc ? 0 : 1;
    const bPc = pc && pcCompact(b.postcode) === pc ? 0 : 1;
    if (aPc !== bPc) return aPc - bPc;
    return formatHuisnummerLabel(a).localeCompare(formatHuisnummerLabel(b), 'nl', { numeric: true });
  });
}

export default function BagAdresLookup({
  initieleStraat, initieelHuisnummer, initielePlaats, initielePostcode,
  voorkeursHuisnummerLabel, onKies,
}: Props) {
  const [straat, setStraat] = useState(initieleStraat ?? '');
  const [huisnummer, setHuisnummer] = useState(initieelHuisnummer ?? '');
  const [plaats, setPlaats] = useState(initielePlaats ?? '');
  const [postcode, setPostcode] = useState(initielePostcode ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [resultaten, setResultaten] = useState<BagAdresResultaat[] | null>(null);
  const [gekozen, setGekozen] = useState<BagAdresResultaat | null>(null);
  const [automatisch, setAutomatisch] = useState(false);

  // Cruciaal in Focusmodus: wisselen van signaal moet ALLE lokale PDOK-state resetten.
  useEffect(() => {
    setStraat(initieleStraat ?? '');
    setHuisnummer(initieelHuisnummer ?? '');
    setPlaats(initielePlaats ?? '');
    setPostcode(initielePostcode ?? '');
    setResultaten(null);
    setGekozen(null);
    setFout(null);
    setAutomatisch(false);
  }, [initieleStraat, initieelHuisnummer, initielePlaats, initielePostcode, voorkeursHuisnummerLabel]);

  const kanZoeken = !!straat.trim() && !!huisnummer.trim() && !!plaats.trim();
  const gesorteerd = useMemo(
    () => resultaten ? sorteerResultaten(resultaten, {
      straat, huisnummer, plaats, postcode, explicietLabel: voorkeursHuisnummerLabel,
    }) : null,
    [resultaten, straat, huisnummer, plaats, postcode, voorkeursHuisnummerLabel],
  );

  function kies(r: BagAdresResultaat, auto = false) {
    setGekozen(r);
    setAutomatisch(auto);
    if (r.postcode) setPostcode(formatPostcodeWeergave(r.postcode));
    onKies(r);
  }

  async function zoeken() {
    if (!kanZoeken || bezig) return;
    setBezig(true); setFout(null); setResultaten(null); setGekozen(null); setAutomatisch(false);
    try {
      // Straat + huisnummer + plaats zijn leidend. Een mogelijk foute oude postcode
      // wordt bewust NIET meegestuurd en kan dus de officiële match niet blokkeren.
      const r = await zoekBagAdressen({
        straat: straat.trim(), huisnummer: huisnummer.trim(), plaats: plaats.trim(), postcode: null,
      });
      const sorted = sorteerResultaten(r, {
        straat, huisnummer, plaats, postcode, explicietLabel: voorkeursHuisnummerLabel,
      });
      setResultaten(sorted);
      if (sorted.length === 0) {
        setFout('Geen officiële BAG-match gevonden voor straat, huisnummer en plaats.');
        return;
      }
      const exacteKern = sorted.filter(x => kernMatch(x, straat, huisnummer, plaats));
      if (exacteKern.length > 0) {
        // Automatisch de beste BAG-match volgens de expliciete/H/1/A-regel.
        kies(exacteKern[0], true);
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'BAG-lookup mislukt');
    } finally { setBezig(false); }
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/10 p-3 space-y-3 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /><span>BAG-adres zoeken (PDOK)</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Controleert gratis het actuele signaaladres en kiest bij meerdere BAG-subadressen automatisch de voorkeursmatch.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 min-w-0">
        <div className="space-y-1 sm:col-span-2 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Straatnaam</Label>
          <Input value={straat} onChange={e => setStraat(e.target.value)} />
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Huisnummer</Label>
          <Input value={huisnummer} onChange={e => setHuisnummer(e.target.value.replace(/[^0-9]/g, ''))} className="font-mono-data" />
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Plaats</Label>
          <Input value={plaats} onChange={e => setPlaats(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-4 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Postcode</Label>
          <Input value={postcode} onChange={e => setPostcode(e.target.value)} className="font-mono-data" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="secondary" disabled={!kanZoeken || bezig} onClick={zoeken}>
          {bezig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Adres controleren
        </Button>
      </div>

      {fout && <div className="flex gap-2 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" /><p>{fout}</p></div>}

      {gekozen && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1 min-w-0">
          <div className="flex items-start gap-2 text-xs">
            {automatisch ? <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />}
            <div className="min-w-0">
              <p className="font-medium break-words">
                {automatisch ? 'Automatisch gekozen: ' : 'Gekozen: '}{gekozen.straat} {formatHuisnummerLabel(gekozen)}, {formatPostcodeWeergave(gekozen.postcode)} {gekozen.woonplaats}
              </p>
              <p className="text-muted-foreground font-mono-data break-words">Kadasteradres: {formatAanvraag(gekozen)}</p>
            </div>
          </div>
        </div>
      )}

      {gesorteerd && gesorteerd.length > 1 && (
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-muted-foreground">Andere BAG-adressen ({gesorteerd.length - 1}) — alleen wijzigen als de automatische keuze niet klopt.</p>
          <CollapsibleList
            items={gesorteerd.filter(r => r.id !== gekozen?.id)}
            renderItem={r => (
              <div className="rounded-md border border-border bg-card p-3 min-w-0">
                <p className="text-sm font-medium break-words">{r.straat} {formatHuisnummerLabel(r)}</p>
                <p className="text-xs text-muted-foreground font-mono-data break-words">{formatPostcodeWeergave(r.postcode)} {r.woonplaats}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => kies(r)} className="mt-2 w-full sm:w-auto">Gebruik dit adres</Button>
              </div>
            )}
            listClassName="space-y-2"
          />
        </div>
      )}
    </div>
  );
}
