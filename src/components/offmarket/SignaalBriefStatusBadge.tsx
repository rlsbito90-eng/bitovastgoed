import { Mail } from 'lucide-react';
import { BRIEFSTATUS_LABEL, type BriefStatus } from '@/lib/offMarket/briefStatus';

type Tone = 'neutral' | 'sand' | 'gold' | 'amber' | 'emerald';

const TOON: Record<BriefStatus, Tone> = {
  geen: 'neutral',
  brief1_concept: 'sand',
  brief1_verstuurd: 'emerald',
  brief2_gepland: 'gold',
  brief2_concept: 'sand',
  brief2_verstuurd: 'emerald',
};

const TOON_CLS: Record<Tone, string> = {
  neutral: 'bg-muted/60 text-muted-foreground border-border',
  sand: 'bg-secondary/15 text-foreground border-secondary/30',
  gold: 'bg-accent/10 text-accent border-accent/25',
  amber: 'bg-warning/10 text-warning border-warning/25',
  emerald: 'bg-success/10 text-success border-success/25',
};

export default function SignaalBriefStatusBadge({
  status,
  withIcon = true,
}: {
  status: BriefStatus;
  withIcon?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${TOON_CLS[TOON[status]]}`}
    >
      {withIcon && <Mail className="h-3 w-3" />}
      {BRIEFSTATUS_LABEL[status]}
    </span>
  );
}
