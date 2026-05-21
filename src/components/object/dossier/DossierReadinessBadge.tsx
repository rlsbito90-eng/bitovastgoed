// Gekleurd badge voor verkoopgereedheid.
import { READINESS_LABELS, READINESS_TONE, type ReadinessLabel } from '@/lib/objectDossier/readiness';

const TONE_CLASSES: Record<string, string> = {
  emerald: 'bg-success/10 text-success border-success/25',
  amber:   'bg-warning/10 text-warning border-warning/25',
  gold:    'bg-accent/10 text-accent border-accent/25',
  sand:    'bg-secondary/15 text-foreground border-secondary/30',
  crimson: 'bg-destructive/10 text-destructive border-destructive/25',
  neutral: 'bg-muted/60 text-muted-foreground border-border',
};

interface Props {
  label: ReadinessLabel;
  score?: number;
  className?: string;
}

export default function DossierReadinessBadge({ label, score, className = '' }: Props) {
  const tone = READINESS_TONE[label];
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium border rounded-full ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className="font-semibold">{READINESS_LABELS[label]}</span>
      {typeof score === 'number' && (
        <span className="font-mono-data text-[11px] opacity-80">{score}%</span>
      )}
    </span>
  );
}
