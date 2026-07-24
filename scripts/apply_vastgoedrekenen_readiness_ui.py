from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


result_path = Path('src/components/vastgoedrekenen/ResultaatKaart.tsx')
result = result_path.read_text()
result = replace_once(
    result,
    "import { evaluateFeasibility, feasibilityLabel, type FeasibilityResult } from '@/lib/vastgoedrekenen/feasibility';\n",
    "import { evaluateFeasibility, feasibilityLabel, type FeasibilityResult } from '@/lib/vastgoedrekenen/feasibility';\nimport { buildScenarioReadiness } from '@/lib/vastgoedrekenen/readiness';\n",
    'ResultaatKaart readiness import',
)
result = replace_once(
    result,
    "  const residual = o.residual;\n",
    "  const residual = o.residual;\n  const readiness = buildScenarioReadiness(o);\n  const remainingAttentionPoints = o.scoreAttentionPoints.filter(\n    (point) => !readiness.items.some((item) => item.message === point),\n  );\n",
    'ResultaatKaart readiness state',
)
result = replace_once(
    result,
    '''            {residual.criticalIssues.length > 0 && (\n              <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">\n                <p className="font-medium">Nog nodig voor “Voor bieding”</p>\n                <ul className="mt-1 list-disc pl-4 space-y-0.5">\n                  {residual.criticalIssues.map((issue) => <li key={issue}>{issue}</li>)}\n                </ul>\n              </div>\n            )}\n''',
    '',
    'ResultaatKaart old critical issues panel',
)
readiness_panel = '''        {!compact && (residual || readiness.items.length > 0) && (\n          <div className={`rounded-md border p-3 text-xs ${\n            readiness.status === 'voor_bieding'\n              ? 'border-emerald-500/40 bg-emerald-500/5'\n              : 'border-amber-500/40 bg-amber-500/5'\n          }`}>\n            <p className="font-medium">{readiness.title}</p>\n            <p className="mt-1 text-muted-foreground leading-snug">{readiness.summary}</p>\n            {readiness.items.length > 0 && (\n              <ul className="mt-2 space-y-1">\n                {readiness.items.map((item) => (\n                  <li key={`${item.category}-${item.message}`} className="flex gap-2 leading-snug">\n                    <span className="shrink-0 font-medium">{item.label}:</span>\n                    <span>{item.message}</span>\n                  </li>\n                ))}\n              </ul>\n            )}\n          </div>\n        )}\n\n'''
result = replace_once(
    result,
    '        {/* €/m² subregel — alleen tonen wanneer er minstens één KPI beschikbaar is */}\n',
    readiness_panel + '        {/* €/m² subregel — alleen tonen wanneer er minstens één KPI beschikbaar is */}\n',
    'ResultaatKaart readiness panel insertion',
)
result = replace_once(
    result,
    '        {o.scoreAttentionPoints.length > 0 && (\n',
    '        {remainingAttentionPoints.length > 0 && (\n',
    'ResultaatKaart remaining attention condition',
)
result = replace_once(
    result,
    '              {o.scoreAttentionPoints.slice(0, 4).map((p, i) => (\n',
    '              {remainingAttentionPoints.slice(0, 4).map((p, i) => (\n',
    'ResultaatKaart remaining attention list',
)
result_path.write_text(result)

comparison_path = Path('src/components/vastgoedrekenen/ScenarioVergelijking.tsx')
comparison = comparison_path.read_text()
comparison = replace_once(
    comparison,
    "import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';\n",
    "import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';\nimport { buildScenarioReadiness } from '@/lib/vastgoedrekenen/readiness';\n",
    'ScenarioVergelijking readiness import',
)
comparison = replace_once(
    comparison,
    "  const metrics = getDevelopmentComparisonMetrics(outputs);\n  const asking = Number(scenario.asking_price ?? 0);\n",
    "  const metrics = getDevelopmentComparisonMetrics(outputs);\n  const readiness = buildScenarioReadiness(outputs);\n  const asking = Number(scenario.asking_price ?? 0);\n",
    'ScenarioCard readiness state',
)
comparison = replace_once(
    comparison,
    '          <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{metrics.statusLabel}</span>\n',
    '          <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{readiness.shortLabel}</span>\n',
    'ScenarioCard status badge',
)
comparison = replace_once(
    comparison,
    '''        {outputs.scoreAttentionPoints.length > 0 && (\n          <p className="text-[11px] text-muted-foreground leading-snug">⚠ {outputs.scoreAttentionPoints[0]}</p>\n        )}\n        <p className="text-[11px] text-muted-foreground">Quickscanstatus: {VR_STATUS_LABELS[scenario.status]} · betrouwbaarheid {outputs.inputReliability}</p>\n''',
    '''        <div className={`rounded-md border p-2 text-[11px] ${\n          readiness.status === 'voor_bieding'\n            ? 'border-emerald-500/30 bg-emerald-500/5'\n            : 'border-amber-500/30 bg-amber-500/5'\n        }`}>\n          <p className="font-medium">{readiness.title}</p>\n          {readiness.items.slice(0, 2).map((item) => (\n            <p key={`${item.category}-${item.message}`} className="mt-1 leading-snug text-muted-foreground">\n              {item.label}: {item.message}\n            </p>\n          ))}\n        </div>\n        <p className="text-[11px] text-muted-foreground">Quickscanstatus: {VR_STATUS_LABELS[scenario.status]} · betrouwbaarheid {outputs.inputReliability}</p>\n''',
    'ScenarioCard readiness panel',
)
comparison = replace_once(
    comparison,
    "                  const metrics = getDevelopmentComparisonMetrics(outputs);\n                  const asking = Number(scenario.asking_price ?? 0);\n",
    "                  const metrics = getDevelopmentComparisonMetrics(outputs);\n                  const readiness = buildScenarioReadiness(outputs);\n                  const asking = Number(scenario.asking_price ?? 0);\n",
    'Scenario table readiness state',
)
comparison = replace_once(
    comparison,
    '                      <td className="px-3 py-2 text-xs border-b">{metrics.statusLabel}</td>\n',
    '                      <td className="px-3 py-2 text-xs border-b">{readiness.shortLabel}</td>\n',
    'Scenario table status',
)
comparison = replace_once(
    comparison,
    "                          <td className=\"px-3 py-2 text-xs border-b max-w-[280px]\">{outputs.scoreAttentionPoints[0] ?? outputs.residual?.criticalIssues[0] ?? '—'}</td>\n",
    "                          <td className=\"px-3 py-2 text-xs border-b max-w-[280px]\">{readiness.items[0]?.message ?? '—'}</td>\n",
    'Scenario table attention point',
)
comparison_path.write_text(comparison)
