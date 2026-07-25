from pathlib import Path
import re

scores_path = Path('src/lib/vastgoedrekenen/scores.ts')
scores = scores_path.read_text()

scores = scores.replace(
    "import type { Component, Scenario, ScenarioAssessmentType, ScenarioCost, ScenarioScoreLabel, WwsUnit } from './types';",
    "import type { Component, Scenario, ScenarioAssessmentType, ScenarioCost, ScenarioScoreLabel, SellOffUnit, WwsUnit } from './types';",
    1,
)
if "import { assessInputReliability } from './reliabilityAssessment';" not in scores:
    scores = scores.replace(
        "import { SALE_FOCUSED_SALE_STRATEGIES, SALE_FOCUSED_STRATEGIES } from './verkoop';\n",
        "import { SALE_FOCUSED_SALE_STRATEGIES, SALE_FOCUSED_STRATEGIES } from './verkoop';\nimport { assessInputReliability } from './reliabilityAssessment';\n",
        1,
    )

score_fields_anchor = "  wwsUnits: WwsUnit[];\n"
score_fields = "  wwsUnits: WwsUnit[];\n  strategyUnits?: SellOffUnit[];\n  correctedAnnualRent?: number;\n  saleHasInput?: boolean;\n  ovbMissingBasisCount?: number;\n"
if "strategyUnits?: SellOffUnit[];" not in scores:
    if score_fields_anchor not in scores:
        raise SystemExit('ScoreInput field anchor not found')
    scores = scores.replace(score_fields_anchor, score_fields, 1)

reliability_pattern = re.compile(
    r"export function computeInputReliability\(i: ScoreInput\): 'laag' \| 'middel' \| 'hoog' \{.*?\n\}",
    re.S,
)
reliability_replacement = """export function computeInputReliability(i: ScoreInput): 'laag' | 'middel' | 'hoog' {
  return assessInputReliability({
    scenario: i.scenario,
    components: i.components,
    costs: i.costs,
    wwsUnits: i.wwsUnits,
    strategyUnits: i.strategyUnits ?? [],
    objectType: i.objectType,
    correctedAnnualRent: Number(i.correctedAnnualRent ?? 0),
    saleHasInput: Boolean(i.saleHasInput),
    ovbMissingBasisCount: Number(i.ovbMissingBasisCount ?? 0),
  }).level;
}"""
scores, count = reliability_pattern.subn(reliability_replacement, scores, count=1)
if count != 1:
    raise SystemExit(f'computeInputReliability replacement count: {count}')
scores_path.write_text(scores)

compute_path = Path('src/lib/vastgoedrekenen/compute.ts')
compute = compute_path.read_text()
score_input_anchor = """  const scoreInput = {
    scenario, components, costs, wwsUnits, objectType,
    barTotalInvestment: barTotal,
"""
score_input_replacement = """  const scoreInput = {
    scenario, components, costs, wwsUnits, objectType,
    strategyUnits: ctx.strategyUnits ?? [],
    correctedAnnualRent: correctedAnnual,
    saleHasInput: reportedSaleHasInput,
    ovbMissingBasisCount: ovb.missingBasisCount,
    barTotalInvestment: barTotal,
"""
if score_input_anchor not in compute:
    raise SystemExit('compute scoreInput anchor not found')
compute = compute.replace(score_input_anchor, score_input_replacement, 1)
compute_path.write_text(compute)

editor_path = Path('src/components/vastgoedrekenen/ScenarioEditor.tsx')
editor = editor_path.read_text()

if "import BetrouwbaarheidsOpbouw from './BetrouwbaarheidsOpbouw';" not in editor:
    editor = editor.replace(
        "import AuditSidePanel from './cockpit/AuditSidePanel';\n",
        "import AuditSidePanel from './cockpit/AuditSidePanel';\nimport BetrouwbaarheidsOpbouw from './BetrouwbaarheidsOpbouw';\n",
        1,
    )
if "import { assessInputReliability } from '@/lib/vastgoedrekenen/reliabilityAssessment';" not in editor:
    editor = editor.replace(
        "import { buildNogTeControleren, buildAannameWaarschuwingen, type ValidationAction } from '@/lib/vastgoedrekenen/validation';\n",
        "import { buildNogTeControleren, buildAannameWaarschuwingen, type ValidationAction } from '@/lib/vastgoedrekenen/validation';\nimport { assessInputReliability } from '@/lib/vastgoedrekenen/reliabilityAssessment';\n",
        1,
    )

validation_block = """  const nogTeControleren = useMemo(() => buildNogTeControleren({
    scenario: s, components, costs: draftCosts, wwsUnits, sellOffUnits, objectType, propertyType,
    hasWoz: !!props.objectWoz, hasEnergyLabel: !!props.objectEnergyLabel, hasBouwjaar: !!props.objectBouwjaar,
    energyLabel: props.objectEnergyLabel, dirty,
  }), [s, components, draftCosts, wwsUnits, sellOffUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, dirty]);

"""
assessment_block = validation_block + """  const reliabilityAssessment = useMemo(() => assessInputReliability({
    scenario: s,
    components,
    costs: draftCosts,
    wwsUnits,
    strategyUnits: sellOffUnits,
    objectType,
    correctedAnnualRent: outputs.correctedAnnualRent,
    saleHasInput: outputs.saleHasInput,
    ovbMissingBasisCount: outputs.ovbMissingBasisCount,
  }), [s, components, draftCosts, wwsUnits, sellOffUnits, objectType, outputs.correctedAnnualRent, outputs.saleHasInput, outputs.ovbMissingBasisCount]);

"""
if "const reliabilityAssessment = useMemo" not in editor:
    if validation_block not in editor:
        raise SystemExit('ScenarioEditor validation block not found')
    editor = editor.replace(validation_block, assessment_block, 1)

section_anchor = """            <Section id="sec-onderbouwing" title="Onderbouwing & betrouwbaarheid" status={onderbouwingStatus} {...sectionProps('sec-onderbouwing')} source="Scenario" relevance={blockerCount + warningCount > 0 ? 'aandacht' : 'informatief'}>
              <div className="pt-3 space-y-3">
                <p className="text-xs text-muted-foreground">De concrete herstelacties staan bovenaan het scenario. Gebruik daar “Ga naar…” om direct naar de juiste invoer te springen.</p>
"""
section_replacement = """            <Section id="sec-onderbouwing" title="Onderbouwing & betrouwbaarheid" status={onderbouwingStatus} {...sectionProps('sec-onderbouwing')} source="Scenario" relevance={blockerCount + warningCount > 0 ? 'aandacht' : 'informatief'}>
              <div className="pt-3 space-y-3">
                <BetrouwbaarheidsOpbouw assessment={reliabilityAssessment} onAction={navigateToValidationAction} />
                <p className="text-xs text-muted-foreground">De concrete herstelacties staan bovenaan het scenario. Gebruik daar “Ga naar…” om direct naar de juiste invoer te springen.</p>
"""
if "<BetrouwbaarheidsOpbouw assessment={reliabilityAssessment}" not in editor:
    if section_anchor not in editor:
        raise SystemExit('ScenarioEditor reliability section anchor not found')
    editor = editor.replace(section_anchor, section_replacement, 1)

editor_path.write_text(editor)
