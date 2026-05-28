import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Scenario, TaxSettings, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, fmtEurPerM2, DEAL_BADGE } from './format';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { SALE_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/verkoop';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';
import { Trophy, TrendingUp, ShieldCheck, Target, Coins, ChevronDown, ChevronRight } from 'lucide-react';

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
  const diff = o.leadingMaxValue - asking;
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

  const byBid = [...pool].sort((a, b) => (b.outputs.leadingMaxValue ?? 0) - (a.outputs.leadingMaxValue ?? 0))[0];
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

function ScenarioCardMobile({ row, onSelect }: { row: RowData; onSelect?: (id: string) => void }) {
  const { scenario: s, outputs: o } = row;
  const asking = Number(s.asking_price ?? 0);
  const vp = bidVsAsking(o, asking);
  const deal = DEAL_BADGE[o.dealScore];
  const exploitatie = o.assessmentType === 'exploitatie';
  const toneCls = vp.tone === 'positive'
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : vp.tone === 'negative'
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-muted';
  const clickable = !!onSelect;
  return (
    <Card
      className={clickable ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
      onClick={clickable ? () => onSelect!(s.id) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug break-words">{s.scenario_name}</p>
            <p className="text-xs text-muted-foreground">{VR_STRATEGY_LABELS[s.strategy_type] ?? s.strategy_type}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{o.scoreLabel}</span>
        </div>

        <div className={`rounded-md border p-3 ${toneCls}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leidende max prijs</p>
          <p className="text-xl font-semibold font-mono-data mt-0.5">{fmtEur(o.leadingMaxValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{o.leadingMaxBasisLabel}</p>
          <div className="mt-2 text-xs">
            <p className="text-muted-foreground">Verschil met vraagprijs</p>
            <DiffBlock diff={o.leadingDifferenceWithAskingPrice} asking={asking} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {o.leadingRoundsAtAsking == null ? vp.label : o.leadingRoundsAtAsking ? 'Rond te rekenen: Ja' : 'Rond te rekenen: Nee'}
            </p>
          </div>
        </div>


        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-muted-foreground">Totale investering</p><p className="font-mono-data">{fmtEur(o.totalInvestment)}</p></div>
          {exploitatie ? (
            <>
              <div><p className="text-muted-foreground">BAR op TI</p><p className="font-mono-data">{fmtPct(o.barTotalInvestment)}</p></div>
              <div><p className="text-muted-foreground">NOI</p><p className="font-mono-data">{fmtEur(o.noi)}</p></div>
              {o.annualRentPerM2 != null && <div><p className="text-muted-foreground">Jaarhuur /m²</p><p className="font-mono-data">{fmtEurPerM2(o.annualRentPerM2)}</p></div>}
            </>
          ) : (
            <>
              <div><p className="text-muted-foreground">ROI</p><p className={`font-mono-data ${o.roi != null && o.roi < 0 ? 'text-destructive' : ''}`}>{o.roi != null ? `${o.roi.toFixed(1)}%` : '—'}</p></div>
              <div><p className="text-muted-foreground">Nettomarge</p><p className={`font-mono-data ${o.netMargin != null && o.netMargin < 0 ? 'text-destructive' : ''}`}>{o.netMargin != null ? fmtEur(o.netMargin) : '—'}</p></div>
              {o.salePricePerM2 != null && <div><p className="text-muted-foreground">Verkoop /m²</p><p className="font-mono-data">{fmtEurPerM2(o.salePricePerM2)}</p></div>}
            </>
          )}
          {o.totalInvestmentPerM2 != null && <div><p className="text-muted-foreground">Investering /m²</p><p className="font-mono-data">{fmtEurPerM2(o.totalInvestmentPerM2)}</p></div>}
          {o.maximumBidPerM2 != null && <div><p className="text-muted-foreground">Max bod /m²</p><p className="font-mono-data">{fmtEurPerM2(o.maximumBidPerM2)}</p></div>}
        </div>
        {o.scoreAttentionPoints.length > 0 && (
          <p className="text-[11px] text-muted-foreground leading-snug">⚠ {o.scoreAttentionPoints[0]}</p>
        )}
        <p className="text-[11px] text-muted-foreground">Status: {VR_STATUS_LABELS[s.status]} {o.bidBasisUsed === 'verkoop' && '· bod o.b.v. verkoop'}</p>

      </CardContent>
    </Card>
  );
}

export default function ScenarioVergelijking({ scenarios, onSelectScenario, ...shared }: { scenarios: Scenario[]; onSelectScenario?: (id: string) => void } & SharedProps) {
  const [showFullTable, setShowFullTable] = useState(false);
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
              {best.byMargin && (
                <div className="rounded-md border bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" /> Hoogste nettomarge</p>
                  <p className="text-sm font-semibold mt-1 leading-snug">{best.byMargin.scenario.scenario_name}</p>
                  <p className="text-xs font-mono-data text-muted-foreground">{best.byMargin.outputs.netMargin != null ? fmtEur(best.byMargin.outputs.netMargin) : '—'}</p>
                </div>
              )}
              {best.byRoi && (
                <div className="rounded-md border bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Hoogste ROI</p>
                  <p className="text-sm font-semibold mt-1 leading-snug">{best.byRoi.scenario.scenario_name}</p>
                  <p className="text-xs font-mono-data text-muted-foreground">{best.byRoi.outputs.roi != null ? `${best.byRoi.outputs.roi.toFixed(1)}%` : '—'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">Scenario's worden berekend…</CardContent></Card>
      )}

      {/* Scenario cards — primaire vergelijking op alle viewports */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
          {rows.map((r) => <ScenarioCardMobile key={r.scenario.id} row={r} onSelect={onSelectScenario} />)}
        </div>
      )}

      {/* Desktop vergelijkingstabel — toggle voor compact / volledig */}
      {rows.length > 0 && (
        <Card className="hidden lg:block mt-3">
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Scenariovergelijking</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {showFullTable
                  ? 'Volledige vergelijking — alle kolommen.'
                  : 'Kernkolommen — klik op een rij om het scenario te openen.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFullTable((v) => !v)} className="shrink-0">
              {showFullTable
                ? <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Toon compact</>
                : <><ChevronRight className="h-3.5 w-3.5 mr-1" /> Toon volledige vergelijking</>}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className={`w-full text-sm border-separate border-spacing-0 ${showFullTable ? 'min-w-[1400px]' : ''}`}>
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 sticky left-0 bg-card z-10 border-b">Scenario</th>
                  <th className="px-3 py-2 border-b">Strategie</th>
                  <th className="px-3 py-2 border-b">Score</th>
                  <th className="px-3 py-2 text-right border-b bg-primary/5">Maximale bieding</th>
                  <th className="px-3 py-2 text-right border-b">Max bod /m²</th>
                  <th className="px-3 py-2 text-right border-b">Δ vraagprijs</th>
                  <th className="px-3 py-2 text-right border-b">Totale investering</th>
                  <th className="px-3 py-2 text-right border-b">Investering /m²</th>
                  <th className="px-3 py-2 text-right border-b">Kernrendement</th>
                  <th className="px-3 py-2 text-right border-b">NOI / Nettomarge</th>
                  {showFullTable && (
                    <>
                      <th className="px-3 py-2 border-b">Status</th>
                      <th className="px-3 py-2 text-right border-b">Vraagprijs</th>
                      <th className="px-3 py-2 text-right border-b">Vraagprijs /m²</th>
                      <th className="px-3 py-2 text-right border-b">Aankoopprijs</th>
                      <th className="px-3 py-2 text-right border-b">Aankoop /m²</th>
                      <th className="px-3 py-2 text-right border-b">Bouw-/renovatie</th>
                      <th className="px-3 py-2 text-right border-b">Bouwkosten /m²</th>
                      <th className="px-3 py-2 text-right border-b">Jaarhuur huidig</th>
                      <th className="px-3 py-2 text-right border-b">Jaarhuur markt</th>
                      <th className="px-3 py-2 text-right border-b">Gecorr. jaarhuur</th>
                      <th className="px-3 py-2 text-right border-b">Huur /m²</th>
                      <th className="px-3 py-2 text-right border-b">NOI /m²</th>
                      <th className="px-3 py-2 text-right border-b">Exploitatie</th>
                      <th className="px-3 py-2 text-right border-b">BAR op vraagpr.</th>
                      <th className="px-3 py-2 text-right border-b">Factor op vraagpr.</th>
                      <th className="px-3 py-2 text-right border-b">Factor op TI</th>
                      <th className="px-3 py-2 text-right border-b">Δ aankoopprijs</th>
                      <th className="px-3 py-2 border-b bg-emerald-500/5">Verkoopstrategie</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Bruto verkoopopbr.</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Verkoop /m²</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Verkoopkosten</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Netto verkoopopbr.</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Netto verkoop /m²</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Marge /m²</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">ROI</th>
                      <th className="px-3 py-2 text-right border-b bg-emerald-500/5">Exitwaarde</th>
                    </>
                  )}

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
                  const saleStrategyKey = ((s as unknown as Record<string, unknown>).sale_strategy as string | null) ?? null;
                  const saleStrategyLabel = saleStrategyKey ? (SALE_STRATEGY_LABELS[saleStrategyKey] ?? saleStrategyKey) : '—';
                  const exploitatie = o.assessmentType === 'exploitatie';
                  const clickable = !!onSelectScenario;
                  return (
                    <tr
                      key={s.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 ${clickable ? 'cursor-pointer' : ''}`}
                      onClick={clickable ? () => onSelectScenario!(s.id) : undefined}
                    >
                      <td className="px-3 py-2 sticky left-0 bg-card font-medium border-b">
                        <div className="flex items-center gap-1.5">
                          {isBestBid && <Trophy className="h-3 w-3 text-primary" />}
                          <span>{s.scenario_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground border-b">{VR_STRATEGY_LABELS[s.strategy_type] ?? s.strategy_type}</td>
                      <td className="px-3 py-2 border-b">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{o.scoreLabel}</span>
                      </td>
                      <td className="px-3 py-2 font-mono-data text-right font-semibold bg-primary/5 border-b">{fmtEur(o.maximumBid)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.maximumBidPerM2)}</td>
                      <td className="px-3 py-2 text-right border-b text-xs"><DiffBlock diff={o.differenceWithAskingPrice} asking={asking} /></td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.totalInvestment)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.totalInvestmentPerM2)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">
                        {exploitatie
                          ? fmtPct(o.barTotalInvestment)
                          : (o.roi != null ? `${o.roi.toFixed(1)}%` : '—')}
                      </td>
                      <td className={`px-3 py-2 font-mono-data text-right border-b ${!exploitatie && o.netMargin != null && o.netMargin < 0 ? 'text-destructive' : ''}`}>
                        {exploitatie
                          ? fmtEur(o.noi)
                          : (o.netMargin != null ? fmtEur(o.netMargin) : '—')}
                      </td>
                      {showFullTable && (
                        <>
                          <td className="px-3 py-2 text-xs border-b">{VR_STATUS_LABELS[s.status]}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{asking > 0 ? fmtEur(asking) : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.askingPricePerM2)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{purchase > 0 ? fmtEur(purchase) : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.purchasePricePerM2)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.totalCosts)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.totalCostsPerM2)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.currentAnnualRent)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.marketAnnualRent)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(o.correctedAnnualRent)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.annualRentPerM2)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b text-xs">{fmtEurPerM2(o.noiPerM2)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{fmtEur(expl)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{fmtPct(barAsking)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{factorAsking != null ? `${factorAsking.toFixed(2)}×` : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b">{o.factorTotalInvestment != null ? `${o.factorTotalInvestment.toFixed(2)}×` : '—'}</td>
                          <td className="px-3 py-2 text-right border-b text-xs"><DiffBlock diff={diffPurchase} asking={purchase} /></td>
                          <td className="px-3 py-2 text-xs border-b bg-emerald-500/5">{saleStrategyLabel}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5">{o.grossSaleProceeds != null ? fmtEur(o.grossSaleProceeds) : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5 text-xs">{fmtEurPerM2(o.salePricePerM2)}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5">{o.saleCostsTotal != null ? fmtEur(o.saleCostsTotal) : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5 font-semibold">{o.netSaleProceeds != null ? fmtEur(o.netSaleProceeds) : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5 text-xs">{fmtEurPerM2(o.netSaleProceedsPerM2)}</td>
                          <td className={`px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5 text-xs ${o.netMarginPerM2 != null && o.netMarginPerM2 < 0 ? 'text-destructive' : ''}`}>{fmtEurPerM2(o.netMarginPerM2)}</td>
                          <td className={`px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5 ${o.roi != null && o.roi < 0 ? 'text-destructive' : ''}`}>{o.roi != null ? `${o.roi.toFixed(1)}%` : '—'}</td>
                          <td className="px-3 py-2 font-mono-data text-right border-b bg-emerald-500/5">{o.exitValue != null ? fmtEur(o.exitValue) : '—'}</td>
                        </>
                      )}

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
