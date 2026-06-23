// V1B — Readiness-badge en waarschuwingbadges voor Acquisitieselectie.
import { AlertTriangle, CheckCircle2, CircleDot, Lock } from 'lucide-react';
import {
  faseInfo, WAARSCHUWING_LABEL,
  type ReadinessFase, type ReadinessWaarschuwing,
} from '@/lib/offMarket/acquisitie/readiness';

const KLEUR_KLASSE: Record<string, string> = {
  geblokkeerd: 'border-destructive/40 bg-destructive/10 text-destructive',
  gereed: 'border-success/40 bg-success/10 text-success',
  in_behandeling: 'border-secondary/40 bg-secondary/15 text-foreground',
  afgehandeld: 'border-border bg-muted/40 text-muted-foreground',
};

export function ReadinessBadge({ fase, className = '' }: { fase: ReadinessFase; className?: string }) {
  const info = faseInfo(fase);
  const Icon = info.status === 'geblokkeerd' ? Lock
    : info.status === 'gereed' ? CheckCircle2
    : info.status === 'afgehandeld' ? CheckCircle2
    : CircleDot;
  return (
    <span
      data-testid="readiness-badge"
      data-fase={fase}
      data-status={info.status}
      title={info.reden}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap ${KLEUR_KLASSE[info.status]} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

export function WaarschuwingBadges({
  waarschuwingen, max = 3, className = '',
}: { waarschuwingen: ReadinessWaarschuwing[]; max?: number; className?: string }) {
  if (waarschuwingen.length === 0) return null;
  const zichtbaar = waarschuwingen.slice(0, max);
  const rest = waarschuwingen.length - zichtbaar.length;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`} data-testid="readiness-waarschuwingen">
      {zichtbaar.map(w => (
        <span
          key={w}
          title={WAARSCHUWING_LABEL[w]}
          data-waarschuwing={w}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-amber-500/30 bg-amber-500/10 text-amber-700 whitespace-nowrap"
        >
          <AlertTriangle className="h-3 w-3" />
          {WAARSCHUWING_LABEL[w]}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[10px] text-muted-foreground">+{rest}</span>
      )}
    </span>
  );
}
