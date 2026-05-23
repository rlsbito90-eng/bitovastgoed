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
 * NOI-benadering op objectniveau: jaarhuur − servicekostenJaar.
 * Dit is een ruwe indicatie; Vastgoedrekenen blijft leidend voor scenario-NOI.
 * Een opgegeven `override` wint altijd.
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
