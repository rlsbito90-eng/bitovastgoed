// V1B — Compacte KPI-strip bovenaan de Acquisitieselectie-tab. Mobiel: wrap.
import { ListChecks, Users, Printer, Lock, Clock } from 'lucide-react';
import type { AcquisitieKpis } from '@/lib/offMarket/acquisitie/readiness';

interface Props {
  kpis: AcquisitieKpis;
}

function Pil({
  icon: Icon, label, value, testid, tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; testid: string;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}) {
  const toneCls =
    tone === 'success' ? 'border-success/40 bg-success/10 text-success'
    : tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    : tone === 'danger' ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : 'border-border bg-card text-foreground';
  return (
    <div
      data-testid={testid}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${toneCls}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">{label}</p>
        <p className="text-base font-semibold font-mono-data leading-none">{value}</p>
      </div>
    </div>
  );
}

export default function AcquisitieKpis({ kpis }: Props) {
  return (
    <div
      data-testid="acquisitie-kpis"
      className="flex flex-wrap gap-2"
    >
      <Pil icon={ListChecks} label="Signalen" value={kpis.signalen} testid="kpi-signalen" />
      <Pil icon={Users} label="Geadresseerden" value={kpis.geadresseerden} testid="kpi-geadresseerden" />
      <Pil icon={Printer} label="Printklaar" value={kpis.printklaar} testid="kpi-printklaar" tone={kpis.printklaar > 0 ? 'success' : 'default'} />
      <Pil icon={Lock} label="Geblokkeerd" value={kpis.geblokkeerd} testid="kpi-geblokkeerd" tone={kpis.geblokkeerd > 0 ? 'danger' : 'default'} />
      <Pil icon={Clock} label="Opvolging open" value={kpis.opvolgingOpen} testid="kpi-opvolging" tone={kpis.opvolgingOpen > 0 ? 'warn' : 'default'} />
    </div>
  );
}
