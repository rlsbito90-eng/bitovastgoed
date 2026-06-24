// V3 — Pure helpers voor adreslabels (Brother QL-710W, 90 × 29 mm).
// Geen DB-aanroepen, geen Kadaster/BAG/AI. Volledig deterministisch en
// mutatievrij — gebruikt door GecombineerdeAdreslabelsPDF en de preview-
// dialog. Wordt los getest in src/test/offMarket/v38/.

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

// ---------------------------------------------------------------------
// Eenheden — Brother QL-710W 90 × 29 mm liggend, 3 mm veilige marge.
// 1 mm = 2.834645669 pt (PDF point).
// ---------------------------------------------------------------------
export const MM_PER_PT = 2.834645669;
export const LABEL_BREEDTE_MM = 90;
export const LABEL_HOOGTE_MM = 29;
export const VEILIGE_MARGE_MM = 3;

export const LABEL_BREEDTE_PT = +(LABEL_BREEDTE_MM * MM_PER_PT).toFixed(4);
export const LABEL_HOOGTE_PT = +(LABEL_HOOGTE_MM * MM_PER_PT).toFixed(4);
export const VEILIGE_MARGE_PT = +(VEILIGE_MARGE_MM * MM_PER_PT).toFixed(4);

// Bruikbare oppervlakte binnen marges (in mm).
export const INHOUD_BREEDTE_MM = LABEL_BREEDTE_MM - 2 * VEILIGE_MARGE_MM; // 84 mm
export const INHOUD_HOOGTE_MM = LABEL_HOOGTE_MM - 2 * VEILIGE_MARGE_MM;   // 23 mm

// ---------------------------------------------------------------------
// Tekst-normalisatie
// ---------------------------------------------------------------------
const POSTCODE_RE = /\b(\d{4})\s*([A-Za-z]{2})\b/;

/** Normaliseer NL-postcode naar `1234 AB` (één spatie, hoofdletters). */
export function normaliseerPostcode(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.toString().match(POSTCODE_RE);
  if (!m) return null;
  return `${m[1]} ${m[2].toUpperCase()}`;
}

/** Plaatsnaam → hoofdletters; trim en collapse witruimte. */
export function plaatsBovenkast(input: string | null | undefined): string {
  if (!input) return '';
  return input.toString().replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Parse een multi-line verzendadres naar straat + postcode + plaats.
 * Vereist dat de laatste niet-lege regel postcode + plaats bevat. Geeft
 * `null` terug wanneer dat niet lukt — caller behandelt dat als blokkade.
 */
export interface GeparseerdAdres {
  straat: string;
  postcode: string;   // genormaliseerd
  plaats: string;     // bovenkast
}

export function parseVerzendadres(adres: string | null | undefined): GeparseerdAdres | null {
  if (!adres) return null;
  const regels = adres
    .toString()
    .replace(/\r/g, '')
    .split('\n')
    .map(r => r.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (regels.length === 0) return null;

  // Zoek de regel met postcode (meestal de laatste).
  let idx = -1;
  for (let i = regels.length - 1; i >= 0; i -= 1) {
    if (POSTCODE_RE.test(regels[i])) { idx = i; break; }
  }
  if (idx < 0) return null;

  const pcRegel = regels[idx];
  const pcMatch = pcRegel.match(POSTCODE_RE);
  if (!pcMatch) return null;
  const postcode = `${pcMatch[1]} ${pcMatch[2].toUpperCase()}`;
  // Plaats = rest van pcRegel na de postcode.
  const plaatsRuw = pcRegel.replace(POSTCODE_RE, '').trim();
  const plaats = plaatsBovenkast(plaatsRuw);
  if (!plaats) return null;

  const straatRegels = regels.slice(0, idx);
  const straat = straatRegels.join(' ').trim();
  if (!straat) return null;

  return { straat, postcode, plaats };
}

// ---------------------------------------------------------------------
// Aanhef — nooit geslacht afleiden uit naam.
// Gebruik opgeslagen specifieke aanhef alleen als die niet generiek is.
// ---------------------------------------------------------------------
const GENERIEKE_AANHEF_RE = /^geachte\s+heer\s*\/?\s*mevrouw/i;

/** True wanneer een opgeslagen aanhef expliciet (niet generiek) is. */
export function isSpecifiekeAanhef(aanhef: string | null | undefined): boolean {
  if (!aanhef) return false;
  const t = aanhef.toString().trim();
  if (!t) return false;
  return !GENERIEKE_AANHEF_RE.test(t);
}

// ---------------------------------------------------------------------
// Labelvariant + opbouw regels
// ---------------------------------------------------------------------
export type LabelVariant = 'persoon' | 'bedrijf';

export interface LabelBron {
  /** Stabiele key voor sortering/dedupe. */
  briefId: string;
  signaalId: string;
  toegevoegdOp: string | null;
  geadresseerdeKey: string | null;
  campagneStap: string | null;
  eigenaarNaam: string | null;
  eigenaarBedrijfsnaam: string | null;
  verzendadres: string | null;
  /** Optionele opgeslagen aanhef uit `off_market_brieven.aanhef`. */
  opgeslagenAanhef?: string | null;
}

export interface AdresLabel {
  bron: LabelBron;
  variant: LabelVariant;
  regels: string[];          // weergegeven labelregels (zonder geslacht-inferentie)
  postcode: string | null;
  plaats: string | null;
  /** True wanneer label gegenereerd kan worden. */
  geldig: boolean;
  /** Concrete blokkadereden (NL) — `null` wanneer geldig. */
  blokkadeReden: string | null;
  /** Niet-blokkerende overflow-waarschuwing per regel. */
  overflowWaarschuwing: string | null;
  /** Aanbevolen fontsize in pt na fit-berekening. */
  fontPt: number;
}

/**
 * Bouw één adreslabel uit een brief-bron. Niet mutatievrij, maar geeft
 * een nieuw object terug en raakt de bron niet aan.
 */
export function bouwAdresLabel(bron: LabelBron): AdresLabel {
  const naam = (bron.eigenaarNaam ?? '').trim();
  const bedrijf = (bron.eigenaarBedrijfsnaam ?? '').trim();
  const heeftPersoon = naam.length > 0;
  const heeftBedrijf = bedrijf.length > 0;
  const variant: LabelVariant = heeftPersoon ? 'persoon' : 'bedrijf';

  if (!heeftPersoon && !heeftBedrijf) {
    return {
      bron, variant: 'persoon', regels: [],
      postcode: null, plaats: null,
      geldig: false,
      blokkadeReden: 'Geen naam of bedrijfsnaam bekend.',
      overflowWaarschuwing: null, fontPt: 10,
    };
  }

  const adres = parseVerzendadres(bron.verzendadres);
  if (!adres) {
    return {
      bron, variant, regels: [],
      postcode: null, plaats: null,
      geldig: false,
      blokkadeReden: 'Postadres onvolledig of niet leesbaar.',
      overflowWaarschuwing: null, fontPt: 10,
    };
  }

  const regels: string[] = [];
  if (variant === 'persoon') {
    const specifiek = isSpecifiekeAanhef(bron.opgeslagenAanhef);
    const aanhef = specifiek ? bron.opgeslagenAanhef!.trim() : 'De heer/mevrouw';
    regels.push(`${aanhef} ${naam}`.replace(/\s+/g, ' ').trim());
  } else {
    regels.push(bedrijf);
    regels.push('T.a.v. de directie');
  }
  regels.push(adres.straat);
  regels.push(`${adres.postcode} ${adres.plaats}`.trim());

  const fit = berekenFit(regels);

  return {
    bron, variant, regels,
    postcode: adres.postcode, plaats: adres.plaats,
    geldig: true,
    blokkadeReden: null,
    overflowWaarschuwing: fit.waarschuwing,
    fontPt: fit.fontPt,
  };
}

// ---------------------------------------------------------------------
// Fit-berekening
// Strikt conservatief: schat de breedte van iedere regel in mm bij een
// gegeven fontgrootte. Wanneer de regel binnen 84 mm past op de basis-
// grootte → geen probleem. Anders zakt het naar een ondergrens; daarna
// volgt een overflowwaarschuwing.
// ---------------------------------------------------------------------
const BASIS_FONT_PT = 10;          // ≈ 3.5 mm regelhoogte
const MIN_FONT_PT = 8;             // onder dit punt zakken we niet — leesbaar blijft leidend.
// Gemiddelde tekenbreedte in mm bij 10 pt Helvetica.
const KARAKTER_MM_PER_PT = 0.18;

function breedteVoorRegel(regel: string, fontPt: number): number {
  return regel.length * KARAKTER_MM_PER_PT * fontPt;
}

interface FitResultaat {
  fontPt: number;
  waarschuwing: string | null;
}

function berekenFit(regels: string[]): FitResultaat {
  const maxBreedte = INHOUD_BREEDTE_MM;
  // Probeer 10 → 9.5 → 9 → 8.5 → 8 (in halve punten).
  const stappen = [10, 9.5, 9, 8.5, 8];
  for (const pt of stappen) {
    const overschreden = regels.find(r => breedteVoorRegel(r, pt) > maxBreedte);
    if (!overschreden) return { fontPt: pt, waarschuwing: null };
  }
  // Niet betrouwbaar passend op MIN_FONT_PT → waarschuwen.
  const slechtste = regels.reduce(
    (acc, r) => (breedteVoorRegel(r, MIN_FONT_PT) > acc.b
      ? { r, b: breedteVoorRegel(r, MIN_FONT_PT) }
      : acc),
    { r: '', b: 0 },
  );
  return {
    fontPt: MIN_FONT_PT,
    waarschuwing: `Regel "${slechtste.r}" past mogelijk niet binnen 90 × 29 mm.`,
  };
}

// ---------------------------------------------------------------------
// Helper voor mapping van OffMarketBrief → LabelBron
// ---------------------------------------------------------------------
export function briefNaarLabelBron(
  brief: OffMarketBrief, toegevoegdOp: string | null,
): LabelBron {
  return {
    briefId: brief.id,
    signaalId: brief.signaal_id,
    toegevoegdOp,
    geadresseerdeKey: brief.geadresseerde_key ?? null,
    campagneStap: brief.campagne_stap ?? null,
    eigenaarNaam: brief.eigenaar_naam ?? null,
    eigenaarBedrijfsnaam: brief.eigenaar_bedrijfsnaam ?? null,
    verzendadres: brief.verzendadres ?? null,
    opgeslagenAanhef: (brief as any).aanhef ?? null,
  };
}
