import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Scenario, TaxSettings } from '@/lib/vastgoedrekenen/types';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { fmtEur, fmtPct, DEAL_BADGE } from './format';
import { VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';

function ScenarioRow({ s, taxSettings, objectType, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, isBest }: {
  s: Scenario; taxSettings: TaxSettings | null; objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null; objectWoz?: number | null; objectEnergyLabel?: string | null; objectBouwjaar?: number | null;
  isBest: boolean;
}) {
  const { components, costs, wwsUnits } = useScenarioChildren(s.id);
  const o = useMemo(() => computeScenario({
    scenario: s, components, costs, wwsUnits, taxSettings, objectType, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar,
  }), [s, components, costs, wwsUnits, taxSettings, objectType, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar]);
  const deal = DEAL_BADGE[o.dealScore];
  return (
    <tr className={isBest ? 'bg-primary/5' : ''}>
      <td className="px-2 py-2 font-medium">{s.scenario_name}{isBest && <span className="ml-1 text-xs text-primary">★ best</span>}</td>
      <td className="px-2 py-2 text-xs text-muted-foreground">{VR_STRATEGY_LABELS[s.strategy_type] ?? s.strategy_type}</td>
      <td className="px-2 py-2 font-mono-data text-right">{fmtEur(s.purchase_price)}</td>
      <td className="px-2 py-2 font-mono-data text-right">{fmtEur(o.totalInvestment)}</td>
      <td className="px-2 py-2 font-mono-data text-right">{fmtEur(o.correctedAnnualRent)}</td>
      <td className="px-2 py-2 font-mono-data text-right">{fmtPct(o.barTotalInvestment)}</td>
      <td className="px-2 py-2 font-mono-data text-right">{o.factorTotalInvestment != null ? `${o.factorTotalInvestment.toFixed(2)}×` : '—'}</td>
      <td className="px-2 py-2 font-mono-data text-right">{fmtEur(o.maximumBid)}</td>
      <td className="px-2 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border ${deal.cls}`}>{o.dealScore}</span></td>
    </tr>
  );
}

export default function ScenarioVergelijking({ scenarios, taxSettings, objectType, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar }: {
  scenarios: Scenario[]; taxSettings: TaxSettings | null; objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null; objectWoz?: number | null; objectEnergyLabel?: string | null; objectBouwjaar?: number | null;
}) {
  if (scenarios.length === 0) return null;

  // Heuristisch: het scenario met de hoogste BAR_total (en geen reject) markeren als best
  const best = scenarios.reduce<{ id: string | null; bar: number }>((acc, s) => acc, { id: null, bar: -Infinity });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Scenariovergelijking</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="px-2 py-2">Scenario</th>
              <th className="px-2 py-2">Strategie</th>
              <th className="px-2 py-2 text-right">Aankoop</th>
              <th className="px-2 py-2 text-right">Tot. investering</th>
              <th className="px-2 py-2 text-right">Gecorr. jaarhuur</th>
              <th className="px-2 py-2 text-right">BAR (TI)</th>
              <th className="px-2 py-2 text-right">Factor</th>
              <th className="px-2 py-2 text-right">Max bod</th>
              <th className="px-2 py-2">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {scenarios.map((s) => (
              <ScenarioRow key={s.id} s={s} taxSettings={taxSettings} objectType={objectType}
                objectArea={objectArea} objectWoz={objectWoz} objectEnergyLabel={objectEnergyLabel} objectBouwjaar={objectBouwjaar}
                isBest={best.id === s.id} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
