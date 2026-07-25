import { AlertTriangle, CheckCircle2, CircleHelp, MinusCircle, XCircle } from 'lucide-react';
import type { ReliabilityAssessment, ReliabilityPillar, ReliabilityPillarStatus } from '@/lib/vastgoedrekenen/reliabilityAssessment';

const STATUS_CFG: Record<ReliabilityPillarStatus, {
  label: string;
  icon: typeof CheckCircle2;
  cls: string;
}> = {
  voldoende: {
    label: 'Voldoende',
    icon: CheckCircle2,
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  },
  aandacht: {
    label: 'Aandacht',
    icon: AlertTriangle,
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  },
  ontbreekt: {
    label: 'Ontbreekt',
    icon: XCircle,
    cls: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  niet_relevant: {
    label: 'Niet relevant',
    icon: MinusCircle,
    cls: 'border-border bg-muted/40 text-muted-foreground',
  },
};

type ReliabilityAction = {
  sectionId: string;
  targetId?: string;
  label: string;
};

function PillarCard({ pillar, onAction }: { pillar: ReliabilityPillar; onAction?: (action: ReliabilityAction) => void }) {
  const cfg = STATUS_CFG[pillar.status];
  const Icon = cfg.icon;
  return (
    <div className="rounded-md border bg-background/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{pillar.label}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{pillar.current}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium uppercase tracking-wide ${cfg.cls}`}>
          <Icon className="h-3 w-3" />{cfg.label}
        </span>
      </div>
      <div className="mt-2 rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">Nodig:</span> {pillar.needed}
      </div>
      {pillar.actionLabel && pillar.status !== 'voldoende' && pillar.status !== 'niet_relevant' && onAction && (
        <button
          type="button"
          onClick={() => onAction({ sectionId: pillar.sectionId, targetId: pillar.targetId, label: pillar.actionLabel ?? 'Open invoer' })}
          className="mt-2 inline-flex items-center rounded-md border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          {pillar.actionLabel}
        </button>
      )}
    </div>
  );
}

export default function BetrouwbaarheidsOpbouw({
  assessment,
  onAction,
}: {
  assessment: ReliabilityAssessment;
  onAction?: (action: ReliabilityAction) => void;
}) {
  const relevant = assessment.pillars.filter((pillar) => pillar.status !== 'niet_relevant');
  const notRelevant = assessment.pillars.filter((pillar) => pillar.status === 'niet_relevant');
  const tone = assessment.level === 'hoog'
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : assessment.level === 'middel'
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-destructive/40 bg-destructive/5';
  const pct = assessment.relevantCount > 0
    ? Math.round((assessment.sufficientCount / assessment.relevantCount) * 100)
    : 0;

  return (
    <div className={`rounded-md border p-3 space-y-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CircleHelp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Betrouwbaarheid van deze berekening</p>
          </div>
          <p className="mt-1 text-xs font-medium text-foreground">{assessment.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{assessment.summary}</p>
        </div>
        <span className="rounded-full border bg-background/70 px-2.5 py-1 text-xs font-semibold capitalize text-foreground">
          {assessment.level}
        </span>
      </div>

      <div>
        <div className="mb-1 flex justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{assessment.sufficientCount} van {assessment.relevantCount} kernpijlers voldoende</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {relevant.map((pillar) => <PillarCard key={pillar.key} pillar={pillar} onAction={onAction} />)}
      </div>

      {notRelevant.length > 0 && (
        <details className="rounded-md border bg-background/50">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
            Niet relevant voor dit rekenspoor ({notRelevant.length})
          </summary>
          <div className="grid grid-cols-1 gap-2 border-t p-3 lg:grid-cols-2">
            {notRelevant.map((pillar) => <PillarCard key={pillar.key} pillar={pillar} />)}
          </div>
        </details>
      )}

      <p className="text-[10px] leading-snug text-muted-foreground">
        “Hoog” betekent dat alle voor het gekozen rekenspoor relevante kernpijlers volgens de huidige modelregels voldoende zijn. Het blijft geen formele taxatie, bouwkostenbegroting of fiscale goedkeuring.
      </p>
    </div>
  );
}
