import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import { fmtEur } from '../format';

/**
 * Pure SVG waterfall — visualiseert opbouw van vraagprijs → kosten → OVB →
 * (bij verkoop) verkoopkosten → netto verkoopopbrengst → nettomarge.
 *
 * Geen externe libs, geen rekenlogica: leest uitsluitend bestaande
 * ComputedOutputs-velden. Wordt rustig leeg weergegeven als er onvoldoende
 * data is.
 */
type Step = {
  key: string;
  label: string;
  value: number;
  /** start = startwaarde (cumulatief) na/voor deze stap voor de bar-positionering */
  cumulative: number;
  tone: 'base' | 'cost' | 'result' | 'positive' | 'negative';
};

export default function InvesteringsWaterfall({
  scenario,
  outputs,
}: {
  scenario: Scenario;
  outputs: ComputedOutputs;
}) {
  const asking = Number(scenario.asking_price ?? 0);
  if (asking <= 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        Vul een vraagprijs in om de investerings-waterfall te tonen.
      </div>
    );
  }

  const exploitatie = outputs.assessmentType === 'exploitatie';
  const totalCosts = Math.max(0, Math.round(outputs.totalCosts || 0));
  const ovb = Math.max(0, Math.round(outputs.totalTransferTax || 0));
  const investment = Math.round(outputs.totalInvestment || 0);
  const grossSale = outputs.grossSaleProceeds != null ? Math.round(outputs.grossSaleProceeds) : null;
  const saleCosts = outputs.saleCostsTotal != null ? Math.max(0, Math.round(outputs.saleCostsTotal)) : null;
  const netSale = outputs.netSaleProceeds != null ? Math.round(outputs.netSaleProceeds) : null;
  const netMargin = outputs.netMargin != null ? Math.round(outputs.netMargin) : null;

  // Bouw stappenreeks
  const steps: Step[] = [
    { key: 'asking',    label: 'Vraagprijs',         value: asking,      cumulative: asking, tone: 'base' },
  ];
  if (totalCosts > 0) {
    steps.push({ key: 'costs', label: 'Bijkomende kosten', value: totalCosts, cumulative: asking + totalCosts, tone: 'cost' });
  }
  if (ovb > 0) {
    steps.push({ key: 'ovb', label: 'OVB', value: ovb, cumulative: asking + totalCosts + ovb, tone: 'cost' });
  }
  steps.push({
    key: 'investment',
    label: 'Totale investering',
    value: investment,
    cumulative: investment,
    tone: 'result',
  });

  if (!exploitatie && grossSale != null) {
    steps.push({
      key: 'grossSale',
      label: 'Bruto verkoopopbrengst',
      value: grossSale,
      cumulative: grossSale,
      tone: 'base',
    });
    if (saleCosts != null && saleCosts > 0) {
      steps.push({
        key: 'saleCosts',
        label: 'Verkoopkosten',
        value: saleCosts,
        cumulative: grossSale - saleCosts,
        tone: 'cost',
      });
    }
    if (netSale != null) {
      steps.push({
        key: 'netSale',
        label: 'Netto verkoopopbrengst',
        value: netSale,
        cumulative: netSale,
        tone: 'result',
      });
    }
    if (netMargin != null) {
      steps.push({
        key: 'netMargin',
        label: 'Nettomarge',
        value: netMargin,
        cumulative: netMargin,
        tone: netMargin >= 0 ? 'positive' : 'negative',
      });
    }
  }

  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.value)), 1);

  const toneFill = (tone: Step['tone']) => {
    switch (tone) {
      case 'base':     return 'fill-primary/70';
      case 'cost':     return 'fill-amber-500/80';
      case 'result':   return 'fill-primary';
      case 'positive': return 'fill-emerald-500/80';
      case 'negative': return 'fill-destructive/80';
    }
  };
  const toneText = (tone: Step['tone']) => {
    switch (tone) {
      case 'positive': return 'text-emerald-700 dark:text-emerald-300';
      case 'negative': return 'text-destructive';
      default:         return 'text-foreground';
    }
  };

  // Layout-parameters
  const barH = 28;
  const gap = 10;
  const labelW = 220;
  const valueW = 160;
  const chartW = 480;
  const totalW = labelW + chartW + valueW + 16;
  const totalH = steps.length * (barH + gap) + gap;

  return (
    <div className="rounded-md border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold">
          Investerings-waterfall
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            — vraagprijs → investering → opbrengst → marge
          </span>
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {exploitatie
            ? 'Opbouw totale investering (exploitatie-scenario).'
            : 'Van vraagprijs naar nettomarge (verkoop-scenario).'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${totalW} ${totalH}`}
          role="img"
          aria-label="Investerings-waterfall"
          className="min-w-[640px]"
        >
          {steps.map((step, i) => {
            const y = gap + i * (barH + gap);
            const barLen = Math.max(2, (Math.abs(step.value) / maxAbs) * chartW);
            return (
              <g key={step.key}>
                <text
                  x={labelW - 8}
                  y={y + barH * 0.65}
                  textAnchor="end"
                  className="fill-foreground text-[12px]"
                >
                  {step.label}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={barLen}
                  height={barH}
                  rx={3}
                  className={toneFill(step.tone)}
                />
                <text
                  x={labelW + chartW + 12}
                  y={y + barH * 0.65}
                  className={`${toneText(step.tone)} text-[12px] font-mono`}
                >
                  {(step.tone === 'positive' || step.tone === 'negative') && step.value >= 0 ? '+ ' : ''}
                  {fmtEur(step.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-primary/70" />Basis</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-500/80" />Kosten / OVB</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-primary" />Tussentotaal</span>
        {!exploitatie && (
          <>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/80" />Positieve marge</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-destructive/80" />Negatieve marge</span>
          </>
        )}
      </div>
    </div>
  );
}
