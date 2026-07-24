from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    source = p.read_text()
    if old not in source:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    p.write_text(source.replace(old, new, 1))


# 1. Validation items krijgen concrete navigatie-acties.
replace_once(
    'src/lib/vastgoedrekenen/validation.ts',
    "export type ValidationItem = {\n  level: 'warning' | 'info' | 'blocker';\n  message: string;\n};",
    "export type ValidationAction = {\n  label: string;\n  sectionId: string;\n  targetId?: string;\n};\n\nexport type ValidationItem = {\n  level: 'warning' | 'info' | 'blocker';\n  title?: string;\n  message: string;\n  actions?: ValidationAction[];\n};",
)

old_overlap_helpers = """function componentDevelopmentKinds(units: SellOffUnit[]): Set<'renovatie' | 'splitsing' | 'transformatie'> {
  const kinds = new Set<'renovatie' | 'splitsing' | 'transformatie'>();
  for (const unit of units) {
    const record = unitRecord(unit);
    if (positive(record.renovation_costs)) kinds.add('renovatie');
    if (positive(record.splitting_costs)) kinds.add('splitsing');
    if (positive(record.transformation_costs)) kinds.add('transformatie');
  }
  return kinds;
}

function centralCostText(cost: ScenarioCost): string {
  const record = cost as unknown as Record<string, unknown>;
  return `${cost.cost_category ?? ''} ${cost.description ?? ''} ${record.notes ?? ''}`.toLowerCase();
}

function costAmount(cost: ScenarioCost): number {
  const record = cost as unknown as Record<string, unknown>;
  const amount = Number(cost.amount ?? 0);
  const perM2 = Number(record.amount_per_m2 ?? 0);
  const basis = Number(record.m2_basis ?? 0);
  return amount > 0 ? amount : Math.max(0, perM2 * basis);
}

export function findDuplicateDevelopmentCostKinds(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): Array<'renovatie' | 'splitsing' | 'transformatie'> {
  const componentKinds = componentDevelopmentKinds(units);
  if (componentKinds.size === 0) return [];

  const centralTexts = costs
    .filter((cost) => costAmount(cost) > 0)
    .map(centralCostText);

  const overlaps: Array<'renovatie' | 'splitsing' | 'transformatie'> = [];
  if (
    componentKinds.has('renovatie')
    && centralTexts.some((text) => /renovat|verbouw/.test(text))
  ) overlaps.push('renovatie');
  if (
    componentKinds.has('splitsing')
    && centralTexts.some((text) => /splits/.test(text))
  ) overlaps.push('splitsing');
  if (
    componentKinds.has('transformatie')
    && centralTexts.some((text) => /transformat|sloop|nieuwbouw|bouwkosten/.test(text))
  ) overlaps.push('transformatie');
  return overlaps;
}
"""

new_overlap_helpers = """export type DevelopmentCostKind = 'renovatie' | 'splitsing' | 'transformatie';

export type DuplicateDevelopmentCostDetail = {
  kind: DevelopmentCostKind;
  centralCostIds: string[];
  centralLabels: string[];
  centralAmount: number;
  componentUnitIds: string[];
  componentLabels: string[];
  componentAmount: number;
};

function centralCostText(cost: ScenarioCost): string {
  const record = cost as unknown as Record<string, unknown>;
  return `${cost.cost_category ?? ''} ${cost.description ?? ''} ${record.notes ?? ''}`.toLowerCase();
}

function costAmount(cost: ScenarioCost): number {
  const record = cost as unknown as Record<string, unknown>;
  const amount = Number(cost.amount ?? 0);
  const perM2 = Number(record.amount_per_m2 ?? 0);
  const basis = Number(record.m2_basis ?? 0);
  return amount > 0 ? amount : Math.max(0, perM2 * basis);
}

function costLabel(cost: ScenarioCost): string {
  return String(cost.description ?? '').trim()
    || String(cost.cost_category ?? '').trim()
    || 'Naamloze kostenpost';
}

function unitLabel(unit: SellOffUnit): string {
  const record = unitRecord(unit);
  return String(record.unit_label ?? record.unit_name ?? '').trim() || 'Naamloze component';
}

function isContingencyCost(cost: ScenarioCost): boolean {
  return /onvoorzien|contingenc|risicoreserver/.test(centralCostText(cost));
}

const KIND_CONFIG: Record<DevelopmentCostKind, {
  field: 'renovation_costs' | 'splitting_costs' | 'transformation_costs';
  centralPattern: RegExp;
}> = {
  renovatie: { field: 'renovation_costs', centralPattern: /renovat|verbouw/ },
  splitsing: { field: 'splitting_costs', centralPattern: /splits/ },
  transformatie: { field: 'transformation_costs', centralPattern: /transformat|sloop|nieuwbouw|bouwkosten/ },
};

export function findDuplicateDevelopmentCostDetails(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): DuplicateDevelopmentCostDetail[] {
  const details: DuplicateDevelopmentCostDetail[] = [];

  for (const kind of Object.keys(KIND_CONFIG) as DevelopmentCostKind[]) {
    const cfg = KIND_CONFIG[kind];
    const centralMatches = costs.filter((cost) => (
      costAmount(cost) > 0
      && !isContingencyCost(cost)
      && cfg.centralPattern.test(centralCostText(cost))
    ));
    const componentMatches = units.filter((unit) => positive(unitRecord(unit)[cfg.field]));
    if (centralMatches.length === 0 || componentMatches.length === 0) continue;

    details.push({
      kind,
      centralCostIds: centralMatches.map((cost) => cost.id),
      centralLabels: centralMatches.map(costLabel),
      centralAmount: centralMatches.reduce((sum, cost) => sum + costAmount(cost), 0),
      componentUnitIds: componentMatches.map((unit) => unit.id),
      componentLabels: componentMatches.map(unitLabel),
      componentAmount: componentMatches.reduce((sum, unit) => sum + Number(unitRecord(unit)[cfg.field] ?? 0), 0),
    });
  }

  return details;
}

export function findDuplicateDevelopmentCostKinds(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): DevelopmentCostKind[] {
  return findDuplicateDevelopmentCostDetails(costs, units).map((detail) => detail.kind);
}
"""
replace_once('src/lib/vastgoedrekenen/validation.ts', old_overlap_helpers, new_overlap_helpers)

old_duplicate_block = """  const duplicateKinds = findDuplicateDevelopmentCostKinds(c.costs, sellOffUnits);
  if (duplicateKinds.length > 0) {
    out.push({
      level: 'warning',
      message: `Mogelijke dubbele kosteninvoer: ${duplicateKinds.join(', ')} staat zowel bij algemene kosten als bij componenten. Verwijder één invoerbron of leg vast waarom beide bedragen verschillend zijn.`,
    });
  }
"""

new_duplicate_block = """  const formatEur = (value: number) => new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value);

  const costsNeedingSupport = c.costs.filter((cost) => {
    if (costAmount(cost) <= 0) return false;
    const notes = String((cost as unknown as Record<string, unknown>).notes ?? '').trim();
    return cost.reliability_status !== 'hoog' || !notes;
  });
  for (const cost of costsNeedingSupport) {
    const notes = String((cost as unknown as Record<string, unknown>).notes ?? '').trim();
    const status = cost.reliability_status == null
      ? 'niet beoordeeld'
      : cost.reliability_status;
    out.push({
      level: 'warning',
      title: notes || cost.reliability_status !== 'hoog'
        ? 'Kostenpost onderbouwen'
        : 'Bron van kostenpost invullen',
      message: cost.reliability_status === 'hoog' && !notes
        ? `“${costLabel(cost)}” (${formatEur(costAmount(cost))}) staat op Hoog, maar Bron / onderbouwing is leeg. Vul bijvoorbeeld de begroting, offerte of referentie met datum in.`
        : `“${costLabel(cost)}” (${formatEur(costAmount(cost))}) staat op ${status}. Controleer bedrag en scope, vul Bron / onderbouwing in en kies daarna de passende betrouwbaarheid.`,
      actions: [{
        label: 'Ga naar deze kostenpost',
        sectionId: 'sec-kosten',
        targetId: `cost-${cost.id}`,
      }],
    });
  }

  const duplicateDetails = findDuplicateDevelopmentCostDetails(c.costs, sellOffUnits);
  for (const detail of duplicateDetails) {
    const centralNames = detail.centralLabels.join(', ');
    const componentDescription = `${detail.componentUnitIds.length} component(en)`;
    out.push({
      level: 'warning',
      title: `Controleer mogelijke dubbele ${detail.kind}kosten`,
      message: `Algemene kostenpost “${centralNames}” (${formatEur(detail.centralAmount)}) lijkt dezelfde kostensoort te bevatten als ${componentDescription} in de componentstrategie (${formatEur(detail.componentAmount)}). Onvoorzien (%) wordt hierbij niet als dubbele kostenpost behandeld.`,
      actions: [
        {
          label: 'Naar algemene kostenpost',
          sectionId: 'sec-kosten',
          targetId: `cost-${detail.centralCostIds[0]}`,
        },
        {
          label: 'Naar componentkosten',
          sectionId: 'sec-strategie',
          targetId: `strategy-unit-${detail.componentUnitIds[0]}`,
        },
      ],
    });
  }
"""
replace_once('src/lib/vastgoedrekenen/validation.ts', old_duplicate_block, new_duplicate_block)

# 2. Rekenkern: Hoog vereist ook bron/onderbouwing; overlapmelding wordt concreet.
replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    "import { findDuplicateDevelopmentCostKinds } from './validation';",
    "import { findDuplicateDevelopmentCostDetails } from './validation';",
)
replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    """  const insufficientlySupportedCosts = costs.filter(
    (cost) => effectiveCostAmount(cost) > 0 && cost.reliability_status !== 'hoog',
  );
""",
    """  const insufficientlySupportedCosts = costs.filter((cost) => {
    if (effectiveCostAmount(cost) <= 0) return false;
    const notes = String((cost as unknown as Record<string, unknown>).notes ?? '').trim();
    return cost.reliability_status !== 'hoog' || !notes;
  });
""",
)
replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    """      `Algemene projectkosten nog niet hoog onderbouwd: ${visibleNames.join(', ')}${remaining > 0 ? ` en ${remaining} overige post(en)` : ''}. Controleer bedrag, scope en bron; zet betrouwbaarheid pas daarna op Hoog.`,
""",
    """      `Algemene projectkosten nog niet volledig onderbouwd: ${visibleNames.join(', ')}${remaining > 0 ? ` en ${remaining} overige post(en)` : ''}. Controleer bedrag en scope, leg bron met datum vast en kies daarna de passende betrouwbaarheid.`,
""",
)
replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    """  const duplicateDevelopmentCostKinds = findDuplicateDevelopmentCostKinds(costs, ctx.strategyUnits ?? []);
  if (duplicateDevelopmentCostKinds.length > 0) {
    residualWarnings.push(
      `Mogelijke dubbele kosteninvoer: ${duplicateDevelopmentCostKinds.join(', ')} staat zowel bij algemene kosten als bij componenten. Verwijder één invoerbron of leg vast waarom beide bedragen verschillend zijn.`,
    );
  }
""",
    """  const duplicateDevelopmentCostDetails = findDuplicateDevelopmentCostDetails(costs, ctx.strategyUnits ?? []);
  for (const detail of duplicateDevelopmentCostDetails) {
    residualWarnings.push(
      `Mogelijke dubbele ${detail.kind}kosten: algemene kostenpost “${detail.centralLabels.join(', ')}” (${eur(detail.centralAmount)}) en ${detail.componentUnitIds.length} component(en) (${eur(detail.componentAmount)}). Onvoorzien (%) telt niet als dubbele kostenpost.`,
    );
  }
""",
)

# 3. Actielijst met knoppen.
Path('src/components/vastgoedrekenen/NogTeControleren.tsx').write_text("""import { AlertTriangle, Info, Ban, ArrowRight } from 'lucide-react';
import type { ValidationAction, ValidationItem } from '@/lib/vastgoedrekenen/validation';

export default function NogTeControleren({
  items,
  title = 'Nog te controleren',
  onAction,
}: {
  items: ValidationItem[];
  title?: string;
  onAction?: (action: ValidationAction) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className=\"rounded-md border border-amber-500/30 bg-amber-500/5 p-3\">
      <p className=\"text-sm font-medium text-amber-900 dark:text-amber-200 mb-2\">{title}</p>
      <ol className=\"space-y-2\">
        {items.map((item, idx) => {
          const Icon = item.level === 'blocker' ? Ban : item.level === 'warning' ? AlertTriangle : Info;
          const color = item.level === 'blocker' ? 'text-destructive' : item.level === 'warning' ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground';
          return (
            <li key={`${item.title ?? item.message}-${idx}`} className=\"rounded-md border bg-background/70 p-2.5\">
              <div className={`flex gap-2 text-xs ${color}`}>
                <span className=\"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-semibold text-[10px]\">{idx + 1}</span>
                <Icon className=\"h-3.5 w-3.5 mt-0.5 flex-shrink-0\" />
                <span className=\"min-w-0\">
                  {item.title && <span className=\"block font-semibold text-foreground\">{item.title}</span>}
                  <span className=\"block mt-0.5 leading-relaxed\">{item.message}</span>
                </span>
              </div>
              {item.actions && item.actions.length > 0 && (
                <div className=\"mt-2 ml-12 flex flex-wrap gap-2\">
                  {item.actions.map((action) => (
                    <button
                      key={`${action.sectionId}-${action.targetId ?? ''}-${action.label}`}
                      type=\"button\"
                      onClick={() => onAction?.(action)}
                      className=\"inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted\"
                    >
                      {action.label}<ArrowRight className=\"h-3 w-3\" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
""")

# 4. Scenario-editor: zichtbaar betrouwbaarheidsveld, bronveld en kliknavigatie.
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    "import { buildNogTeControleren, buildAannameWaarschuwingen } from '@/lib/vastgoedrekenen/validation';",
    "import { buildNogTeControleren, buildAannameWaarschuwingen, type ValidationAction } from '@/lib/vastgoedrekenen/validation';",
)
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    """  const markDirtyFromRaw = () => {
    setDirty((prev) => (prev ? prev : true));
  };
""",
    """  const markDirtyFromRaw = () => {
    setDirty((prev) => (prev ? prev : true));
  };

  const navigateToValidationAction = (action: ValidationAction) => {
    const sectionKey = action.sectionId as SubSectionKey;
    if (ALL_SUB_SECTION_KEYS.includes(sectionKey)) {
      setOpenSections((prev) => ({ ...prev, [sectionKey]: true }));
    }
    window.setTimeout(() => {
      const target = document.getElementById(action.targetId ?? action.sectionId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2', 'ring-offset-background');
      const focusable = target.querySelector<HTMLElement>('input, [role=combobox], textarea, button');
      window.setTimeout(() => focusable?.focus({ preventScroll: true }), 250);
      window.setTimeout(() => {
        target.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2', 'ring-offset-background');
      }, 2200);
    }, 120);
  };
""",
)
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    """      {/* Rekenbasis */}
      <RekenbasisBar scenario={s} outputs={outputs} />

      {/* Strategie-specifieke banner */}
""",
    """      {/* Rekenbasis */}
      <RekenbasisBar scenario={s} outputs={outputs} />

      {nogTeControleren.length > 0 && (
        <NogTeControleren
          items={nogTeControleren}
          title=\"Acties om dit scenario te verbeteren\"
          onAction={navigateToValidationAction}
        />
      )}

      {/* Strategie-specifieke banner */}
""",
)
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    '<div key={c.id} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden">',
    '<div key={c.id} id={`cost-${c.id}`} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden scroll-mt-32 transition-shadow">',
)

reliability_insert_point = """                    {/* Btw-opbouw per kostenpost — altijd zichtbaar */}
                    <div className=\"rounded-md border bg-muted/20 p-3 text-xs space-y-1\">"""
reliability_block = """                    <div className=\"grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0 border-t pt-3\">
                      <MobileFieldGroup
                        label=\"Betrouwbaarheid kostenpost\"
                        helper=\"Hoog = projectspecifieke begroting, offerte of contract gecontroleerd. Leg de bron en datum in het veld hiernaast vast.\"
                      >
                        <Select
                          value={c.reliability_status ?? '__niet_beoordeeld__'}
                          onValueChange={(v) => updateCost(c.id, {
                            reliability_status: v === '__niet_beoordeeld__' ? null : v,
                          } as Partial<ScenarioCost>, true)}
                        >
                          <SelectTrigger className=\"h-9 w-full\"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value=\"__niet_beoordeeld__\">Niet beoordeeld</SelectItem>
                            <SelectItem value=\"laag\">Laag — globale werkhypothese</SelectItem>
                            <SelectItem value=\"middel\">Middel — onderbouwde referentie</SelectItem>
                            <SelectItem value=\"hoog\">Hoog — projectspecifiek gecontroleerd</SelectItem>
                          </SelectContent>
                        </Select>
                      </MobileFieldGroup>
                      <MobileFieldGroup
                        label=\"Bron / onderbouwing\"
                        helper=\"Bijvoorbeeld: aannemersbegroting d.d. 15-07-2026, offerte X of eigen raming met uitgangspunten.\"
                        className=\"md:col-span-2\"
                      >
                        <RawTextInput
                          className=\"h-9\"
                          initialValue={c.notes ?? ''}
                          placeholder=\"Bron, datum en korte scope van deze kostenpost\"
                          onRawChange={(raw) => updateCost(c.id, { notes: raw.trim() || null }, true)}
                          onCommit={(raw) => updateCost(c.id, { notes: raw.trim() || null })}
                        />
                      </MobileFieldGroup>
                    </div>

                    {/* Btw-opbouw per kostenpost — altijd zichtbaar */}
                    <div className=\"rounded-md border bg-muted/20 p-3 text-xs space-y-1\">"""
replace_once('src/components/vastgoedrekenen/ScenarioEditor.tsx', reliability_insert_point, reliability_block)
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    "                {nogTeControleren.length > 0 && <NogTeControleren items={nogTeControleren} />}\n",
    "                <p className=\"text-xs text-muted-foreground\">De concrete herstelacties staan bovenaan het scenario. Gebruik daar “Ga naar…” om direct naar de juiste invoer te springen.</p>\n",
)

# 5. Regressietests voor onvoorzien, concrete acties en betrouwbaarheid.
Path('src/test/vastgoedrekenen/actionableValidation.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  buildNogTeControleren,
  findDuplicateDevelopmentCostDetails,
  type ValidationContext,
} from '@/lib/vastgoedrekenen/validation';
import { comp, cost, scen, unit } from './golden/fixtures';

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    scenario: scen({
      strategy_type: 'herontwikkeling',
      ovb_mode: 'manual',
      transfer_tax_amount: 0,
      sale_strategy: 'geen_verkoop',
      rent_source: 'handmatig',
      cost_structure: 'bekend',
      contract_checked: true,
      service_costs_checked: true,
      mjop_present: 'ja',
    }),
    components: [comp({ component_type: 'appartement' })],
    costs: [],
    wwsUnits: [],
    sellOffUnits: [],
    objectType: 'enkelvoudig',
    propertyType: 'mixed_use',
    hasWoz: true,
    hasEnergyLabel: true,
    hasBouwjaar: true,
    ...overrides,
  };
}

describe('actiegerichte validatie Vastgoedrekenen', () => {
  it('behandelt onvoorzien over directe componentkosten niet als dubbele transformatiekosten', () => {
    const details = findDuplicateDevelopmentCostDetails([
      cost({
        id: 'cost-onvoorzien',
        cost_category: 'Bouwkosten',
        description: 'Onvoorzien over directe componentkosten (10%)',
        amount: 120_000,
        reliability_status: 'hoog',
        notes: 'Projectspecifieke risicoreservering d.d. 24-07-2026',
      }),
    ], [
      unit({ id: 'unit-1', strategy: 'transformeren_verkopen', transformation_costs: 300_000 }),
    ]);

    expect(details).toEqual([]);
  });

  it('wijst een niet-onderbouwde kostenpost rechtstreeks aan', () => {
    const result = buildNogTeControleren(context({
      costs: [cost({
        id: 'cost-advies',
        cost_category: 'Advieskosten',
        description: 'Architect en constructeur',
        amount: 75_000,
        reliability_status: null,
        notes: null,
      })],
    }));

    const item = result.find((entry) => entry.title === 'Kostenpost onderbouwen');
    expect(item?.message).toContain('Architect en constructeur');
    expect(item?.actions?.[0]).toEqual({
      label: 'Ga naar deze kostenpost',
      sectionId: 'sec-kosten',
      targetId: 'cost-cost-advies',
    });
  });

  it('benoemt beide invoerbronnen en geeft twee navigatieacties bij echte overlap', () => {
    const result = buildNogTeControleren(context({
      costs: [cost({
        id: 'cost-transformatie',
        cost_category: 'Bouwkosten transformatie',
        description: 'Centrale transformatieraming',
        amount: 300_000,
        reliability_status: 'hoog',
        notes: 'Aannemersraming d.d. 24-07-2026',
      })],
      sellOffUnits: [unit({
        id: 'unit-2',
        unit_label: 'Piet Heinstraat 89',
        strategy: 'transformeren_verkopen',
        transformation_costs: 300_000,
      })],
    }));

    const item = result.find((entry) => entry.title?.includes('dubbele transformatiekosten'));
    expect(item?.message).toContain('Centrale transformatieraming');
    expect(item?.message).toContain('1 component(en)');
    expect(item?.actions).toHaveLength(2);
    expect(item?.actions?.[1].targetId).toBe('strategy-unit-unit-2');
  });
});
""")

Path('src/test/ui/actionableValidationUx.test.ts').write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('actiegerichte validatie-UX', () => {
  it('toont betrouwbaarheid en bron per algemene kostenpost', () => {
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(editor).toContain('Betrouwbaarheid kostenpost');
    expect(editor).toContain('Bron / onderbouwing');
    expect(editor).toContain('Projectspecifiek gecontroleerd');
  });

  it('biedt klikbare herstelacties en exacte navigatiedoelen', () => {
    const list = source('src/components/vastgoedrekenen/NogTeControleren.tsx');
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(list).toContain('onAction?.(action)');
    expect(editor).toContain('navigateToValidationAction');
    expect(editor).toContain('id={`cost-${c.id}`}');
  });
});
""")
