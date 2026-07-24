import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Scenario, TaxSettings, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, fmtEurPerM2, DEAL_BADGE } from './format';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';
import { buildScenarioReadiness } from '@/lib/vastgoedrekenen/readiness';
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

export type DevelopmentComparisonMetrics = {
  isDevelopment: boolean;
  complete: boolean;
  maxPurchasePrice: number | null;
  grossDevelopmentValue: number | null;
  netDevelopmentProceeds: number | null;
  nonAcquisitionCosts: number | null;
  totalInvestment: number | null;
  profit: number | null;
  profitOnGdvPct: number | null;
  profitOnCostPct: number | null;
  statusLabel: string;
  bindingLabel: string;
  bindingKey: string;
};

const positiveOrNull = (value: number | null | undefined): number | null => (
  value != null && Number.isFinite(value) && value > 0 ? value : null
);

export function getDevelopmentComparisonMetrics(outputs: ComputedOutputs): DevelopmentComparisonMetrics {
  const residual = outputs.residual;
  const isDevelopment = outputs.assessmentType === 'verkoop' || outputs.strategyEnabled || outputs.saleHasInput;

  if (residual) {
    const nonAcquisitionCosts = residual.componentDispositionCosts
      + residual.componentDevelopmentCosts
      + residual.sharedScenarioCosts
      + residual.financingCosts;
    const bindingLabel = residual.bindingTarget === 'winst_op_gdv'
      ? 'Winst op GDV'
      : residual.bindingTarget === 'winst_op_kosten'
        ? 'Winst op kosten'
        : residual.bindingTarget === 'vaste_winst'
          ? 'Vaste doelwinst'
          : 'Geen geldige doelwinst';
    return {
      isDevelopment: true,
      complete: residual.maxPurchasePrice > 0 && residual.criticalIssues.length === 0,
      maxPurchasePrice: positiveOrNull(residual.maxPurchasePrice),
      grossDevelopmentValue: positiveOrNull(residual.grossDevelopmentValue),
      netDevelopmentProceeds: positiveOrNull(residual.grossDevelopmentValue - residual.componentDispositionCosts),
      nonAcquisitionCosts: positiveOrNull(nonAcquisitionCosts),
      totalInvestment: positiveOrNull(residual.totalInvestmentAtMaxPurchase),
      profit: Number.isFinite(residual.profitAtMaxPurchase) ? residual.profitAtMaxPurchase : null,
      profitOnGdvPct: residual.profitOnGdvPct,
      profitOnCostPct: residual.profitOnCostPct,
      statusLabel: residual.status === 'voor_bieding' ? 'Residueel bepaald' : 'Indicatief / incompleet',
      bindingLabel,
      bindingKey: residual.bindingTarget ?? 'geen_doelwinst',
    };
  }

  const gdv = positiveOrNull(outputs.grossSaleProceeds);
  const profit = outputs.netMargin;
  return {
    isDevelopment,
    complete: isDevelopment && positiveOrNull(outputs.leadingMaxValue) != null && gdv != null && profit != null,
    maxPurchasePrice: positiveOrNull(outputs.leadingMaxValue),
    grossDevelopmentValue: gdv,
    netDevelopmentProceeds: positiveOrNull(outputs.netSaleProceeds ?? outputs.saleNetProceedsUnits),
    nonAcquisitionCosts: positiveOrNull(outputs.totalCosts),
    totalInvestment: positiveOrNull(outputs.totalInvestment),
    profit,
    profitOnGdvPct: gdv && profit != null ? Number(((profit / gdv) * 100).toFixed(2)) : null,
    profitOnCostPct: outputs.roi,
    statusLabel: outputs.scoreLabel,
    bindingLabel: outputs.leadingMaxBasisLabel,
    bindingKey: outputs.exitBidBindingTarget ?? outputs.leadingMaxBasis,
  };
}

function ScenarioComputer({
  s, shared, onReady,
}: { s: Scenario; shared: SharedProps; onReady: (id: string, data: RowData | null) => void }) {
  const { components, costs, wwsUnits, sellOffUnits, loading } = useScenarioChildren(s.id);
  const propertyType = useMemo(
    () => mapToAssumptionType(shared.objectRawType ?? null, shared.objectType),
    [shared.objectRawType, shared.objectType],
  );
  const outputs = useMemo(() => computeScenario({
    scenario: s,
    components,
    costs,
    wwsUnits,
    strategyUnits: sellOffUnits,
    taxSettings: shared.taxSettings,
    objectType: shared.objectType,
    objectArea: shared.objectArea,
    objectWoz: shared.objectWoz,
    objectEnergyLabel: shared.objectEnergyLabel,
    objectBouwjaar: shared.objectBouwjaar,
    propertyType,
  }), [
    s, components, costs, wwsUnits, sellOffUnits, propertyType,
    shared.taxSettings, shared.objectType, shared.objectArea, shared.objectWoz,
    shared.objectEnergyLabel, shared.objectBouwjaar,
  ]);

  useEffect(() => {
    if (loading) return;
    onReady(s.id, { scenario: s, outputs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, s, outputs]);

  return null;
}

const eur = (value: number | null): string => value == null ? '—' : fmtEur(value);
const pct = (value: number | null): string => value == null ? '—' : `${value.toFixed(1)}%`;

const formatTargetNumber = (value: number): string => new Intl.NumberFormat('nl-NL', {
  maximumFractionDigits: 2,
}).format(value);

export function getTargetProfitLabel(scenario: Scenario, outputs: ComputedOutputs): string {
  const binding = outputs.residual?.bindingTarget;
  if (binding === 'winst_op_gdv') {
    const value = Number(scenario.sale_target_margin_percentage ?? outputs.residual?.profitOnGdvPct ?? 0);
    return value > 0 ? `${formatTargetNumber(value)}% van GDV` : 'Winst op GDV — percentage ontbreekt';
  }
  if (binding === 'winst_op_kosten') {
    const value = Number(scenario.sale_target_roi_percentage ?? outputs.residual?.profitOnCostPct ?? 0);
    return value > 0 ? `${formatTargetNumber(value)}% op kosten` : 'Winst op kosten — percentage ontbreekt';
  }
  if (binding === 'vaste_winst') {
    const value = Number(scenario.sale_target_margin_amount ?? outputs.residual?.targetProfitAmount ?? 0);
    return value > 0 ? `Vaste winst ${fmtEur(value)}` : 'Vaste doelwinst — bedrag ontbreekt';
  }
  return outputs.residual ? 'Geen geldige doelwinst' : outputs.leadingMaxBasisLabel;
}

function comparisonBasisGroups(rows: RowData[]) {
  const groups = new Map<string, { key: string; label: string; count: number }>();
  for (const row of rows) {
    const metrics = getDevelopmentComparisonMetrics(row.outputs);
    if (!metrics.isDevelopment || metrics.bindingKey === 'geen_doelwinst') continue;
    const current = groups.get(metrics.bindingKey);
    groups.set(metrics.bindingKey, {
      key: metrics.bindingKey,
      label: metrics.bindingLabel,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'nl-NL'));
}

function bidVsAsking(maxPurchasePrice: number | null, asking: number): { label: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (maxPurchasePrice == null) return { label: 'Onvoldoende data', tone: 'neutral' };
  if (!asking || asking <= 0) return { label: 'Vraagprijs onbekend', tone: 'neutral' };
  const diff = maxPurchasePrice - asking;
  const percentage = (diff / asking) * 100;
  if (Math.abs(percentage) < 2) return { label: 'Rond vraagprijs', tone: 'neutral' };
  if (diff > 0) return { label: 'Boven vraagprijs', tone: 'positive' };
  if (percentage > -10) return { label: 'Onder vraagprijs', tone: 'negative' };
  return { label: 'Alleen interessant bij lagere aankoopprijs', tone: 'negative' };
}

function comparableRows(rows: RowData[]) {
  return rows
    .map((row) => ({ ...row, metrics: getDevelopmentComparisonMetrics(row.outputs) }))
    .filter((row) => row.metrics.complete && row.outputs.dealScore !== 'reject');
}

function pickBest(rows: RowData[]) {
  const pool = comparableRows(rows);
  const grouped = new Map<string, typeof pool>();
  for (const row of pool) {
    const group = grouped.get(row.metrics.bindingKey) ?? [];
    group.push(row);
    grouped.set(row.metrics.bindingKey, group);
  }
  const candidates = [...grouped.entries()]
    .filter(([, group]) => group.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'nl-NL'));
  if (candidates.length === 0) return null;
  if (candidates.length > 1 && candidates[0][1].length === candidates[1][1].length) return null;

  const [, comparablePool] = candidates[0];
  const riskRank: Record<string, number> = { laag: 0, middel: 1, hoog: 2 };
  const byBid = [...comparablePool].sort((a, b) => (b.metrics.maxPurchasePrice ?? -Infinity) - (a.metrics.maxPurchasePrice ?? -Infinity))[0];
  const byProfit = [...comparablePool].sort((a, b) => (b.metrics.profit ?? -Infinity) - (a.metrics.profit ?? -Infinity))[0];
  const byProfitOnCost = [...comparablePool].sort((a, b) => (b.metrics.profitOnCostPct ?? -Infinity) - (a.metrics.profitOnCostPct ?? -Infinity))[0];
  const byRisk = [...comparablePool].sort((a, b) => (riskRank[a.outputs.riskScore] ?? 99) - (riskRank[b.outputs.riskScore] ?? 99))[0];
  return {
    byBid,
    byProfit,
    byProfitOnCost,
    byRisk,
    count: comparablePool.length,
    basisLabel: comparablePool[0].metrics.bindingLabel,
    excludedCount: Math.max(0, pool.length - comparablePool.length),
  };
}

function DiffBlock({ maximum, asking }: { maximum: number | null; asking: number }) {
  if (maximum == null || !asking || asking <= 0) return <span className="text-muted-foreground">—</span>;
  const diff = maximum - asking;
  const percentage = (diff / asking) * 100;
  const positive = diff >= 0;
  const cls = positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300';
  const sign = positive ? '+' : '−';
  return (
    <span className={`font-mono-data ${cls}`}>
      {sign} {fmtEur(Math.abs(diff))} <span className="opacity-75">/ {sign}{Math.abs(percentage).toFixed(1)}%</span>
    </span>
  );
}

function ScenarioCard({ row, onSelect }: { row: RowData; onSelect?: (id: string) => void }) {
  const { scenario, outputs } = row;
  const metrics = getDevelopmentComparisonMetrics(outputs);
  const readiness = buildScenarioReadiness(outputs);
  const asking = Number(scenario.asking_price ?? 0);
  const position = bidVsAsking(metrics.maxPurchasePrice, asking);
  const deal = DEAL_BADGE[outputs.dealScore];
  const tone = position.tone === 'positive'
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : position.tone === 'negative'
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-muted';
  const clickable = Boolean(onSelect);

  return (
    <Card
      className={clickable ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
      onClick={clickable ? () => onSelect?.(scenario.id) : undefined}
      onKeyDown={clickable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect?.(scenario.id);
      } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug break-words">{scenario.scenario_name}</p>
            <p className="text-xs text-muted-foreground">{VR_STRATEGY_LABELS[scenario.strategy_type] ?? scenario.strategy_type}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Doelwinst: {getTargetProfitLabel(scenario, outputs)}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{readiness.shortLabel}</span>
        </div>

        <div className={`rounded-md border p-3 ${tone}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Maximale aankoopprijs</p>
          <p className="text-xl font-semibold font-mono-data mt-0.5">{eur(metrics.maxPurchasePrice)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.bindingLabel}</p>
          <div className="mt-2 text-xs">
            <p className="text-muted-foreground">Verschil met vraagprijs</p>
            <DiffBlock maximum={metrics.maxPurchasePrice} asking={asking} />
            <p className="mt-1 text-[11px] text-muted-foreground">{position.label}</p>
          </div>
        </div>

        {metrics.isDevelopment ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">GDV</p><p className="font-mono-data">{eur(metrics.grossDevelopmentValue)}</p></div>
            <div><p className="text-muted-foreground">Netto ontwikkelopbrengst</p><p className="font-mono-data">{eur(metrics.netDevelopmentProceeds)}</p></div>
            <div><p className="text-muted-foreground">Kosten excl. verwerving</p><p className="font-mono-data">{eur(metrics.nonAcquisitionCosts)}</p></div>
            <div><p className="text-muted-foreground">Investering bij maximum</p><p className="font-mono-data">{eur(metrics.totalInvestment)}</p></div>
            <div><p className="text-muted-foreground">Ontwikkelaarswinst</p><p className={`font-mono-data ${metrics.profit != null && metrics.profit < 0 ? 'text-destructive' : ''}`}>{eur(metrics.profit)}</p></div>
            <div><p className="text-muted-foreground">Winst op GDV</p><p className="font-mono-data">{pct(metrics.profitOnGdvPct)}</p></div>
            <div><p className="text-muted-foreground">Winst op kosten</p><p className="font-mono-data">{pct(metrics.profitOnCostPct)}</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">Totale investering</p><p className="font-mono-data">{fmtEur(outputs.totalInvestment)}</p></div>
            <div><p className="text-muted-foreground">BAR op investering</p><p className="font-mono-data">{fmtPct(outputs.barTotalInvestment)}</p></div>
            <div><p className="text-muted-foreground">NOI</p><p className="font-mono-data">{fmtEur(outputs.noi)}</p></div>
            {outputs.annualRentPerM2 != null && <div><p className="text-muted-foreground">Jaarhuur /m²</p><p className="font-mono-data">{fmtEurPerM2(outputs.annualRentPerM2)}</p></div>}
          </div>
        )}

        <div className={`rounded-md border p-2 text-[11px] ${
          readiness.status === 'voor_bieding'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <p className="font-medium">{readiness.title}</p>
          {readiness.items.slice(0, 2).map((item) => (
            <p key={`${item.category}-${item.message}`} className="mt-1 leading-snug text-muted-foreground">
              {item.label}: {item.message}
            </p>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Quickscanstatus: {VR_STATUS_LABELS[scenario.status]} · betrouwbaarheid {outputs.inputReliability}</p>
      </CardContent>
    </Card>
  );
}

export default function ScenarioVergelijking({ scenarios, onSelectScenario, ...shared }: { scenarios: Scenario[]; onSelectScenario?: (id: string) => void } & SharedProps) {
  const [showFullTable, setShowFullTable] = useState(false);
  const [map, setMap] = useState<Record<string, RowData>>({});

  const handleReady = useCallback((id: string, data: RowData | null) => {
    setMap((previous) => {
      if (!data) {
        if (!(id in previous)) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      }
      const existing = previous[id];
      if (existing && existing.scenario === data.scenario && existing.outputs === data.outputs) return previous;
      return { ...previous, [id]: data };
    });
  }, []);

  useEffect(() => {
    const ids = new Set(scenarios.map((scenario) => scenario.id));
    setMap((previous) => {
      const next: Record<string, RowData> = {};
      let changed = false;
      for (const [id, data] of Object.entries(previous)) {
        if (ids.has(id)) next[id] = data;
        else changed = true;
      }
      return changed ? next : previous;
    });
  }, [scenarios]);

  const rows = useMemo(
    () => scenarios.map((scenario) => map[scenario.id]).filter(Boolean) as RowData[],
    [map, scenarios],
  );
  const best = useMemo(() => pickBest(rows), [rows]);
  const basisGroups = useMemo(() => comparisonBasisGroups(rows), [rows]);

  if (scenarios.length === 0) return null;

  return (
    <>
      {scenarios.map((scenario) => (
        <ScenarioComputer key={scenario.id} s={scenario} shared={shared} onReady={handleReady} />
      ))}


      {basisGroups.length > 1 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-xs">
            <p className="font-semibold">Niet alle scenario's zijn één-op-één vergelijkbaar</p>
            <p className="mt-1 text-muted-foreground">
              {basisGroups.map((group) => `${group.label}: ${group.count}`).join(' · ')}. Alleen scenario's met dezelfde doelwinstgrondslag worden samen als winnaar gerangschikt.
            </p>
          </CardContent>
        </Card>
      )}

      {best && best.count >= 2 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Vergelijkbare scenario's — {best.basisLabel}</p>
              <span className="text-[10px] text-muted-foreground">Onvolledige scenario's en andere doelwinstgrondslagen worden niet als winnaar gerangschikt{best.excludedCount > 0 ? ` (${best.excludedCount} uitgesloten)` : ''}.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Hoogste maximale aankoopprijs</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byBid.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{eur(best.byBid.metrics.maxPurchasePrice)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" /> Hoogste ontwikkelaarswinst</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byProfit.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{eur(best.byProfit.metrics.profit)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Hoogste winst op kosten</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byProfitOnCost.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{pct(best.byProfitOnCost.metrics.profitOnCostPct)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Laagste risicoscore</p>
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

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
          {rows.map((row) => <ScenarioCard key={row.scenario.id} row={row} onSelect={onSelectScenario} />)}
        </div>
      )}

      {rows.length > 0 && (
        <Card className="hidden lg:block mt-3">
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Scenariovergelijking</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Ontwikkelscenario's worden vergeleken op residuele aankoopruimte, GDV en ontwikkelaarswinst.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFullTable((value) => !value)} className="shrink-0">
              {showFullTable
                ? <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Toon compact</>
                : <><ChevronRight className="h-3.5 w-3.5 mr-1" /> Toon volledige vergelijking</>}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className={`w-full text-sm border-separate border-spacing-0 ${showFullTable ? 'min-w-[1580px]' : 'min-w-[1250px]'}`}>
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 sticky left-0 bg-card z-10 border-b">Scenario</th>
                  <th className="px-3 py-2 border-b">Strategie</th>
                  <th className="px-3 py-2 border-b">Status</th>
                  <th className="px-3 py-2 border-b">Doelwinst</th>
                  <th className="px-3 py-2 text-right border-b bg-primary/5">Max. aankoopprijs</th>
                  <th className="px-3 py-2 text-right border-b">GDV / waarde</th>
                  <th className="px-3 py-2 text-right border-b">Netto opbrengst</th>
                  <th className="px-3 py-2 text-right border-b">Kosten excl. verwerving</th>
                  <th className="px-3 py-2 text-right border-b">Investering bij maximum</th>
                  <th className="px-3 py-2 text-right border-b">Winst / NOI</th>
                  <th className="px-3 py-2 text-right border-b">Winst op GDV</th>
                  <th className="px-3 py-2 text-right border-b">Winst op kosten / BAR</th>
                  {showFullTable && (
                    <>
                      <th className="px-3 py-2 text-right border-b">Δ vraagprijs</th>
                      <th className="px-3 py-2 border-b">Bindend criterium</th>
                      <th className="px-3 py-2 border-b">Risico</th>
                      <th className="px-3 py-2 border-b">Betrouwbaarheid</th>
                      <th className="px-3 py-2 border-b">Belangrijkste aandachtspunt</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { scenario, outputs } = row;
                  const metrics = getDevelopmentComparisonMetrics(outputs);
                  const readiness = buildScenarioReadiness(outputs);
                  const asking = Number(scenario.asking_price ?? 0);
                  const development = metrics.isDevelopment;
                  const clickable = Boolean(onSelectScenario);
                  return (
                    <tr
                      key={scenario.id}
                      className={`hover:bg-muted/30 ${clickable ? 'cursor-pointer' : ''}`}
                      onClick={clickable ? () => onSelectScenario?.(scenario.id) : undefined}
                    >
                      <td className="px-3 py-2 sticky left-0 bg-card font-medium border-b">{scenario.scenario_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground border-b">{VR_STRATEGY_LABELS[scenario.strategy_type] ?? scenario.strategy_type}</td>
                      <td className="px-3 py-2 text-xs border-b">{readiness.shortLabel}</td>
                      <td className="px-3 py-2 text-xs border-b">{getTargetProfitLabel(scenario, outputs)}</td>
                      <td className="px-3 py-2 font-mono-data text-right font-semibold bg-primary/5 border-b">{eur(metrics.maxPurchasePrice)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.grossDevelopmentValue) : eur(positiveOrNull(outputs.exitValue ?? outputs.maximumAllInValue))}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.netDevelopmentProceeds) : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.nonAcquisitionCosts) : eur(positiveOrNull(outputs.totalCosts))}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.totalInvestment) : eur(positiveOrNull(outputs.totalInvestment))}</td>
                      <td className={`px-3 py-2 font-mono-data text-right border-b ${development && metrics.profit != null && metrics.profit < 0 ? 'text-destructive' : ''}`}>{development ? eur(metrics.profit) : fmtEur(outputs.noi)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? pct(metrics.profitOnGdvPct) : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? pct(metrics.profitOnCostPct) : fmtPct(outputs.barTotalInvestment)}</td>
                      {showFullTable && (
                        <>
                          <td className="px-3 py-2 text-right border-b text-xs"><DiffBlock maximum={metrics.maxPurchasePrice} asking={asking} /></td>
                          <td className="px-3 py-2 text-xs border-b">{metrics.bindingLabel}</td>
                          <td className="px-3 py-2 text-xs border-b capitalize">{outputs.riskScore}</td>
                          <td className="px-3 py-2 text-xs border-b capitalize">{outputs.inputReliability}</td>
                          <td className="px-3 py-2 text-xs border-b max-w-[280px]">{readiness.items[0]?.message ?? '—'}</td>
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
