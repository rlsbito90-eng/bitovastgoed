/** Numerieke formatters voor de Vastgoedrekenen module. */
const EUR = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });

export const fmtEur = (n: number | null | undefined) => (n == null || isNaN(Number(n)) ? '—' : EUR.format(Number(n)));
export const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${NUM.format(Number(n))}%`);
export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : NUM.format(Number(n)));
export const fmtM2 = (n: number | null | undefined) => (n == null ? '—' : `${NUM.format(Number(n))} m²`);

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
