import { useState, type ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, MinusCircle } from 'lucide-react';

export type SectionRelevance = 'leidend' | 'informatief' | 'niet_relevant' | 'aandacht';

type UsageStatus = 'gebruikt' | 'controleren' | 'ontbreekt' | 'niet_gebruikt';

const ROLE_CFG: Record<SectionRelevance, { label: string; cls: string }> = {
  leidend: {
    label: 'Leidend',
    cls: 'bg-primary/15 text-primary border-primary/30',
  },
  informatief: {
    label: 'Ondersteunend',
    cls: 'bg-muted text-muted-foreground border-border',
  },
  niet_relevant: {
    label: 'Niet leidend',
    cls: 'bg-muted/50 text-muted-foreground/80 border-border',
  },
  aandacht: {
    label: 'Ondersteunend',
    cls: 'bg-muted text-muted-foreground border-border',
  },
};

const USAGE_CFG: Record<UsageStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  gebruikt: {
    label: 'Gebruikt',
    icon: CheckCircle2,
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  controleren: {
    label: 'Controleren',
    icon: AlertTriangle,
    cls: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  },
  ontbreekt: {
    label: 'Ontbreekt',
    icon: AlertOctagon,
    cls: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  niet_gebruikt: {
    label: 'Invoer niet gebruikt',
    icon: MinusCircle,
    cls: 'border-border bg-muted/60 text-muted-foreground',
  },
};

function deriveUsageStatus(relevance?: SectionRelevance): UsageStatus | null {
  if (!relevance) return null;
  if (relevance === 'aandacht') return 'controleren';
  if (relevance === 'niet_relevant') return 'niet_gebruikt';
  return 'gebruikt';
}

/**
 * Lichte, inklapbare sectie voor de Vastgoedrekenen-module.
 * Rol en gebruiksstatus worden bewust afzonderlijk getoond:
 * - rol: leidend, ondersteunend of niet leidend;
 * - gebruik: gebruikt, controleren, ontbreekt of invoer niet gebruikt.
 */
export function Section({
  title,
  status,
  defaultOpen,
  open: openProp,
  onOpenChange,
  hidden,
  children,
  tone,
  id,
  source,
  relevance,
  usageStatus,
  numberLabel,
}: {
  title: string;
  status?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  hidden?: boolean;
  children: ReactNode;
  tone?: 'default' | 'primary';
  id?: string;
  source?: string;
  relevance?: SectionRelevance;
  usageStatus?: UsageStatus;
  numberLabel?: string;
}) {
  const [innerOpen, setInnerOpen] = useState(!!defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : innerOpen;
  const toggle = () => {
    if (isControlled) onOpenChange?.(!open);
    else {
      setInnerOpen((value) => !value);
      onOpenChange?.(!open);
    }
  };
  if (hidden) return null;

  const effectiveUsage = usageStatus ?? deriveUsageStatus(relevance);
  const roleConfig = relevance ? ROLE_CFG[relevance] : null;
  const usageConfig = effectiveUsage ? USAGE_CFG[effectiveUsage] : null;
  const UsageIcon = usageConfig?.icon;
  const borderCls =
    effectiveUsage === 'ontbreekt'
      ? 'border-destructive/50'
      : effectiveUsage === 'controleren'
        ? 'border-amber-500/50'
        : tone === 'primary' || relevance === 'leidend'
          ? 'border-primary/40'
          : 'border-border/70';

  return (
    <div
      id={id}
      className={`group/section relative scroll-mt-32 overflow-hidden rounded-xl border bg-card/95 transition-all duration-200 lg:scroll-mt-36 ${borderCls} ${open ? 'shadow-[0_2px_10px_-6px_hsl(var(--shadow-color)/0.18),inset_3px_0_0_0_hsl(var(--accent)/0.65)]' : 'hover:border-border'}`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full min-w-0 flex-col gap-1.5 px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 ${open ? 'bg-accent/[0.04]' : 'hover:bg-muted/40'}`}
      >
        <div className="flex w-full min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-2.5">
          <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 sm:mt-0 ${open ? 'rotate-90 text-accent' : ''}`} />
          {numberLabel && (
            <span className="mt-0.5 shrink-0 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground/90 sm:mt-0">
              {numberLabel}
            </span>
          )}
          <span className="min-w-0 flex-1 line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.005em] text-foreground sm:line-clamp-none sm:text-[14.5px] sm:break-words">
            {title}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex">
            {roleConfig && (
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${roleConfig.cls}`}>
                {roleConfig.label}
              </span>
            )}
            {usageConfig && UsageIcon && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${usageConfig.cls}`}>
                <UsageIcon className="h-3 w-3" />
                {usageConfig.label}
              </span>
            )}
          </span>
          {source && <span className="hidden break-words text-[10px] text-muted-foreground/80 md:inline">· {source}</span>}
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 pl-6 sm:hidden">
          {roleConfig && <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${roleConfig.cls}`}>{roleConfig.label}</span>}
          {usageConfig && UsageIcon && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${usageConfig.cls}`}><UsageIcon className="h-3 w-3" />{usageConfig.label}</span>}
        </div>
        {status && (
          <span className="w-full shrink-0 whitespace-normal break-words pl-6 text-[11px] leading-snug text-muted-foreground/90 tabular-nums sm:w-auto sm:max-w-[55%] sm:pl-0 sm:text-right sm:text-[11.5px] md:max-w-[60%]">
            {status}
          </span>
        )}
      </button>
      {open && <div className="border-t border-border/50 bg-card px-3 pb-3 pt-2 sm:px-4 sm:pb-4">{children}</div>}
    </div>
  );
}

export function SectionGroup({ step, title, hint }: { step?: number | string; title: string; hint?: string }) {
  const stepLabel = step != null ? (typeof step === 'number' ? String(step).padStart(2, '0') : step) : null;
  return (
    <section className="scroll-mt-32 pb-3 pt-10 first:pt-3 lg:scroll-mt-36" aria-label={title}>
      <div className="flex min-w-0 items-center gap-3">
        {stepLabel && <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary tabular-nums">{stepLabel}</span>}
        {stepLabel && <span className="select-none text-primary/40" aria-hidden>—</span>}
        <h3 className="min-w-0 truncate text-[14px] font-bold uppercase tracking-[0.13em] text-primary sm:text-[15px]">{title}</h3>
        <span className="ml-2 h-px flex-1 bg-gradient-to-r from-accent/60 via-accent/25 to-transparent" aria-hidden />
      </div>
      {hint && <p className="ml-[2px] mt-2 max-w-[68ch] break-words text-[12px] leading-relaxed text-muted-foreground/95">{hint}</p>}
    </section>
  );
}
