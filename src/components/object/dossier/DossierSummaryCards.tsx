// Compacte samenvattings-cards bovenaan de Dossier-cockpit.

import { READINESS_LABELS, type ReadinessResult } from '@/lib/objectDossier/readiness';
import type { EffectiveItem } from '@/lib/objectDossier/readiness';
import type { AttentionRow } from '@/hooks/useObjectDossier';
import { CHECKLIST_CATALOG } from '@/lib/objectDossier/catalog';

interface Props {
  readiness: ReadinessResult;
  effective: EffectiveItem[];
  attention: AttentionRow[];
}

function counts(effective: EffectiveItem[]) {
  let critTotal = 0;
  let critDone = 0;
  let opgevraagd = 0;
  let teControleren = 0;
  for (const e of effective) {
    if (e.catalog.weight === 3) {
      critTotal++;
      if (e.status === 'aanwezig') critDone++;
    }
    if (e.status === 'opgevraagd') opgevraagd++;
    if (e.status === 'te_controleren') teControleren++;
  }
  return { critTotal, critDone, opgevraagd, teControleren };
}

export default function DossierSummaryCards({ readiness, effective, attention }: Props) {
  const c = counts(effective);
  const openAttention = attention.filter(a => (a.status ?? 'open') === 'open').length;

  // Visuele toon voor de scorekaart
  const scoreTone =
    readiness.score >= 80 ? 'success'
    : readiness.score >= 60 ? 'accent'
    : readiness.score >= 40 ? 'warning'
    : 'destructive';

  const ringStyle = {
    background: `conic-gradient(hsl(var(--${scoreTone})) ${readiness.score * 3.6}deg, hsl(var(--muted)) 0deg)`,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* Score-kaart met conic ring */}
      <div className="col-span-2 md:col-span-2 border border-border rounded-lg bg-card p-4 flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 rounded-full" style={ringStyle}>
          <div className="absolute inset-1.5 rounded-full bg-card flex items-center justify-center">
            <span className="text-sm font-semibold font-mono-data text-foreground">{readiness.score}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Dossiergereedheid</p>
          <p className="text-sm font-semibold text-foreground truncate">{READINESS_LABELS[readiness.label]}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {readiness.totalAchieved}/{readiness.totalCounted} gewogen punten
          </p>
        </div>
      </div>

      <StatCard label="Cruciaal compleet" value={`${c.critDone}/${c.critTotal}`} tone={c.critDone === c.critTotal ? 'success' : 'destructive'} />
      <StatCard label="Open aandachtspunten" value={openAttention} tone={openAttention > 0 ? 'warning' : 'neutral'} />
      <StatCard label="Opgevraagd" value={c.opgevraagd} tone={c.opgevraagd > 0 ? 'accent' : 'neutral'} sub={c.teControleren > 0 ? `${c.teControleren} te controleren` : undefined} />
    </div>
  );
}

function StatCard({ label, value, tone, sub }: { label: string; value: number | string; tone: 'success' | 'warning' | 'destructive' | 'accent' | 'neutral'; sub?: string }) {
  const toneClass: Record<string, string> = {
    success:     'text-success',
    warning:     'text-warning',
    destructive: 'text-destructive',
    accent:      'text-accent',
    neutral:     'text-foreground',
  };
  return (
    <div className="border border-border rounded-lg bg-card p-4 flex flex-col justify-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold font-mono-data ${toneClass[tone]} mt-1`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
