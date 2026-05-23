// Centrale Nederlandse parse- en formatteerhelpers voor numerieke invoer en weergave.
// Intern blijven alle waarden gewone JS numbers; deze helpers zijn puur voor UI I/O.

export type FormatKind = 'currency' | 'number' | 'integer' | 'area' | 'percent' | 'factor';

/**
 * Parseert Nederlandse (en internationale) numerieke invoer naar een number.
 * Accepteert: "1.000.000", "1000000", "€ 1.000.000", "37,29", "37.29",
 * "6,5%", "10,4%", "927,41 m²".
 * Retourneert null bij lege/ongeldige input.
 */
export function parseDutchNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const stripped = String(raw)
    .trim()
    .replace(/[€%\s]/g, '')
    .replace(/m²/gi, '')
    .replace(/x$/i, '');
  if (!stripped || stripped === '-' || stripped === ',' || stripped === '.') return null;

  const hasComma = stripped.includes(',');
  const hasDot = stripped.includes('.');
  let normalized = stripped;

  if (hasComma && hasDot) {
    normalized = stripped.lastIndexOf(',') > stripped.lastIndexOf('.')
      ? stripped.replace(/\./g, '').replace(',', '.')
      : stripped.replace(/,/g, '');
  } else if (hasComma) {
    normalized = stripped.replace(',', '.');
  } else if (hasDot) {
    const parts = stripped.split('.');
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    normalized = looksLikeThousands ? parts.join('') : stripped;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export const parseCurrencyInput = parseDutchNumber;
export const parsePercentageInput = parseDutchNumber;
export const parseAreaInput = parseDutchNumber;

const nl = (maxDecimals: number, minDecimals = maxDecimals) =>
  new Intl.NumberFormat('nl-NL', { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals });

export function formatNumberNL(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return nl(decimals).format(Number(n));
}

export function formatCurrency(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return `€ ${nl(decimals).format(Number(n))}`;
}

export function formatArea(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return `${nl(decimals).format(Number(n))} m²`;
}

export function formatPercentage(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return `${nl(decimals, decimals).format(Number(n))}%`;
}

export function formatFactor(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return `${nl(decimals, decimals).format(Number(n))}x`;
}

/** Editbare weergave: geen duizendscheidingen, komma als decimaal, geen suffix. */
export function toEditableNL(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const s = String(Number(n));
  return s.replace('.', ',');
}

/** Formatteer een number op basis van soort, zonder unit-suffix (suffix wordt door UI getoond). */
export function formatNumberForKind(n: number | null | undefined, kind: FormatKind | undefined, decimals?: number): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  switch (kind) {
    case 'currency':
    case 'integer':
      return nl(decimals ?? 0).format(Number(n));
    case 'area':
      return nl(decimals ?? 2).format(Number(n));
    case 'percent':
      return nl(decimals ?? 1, decimals ?? 1).format(Number(n));
    case 'factor':
      return nl(decimals ?? 1, decimals ?? 1).format(Number(n));
    case 'number':
      return nl(decimals ?? 2).format(Number(n));
    default:
      return toEditableNL(Number(n));
  }
}

/** Validatieboodschap per soort (voor toast/foutmelding). */
export function validationMessageForKind(kind: FormatKind | undefined): string {
  switch (kind) {
    case 'currency': return 'Voer een geldig bedrag in, bijvoorbeeld 1.000.000.';
    case 'percent': return 'Voer een geldig percentage in, bijvoorbeeld 6,5%.';
    case 'area': return 'Voer een geldig metrage in, bijvoorbeeld 37,29 m².';
    case 'factor': return 'Voer een geldige factor in, bijvoorbeeld 16,4x.';
    default: return 'Voer een geldig getal in, bijvoorbeeld 1.234,56.';
  }
}
