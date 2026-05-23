// Hulpfuncties voor automatische vastgoedberekeningen in invoer-/bewerkmodals.
// Pure functions, geen state.

export type FinancialInputs = {
  jaarhuur?: number;
  vraagprijs?: number;
  noi?: number;
  m2?: number;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Maandhuur uit jaarhuur. */
export const maandhuurFromJaar = (jaar?: number): number | undefined =>
  jaar && jaar > 0 ? round2(jaar / 12) : undefined;

/** Jaarhuur uit maandhuur. */
export const jaarFromMaandhuur = (maand?: number): number | undefined =>
  maand && maand > 0 ? round2(maand * 12) : undefined;

/** Huur per m² per jaar. */
export const huurPerM2 = (jaar?: number, m2?: number): number | undefined =>
  jaar && m2 && m2 > 0 ? round2(jaar / m2) : undefined;

/** BAR = jaarhuur / vraagprijs × 100 (%). */
export const bar = (jaar?: number, vraagprijs?: number): number | undefined =>
  jaar && vraagprijs && vraagprijs > 0 ? round2((jaar / vraagprijs) * 100) : undefined;

/** NAR = NOI / vraagprijs × 100 (%). */
export const nar = (noi?: number, vraagprijs?: number): number | undefined =>
  noi != null && vraagprijs && vraagprijs > 0 ? round2((noi / vraagprijs) * 100) : undefined;

/** Kapitalisatiefactor = vraagprijs / jaarhuur. */
export const kapitalisatiefactor = (vraagprijs?: number, jaar?: number): number | undefined =>
  vraagprijs && jaar && jaar > 0 ? round2(vraagprijs / jaar) : undefined;

/** Formatteer kapitalisatiefactor als "13.8x". */
export const formatFactor = (f?: number): string => (f != null ? `${f.toFixed(1)}x` : '—');
