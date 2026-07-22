// Nederlandse werkdag-helper.
// Alle datumvergelijkingen in de Off-Market Radar Selectie moeten dezelfde
// Nederlandse kalenderdatum gebruiken, inclusief zomer- en wintertijd.
// Gebruik hiervoor `Intl.DateTimeFormat` met tijdzone `Europe/Amsterdam`.

const AMSTERDAM_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  // en-CA levert `YYYY-MM-DD`; perfect voor lexicografische vergelijking.
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Nederlandse kalenderdatum (YYYY-MM-DD) van `at` (default: nu).
 * Werkt correct rond middernacht en respecteert zomer-/wintertijd.
 */
export function getNlDatum(at: Date = new Date()): string {
  return AMSTERDAM_FORMATTER.format(at);
}

/** Alias die de intentie duidelijker maakt binnen werkbak-code. */
export function vandaagNl(at: Date = new Date()): string {
  return getNlDatum(at);
}

/** Is `iso` (YYYY-MM-DD) na `vandaag` in Nederlandse kalender? */
export function isDatumInToekomstNl(iso: string, vandaag: string = vandaagNl()): boolean {
  return iso > vandaag;
}

/** Is `iso` gelijk aan `vandaag` in Nederlandse kalender? */
export function isDatumVandaagNl(iso: string, vandaag: string = vandaagNl()): boolean {
  return iso === vandaag;
}
