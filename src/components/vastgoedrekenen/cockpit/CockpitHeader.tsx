// Premium "deal cockpit" header voor Vastgoedrekenen.
// Toont scenario-meta, KPI-strip en de globale "scenario-uitkomst gebaseerd op"-selector.
// 100% presentatie — leest bestaande ComputedOutputs en patcht alleen leading_valuation_track.

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import { fmtEur, DEAL_BADGE } from '../format';
import { toast } from 'sonner';

type Props = {
  scenario: Scenario;
  outputs: ComputedOutputs;
  /** Andere scenario's voor potentiële commissie etc. (optioneel). */
  scenarioName?: string;
  /** Rekenspoor (scenario / hybride / component) — al berekend door editor. */
  trackMode: 'scenario' | 'hybride' | 'component';
  /** Of er een ongekozen conflict tussen scenario-exit en componentstrategie is. */
  conflictUnresolved: boolean;
  /** Beschikbaarheid voor selector-opties. */
  scenarioExitActive: boolean;
  strategyActive: boolean;
  /** Patch het scenario (alleen leading_valuation_track). */
  onPatch: (patch: Partial<Scenario>) => void;
};

const TRACK_MODE_LABEL: Record<Props['trackMode'], string> = {
  scenario: 'Scenario-level',
  hybride: 'Hybride (sell + hold)',
  component: 'Componentgedreven',
};

const TRACK_MODE_CLS: Record<Props['trackMode'], string> = {
  scenario: 'bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-700 dark:text-slate-50 dark:border-slate-500',
  hybride: 'bg-violet-200 text-violet-950 border-violet-500 dark:bg-violet-900/70 dark:text-violet-50 dark:border-violet-500',
  component: 'bg-emerald-200 text-emerald-950 border-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-50 dark:border-emerald-500',
};

export default function CockpitHeader({
  scenario,
  outputs: o,
  scenarioName,
  trackMode,
  conflictUnresolved,
  scenarioExitActive,
  strategyActive,
  onPatch,
}: Props) {
  const asking = Number(scenario.asking_price ?? 0);
  const diff = o.leadingDifferenceWithAskingPrice;
  const pct = asking > 0 ? (diff / asking) * 100 : null;
  const rounds = o.leadingRoundsAtAsking;
  const deal = DEAL_BADGE[o.dealScore];
  const trackChoice = ((scenario as unknown as Record<string, unknown>).leading_valuation_track as string | null) ?? 'auto';

  // Informatieve alternatieven (niet leidend).
  const altExit = o.leadingMaxBasis !== 'verkoop' && o.exitBasedMaxBid != null && o.exitBasedMaxBid > 0
    ? o.exitBasedMaxBid : null;
  const altHuur = o.leadingMaxBasis !== 'huur' && Math.round(o.maximumBid) !== Math.round(o.leadingMaxValue) && o.bidBasisUsed === 'huur'
    ? o.maximumBid : null;

  // Commissie (1% v.d. leidende waarde, gewogen ½) — bestaande heuristiek, puur informatief.
  const commissie = Math.round(o.leadingMaxValue * 0.01);
  const commissieGewogen = Math.round(commissie * 0.75);

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-[hsl(var(--primary)/0.08)] via-card to-card overflow-hidden">
      {/* Meta-regel */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 border-b border-primary/15 bg-primary/5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary whitespace-nowrap">Vastgoedrekenen</span>
          {scenarioName && (
            <span className="text-sm text-foreground/90 break-words">· {scenarioName}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Rekenspoor</span>
          <span className={`px-2 py-0.5 rounded-full border ${TRACK_MODE_CLS[trackMode]}`}>{TRACK_MODE_LABEL[trackMode]}</span>
        </div>
      </div>

      {/* KPI-strip — auto-fit zodat lange eurobedragen volledig blijven */}
      <div
        className="grid gap-px bg-border/40"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <Kpi
          label="Rond te rekenen"
          value={asking > 0 ? (rounds ? 'Ja' : 'Nee') : '—'}
          tone={asking > 0 ? (rounds ? 'success' : 'warn') : 'neutral'}
          sub={asking > 0
            ? (rounds
                ? `Ruimte ${fmtEur(Math.abs(diff))}${pct != null ? ` (${Math.abs(pct).toFixed(1)}%)` : ''}`
                : `Tekort ${fmtEur(Math.abs(diff))}${pct != null ? ` (${Math.abs(pct).toFixed(1)}%)` : ''}`)
            : 'Geen vraagprijs'}
        />
        <Kpi
          label={o.leadingMaxBasis === 'strategie' ? 'Max. aankoopprijs' : 'Max. bieding'}
          value={fmtEur(o.leadingMaxValue)}
          tone="primary"
          sub={`Bron: ${o.leadingMaxBasisLabel}`}
        />
        <Kpi
          label="Vraagprijs"
          value={asking > 0 ? fmtEur(asking) : '—'}
          tone="neutral"
          sub={asking > 0 && diff !== 0 ? `${diff >= 0 ? '+' : '−'} ${fmtEur(Math.abs(diff))} verschil` : undefined}
        />
        <Kpi
          label="ROI totaal"
          value={o.roi != null ? `${o.roi.toFixed(1)}%` : '—'}
          tone={o.roi != null && o.roi < 0 ? 'danger' : 'neutral'}
          sub={o.roi != null ? 'Target 20%' : 'Verkoopdata ontbreekt'}
        />
        <Kpi
          label="Netto marge"
          value={o.netMargin != null ? fmtEur(o.netMargin) : '—'}
          tone={o.netMargin != null && o.netMargin < 0 ? 'danger' : 'neutral'}
          sub={o.netMarginPerM2 != null ? `${fmtEur(o.netMarginPerM2)} / m²` : undefined}
        />
        <Kpi
          label="Score"
          value={o.scoreLabel}
          tone="neutral"
          customValueCls={deal.cls}
          sub={`Betrouwbaarheid ${o.inputReliability}`}
        />
        <Kpi
          label="Commissie"
          value={fmtEur(commissie)}
          tone="neutral"
          sub={`Gewogen ${fmtEur(commissieGewogen)}`}
        />
      </div>


      {/* Globale track-selector */}
      <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs border-t ${conflictUnresolved ? 'border-amber-500/50 bg-amber-500/10' : 'border-border/60 bg-card'}`}>
        <span className="font-medium text-foreground">Scenario-uitkomst gebaseerd op:</span>
        <Select
          value={trackChoice}
          onValueChange={(v) => {
            onPatch({ leading_valuation_track: v } as unknown as Partial<Scenario>);
            const label = v === 'huur_bar' ? 'Huur / BAR'
              : v === 'scenario_exit' ? 'Scenario-level verkoop / exit'
              : v === 'componentstrategie' ? 'Componentstrategie'
              : 'Automatisch';
            toast.success(`Scenario-uitkomst bijgewerkt op basis van ${label}.`);
          }}
        >
          <SelectTrigger className="h-auto min-h-7 w-full sm:w-auto sm:min-w-[260px] text-xs py-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automatisch (heuristiek)</SelectItem>
            <SelectItem value="huur_bar">Huur / BAR</SelectItem>
            <SelectItem value="scenario_exit" disabled={!scenarioExitActive}>
              Scenario-level verkoop / exit{!scenarioExitActive ? ' — geen exit ingevuld' : ''}
            </SelectItem>
            <SelectItem value="componentstrategie" disabled={!strategyActive}>
              Componentstrategie (per unit){!strategyActive ? ' — geen units' : ''}
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">
          Huidig leidend: <span className="text-foreground font-medium">{o.leadingMaxBasisLabel}</span>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {altExit != null && <span>Informatief · Verkoop/exit: <span className="font-mono-data text-foreground">{fmtEur(altExit)}</span></span>}
          {altHuur != null && <span>Informatief · Huur/BAR: <span className="font-mono-data text-foreground">{fmtEur(altHuur)}</span></span>}
        </span>
      </div>

      {conflictUnresolved && (
        <div className="px-4 py-2 text-[11px] text-amber-900 dark:text-amber-200 bg-amber-500/10 border-t border-amber-500/30 leading-snug">
          Zowel scenario-level verkoop/exit als componentstrategie zijn ingevuld. Kies hierboven expliciet welk spoor leidend is.
        </div>
      )}
    </div>
  );
}

type Tone = 'primary' | 'success' | 'warn' | 'danger' | 'neutral';

const TONE_VALUE_CLS: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-emerald-400',
  warn: 'text-amber-400',
  danger: 'text-destructive',
  neutral: 'text-foreground',
};

function Kpi({ label, value, sub, tone, customValueCls }: { label: string; value: string; sub?: string; tone: Tone; customValueCls?: string }) {
  return (
    <div className="bg-card px-3 py-2.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium break-words">{label}</p>
      <p
        className={`mt-0.5 font-semibold font-mono-data leading-tight tabular-nums text-base lg:text-lg break-words ${customValueCls ?? TONE_VALUE_CLS[tone]}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 break-words">{sub}</p>}
    </div>
  );
}

