from pathlib import Path

scenario_path = Path('src/components/vastgoedrekenen/ScenarioVergelijking.tsx')
test_path = Path('src/test/scenariovergelijking.test.ts')

source = scenario_path.read_text()

old_logic = '''function comparableRows(rows: RowData[]) {
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
'''

new_logic = '''type ComparisonRow = RowData & {
  metrics: DevelopmentComparisonMetrics;
  readiness: ReturnType<typeof buildScenarioReadiness>;
};

function rankableRows(rows: RowData[]): ComparisonRow[] {
  return rows
    .map((row) => ({
      ...row,
      metrics: getDevelopmentComparisonMetrics(row.outputs),
      readiness: buildScenarioReadiness(row.outputs),
    }))
    .filter((row) => (
      row.metrics.isDevelopment
      && row.metrics.bindingKey !== 'geen_doelwinst'
      && row.metrics.maxPurchasePrice != null
      && row.metrics.grossDevelopmentValue != null
      && row.metrics.profit != null
      && row.outputs.dealScore !== 'reject'
    ));
}

export function getComparisonSummary(rows: RowData[]) {
  const pool = rankableRows(rows);
  const grouped = new Map<string, ComparisonRow[]>();
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
  const lowestBid = [...comparablePool].sort((a, b) => (a.metrics.maxPurchasePrice ?? Infinity) - (b.metrics.maxPurchasePrice ?? Infinity))[0];
  const byProfit = [...comparablePool].sort((a, b) => (b.metrics.profit ?? -Infinity) - (a.metrics.profit ?? -Infinity))[0];
  const byRisk = [...comparablePool].sort((a, b) => (riskRank[a.outputs.riskScore] ?? 99) - (riskRank[b.outputs.riskScore] ?? 99))[0];
  const definitive = comparablePool.every((row) => row.readiness.status === 'voor_bieding');

  return {
    byBid,
    lowestBid,
    byProfit,
    byRisk,
    count: comparablePool.length,
    basisLabel: comparablePool[0].metrics.bindingLabel,
    excludedCount: Math.max(0, pool.length - comparablePool.length),
    definitive,
    bidSpread: Math.max(0, (byBid.metrics.maxPurchasePrice ?? 0) - (lowestBid.metrics.maxPurchasePrice ?? 0)),
  };
}
'''

if old_logic not in source:
    raise SystemExit('comparison logic block not found')
source = source.replace(old_logic, new_logic, 1)

source = source.replace(
    '  const best = useMemo(() => pickBest(rows), [rows]);',
    '  const comparison = useMemo(() => getComparisonSummary(rows), [rows]);',
    1,
)

old_block = '''      {best && best.count >= 2 && (
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
'''

new_block = '''      {comparison && comparison.count >= 2 && (
        <Card className={comparison.definitive ? 'border-primary/40 bg-primary/5' : 'border-amber-500/40 bg-amber-500/5'}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Trophy className={comparison.definitive ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-amber-600'} />
              <p className="text-sm font-semibold">
                {comparison.definitive ? 'Definitieve vergelijking' : 'Voorlopige vergelijking'} — {comparison.basisLabel}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {comparison.definitive
                  ? 'Alle vergeleken scenario\'s zijn volgens de huidige invoer biedingsgereed.'
                  : 'Indicatieve uitkomsten: gebruik dit als richting en nog niet als definitief biedingsadvies.'}
                {comparison.excludedCount > 0 ? ` ${comparison.excludedCount} scenario met een andere grondslag is uitgesloten.` : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Hoogste maximale aankoopprijs</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{comparison.byBid.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{eur(comparison.byBid.metrics.maxPurchasePrice)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" /> Hoogste ontwikkelaarswinst</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{comparison.byProfit.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{eur(comparison.byProfit.metrics.profit)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Verschil in aankoopruimte</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{eur(comparison.bidSpread)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{comparison.byBid.scenario.scenario_name} versus {comparison.lowestBid.scenario.scenario_name}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Laagste risicoscore</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{comparison.byRisk.scenario.scenario_name}</p>
                <p className="text-xs text-muted-foreground capitalize">Risico: {comparison.byRisk.outputs.riskScore}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {comparison.byBid.scenario.scenario_name} laat {eur(comparison.bidSpread)} meer maximale aankoopruimte zien dan {comparison.lowestBid.scenario.scenario_name}. {comparison.byProfit.scenario.scenario_name} reserveert binnen deze vergelijking de hoogste ontwikkelaarswinst.
            </p>
          </CardContent>
        </Card>
      )}
'''

if old_block not in source:
    raise SystemExit('comparison card block not found')
source = source.replace(old_block, new_block, 1)
scenario_path.write_text(source)

# Add a focused regression test for equal-basis preliminary comparison.
test_source = test_path.read_text()
test_source = test_source.replace(
    "import { getDevelopmentComparisonMetrics } from '@/components/vastgoedrekenen/ScenarioVergelijking';",
    "import { getComparisonSummary, getDevelopmentComparisonMetrics } from '@/components/vastgoedrekenen/ScenarioVergelijking';",
    1,
)

addition = '''\n  it('maakt een voorlopige samenvatting voor twee GDV-scenario\'s en sluit winst op kosten uit', () => {
    const base = outputWithResidual();
    const cautious = outputWithResidual();
    cautious.residual = {
      ...cautious.residual!,
      maxPurchasePrice: 1_633_646,
      targetProfitAmount: 800_000,
      totalInvestmentAtMaxPurchase: 3_200_000,
      profitAtMaxPurchase: 800_000,
      profitOnGdvPct: 20,
      profitOnCostPct: 25,
      status: 'indicatief',
    };
    const costBased = outputWithResidual();
    costBased.residual = {
      ...costBased.residual!,
      bindingTarget: 'winst_op_kosten',
      maxPurchasePrice: 983_096,
      profitAtMaxPurchase: 363_637,
      profitOnGdvPct: 9.1,
      profitOnCostPct: 10,
    };

    const summary = getComparisonSummary([
      { scenario: { id: 'base', scenario_name: 'Basis 15%', sale_target_margin_percentage: 15 } as never, outputs: base },
      { scenario: { id: 'cautious', scenario_name: 'Voorzichtig 20%', sale_target_margin_percentage: 20 } as never, outputs: cautious },
      { scenario: { id: 'cost', scenario_name: 'Kosten 10%', sale_target_roi_percentage: 10 } as never, outputs: costBased },
    ]);

    expect(summary?.basisLabel).toBe('Winst op GDV');
    expect(summary?.count).toBe(2);
    expect(summary?.excludedCount).toBe(1);
    expect(summary?.byBid.scenario.scenario_name).toBe('Basis 15%');
    expect(summary?.byProfit.scenario.scenario_name).toBe('Voorzichtig 20%');
    expect(summary?.bidSpread).toBe(182_124);
  });
'''

marker = "\n});\n"
pos = test_source.rfind(marker)
if pos == -1:
    raise SystemExit('test suite closing marker not found')
test_source = test_source[:pos] + addition + test_source[pos:]
test_path.write_text(test_source)
