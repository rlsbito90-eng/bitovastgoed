// Herbruikbare BAG/PDOK adresresolver voor Kadaster-zoekadres.
// Gratis PDOK lookup; doet NOOIT zelf een Kadasteraanvraag.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, AlertCircle, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleList } from '@/components/ui/collapsible-list';
import { zoekBagAdressen, type BagAdresResultaat } from '@/lib/bag/pdokLookup';
import { useKadasterAdresPreference } from '@/components/offmarket/kadaster/KadasterAdresPreferenceContext';

interface Props {
  initieleStraat?: string | null;
  initieelHuisnummer?: string | null;
  initielePlaats?: string | null;
  initielePostcode?: string | null;
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

function normaliseerHuisnummerLabel(v: string | null | undefined): string {
  return (v ?? '').toUpperCase().replace(/[\s_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function kernMatch(r: BagAdresResultaat, straat: string, huisnummer: string, plaats: string): boolean {
  return norm(r.straat) === norm(straat)
    && String(r.huisnummer ?? '') === huisnummer.trim()
    && norm(r.woonplaats) === norm(plaats);
}

/**
 * Zeer conservatieve straatcorrectie. Alleen als PDOK bij exact hetzelfde
 * huisnummer en dezelfde plaats precies één officiële straatnaam teruggeeft
 * die de ingevoerde straat als volledig woorddeel bevat (of andersom).
 * Voorbeeld: "Baerlestraat" -> "Van Baerlestraat".
 */
function uniekeStraatCorrectie(
  raw: BagAdresResultaat[],
  straat: string,
  huisnummer: string,
  plaats: string,
): BagAdresResultaat[] {
  const basis = norm(straat);
  const zelfdeNummerPlaats = raw.filter((r) =>
    String(r.huisnummer ?? '') === huisnummer.trim() && norm(r.woonplaats) === norm(plaats),
  );
  const kandidaten = zelfdeNummerPlaats.filter((r) => {
    const officieel = norm(r.straat);
    return officieel === basis
      || officieel.endsWith(` ${basis}`)
      || basis.endsWith(` ${officieel}`);
  });
  const straten = new Set(kandidaten.map((r) => norm(r.straat)).filter(Boolean));
  return straten.size === 1 ? kandidaten : [];
}

/**
 * Voorkeursvolgorde binnen de officiële BAG-resultset:
 * expliciete toevoeging uit signaal → H → 1 → A → overige → kaal nummer.
 */
export function voorkeurScore(r: BagAdresResultaat, explicietLabel: string | null | undefined): number {
  const label = normaliseerHuisnummerLabel(formatHuisnummerLabel(r));
  const exact = normaliseerHuisnummerLabel(explicietLabel);
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
  input: { postcode: string; explicietLabel?: string | null },
): BagAdresResultaat[] {
  return [...resultaten].sort((a, b) => {
    const pref = voorkeurScore(a, input.explicietLabel) - voorkeurScore(b, input.explicietLabel);
    if (pref !== 0) return pref;
    const pc = pcCompact(input.postcode);
    const aPc = pc && pcCompact(a.postcode) === pc ? 0 : 1;
    const bPc = pc && pcCompact(b.postcode) === pc ? 0 : 1;
    if (aPc !== bPc) return aPc - bPc;
    return formatHuisnummerLabel(a).localeCompare(formatHuisnummerLabel(b), 'nl', { numeric: true });
  });
}

function scrollNaarKadasterActie() {
  const scroll = () => {
    const kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
    if (!kaart) return;
    const anchor = kaart.querySelector<HTMLElement>('[data-testid="kadaster-ophalen-anchor"]');
    const knop = anchor ?? Array.from(kaart.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      (b.textContent ?? '').includes('Kadastergegevens ophalen'),
    );
    (knop ?? kaart).scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };

  // Een adreskeuze verandert de hoogte van de resultatenlijst. Daarom na de
  // directe render én nogmaals na de collapsible/layout-transitie positioneren.
  [60, 260, 700].forEach((ms) => window.setTimeout(scroll, ms));
}

/**
 * Backstop voor de normale signaaldetailweergave: die leverde historisch alleen
 * het numerieke huisnummer aan BagAdresLookup. Het al gerenderde, geparste
 * huisnummer bevat daar wél de expliciete toevoeging (bv. "9 2").
 * Dit is alleen een fallback; een expliciete prop/context blijft leidend.
 */
function leesGerenderdeExplicieteVoorkeur(baseHuisnummer: string): string | null {
  const kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
  if (!kaart) return null;
  const base = normaliseerHuisnummerLabel(baseHuisnummer);
  const inputs = Array.from(kaart.querySelectorAll<HTMLInputElement>('input'));
  for (const input of inputs) {
    const label = normaliseerHuisnummerLabel(input.value);
    if (!label || label === base) continue;
    if (label.startsWith(`${base}-`)) return label;
  }
  return null;
}

export default function BagAdresLookup({
  initieleStraat, initieelHuisnummer, initielePlaats, initielePostcode,
  voorkeursHuisnummerLabel, onKies,
}: Props) {
  const contextVoorkeur = useKadasterAdresPreference();
  const [domVoorkeur, setDomVoorkeur] = useState<string | null>(null);
  const effectieveVoorkeur = voorkeursHuisnummerLabel ?? contextVoorkeur ?? domVoorkeur;

  const [straat, setStraat] = useState(initieleStraat ?? '');
  const [huisnummer, setHuisnummer] = useState(initieelHuisnummer ?? '');
  const [plaats, setPlaats] = useState(initielePlaats ?? '');
  const [postcode, setPostcode] = useState(initielePostcode ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [resultaten, setResultaten] = useState<BagAdresResultaat[] | null>(null);
  const [gekozen, setGekozen] = useState<BagAdresResultaat | null>(null);
  const [automatisch, setAutomatisch] = useState(false);
  const [straatGecorrigeerd, setStraatGecorrigeerd] = useState<string | null>(null);
  const resolutieSeq = useRef(0);

  const kanZoeken = !!straat.trim() && !!huisnummer.trim() && !!plaats.trim();
  const gesorteerd = useMemo(
    () => resultaten ? sorteerResultaten(resultaten, { postcode, explicietLabel: effectieveVoorkeur }) : null,
    [resultaten, postcode, effectieveVoorkeur],
  );

  useEffect(() => {
    if (voorkeursHuisnummerLabel || contextVoorkeur || !initieelHuisnummer) {
      setDomVoorkeur(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setDomVoorkeur(leesGerenderdeExplicieteVoorkeur(initieelHuisnummer));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [voorkeursHuisnummerLabel, contextVoorkeur, initieelHuisnummer]);

  function kies(r: BagAdresResultaat, auto = false) {
    if (!resultaten?.some((x) => x.id === r.id)) return;
    setGekozen(r);
    setAutomatisch(auto);
    if (r.postcode) setPostcode(formatPostcodeWeergave(r.postcode));
    onKies(r);
    if (!auto) scrollNaarKadasterActie();
  }

  async function resolveAdres(input: {
    straat: string; huisnummer: string; plaats: string; postcode: string; auto: boolean;
  }) {
    if (!input.straat.trim() || !input.huisnummer.trim() || !input.plaats.trim()) return;
    const seq = ++resolutieSeq.current;
    setBezig(true);
    setFout(null);
    setResultaten(null);
    setGekozen(null);
    setAutomatisch(false);
    setStraatGecorrigeerd(null);

    try {
      const raw = await zoekBagAdressen({
        straat: input.straat.trim(),
        huisnummer: input.huisnummer.trim(),
        plaats: input.plaats.trim(),
        postcode: null,
      });
      if (seq !== resolutieSeq.current) return;

      let officieel = raw.filter((x) => kernMatch(x, input.straat, input.huisnummer, input.plaats));
      if (officieel.length === 0) {
        const correctie = uniekeStraatCorrectie(raw, input.straat, input.huisnummer, input.plaats);
        if (correctie.length > 0) {
          officieel = correctie;
          const officieleStraat = correctie[0]?.straat ?? null;
          if (officieleStraat && norm(officieleStraat) !== norm(input.straat)) {
            setStraat(officieleStraat);
            setStraatGecorrigeerd(officieleStraat);
          }
        }
      }

      const sorted = sorteerResultaten(officieel, {
        postcode: input.postcode,
        explicietLabel: effectieveVoorkeur,
      });
      setResultaten(sorted);

      if (sorted.length === 0) {
        setFout('Geen betrouwbaar officieel BAG-adres gevonden voor deze straat, dit huisnummer en deze plaats.');
        return;
      }

      const beste = sorted[0];
      setGekozen(beste);
      setAutomatisch(input.auto);
      if (beste.postcode) setPostcode(formatPostcodeWeergave(beste.postcode));
      onKies(beste);
    } catch (e) {
      if (seq !== resolutieSeq.current) return;
      setFout(e instanceof Error ? e.message : 'BAG-lookup mislukt');
    } finally {
      if (seq === resolutieSeq.current) setBezig(false);
    }
  }

  useEffect(() => {
    const volgendeStraat = initieleStraat ?? '';
    const volgendHuisnummer = initieelHuisnummer ?? '';
    const volgendePlaats = initielePlaats ?? '';
    const volgendePostcode = initielePostcode ?? '';

    setStraat(volgendeStraat);
    setHuisnummer(volgendHuisnummer);
    setPlaats(volgendePlaats);
    setPostcode(volgendeStraat && volgendHuisnummer && volgendePlaats ? '' : volgendePostcode);
    setResultaten(null);
    setGekozen(null);
    setFout(null);
    setAutomatisch(false);
    setStraatGecorrigeerd(null);

    if (volgendeStraat.trim() && volgendHuisnummer.trim() && volgendePlaats.trim()) {
      void resolveAdres({
        straat: volgendeStraat,
        huisnummer: volgendHuisnummer,
        plaats: volgendePlaats,
        postcode: volgendePostcode,
        auto: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initieleStraat, initieelHuisnummer, initielePlaats, initielePostcode, effectieveVoorkeur]);

  async function zoeken() {
    if (!kanZoeken || bezig) return;
    await resolveAdres({ straat, huisnummer, plaats, postcode, auto: true });
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/10 p-3 space-y-3 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /><span>BAG-adres controleren (PDOK)</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Controleert gratis het actuele signaaladres. Alleen betrouwbare BAG-adressen voor deze straat, dit huisnummer en deze plaats worden gebruikt.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 min-w-0">
        <div className="space-y-1 sm:col-span-2 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Straatnaam</Label>
          <Input value={straat} onChange={(e) => setStraat(e.target.value)} />
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Huisnummer</Label>
          <Input value={huisnummer} onChange={(e) => setHuisnummer(e.target.value.replace(/[^0-9]/g, ''))} className="font-mono-data" />
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Plaats</Label>
          <Input value={plaats} onChange={(e) => setPlaats(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-4 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Officiële postcode</Label>
          <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder={bezig ? 'Wordt via PDOK gecontroleerd…' : 'Nog niet vastgesteld'} className="font-mono-data" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="secondary" disabled={!kanZoeken || bezig} onClick={zoeken}>
          {bezig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {bezig ? 'Controleren…' : 'Opnieuw controleren'}
        </Button>
      </div>

      {straatGecorrigeerd && (
        <p className="text-[11px] text-muted-foreground">
          Officiële BAG-straatnaam gebruikt: <span className="font-medium text-foreground">{straatGecorrigeerd}</span>.
        </p>
      )}

      {fout && (
        <div className="flex gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /><p>{fout}</p>
        </div>
      )}

      {gekozen && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1 min-w-0">
          <div className="flex items-start gap-2 text-xs">
            {automatisch
              ? <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />}
            <div className="min-w-0">
              <p className="font-medium break-words">
                {automatisch ? 'Automatisch gekozen uit BAG-resultaten: ' : 'Gekozen: '}
                {gekozen.straat} {formatHuisnummerLabel(gekozen)}, {formatPostcodeWeergave(gekozen.postcode)} {gekozen.woonplaats}
              </p>
              <p className="text-muted-foreground font-mono-data break-words">Kadasteradres: {formatAanvraag(gekozen)}</p>
            </div>
          </div>
        </div>
      )}

      {gesorteerd && gesorteerd.length > 0 && (
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-muted-foreground">
            BAG-adressen ({gesorteerd.length}) — de gekozen match staat ook in deze lijst.
          </p>
          <CollapsibleList
            items={gesorteerd}
            renderItem={(r) => {
              const isGekozen = r.id === gekozen?.id;
              return (
                <div className={`rounded-md border p-3 min-w-0 ${isGekozen ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium break-words">{r.straat} {formatHuisnummerLabel(r)}</p>
                    {isGekozen && <span className="text-[10px] font-medium text-primary">Gekozen</span>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono-data break-words">
                    {formatPostcodeWeergave(r.postcode)} {r.woonplaats}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={isGekozen ? 'secondary' : 'outline'}
                    disabled={isGekozen}
                    onClick={() => kies(r)}
                    className="mt-2 w-full sm:w-auto"
                  >
                    {isGekozen ? 'Dit adres is gekozen' : 'Gebruik dit adres'}
                  </Button>
                </div>
              );
            }}
            listClassName="space-y-2"
          />
        </div>
      )}
    </div>
  );
}
