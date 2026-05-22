import type { Bieding } from './types';

export const fmtEur = (n?: number | null) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const fmtEurSigned = (n?: number | null) => {
  if (n == null) return '—';
  const s = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, signDisplay: 'always' }).format(n);
  return s;
};

export const fmtPct = (n?: number | null, digits = 1) =>
  n == null ? '—' : `${n.toFixed(digits)}%`;

export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

export function verschilMetVraagprijs(bedrag?: number | null, vraagprijs?: number | null) {
  if (bedrag == null || vraagprijs == null || vraagprijs <= 0) return null;
  const verschil = bedrag - vraagprijs;
  const pct = (verschil / vraagprijs) * 100;
  return { verschil, pct };
}

export function vraagprijsDelta(bedrag?: number | null, vraagprijs?: number | null):
  { label: string; tone: 'positive' | 'negative' | 'neutral' } | null {
  const v = verschilMetVraagprijs(bedrag, vraagprijs);
  if (!v) return null;
  const sign = v.verschil > 0 ? '+' : v.verschil < 0 ? '−' : '±';
  const abs = Math.abs(v.verschil);
  const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(abs);
  const label = `${sign}${eur} (${v.pct >= 0 ? '+' : ''}${v.pct.toFixed(1)}%)`;
  const tone = v.verschil > 0 ? 'positive' : v.verschil < 0 ? 'negative' : 'neutral';
  return { label, tone };
}

export function dagenTotVerval(b: Pick<Bieding, 'geldigTot'>): number | null {
  if (!b.geldigTot) return null;
  try {
    const d = new Date(b.geldigTot); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}


export function isVerlopen(b: Pick<Bieding, 'geldigTot' | 'status'>) {
  if (!b.geldigTot) return false;
  if (b.status === 'geaccepteerd' || b.status === 'afgewezen' || b.status === 'ingetrokken') return false;
  try {
    const d = new Date(b.geldigTot);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch { return false; }
}

export function effectieveStatus(b: Bieding) {
  if (b.status === 'verlopen') return 'verlopen' as const;
  if (isVerlopen(b)) return 'verlopen' as const;
  return b.status;
}

export function zonderVoorbehouden(b: Bieding) {
  return b.financieringsvoorbehoud === 'geen' && b.ddVoorbehoud === 'geen';
}
