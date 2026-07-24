from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


component_path = Path('src/components/vastgoedrekenen/ScenarioVergelijking.tsx')
text = component_path.read_text()

text = replace_once(
    text,
    "  statusLabel: string;\n  bindingLabel: string;\n};",
    "  statusLabel: string;\n  bindingLabel: string;\n  bindingKey: string;\n};",
    'metrics binding key type',
)
text = replace_once(
    text,
    "      statusLabel: residual.status === 'voor_bieding' ? 'Residueel bepaald' : 'Indicatief / incompleet',\n      bindingLabel,\n",
    "      statusLabel: residual.status === 'voor_bieding' ? 'Residueel bepaald' : 'Indicatief / incompleet',\n      bindingLabel,\n      bindingKey: residual.bindingTarget ?? 'geen_doelwinst',\n",
    'residual binding key',
)
text = replace_once(
    text,
    "    statusLabel: outputs.scoreLabel,\n    bindingLabel: outputs.leadingMaxBasisLabel,\n",
    "    statusLabel: outputs.scoreLabel,\n    bindingLabel: outputs.leadingMaxBasisLabel,\n    bindingKey: outputs.exitBidBindingTarget ?? outputs.leadingMaxBasis,\n",
    'fallback binding key',
)

helper = """
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
"""
text = replace_once(
    text,
    "const eur = (value: number | null): string => value == null ? '—' : fmtEur(value);\nconst pct = (value: number | null): string => value == null ? '—' : `${value.toFixed(1)}%`;\n",
    "const eur = (value: number | null): string => value == null ? '—' : fmtEur(value);\nconst pct = (value: number | null): string => value == null ? '—' : `${value.toFixed(1)}%`;\n" + helper,
    'target profit helper insertion',
)

old_pick = """function pickBest(rows: RowData[]) {
  const pool = comparableRows(rows);
  if (pool.length === 0) return null;
  const riskRank: Record<string, number> = { laag: 0, middel: 1, hoog: 2 };
  const byBid = [...pool].sort((a, b) => (b.metrics.maxPurchasePrice ?? -Infinity) - (a.metrics.maxPurchasePrice ?? -Infinity))[0];
  const byProfit = [...pool].sort((a, b) => (b.metrics.profit ?? -Infinity) - (a.metrics.profit ?? -Infinity))[0];
  const byProfitOnCost = [...pool].sort((a, b) => (b.metrics.profitOnCostPct ?? -Infinity) - (a.metrics.profitOnCostPct ?? -Infinity))[0];
  const byRisk = [...pool].sort((a, b) => (riskRank[a.outputs.riskScore] ?? 99) - (riskRank[b.outputs.riskScore] ?? 99))[0];
  return { byBid, byProfit, byProfitOnCost, byRisk, count: pool.length };
}
"""
new_pick = """function pickBest(rows: RowData[]) {
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
"""
text = replace_once(text, old_pick, new_pick, 'basis-safe best selection')

text = replace_once(
    text,
    "            <p className=\"text-xs text-muted-foreground\">{VR_STRATEGY_LABELS[scenario.strategy_type] ?? scenario.strategy_type}</p>\n",
    "            <p className=\"text-xs text-muted-foreground\">{VR_STRATEGY_LABELS[scenario.strategy_type] ?? scenario.strategy_type}</p>\n            <p className=\"text-[11px] text-muted-foreground mt-0.5\">Doelwinst: {getTargetProfitLabel(scenario, outputs)}</p>\n",
    'scenario card target label',
)

text = replace_once(
    text,
    "  const best = useMemo(() => pickBest(rows), [rows]);\n",
    "  const best = useMemo(() => pickBest(rows), [rows]);\n  const basisGroups = useMemo(() => comparisonBasisGroups(rows), [rows]);\n",
    'basis groups memo',
)

warning_card = """
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

"""
text = replace_once(
    text,
    "      {best && best.count >= 2 && (\n",
    warning_card + "      {best && best.count >= 2 && (\n",
    'mixed basis warning card',
)
text = replace_once(
    text,
    "              <p className=\"text-sm font-semibold\">Vergelijkbare, complete scenario's</p>\n              <span className=\"text-[10px] text-muted-foreground\">Onvolledige scenario's worden niet als winnaar gerangschikt.</span>\n",
    "              <p className=\"text-sm font-semibold\">Vergelijkbare scenario's — {best.basisLabel}</p>\n              <span className=\"text-[10px] text-muted-foreground\">Onvolledige scenario's en andere doelwinstgrondslagen worden niet als winnaar gerangschikt{best.excludedCount > 0 ? ` (${best.excludedCount} uitgesloten)` : ''}.</span>\n",
    'winner basis label',
)

text = replace_once(text, "min-w-[1450px]' : 'min-w-[1120px]", "min-w-[1580px]' : 'min-w-[1250px]", 'table widths')
text = replace_once(
    text,
    "                  <th className=\"px-3 py-2 border-b\">Status</th>\n                  <th className=\"px-3 py-2 text-right border-b bg-primary/5\">Max. aankoopprijs</th>\n",
    "                  <th className=\"px-3 py-2 border-b\">Status</th>\n                  <th className=\"px-3 py-2 border-b\">Doelwinst</th>\n                  <th className=\"px-3 py-2 text-right border-b bg-primary/5\">Max. aankoopprijs</th>\n",
    'table target header',
)
text = replace_once(
    text,
    "                      <td className=\"px-3 py-2 text-xs border-b\">{readiness.shortLabel}</td>\n                      <td className=\"px-3 py-2 font-mono-data text-right font-semibold bg-primary/5 border-b\">{eur(metrics.maxPurchasePrice)}</td>\n",
    "                      <td className=\"px-3 py-2 text-xs border-b\">{readiness.shortLabel}</td>\n                      <td className=\"px-3 py-2 text-xs border-b\">{getTargetProfitLabel(scenario, outputs)}</td>\n                      <td className=\"px-3 py-2 font-mono-data text-right font-semibold bg-primary/5 border-b\">{eur(metrics.maxPurchasePrice)}</td>\n",
    'table target cell',
)
component_path.write_text(text)


test_path = Path('src/test/vastgoedrekenen/scenarioVergelijkingMetrics.test.ts')
test = test_path.read_text()
test = replace_once(
    test,
    "import type { ComputedOutputs } from '@/lib/vastgoedrekenen/types';\nimport { getDevelopmentComparisonMetrics } from '@/components/vastgoedrekenen/ScenarioVergelijking';\n",
    "import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';\nimport { getDevelopmentComparisonMetrics, getTargetProfitLabel } from '@/components/vastgoedrekenen/ScenarioVergelijking';\n",
    'test imports',
)
test = replace_once(
    test,
    "    expect(metrics.profitOnCostPct).toBe(17.65);\n",
    "    expect(metrics.profitOnCostPct).toBe(17.65);\n    expect(metrics.bindingKey).toBe('winst_op_gdv');\n",
    'binding key assertion',
)
new_tests = """

  it('maakt de leidende doelwinstgrondslag expliciet zichtbaar', () => {
    const outputs = outputWithResidual();
    const scenario = { sale_target_margin_percentage: 15 } as unknown as Scenario;
    expect(getTargetProfitLabel(scenario, outputs)).toBe('15% van GDV');

    outputs.residual = {
      ...outputs.residual!,
      bindingTarget: 'winst_op_kosten',
      profitOnCostPct: 10,
      targetProfitAmount: 340_000,
    };
    const costScenario = { sale_target_roi_percentage: 10 } as unknown as Scenario;
    expect(getTargetProfitLabel(costScenario, outputs)).toBe('10% op kosten');
  });
"""
test = replace_once(test, "\n});\n", new_tests + "\n});\n", 'target label tests')
test_path.write_text(test)
