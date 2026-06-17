// Mobiele compacte regel met brondatum, toegevoegd op en bron.
// Velden vallen terug op '—' / 'Onbekend' als ze niet bestaan.
import { Calendar, Inbox, Database } from 'lucide-react';
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
  // toegevoegd_via bestaat nog niet als kolom — afleiden uit bron_type:
  // handmatig → 'Handmatig', overig → 'Auto-import'. Anders 'Onbekend'.
  const toegevoegdVia = signaal.bron_type === 'handmatig'
    ? 'Handmatig'
    : signaal.bron_type
      ? 'Auto-import'
      : 'Onbekend';
  const bronLabel = signaal.bron_type ? BRON_TYPE_LABEL[signaal.bron_type] : '—';

  return (
    <section
      data-testid="signaal-mobile-bronregel"
      className="section-card p-3.5 space-y-2"
    >
      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        Brongegevens
      </h3>
      <ul className="grid grid-cols-1 gap-1.5 text-[12px]">
        <li className="flex items-center gap-2 min-w-0">
          <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0 w-24">Bron</span>
          <span className="text-foreground truncate">{bronLabel}</span>
        </li>
        <li className="flex items-center gap-2 min-w-0">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0 w-24">Brondatum</span>
          <span className="text-foreground tabular-nums">{bronDatum}</span>
        </li>
        <li className="flex items-center gap-2 min-w-0">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0 w-24">Toegevoegd op</span>
          <span className="text-foreground tabular-nums">{toegevoegdOp}</span>
        </li>
        <li className="flex items-center gap-2 min-w-0">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0 w-24">Toegevoegd via</span>
          <span className="text-foreground truncate">{toegevoegdVia}</span>
        </li>
      </ul>
    </section>
  );
}
