from pathlib import Path

comparison_path = Path('src/components/vastgoedrekenen/ScenarioVergelijking.tsx')
result_path = Path('src/components/vastgoedrekenen/ResultaatKaart.tsx')
compute_path = Path('src/lib/vastgoedrekenen/compute.ts')
validation_path = Path('src/lib/vastgoedrekenen/validation.ts')
ux_test_path = Path('src/test/ui/vastgoedrekenenAcceptanceLayout.test.ts')
readiness_test_path = Path('src/test/vastgoedrekenen/readiness.test.ts')

# --- Scenariovergelijking: duidelijke richting aankoopruimte + losse actiepunten ---
source = comparison_path.read_text()
old_difference = '''              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Verschil in aankoopruimte</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{eur(comparison.bidSpread)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{comparison.byBid.scenario.scenario_name} versus {comparison.lowestBid.scenario.scenario_name}</p>
              </div>'''
new_difference = '''              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Meer aankoopruimte</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{comparison.byBid.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-emerald-700 dark:text-emerald-300">
                  {eur(comparison.byBid.metrics.maxPurchasePrice)} <span className="font-sans text-[10px]">· hoogste</span>
                </p>
                <div className="mt-2 border-t pt-2 text-[10px] text-muted-foreground space-y-0.5">
                  <p>{comparison.lowestBid.scenario.scenario_name}: <span className="font-mono-data">{eur(comparison.lowestBid.metrics.maxPurchasePrice)}</span> · laagste</p>
                  <p className="font-medium text-foreground">Verschil: <span className="font-mono-data">{eur(comparison.bidSpread)}</span></p>
                </div>
              </div>'''
if old_difference not in source:
    raise SystemExit('comparison difference block not found')
source = source.replace(old_difference, new_difference, 1)

old_card_readiness = '''        <div className={`rounded-md border p-2 text-[11px] ${
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
        </div>'''
new_card_readiness = '''        <div className={`rounded-md border p-2 text-[11px] ${
          readiness.status === 'voor_bieding'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <p className="font-medium">{readiness.title}</p>
          {readiness.items.length > 0 && (
            <ol className="mt-2 space-y-2">
              {readiness.items.slice(0, 2).map((item, index) => (
                <li key={`${item.category}-${item.message}`} className="flex gap-2 rounded border bg-background/60 p-2 leading-snug">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-semibold" aria-label={`Aandachtspunt ${index + 1}`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{item.label}</span>
                    <span className="block mt-0.5 text-muted-foreground">{item.message}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>'''
if old_card_readiness not in source:
    raise SystemExit('scenario card readiness block not found')
comparison_path.write_text(source)

# --- Resultaatkaart: dezelfde genummerde werklijst ---
source = result_path.read_text()
old_result_list = '''            {readiness.items.length > 0 && (
              <ul className="mt-2 space-y-1">
                {readiness.items.map((item) => (
                  <li key={`${item.category}-${item.message}`} className="flex gap-2 leading-snug">
                    <span className="shrink-0 font-medium">{item.label}:</span>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            )}'''
new_result_list = '''            {readiness.items.length > 0 && (
              <ol className="mt-3 space-y-2">
                {readiness.items.map((item, index) => (
                  <li key={`${item.category}-${item.message}`} className="flex gap-2 rounded-md border bg-background/60 p-2.5 leading-snug">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-semibold" aria-label={`Aandachtspunt ${index + 1}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{item.label}</span>
                      <span className="block mt-0.5 text-muted-foreground">{item.message}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}'''
if old_result_list not in source:
    raise SystemExit('result readiness list not found')
result_path.write_text(source.replace(old_result_list, new_result_list, 1))

# --- Validatie: overlaphelper delen met de rekenkern ---
source = validation_path.read_text()
old_helper = 'function findDuplicateDevelopmentCostKinds(\n'
new_helper = 'export function findDuplicateDevelopmentCostKinds(\n'
if old_helper not in source:
    raise SystemExit('duplicate cost helper declaration not found')
validation_path.write_text(source.replace(old_helper, new_helper, 1))

# --- Compute: specifieke kostenposten benoemen, alleen concrete overlap melden ---
source = compute_path.read_text()
import_anchor = "import { computeResidualBid } from './residueel';\n"
if import_anchor not in source:
    raise SystemExit('compute import anchor not found')
source = source.replace(import_anchor, import_anchor + "import { findDuplicateDevelopmentCostKinds } from './validation';\n", 1)

old_reliability = '''  if (costs.some((cost) => effectiveCostAmount(cost) > 0 && cost.reliability_status !== 'hoog')) {
    residualCriticalIssues.push('Niet alle algemene projectkosten hebben betrouwbaarheid hoog.');
  }'''
new_reliability = '''  const insufficientlySupportedCosts = costs.filter(
    (cost) => effectiveCostAmount(cost) > 0 && cost.reliability_status !== 'hoog',
  );
  if (insufficientlySupportedCosts.length > 0) {
    const visibleNames = insufficientlySupportedCosts.slice(0, 3).map((cost) => {
      const description = String(cost.description ?? '').trim();
      const category = String(cost.cost_category ?? '').trim();
      return description || category || 'Naamloze kostenpost';
    });
    const remaining = insufficientlySupportedCosts.length - visibleNames.length;
    residualCriticalIssues.push(
      `Algemene projectkosten nog niet hoog onderbouwd: ${visibleNames.join(', ')}${remaining > 0 ? ` en ${remaining} overige post(en)` : ''}. Controleer bedrag, scope en bron; zet betrouwbaarheid pas daarna op Hoog.`,
    );
  }

  const duplicateDevelopmentCostKinds = findDuplicateDevelopmentCostKinds(costs, ctx.strategyUnits ?? []);
  if (duplicateDevelopmentCostKinds.length > 0) {
    residualWarnings.push(
      `Mogelijke dubbele kosteninvoer: ${duplicateDevelopmentCostKinds.join(', ')} staat zowel bij algemene kosten als bij componenten. Verwijder één invoerbron of leg vast waarom beide bedragen verschillend zijn.`,
    );
  }'''
if old_reliability not in source:
    raise SystemExit('generic reliability block not found')
source = source.replace(old_reliability, new_reliability, 1)

old_generic_overlap = '''  if (
    strategy.enabled
    && strategy.componentDevelopmentCosts > 0
    && totals.total > 0
  ) {
    residual?.warnings.push('Componentkosten en algemene scenario-kosten tellen beide mee; controleer handmatig of geen invoer overlapt.');
  }

'''
if old_generic_overlap not in source:
    raise SystemExit('generic overlap warning block not found')
source = source.replace(old_generic_overlap, '', 1)
compute_path.write_text(source)

# --- Gerichte regressietests ---
source = ux_test_path.read_text()
addition = '''

  it('toont richting in aankoopruimte en aandachtspunten als afzonderlijke stappen', () => {
    const comparison = source('src/components/vastgoedrekenen/ScenarioVergelijking.tsx');
    const result = source('src/components/vastgoedrekenen/ResultaatKaart.tsx');
    expect(comparison).toContain('Meer aankoopruimte');
    expect(comparison).toContain('· hoogste');
    expect(comparison).toContain('· laagste');
    expect(comparison).toContain('Verschil:');
    expect(comparison).toContain('Aandachtspunt ${index + 1}');
    expect(result).toContain('Aandachtspunt ${index + 1}');
  });
'''
pos = source.rfind('\n});')
if pos == -1:
    raise SystemExit('UX test closing marker not found')
ux_test_path.write_text(source[:pos] + addition + source[pos:])

source = readiness_test_path.read_text()
source = source.replace(
    "'Niet alle algemene projectkosten hebben betrouwbaarheid hoog.',",
    "'Algemene projectkosten nog niet hoog onderbouwd: Architectkosten. Controleer bedrag, scope en bron; zet betrouwbaarheid pas daarna op Hoog.',",
    1,
)
readiness_test_path.write_text(source)
