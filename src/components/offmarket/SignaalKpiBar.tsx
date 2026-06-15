// Bovenste KPI-/statusbalk voor de off-market signaaldetailpagina.
// Horizontaal scrollbaar op mobiel; wrap op desktop.
import { ReactNode } from 'react';
import {
  STATUS_LABEL, PRIORITEIT_LABEL, ASSETTYPE_LABEL, EIGENAARSTATUS_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';
import {
  BRIEFSTATUS_LABEL, type BriefStatus,
} from '@/lib/offMarket/briefStatus';
import { bepaalVolgendeActie, formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import type { Taak } from '@/data/mock-data';
import {
  Activity, Award, Boxes, Compass, Flag, Mail, Sparkles, UserCheck, CalendarClock,
} from 'lucide-react';

interface Props {
  signaal: OffMarketSignaal;
  taken: Taak[];
  briefStatus: BriefStatus;
}

interface Tegel {
  key: string;
  label: string;
  waarde: ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  highlight?: 'success' | 'warning' | 'accent' | 'neutral';
}

function tone(h?: Tegel['highlight']) {
  switch (h) {
    case 'success': return 'text-success';
    case 'warning': return 'text-warning';
    case 'accent': return 'text-accent';
    default: return 'text-foreground';
  }
}

export default function SignaalKpiBar({ signaal, taken, briefStatus }: Props) {
  const verkoopkans = typeof signaal.ai_verkoopkans === 'number'
    ? `${Math.round(Number(signaal.ai_verkoopkans) * 100)}%`
    : '—';
  const aiScore = typeof signaal.ai_score === 'number' ? String(signaal.ai_score) : '—';
  const eigenaar = (signaal as any).eigenaarstatus
    ? EIGENAARSTATUS_LABEL[(signaal as any).eigenaarstatus as keyof typeof EIGENAARSTATUS_LABEL]
    : '—';
  const strategie = signaal.potentiele_strategie || signaal.ai_strategie_suggestie || '—';

  const va = bepaalVolgendeActie(signaal, taken, signaal.id);
  const volgendeActieTekst = va
    ? `${va.titel}${va.deadline ? ` · ${formatDeadlineNL(va.deadline)}` : ''}`
    : '—';

  const tegels: Tegel[] = [
    { key: 'ai', label: 'AI-score', waarde: aiScore, Icon: Sparkles, highlight: aiScore === '—' ? 'neutral' : 'accent' },
    { key: 'vk', label: 'Verkoopkans', waarde: verkoopkans, Icon: Award, highlight: 'success' },
    { key: 'st', label: 'Status', waarde: STATUS_LABEL[signaal.status], Icon: Activity },
    { key: 'pr', label: 'Prioriteit', waarde: PRIORITEIT_LABEL[signaal.prioriteit], Icon: Flag },
    { key: 'as', label: 'Assettype', waarde: ASSETTYPE_LABEL[signaal.assettype], Icon: Boxes },
    { key: 'sg', label: 'Strategie', waarde: strategie, Icon: Compass },
    { key: 'eg', label: 'Eigenaar', waarde: eigenaar, Icon: UserCheck },
    { key: 'br', label: 'Briefstatus', waarde: BRIEFSTATUS_LABEL[briefStatus], Icon: Mail, highlight: briefStatus === 'geen' ? 'neutral' : 'success' },
    { key: 'va', label: 'Volgende actie', waarde: volgendeActieTekst, Icon: CalendarClock, highlight: va ? 'accent' : 'neutral' },
  ];

  return (
    <div
      data-testid="signaal-kpi-bar"
      className="section-card p-1.5 sm:p-2"
    >
      <div className="flex gap-2 overflow-x-auto sm:grid sm:grid-cols-3 lg:grid-cols-9 sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0">
        {tegels.map((t) => (
          <div
            key={t.key}
            className="shrink-0 min-w-[140px] sm:min-w-0 px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <t.Icon className="h-3 w-3" />
              {t.label}
            </div>
            <div className={`text-sm font-medium mt-0.5 leading-tight truncate ${tone(t.highlight)}`} title={String(t.waarde)}>
              {t.waarde}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
