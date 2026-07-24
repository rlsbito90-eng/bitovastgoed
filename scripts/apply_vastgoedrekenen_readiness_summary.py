from pathlib import Path

VALIDATION = Path('src/lib/vastgoedrekenen/validation.ts')
COMPARISON = Path('src/components/vastgoedrekenen/ScenarioVergelijking.tsx')
TEST = Path('src/test/vastgoedrekenen/validationReadiness.test.ts')

validation = VALIDATION.read_text()
marker = "export type ValidationContext = {\n"
insert = """export type ValidationReadiness = 'voor_bieding' | 'indicatief' | 'incompleet';

export type ValidationSummary = {
  readiness: ValidationReadiness;
  title: string;
  blockers: string[];
  warnings: string[];
  info: string[];
  nextActions: string[];
};

export function summarizeValidation(
  items: ValidationItem[],
  inputReliability: 'laag' | 'middel' | 'hoog',
): ValidationSummary {
  const blockers = items.filter((item) => item.level === 'blocker').map((item) => item.message);
  const warnings = items.filter((item) => item.level === 'warning').map((item) => item.message);
  const info = items.filter((item) => item.level === 'info').map((item) => item.message);

  const reliabilityAction = inputReliability === 'laag'
    ? 'Onderbouw de belangrijkste opbrengst- en kostenposten met bron en peildatum; de invoerbetrouwbaarheid staat nog op laag.'
    : inputReliability === 'middel'
      ? 'Controleer de resterende aannames en verhoog de invoerbetrouwbaarheid waar bronstukken beschikbaar zijn.'
      : null;

  const nextActions = [...blockers, ...warnings];
  if (reliabilityAction && !nextActions.includes(reliabilityAction)) nextActions.push(reliabilityAction);

  if (blockers.length > 0) {
    return {
      readiness: 'incompleet',
      title: 'Niet geschikt voor bieding',
      blockers,
      warnings,
      info,
      nextActions: nextActions.slice(0, 3),
    };
  }
  if (warnings.length > 0 || inputReliability !== 'hoog') {
    return {
      readiness: 'indicatief',
      title: 'Indicatief — eerst onderbouwen',
      blockers,
      warnings,
      info,
      nextActions: nextActions.slice(0, 3),
    };
  }
  return {
    readiness: 'voor_bieding',
    title: 'Voor bieding controleerbaar',
    blockers,
    warnings,
    info,
    nextActions: [],
  };
}

"""
if insert not in validation:
    validation = validation.replace(marker, insert + marker)
VALIDATION.write_text(validation)

comparison = COMPARISON.read_text()
comparison = comparison.replace(
    "import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';",
    "import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';\nimport { buildNogTeControleren, summarizeValidation, type ValidationSummary } from '@/lib/vastgoedrekenen/validation';",
)
comparison = comparison.replace(
    "type RowData = { scenario: Scenario; outputs: ComputedOutputs };",
    "type RowData = { scenario: Scenario; outputs: ComputedOutputs; diagnostics: ValidationSummary };",
)
old_outputs = """  const outputs = useMemo(() => computeScenario({
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
"""
new_outputs = """  const outputs = useMemo(() => computeScenario({
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
  const diagnostics = useMemo(() => summarizeValidation(buildNogTeControleren({
    scenario: s,
    components,
    costs,
    wwsUnits,
    sellOffUnits,
    objectType: shared.objectType,
    propertyType,
    hasWoz: shared.objectWoz != null && shared.objectWoz > 0,
    hasEnergyLabel: Boolean(shared.objectEnergyLabel),
    hasBouwjaar: shared.objectBouwjaar != null && shared.objectBouwjaar > 0,
    energyLabel: shared.objectEnergyLabel,
  }), outputs.inputReliability), [
    s, components, costs, wwsUnits, sellOffUnits, propertyType, outputs.inputReliability,
    shared.objectType, shared.objectWoz, shared.objectEnergyLabel, shared.objectBouwjaar,
  ]);

  useEffect(() => {
    if (loading) return;
    onReady(s.id, { scenario: s, outputs, diagnostics });
"""
if old_outputs not in comparison:
    raise SystemExit('ScenarioComputer block not found')
comparison = comparison.replace(old_outputs, new_outputs)
comparison = comparison.replace(
    ".filter((row) => row.metrics.complete && row.outputs.dealScore !== 'reject');",
    ".filter((row) => row.metrics.complete && row.diagnostics.readiness === 'voor_bieding' && row.outputs.dealScore !== 'reject');",
)
comparison = comparison.replace(
    "  const { scenario, outputs } = row;",
    "  const { scenario, outputs, diagnostics } = row;",
)
old_attention = """        {outputs.scoreAttentionPoints.length > 0 && (
          <p className=\"text-[11px] text-muted-foreground leading-snug\">⚠ {outputs.scoreAttentionPoints[0]}</p>
        )}
        <p className=\"text-[11px] text-muted-foreground\">Quickscanstatus: {VR_STATUS_LABELS[scenario.status]} · betrouwbaarheid {outputs.inputReliability}</p>
"""
new_attention = """        <div className={`rounded-md border p-3 text-xs ${diagnostics.readiness === 'voor_bieding'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : diagnostics.readiness === 'incompleet'
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-amber-500/30 bg-amber-500/5'}`}>
          <p className=\"font-semibold\">{diagnostics.title}</p>
          {diagnostics.nextActions.length > 0 && (
            <ul className=\"mt-1.5 space-y-1 text-[11px] text-muted-foreground\">
              {diagnostics.nextActions.map((action) => <li key={action}>• {action}</li>)}
            </ul>
          )}
        </div>
        <p className=\"text-[11px] text-muted-foreground\">Quickscanstatus: {VR_STATUS_LABELS[scenario.status]} · betrouwbaarheid {outputs.inputReliability}</p>
"""
if old_attention not in comparison:
    raise SystemExit('ScenarioCard attention block not found')
comparison = comparison.replace(old_attention, new_attention)
COMPARISON.write_text(comparison)

TEST.write_text("""import { describe, expect, it } from 'vitest';
import { summarizeValidation } from '@/lib/vastgoedrekenen/validation';

describe('Vastgoedrekenen biedingsgereedheid', () => {
  it('blokkerende punten maken een scenario niet geschikt voor bieding', () => {
    const result = summarizeValidation([
      { level: 'blocker', message: 'OVB-grondslag ontbreekt.' },
      { level: 'warning', message: 'Bouwkosten controleren.' },
    ], 'hoog');
    expect(result.readiness).toBe('incompleet');
    expect(result.title).toBe('Niet geschikt voor bieding');
    expect(result.nextActions[0]).toContain('OVB');
  });

  it('lage betrouwbaarheid blijft indicatief, ook zonder andere waarschuwingen', () => {
    const result = summarizeValidation([], 'laag');
    expect(result.readiness).toBe('indicatief');
    expect(result.nextActions[0]).toContain('bron en peildatum');
  });

  it('alleen hoge betrouwbaarheid zonder blockers of warnings is voor bieding controleerbaar', () => {
    const result = summarizeValidation([
      { level: 'info', message: 'Bouwjaar controleren.' },
    ], 'hoog');
    expect(result.readiness).toBe('voor_bieding');
    expect(result.nextActions).toEqual([]);
  });
});
""")
