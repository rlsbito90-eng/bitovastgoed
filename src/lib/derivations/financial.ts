// src/lib/derivations/financial.ts
//
// Pure, herbruikbare financiële afleidingen voor objecten.
// Geen UI-afhankelijkheden, geen formattering — alleen ruwe getallen.
//
// Bronvelden (leidend, bewerkbaar door gebruiker):
//   - vraagprijs
//   - jaarhuur (a.k.a. huurinkomsten)
//   - oppervlakte (GBO / VVO / BVO)
//   - servicekostenJaar
//   - WOZ-waarde, taxatiewaarde, marktwaardeIndicatie
//
// Derived velden:
//   - maandhuur, prijs/m², huur/m², BAR, factor, NAR
//
// Convenanten:
//   - Geen NaN, geen Infinity. Bij ontbrekende/0 input → `null`.
//   - `prijsindicatie` is tekstuele fallback en mag NIET als bron voor
//     rendementsberekeningen worden gebruikt.
//   - BAR/NAR/NOI kunnen in de UI per veld een handmatige override krijgen.
//     Deze helper blijft puur en weet niets van overrides.
//   - Decimalen worden bewust niet afgerond hier (consumer beslist),
//     behalve waar bestaande UI dat al verwacht — zie `financialCalc.ts`.

// ── Numerieke veiligheid ────────────────────────────────────────────────────

/** Maakt een veilig nummer of `null`. Filtert NaN, Infinity en niet-numerieke input. */
export function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Deelt veilig. Returnt `null` bij ongeldige input of deler ≤ 0. */
export function safeDivide(numerator: unknown, denominator: unknown): number | null {
  const n = safeNumber(numerator);
  const d = safeNumber(denominator);
  if (n === null || d === null) return null;
  if (d <= 0) return null;
  const r = n / d;
  return Number.isFinite(r) ? r : null;
}

// ── Derived financiële metrics ──────────────────────────────────────────────

/** Maandhuur uit jaarhuur. */
export function calculateMonthlyRent(annualRent: unknown): number | null {
  const a = safeNumber(annualRent);
  if (a === null || a <= 0) return null;
  return a / 12;
}

/** Jaarhuur uit maandhuur (omgekeerde helper). */
export function calculateAnnualFromMonthly(monthlyRent: unknown): number | null {
  const m = safeNumber(monthlyRent);
  if (m === null || m <= 0) return null;
  return m * 12;
}

/** Prijs per m². Voor €/m² wordt typisch GBO gebruikt. */
export function calculatePricePerM2(price: unknown, area: unknown): number | null {
  return safeDivide(price, area);
}

/** Huur per m² per jaar. */
export function calculateRentPerM2(annualRent: unknown, area: unknown): number | null {
  return safeDivide(annualRent, area);
}

/** Bruto Aanvangs-Rendement in % = jaarhuur / vraagprijs × 100. */
export function calculateBAR(annualRent: unknown, price: unknown): number | null {
  const ratio = safeDivide(annualRent, price);
  return ratio === null ? null : ratio * 100;
}

/** Kapitalisatiefactor = vraagprijs / jaarhuur. */
export function calculateFactor(price: unknown, annualRent: unknown): number | null {
  return safeDivide(price, annualRent);
}

/** Netto Aanvangs-Rendement in % = NOI / vraagprijs × 100. */
export function calculateNAR(noi: unknown, price: unknown): number | null {
  const ratio = safeDivide(noi, price);
  return ratio === null ? null : ratio * 100;
}

// ── Override-resolver ───────────────────────────────────────────────────────
//
// Per veld kan een opgeslagen waarde gelden als handmatige override.
// Deze resolver bepaalt welke waarde gebruikt wordt en hoe groot de delta
// is met de automatisch afgeleide waarde. Consumer toont eventuele badge of
// soft warning op basis hiervan. Geen save-blokkade.

export type DerivedSource = 'auto' | 'override' | 'none';

export interface DerivedValue {
  /** Effectieve waarde (override wint, anders auto). `null` als beide onbekend. */
  value: number | null;
  /** Bron van de effectieve waarde. */
  source: DerivedSource;
  /** Automatische waarde (puur derived) — referentie voor mismatch-detectie. */
  auto: number | null;
  /** Opgeslagen override-waarde, indien aanwezig. */
  override: number | null;
  /** Absolute delta override − auto. `null` als één van beide ontbreekt. */
  delta: number | null;
  /**
   * `true` als de mismatch significant is. Tolerantie wordt door consumer
   * gekozen; resolver vult deze in op basis van een default.
   */
  mismatch: boolean;
}

export interface ResolveOptions {
  /** Relatieve tolerantie (0..1) waarbinnen delta géén mismatch is. Default 0.002 (0.2%). */
  tolerance?: number;
}

/**
 * Combineer auto-afgeleide waarde en optionele opgeslagen override.
 *
 * - Als `override` numeriek is, wint die.
 * - Mismatch = absolute relatieve delta > `tolerance` (default 0.2%).
 *   Voor BAR/NAR (percentages) is dit een absolute drempel op het %.
 */
export function resolveDerived(
  auto: number | null,
  override: unknown,
  options: ResolveOptions = {},
): DerivedValue {
  const tol = options.tolerance ?? 0.002;
  const ov = safeNumber(override);
  const a = auto !== null && Number.isFinite(auto) ? auto : null;

  const value = ov !== null ? ov : a;
  const source: DerivedSource = ov !== null ? 'override' : a !== null ? 'auto' : 'none';

  let delta: number | null = null;
  let mismatch = false;
  if (ov !== null && a !== null) {
    delta = ov - a;
    const ref = Math.abs(a) > 0 ? Math.abs(a) : 1;
    mismatch = Math.abs(delta) / ref > tol;
  }

  return { value, source, auto: a, override: ov, delta, mismatch };
}

// ── Compacte helpers voor BAR/NAR/NOI met override ──────────────────────────

export function resolveBAR(
  annualRent: unknown,
  price: unknown,
  override: unknown,
  options?: ResolveOptions,
): DerivedValue {
  return resolveDerived(calculateBAR(annualRent, price), override, options);
}

export function resolveNAR(
  noi: unknown,
  price: unknown,
  override: unknown,
  options?: ResolveOptions,
): DerivedValue {
  return resolveDerived(calculateNAR(noi, price), override, options);
}

/**
 * Legacy NOI-resolver.
 *
 * ⚠️ Deze helper behandelt `serviceCostsAnnual` als exploitatiekosten en
 * berekent auto = jaarhuur − servicekostenJaar. Dat is inhoudelijk
 * onjuist: servicekosten ≠ exploitatiekosten. Vanaf Fase 2A wordt op
 * ObjectDetailPage geen automatische NOI meer afgeleid. Gebruik daar
 * `resolveManual(object.noi)`; deze functie blijft bestaan voor
 * backwards-compatibility van bestaande callers/tests.
 */
export function resolveNOI(
  annualRent: unknown,
  serviceCostsAnnual: unknown,
  override: unknown,
  options?: ResolveOptions,
): DerivedValue {
  const a = safeNumber(annualRent);
  const s = safeNumber(serviceCostsAnnual) ?? 0;
  const auto = a !== null && a > 0 ? a - s : null;
  return resolveDerived(auto, override, options);
}

// ── Fase 2A: nieuwe pure helpers voor read-only computed financials ─────────

/**
 * Kies canoniek m² voor financiële berekeningen op objectniveau.
 *
 * Prioriteit:
 *   1. `oppervlakteVvo` — praktische standaard voor commerciële/beleggings-
 *      objecten; VVO is doorgaans wat verhuurd/verkocht wordt.
 *   2. `oppervlakteGbo` — fallback (voor woningen kan GBO inhoudelijk
 *      leidend zijn; Fase 2A houdt één eenvoudige canonieke volgorde aan
 *      en bepaalt geen asset-class-afhankelijke keuze).
 *   3. `oppervlakte` — laatste fallback (generieke oppervlakte).
 *
 * Retourneert `null` bij ontbrekende, niet-numerieke of niet-positieve
 * waarden — nooit `NaN` of `Infinity`.
 */
export interface M2Object {
  oppervlakteVvo?: number | null;
  oppervlakteGbo?: number | null;
  oppervlakte?: number | null;
  /**
   * ⚠️ `oppervlakteBvo` is bewust NIET opgenomen. BVO is informatief
   * en mag nooit automatisch als rekenbron dienen voor €/m², huur/m²
   * of rendement. Toevoegen aan deze interface zou de verkeerde
   * suggestie wekken dat het meegenomen wordt in de keten.
   */
}

export type M2Bron = 'gbo' | 'vvo' | 'oppervlakte' | 'none';

export interface BerekenM2Resultaat {
  m2: number | null;
  bron: M2Bron;
  /** true als de primaire bron voor de asset-class ontbrak en er is teruggevallen. */
  fallback: boolean;
  /** UI-label, bijv. "GBO gebruikt" of "Onvoldoende gegevens voor m²-berekening". */
  label: string;
}

/**
 * Volgorde-tabel per asset-class. `null` = geen automatische m²-bron
 * (bijv. `ontwikkellocatie`). Onbekende asset-classes vallen terug op
 * `DEFAULT_VOLGORDE` (huidig Fase 2A-gedrag: VVO → GBO → oppervlakte).
 *
 * BVO staat bewust in geen enkele volgorde — zie interface-comment.
 */
const DEFAULT_VOLGORDE: readonly Exclude<M2Bron, 'none'>[] = ['vvo', 'gbo', 'oppervlakte'];

const M2_VOLGORDE_PER_ASSETCLASS: Record<string, readonly Exclude<M2Bron, 'none'>[] | null> = {
  wonen: ['gbo', 'vvo', 'oppervlakte'],
  kantoren: ['vvo', 'gbo', 'oppervlakte'],
  winkels: ['vvo', 'gbo', 'oppervlakte'],
  bedrijfshallen: ['vvo', 'gbo', 'oppervlakte'],
  logistiek: ['vvo', 'gbo', 'oppervlakte'],
  industrieel: ['vvo', 'gbo', 'oppervlakte'],
  hotels: ['vvo', 'oppervlakte'],
  zorgvastgoed: ['vvo', 'gbo', 'oppervlakte'],
  mixed_use: ['vvo', 'gbo', 'oppervlakte'],
  ontwikkellocatie: null,
};

const BRON_LABEL: Record<Exclude<M2Bron, 'none'>, string> = {
  gbo: 'GBO gebruikt',
  vvo: 'VVO gebruikt',
  oppervlakte: 'Oppervlakte gebruikt',
};

const LABEL_ONVOLDOENDE = 'Onvoldoende gegevens voor m²-berekening';

function readBron(object: M2Object, bron: Exclude<M2Bron, 'none'>): number | null {
  const raw =
    bron === 'gbo' ? object.oppervlakteGbo
    : bron === 'vvo' ? object.oppervlakteVvo
    : object.oppervlakte;
  const n = safeNumber(raw);
  return n !== null && n > 0 ? n : null;
}

/**
 * Backwards-compatible m²-keuze.
 *
 * - `getBerekenM2(object)` zonder `assetClass` behoudt Fase 2A-gedrag:
 *   VVO → GBO → oppervlakte. Bestaande consumers wijzigen niet.
 * - `getBerekenM2(object, assetClass)` gebruikt de asset-class-tabel
 *   (zie `M2_VOLGORDE_PER_ASSETCLASS`). Voor `ontwikkellocatie`
 *   retourneert deze `null` (geen automatische rekenbron).
 * - `oppervlakteBvo` wordt NOOIT meegenomen — ook niet als laatste
 *   fallback. Als enkel BVO bekend is → `null`.
 */
export function getBerekenM2(
  object: M2Object | null | undefined,
  assetClass?: string | null,
): number | null {
  return getBerekenM2Bron(object, assetClass).m2;
}

/**
 * Rijke variant die naast `m2` ook de gekozen bron, fallback-vlag en
 * een UI-label retourneert. UI-consumers gebruiken deze voor bronbadges.
 *
 * BVO-regel (hard): `oppervlakteBvo` komt in geen enkele fallback-keten
 * voor. Als alleen BVO bekend is → `bron: 'none'`,
 * `label: 'Onvoldoende gegevens voor m²-berekening'`.
 */
export function getBerekenM2Bron(
  object: M2Object | null | undefined,
  assetClass?: string | null,
): BerekenM2Resultaat {
  if (!object) {
    return { m2: null, bron: 'none', fallback: false, label: LABEL_ONVOLDOENDE };
  }

  // Expliciete "geen rekenbron" case (bijv. ontwikkellocatie).
  if (assetClass && M2_VOLGORDE_PER_ASSETCLASS[assetClass] === null) {
    return { m2: null, bron: 'none', fallback: false, label: LABEL_ONVOLDOENDE };
  }

  const volgorde =
    (assetClass && M2_VOLGORDE_PER_ASSETCLASS[assetClass]) || DEFAULT_VOLGORDE;

  for (let i = 0; i < volgorde.length; i++) {
    const bron = volgorde[i];
    const m2 = readBron(object, bron);
    if (m2 !== null) {
      return { m2, bron, fallback: i > 0, label: BRON_LABEL[bron] };
    }
  }

  return { m2: null, bron: 'none', fallback: false, label: LABEL_ONVOLDOENDE };
}

/**
 * €/m² als `DerivedValue`. `source='auto'` als vraagprijs en m² geldig
 * zijn, anders `source='none'`. Geen override; consumers die een
 * handmatige €/m² willen tonen kunnen `resolveDerived` gebruiken.
 */
export function resolvePricePerM2(price: unknown, m2: unknown): DerivedValue {
  return resolveDerived(calculatePricePerM2(price, m2), undefined);
}

/**
 * Maandhuur als `DerivedValue` uit jaarhuur/huurinkomsten. `source='auto'`
 * als jaarhuur > 0, anders `source='none'`.
 */
export function resolveMaandhuur(annualRent: unknown): DerivedValue {
  return resolveDerived(calculateMonthlyRent(annualRent), undefined);
}

/**
 * Handmatig-only resolver: gebruikt uitsluitend de opgegeven opgeslagen
 * waarde, doet géén automatische afleiding. `source='override'` als de
 * waarde aanwezig en geldig is, anders `source='none'`.
 *
 * Gebruikt voor velden waar auto-berekening op objectniveau niet
 * verantwoord is (bijv. NOI zonder exploitatiekosten, of NAR zonder
 * echte NOI). De UI kan hierop een `handmatig` / `onvoldoende gegevens`
 * badge tonen.
 */
export function resolveManual(override: unknown): DerivedValue {
  return resolveDerived(null, override);
}
