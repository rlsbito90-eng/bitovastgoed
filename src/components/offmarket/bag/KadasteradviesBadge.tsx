// V2.3 — Compacte badge voor Kadasteradvies.
import type { Kadasteradvies } from '@/lib/offMarket/bag/types';
import { KADASTERADVIES_LABEL } from '@/lib/offMarket/bag/types';

interface Props {
  niveau: Kadasteradvies | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

const NIVEAU_CLS: Record<Kadasteradvies, string> = {
  laag: 'bg-muted text-muted-foreground border-border',
  voorzichtig: 'bg-amber-100/70 text-amber-900 border-amber-300',
  aanbevolen: 'bg-emerald-100/70 text-emerald-900 border-emerald-300',
  sterk_aanbevolen: 'bg-emerald-200/80 text-emerald-950 border-emerald-400',
};

export default function KadasteradviesBadge({ niveau, size = 'sm', className = '' }: Props) {
  if (!niveau) {
    return (
      <span
        data-testid="kadasteradvies-badge"
        data-niveau="onbekend"
        className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border bg-muted/40 text-muted-foreground border-border ${className}`}
      >
        Advies: nog onbekend
      </span>
    );
  }
  const sizing = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span
      data-testid="kadasteradvies-badge"
      data-niveau={niveau}
      className={`inline-flex items-center rounded-full border ${sizing} ${NIVEAU_CLS[niveau]} ${className}`}
    >
      Advies: {KADASTERADVIES_LABEL[niveau]}
    </span>
  );
}
