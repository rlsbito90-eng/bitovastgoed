import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Scenario, TaxSettings, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, DEAL_BADGE } from './format';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { SALE_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/verkoop';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';
import { Trophy, TrendingUp, ShieldCheck, Target, Coins } from 'lucide-react';

type SharedProps = {
  taxSettings: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectRawType?: string | null;
};

type RowData = { scenario: Scenario; outputs: ComputedOutputs };

function ScenarioComputer({
  s, shared, onReady,
}: { s: Scenario; shared: SharedProps; onReady: (id: string, data: RowData | null) => void }) {
  const { components, costs, wwsUnits, loading } = useScenarioChildren(s.id);
  const propertyType = useMemo(
    () => mapToAssumptionType(shared.objectRawType ?? null, shared.objectType),
    [shared.objectRawType, shared.objectType],
  );
  const outputs = useMemo(() => computeScenario({
    scenario: s, components, costs, wwsUnits,
    taxSettings: shared.taxSettings,
    objectType: shared.objectType,
    objectArea: shared.objectArea,
    objectWoz: shared.objectWoz,
    objectEnergyLabel: shared.objectEnergyLabel,
    objectBouwjaar: shared.objectBouwjaar,
    propertyType,
  }), [s, components, costs, wwsUnits, shared, propertyType]);

  useEffect(() => {
    if (loading) return;
    onReady(s.id, { scenario: s, outputs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, s, outputs]);

  return null;
}

function bidVsAsking(o: ComputedOutputs, asking: number): { label: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (!asking || asking <= 0) return { label: 'Vraagprijs onbekend', tone: 'neutral' };
  const diff = o.maximumBid - asking;
  const pct = (diff / asking) * 100;
  if (Math.abs(pct) < 2) return { label: 'Rond vraagprijs', tone: 'neutral' };
  if (diff > 0) return { label: 'Boven vraagprijs', tone: 'positive' };
  if (pct > -10) return { label: 'Onder vraagprijs', tone: 'negative' };
  return { label: 'Interessant bij lagere aankoopprijs', tone: 'negative' };
}

function pickBest(rows: RowData[]) {
  if (rows.length === 0) return null;
  const valid = rows.filter((r) => r.outputs.dealScore !== 'reject');
  const pool = valid.length > 0 ? valid : rows;

  const byBid = [...pool].sort((a, b) => (b.outputs.maximumBid ?? 0) - (a.outputs.maximumBid ?? 0))[0];
  const byBar = [...pool].sort((a, b) => (b.outputs.barTotalInvestment ?? 0) - (a.outputs.barTotalInvestment ?? 0))[0];
  const byInvestment = [...pool].sort((a, b) => (a.outputs.totalInvestment ?? Infinity) - (b.outputs.totalInvestment ?? Infinity))[0];
  const riskRank: Record<string, number> = { laag: 0, middel: 1, hoog: 2 };
  const byRisk = [...pool].sort((a, b) => riskRank[a.outputs.riskScore] - riskRank[b.outputs.riskScore])[0];

  // Verkoopgerichte rankings (alleen wanneer er minstens 1 scenario verkoopdata heeft)
  const withSale = pool.filter((r) => r.outputs.netMargin != null);
  const byMargin = withSale.length > 0
    ? [...withSale].sort((a, b) => (b.outputs.netMargin ?? -Infinity) - (a.outputs.netMargin ?? -Infinity))[0]
    : null;
  const byRoi = withSale.length > 0
    ? [...withSale].sort((a, b) => (b.outputs.roi ?? -Infinity) - (a.outputs.roi ?? -Infinity))[0]
    : null;

  return { byBid, byBar, byInvestment, byRisk, byMargin, byRoi };
}

function DiffBlock({ diff, asking }: { diff: number; asking: number }) {
  if (!asking || asking <= 0) return <span className="text-muted-foreground">—</span>;
  const pct = (diff / asking) * 100;
  const positive = diff >= 0;
  const cls = positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300';
  const sign = positive ? '+' : '−';
  return (
    <span className={`font-mono-data ${cls}`}>
      {sign} {fmtEur(Math.abs(diff))} <span className="opacity-75">/ {sign}{Math.abs(pct).toFixed(1)}%</span>
    </span>
  );
}

function ScenarioCardMobile({ row }: { row: RowData }) {
  const { scenario: s, outputs: o } = row;
  const asking = Number(s.asking_price ?? 0);
  const purchase = Number(s.purchase_price ?? 0);
  const vp = bidVsAsking(o, asking);
  const deal = DEAL_BADGE[o.dealScore];
  const toneCls = vp.tone === 'positive'
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : vp.tone === 'negative'
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-muted';
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug break-words">{s.scenario_name}</p>
            <p className="text-xs text-muted-foreground">{VR_STRATEGY_LABELS[s.strategy_type] ?? s.strategy_type}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{o.dealScore}</span>
        </div>

        <div className={`rounded-md border p-3 ${toneCls}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Maximale bieding</p>
          <p className="text-xl font-semibold font-mono-data mt-0.5">{fmtEur(o.maximumBid)}</p>
          <div className="mt-2 text-xs">
            <p className="text-muted-foreground">Verschil met vraagprijs</p>
            <DiffBlock diff={o.differenceWithAskingPrice} asking={asking} />
            <p className="mt-1 text-[11px] text-muted-foreground">{vp.label}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-muted-foreground">Vraagprijs</p><p className="font-mono-data">{asking > 0 ? fmtEur(asking) : '—'}</p></div>
          <div><p className="text-muted-foreground">Aankoopprijs</p><p className="font-mono-data">{purchase > 0 ? fmtEur(purchase) : '—'}</p></div>
          <div><p className="text-muted-foreground">Totale investering</p><p className="font-mono-data">{fmtEur(o.totalInvestment)}</p></div>
          <div><p className="text-muted-foreground">Bouw-/renovatiekosten</p><p className="font-mono-data">{fmtEur(o.totalCosts)}</p></div>
          <div><p className="text-muted-foreground">Gecorr. jaarhuur</p><p className="font-mono-data">{fmtEur(o.correctedAnnualRent)}</p></div>
          <div><p className="text-muted-foreground">NOI</p><p className="font-mono-data">{fmtEur(o.noi)}</p></div>
          <div><p className="text-muted-foreground">BAR op TI</p><p className="font-mono-data">{fmtPct(o.barTotalInvestment)}</p></div>
          <div><p className="text-muted-foreground">Factor op TI</p><p className="font-mono-data">{o.factorTotalInvestment != null ? `${o.factorTotalInvestment.toFixed(2)}×` : '—'}</p></div>
        </div>
        <p className="text-[11px] text-muted-foreground">Status: {VR_STATUS_LABELS[s.status]}</p>
      </CardContent>
    </Card>
  );
}

export default function ScenarioVergelijking({ scenarios, ...shared }: { scenarios: Scenario[] } & SharedProps) {
  const [map, setMap] = useState<Record<string, RowData>>({});

  const handleReady = useCallback((id: string, data: RowData | null) => {
    setMap((prev) => {
      if (!data) {
        if (!(id in prev)) return prev;
        const next = { ...prev }; delete next[id]; return next;
      }
      const existing = prev[id];
      if (existing && existing.scenario === data.scenario && existing.outputs === data.outputs) return prev;
      return { ...prev, [id]: data };
    });
  }, []);

  // Prune verwijderde scenario's
  useEffect(() => {
    const ids = new Set(scenarios.map((s) => s.id));
    setMap((prev) => {
      const next: Record<string, RowData> = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (ids.has(k)) next[k] = v; else changed = true;
      }
      return changed ? next : prev;
    });
  }, [scenarios]);

  const rows = useMemo(
    () => scenarios.map((s) => map[s.id]).filter(Boolean) as RowData[],
    [scenarios, map],
  );
  const best = useMemo(() => pickBest(rows), [rows]);

  if (scenarios.length === 0) return null;

  return (
    <>
      {/* Hidden computers — één per scenario */}
      {scenarios.map((s) => (
        <ScenarioComputer key={s.id} s={s} shared={shared} onReady={handleReady} />
      ))}

      {/* Beste scenario samenvatting */}
      {best && rows.length >= 2 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Indicatief voorkeurscenario</p>
              <span className="text-[10px] text-muted-foreground">— op basis van huidige inputs en aannames</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Hoogste maximale bieding</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byBid.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{fmtEur(best.byBid.outputs.maximumBid)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Hoogste rendement (BAR)</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byBar.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{fmtPct(best.byBar.outputs.barTotalInvestment)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Laagste investering</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byInvestment.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{fmtEur(best.byInvestment.outputs.totalInvestment)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Laagste risico</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byRisk.scenario.scenario_name}</p>
                <p className="text-xs text-muted-foreground capitalize">Risico: {best.byRisk.outputs.riskScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">Scenario's worden berekend…</CardContent></Card>
      )}

      {/* Mobiele cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:hidden mt-3">
          {rows.map((r) => <ScenarioCardMobile key={r.scenario.id} row={r} />)}
        </div>
      )}

      {/* Desktop vergelijkingstabel */}
      {rows.length > 0 && (
        <Card className="hidden lg:block mt-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scenariovergelijking</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Volledige bedragen — dezelfde rekenengine als het scenario-detail.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1400px] border-separate border-spacing-0">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 sticky left-0 bg-card z-10 border-b">Scenario</th>
                  <th className="px-3 py-2 border-b">Strategie</th>
                  <th className="px-3 py-2 border-b">Status</th>
                  <th className="px-3 py-2 text-right border-b">Vraagprijs</th>
                  <th className="px-3 py-2 text-right border-b">Aankoopprijs</th>
                  <th className="px-3 py-2 text-right border-b">Bouw-/renovatie</th>
                  <th className="px-3 py-2 text-right border-b">Totale investering</th>
                  <th className="px-3 py-2 text-right border-b">Jaarhuur huidig</th>
                  <th className="px-3 py-2 text-right border-b">Jaarhuur markt</th>
                  <th className="px-3 py-2 text-right border-b">Gecorr. jaarhuur</th>
                  <th className="px-3 py-2 text-right border-b">Exploitatie</th>
                  <th className="px-3 py-2 text-right border-b">NOI</th>
                  <th className="px-3 py-2 text-right border-b">BAR op vraagpr.</th>
                  <th className="px-3 py-2 text-right border-b">BAR op TI</th>
                  <th className="px-3 py-2 text-right border-b">Factor op vraagpr.</th>
                  <th className="px-3 py-2 text-right border-b">Factor op TI</th>
                  <th className="px-3 py-2 text-right border-b bg-primary/5">Maximale bieding</th>
                  <th className="px-3 py-2 text-right border-b">Δ vraagprijs</th>
                  <th className="px-3 py-2 text-right border-b">Δ aankoopprijs</th>
                  <th className="px-3 py-2 border-b">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = r.scenario;
                  const o = r.outputs;
                  const asking = Number(s.asking_price ?? 0);
                  const purchase = Number(s.purchase_price ?? 0);
                  const deal = DEAL_BADGE[o.dealScore];
                  const barAsking = asking > 0 ? Number(((o.correctedAnnualRent / asking) * 100).toFixed(2)) : null;
                  const factorAsking = asking > 0 && o.correctedAnnualRent > 0 ? asking / o.correctedAnnualRent : null;
                  const expl = o.operatingCostsEur + o.maintenanceCostsEur + o.managementCostsEur + o.otherCostsEur;
                  const diffPurchase = purchase > 0 ? o.maximumBid - purchase : 0;
                  const isBestBid = best?.byBid.scenario.id === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 border-b last:border-b-0">
                      <td className="px-3 py-2 sticky left-0 bg-card font-medium border-b">
                        <div className="flex items-center gap-1.5">
                          {isBestBid && <Trophy className="h-3 w-3 text-primary" />}
                          <span>{s.scenario_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground border-b">{VR_STRATEGY_LABELS[s.strategy_type] ?? s.strategy_type}</td>
                      <td className="px-3 py-2 text-xs border-b">{VR_STATUS_LABELS[s.status]}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{asking > 0 ? fmtEur(asking) : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{purchase > 0 ? fmtEur(purchase) : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.totalCosts)}</td>
                      <td className="px-3 py-2 font-mono-data text-right font-semibold border-b">{fmtEur(o.totalInvestment)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.currentAnnualRent)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.marketAnnualRent)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.correctedAnnualRent)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(expl)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.noi)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtPct(barAsking)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtPct(o.barTotalInvestment)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{factorAsking != null ? `${factorAsking.toFixed(2)}×` : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{o.factorTotalInvestment != null ? `${o.factorTotalInvestment.toFixed(2)}×` : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right font-semibold bg-primary/5 border-b">{fmtEur(o.maximumBid)}</td>
                      <td className="px-3 py-2 text-right border-b text-xs"><DiffBlock diff={o.differenceWithAskingPrice} asking={asking} /></td>
                      <td className="px-3 py-2 text-right border-b text-xs"><DiffBlock diff={diffPurchase} asking={purchase} /></td>
                      <td className="px-3 py-2 border-b"><span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{o.dealScore}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
