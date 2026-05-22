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
