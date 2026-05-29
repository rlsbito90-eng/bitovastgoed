/** Numerieke formatters voor de Vastgoedrekenen module. Gebruikt centrale NL helpers. */
import {
  formatCurrency as nlFormatCurrency,
  formatNumberNL,
  formatArea as nlFormatArea,
  formatPercentage as nlFormatPercentage,
  formatFactor as nlFormatFactor,
} from '@/lib/format/nl';

export const fmtEur = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? '—' : nlFormatCurrency(Number(n), 0);
/** Compacte notatie voor zeer smalle KPI-cards: "€ 2,48 mln" / "€ 142 dzd". */
export const fmtEurCompact = (n: number | null | undefined) => {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}€ ${(abs / 1_000_000).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} mln`;
  if (abs >= 10_000) return `${sign}€ ${(abs / 1_000).toLocaleString('nl-NL', { maximumFractionDigits: 0 })} dzd`;
  return nlFormatCurrency(v, 0);
};
export const fmtPct = (n: number | null | undefined, decimals = 2) =>
  n == null ? '—' : nlFormatPercentage(Number(n), decimals);
export const fmtNum = (n: number | null | undefined, decimals = 2) =>
  n == null ? '—' : formatNumberNL(Number(n), decimals);
export const fmtM2 = (n: number | null | undefined, decimals = 2) =>
  n == null ? '—' : nlFormatArea(Number(n), decimals);
export const fmtEurPerM2 = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? '—' : `${nlFormatCurrency(Math.round(Number(n)), 0)}/m²`;
export const fmtFactor = (n: number | null | undefined, decimals = 1) =>
  n == null || isNaN(Number(n)) ? '—' : nlFormatFactor(Number(n), decimals);



export const SEGMENT_BADGE: Record<string, { label: string; cls: string }> = {
  sociaal: { label: 'Sociaal', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  middenhuur: { label: 'Middenhuur', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  vrije_sector: { label: 'Vrije sector', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
};

export const DEAL_BADGE: Record<string, { label: string; cls: string }> = {
  A: { label: 'A — zeer interessant', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  B: { label: 'B — interessant', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  C: { label: 'C — alleen bij korting', cls: 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300' },
  reject: { label: 'Niet haalbaar', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  laag: { label: 'Laag uitvoeringsrisico', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  middel: { label: 'Gemiddeld uitvoeringsrisico', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  hoog: { label: 'Hoog uitvoeringsrisico', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};
