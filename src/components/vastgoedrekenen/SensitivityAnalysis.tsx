import { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Component, Scenario, ScenarioCost, SellOffUnit, TaxSettings, WwsUnit } from '@/lib/vastgoedrekenen/types';
import type { AcquisitionComponent } from '@/lib/vastgoedrekenen/acquisition';
import { buildScenarioComputeContext } from '@/lib/vastgoedrekenen/computeContext';
import { computeSensitivityScenario } from '@/lib/vastgoedrekenen/sensitivity';
import type { PropertyAssumptionType } from '@/lib/vastgoedrekenen/profiles';
import { fmtEur, fmtPct } from './format';

const STEPS = [-10, -5, 0, 5, 10] as const;

type Props = {
  scenario: Scenario;
  components: Component[];
  acquisitionComponents: AcquisitionComponent[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  strategyUnits: SellOffUnit[];
  taxSettings: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  propertyType: PropertyAssumptionType;
};

type SensitivityPoint = {
  revenuePct: number;
  costsPct: number;
  maxPurchasePrice: number | null;
  profit: number | null;
  roi: number | null;
};

function pointLabel(pct: number): string {
  return pct === 0 ? 'Basis' : `${pct > 0 ? '+' : ''}${pct}%`;
}

function hasRevenueInput(scenario: Scenario, units: SellOffUnit[]): boolean {
  const s = scenario as unknown as Record<string, unknown>;
  const scenarioHas = ['sale_price_total', 'sale_price_per_m2', 'sale_price_per_unit', 'sale_exit_value_manual']
    .some((field) => Number(s[field] ?? 0) > 0);
  const unitsHave = units.some((unit) => {
    const r = unit as unknown as Record<string, unknown>;
    return ['sale_price_total', 'sale_price_per_m2', 'hold_value_manual']
      .some((field) => Number(r[field] ?? 0) > 0);
  });
  return scenarioHas || unitsHave;
}

export default function SensitivityAnalysis(props: Props) {
  const { scenario, costs, strategyUnits } = props;
  const revenueAvailable = hasRevenueInput(scenario, strategyUnits);

  const computeContext = useMemo(() => buildScenarioComputeContext({
    scenario,
    components: props.components,
    acquisitionComponents: props.acquisitionComponents,
    costs,
    wwsUnits: props.wwsUnits,
    strategyUnits,
    taxSettings: props.taxSettings,
    objectType: props.objectType,
    objectArea: props.objectArea,
    objectWoz: props.objectWoz,
    objectEnergyLabel: props.objectEnergyLabel,
    objectBouwjaar: props.objectBouwjaar,
    propertyType: props.propertyType,
  }), [
    scenario, props.components, props.acquisitionComponents, costs, props.wwsUnits,
    strategyUnits, props.taxSettings, props.objectType, props.objectArea,
    props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, props.propertyType,
  ]);

  const points = useMemo(() => {
    const map = new Map<string, SensitivityPoint>();
    for (const costsPct of STEPS) {
      for (const revenuePct of STEPS) {
        const outputs = computeSensitivityScenario(computeContext, {
          revenuePct,
          developmentCostsPct: costsPct,
        });
        map.set(`${revenuePct}:${costsPct}`, {
          revenuePct,
          costsPct,
          maxPurchasePrice: outputs.residual?.maxPurchasePrice ?? (outputs.leadingMaxValue > 0 ? outputs.leadingMaxValue : null),
          profit: outputs.netMargin ?? outputs.scenarioResultAtAsking,
          roi: outputs.roi,
        });
      }
    }
    return map;
  }, [computeContext]);

  const getPoint = (revenuePct: number, costsPct: number) => points.get(`${revenuePct}:${costsPct}`) ?? null;
  const base = getPoint(0, 0);
  const downside = getPoint(-10, 10);
  const upside = getPoint(10, -10);
  const currentPurchase = Number(scenario.purchase_price ?? 0);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Activity className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Prijs- en gevoeligheidsanalyse</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Read-only doorrekening met dezelfde rekenkern. Opbrengst/eindwaarde en project-/ontwikkelkosten bewegen; opgeslagen invoer blijft ongewijzigd.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!revenueAvailable && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Er is nog geen concrete verkoop- of handmatige eindwaarde om prijsgevoeligheid op toe te passen.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Summary label="Downside" point={downside} base={base} helper="Opbrengst −10% · kosten +10%" currentPurchase={currentPurchase} />
          <Summary label="Basis" point={base} base={base} helper="Huidige scenario-invoer" currentPurchase={currentPurchase} emphasize />
          <Summary label="Upside" point={upside} base={base} helper="Opbrengst +10% · kosten −10%" currentPurchase={currentPurchase} />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Project-/ontwikkelkosten</th>
                {STEPS.map((revenuePct) => (
                  <th key={revenuePct} className="px-3 py-2 text-right font-medium">
                    Opbrengst {pointLabel(revenuePct)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STEPS.map((costsPct) => (
                <tr key={costsPct} className="border-t">
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {pointLabel(costsPct)}
                  </th>
                  {STEPS.map((revenuePct) => {
                    const point = getPoint(revenuePct, costsPct);
                    const isBase = revenuePct === 0 && costsPct === 0;
                    return (
                      <td key={revenuePct} className={`px-3 py-2 text-right font-mono-data ${isBase ? 'bg-primary/5 font-semibold' : ''}`}>
                        <div>{point?.maxPurchasePrice != null ? fmtEur(point.maxPurchasePrice) : '—'}</div>
                        {point?.profit != null && <div className="text-[10px] text-muted-foreground">winst {fmtEur(point.profit)}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Iedere cel toont de indicatieve maximale aankoopprijs; daaronder staat de winst bij de huidige beoogde aankoopprijs wanneer die berekenbaar is. Vaste financieringskosten, fiscale tarieven en rendementseisen blijven in deze eerste gevoeligheidslaag gelijk.
        </p>
      </CardContent>
    </Card>
  );
}

function Summary({
  label,
  point,
  base,
  helper,
  currentPurchase,
  emphasize = false,
}: {
  label: string;
  point: SensitivityPoint | null;
  base: SensitivityPoint | null;
  helper: string;
  currentPurchase: number;
  emphasize?: boolean;
}) {
  const delta = point?.maxPurchasePrice != null && base?.maxPurchasePrice != null
    ? point.maxPurchasePrice - base.maxPurchasePrice
    : null;
  const purchaseBuffer = point?.maxPurchasePrice != null && currentPurchase > 0
    ? point.maxPurchasePrice - currentPurchase
    : null;
  return (
    <div className={`rounded-md border px-3 py-3 ${emphasize ? 'border-primary/40 bg-primary/5' : 'bg-background'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-muted-foreground">{helper}</p>
        </div>
        {point?.roi != null && <span className="text-[10px] text-muted-foreground">ROI {fmtPct(point.roi)}</span>}
      </div>
      <p className="mt-2 font-mono-data text-base font-semibold">
        {point?.maxPurchasePrice != null ? fmtEur(point.maxPurchasePrice) : '—'}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {delta == null || delta === 0 ? 'Referentie maximale aankoopprijs' : `${delta > 0 ? '+' : ''}${fmtEur(delta)} versus basis`}
        {purchaseBuffer != null ? ` · buffer t.o.v. aankoop ${purchaseBuffer >= 0 ? '+' : ''}${fmtEur(purchaseBuffer)}` : ''}
      </p>
    </div>
  );
}
