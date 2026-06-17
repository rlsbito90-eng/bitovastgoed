// Mobiele Brongegevens-kaart in dezelfde stijl als SignaalMobileGebiedsindeling.
// Stacked info rows, subtiele labels, geen per-row iconen.
import { Database } from 'lucide-react';
import { BRON_TYPE_LABEL, type OffMarketSignaal } from '@/lib/offMarket/types';

interface Props { signaal: OffMarketSignaal; }

function formatDatum(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

export default function SignaalMobileBronregel({ signaal }: Props) {
  const a = signaal as any;
  const bronDatum = formatDatum(a.bron_datum ?? null);
  const toegevoegdOp = formatDatum(signaal.created_at ?? null);
  // toegevoegd_via bestaat nog niet als kolom — afgeleid uit bron_type.
  const toegevoegdVia = signaal.bron_type === 'handmatig'
    ? 'Handmatig'
    : signaal.bron_type
      ? 'Auto-import'
      : 'Onbekend';
  const bronLabel = signaal.bron_type ? BRON_TYPE_LABEL[signaal.bron_type] : '—';

  return (
    <section
      data-testid="signaal-mobile-bronregel"
      className="section-card p-3.5 space-y-3"
    >
      <header className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">Brongegevens</h3>
      </header>
      <dl className="divide-y divide-border/40">
        <InfoRow label="Bron" value={bronLabel} />
        <InfoRow label="Brondatum" value={bronDatum} tabular />
        <InfoRow label="Toegevoegd op" value={toegevoegdOp} tabular />
        <InfoRow label="Toegevoegd via" value={toegevoegdVia} />
      </dl>
    </section>
  );
}

function InfoRow({
  label, value, tabular,
}: { label: string; value: string; tabular?: boolean }) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">{label}</dt>
      <dd className={`text-[13px] text-foreground mt-0.5 break-words ${tabular ? 'tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
