from pathlib import Path
import re

validation_path = Path('src/lib/vastgoedrekenen/validation.ts')
source = validation_path.read_text()

# Add structured validation details.
action_block = """export type ValidationAction = {
  label: string;
  sectionId: string;
  targetId?: string;
  /** Open het aangewezen tabelitem of de drawer na navigatie. */
  openTarget?: boolean;
};
"""
detail_block = action_block + """
export type ValidationDetail = {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'warning' | 'info';
};
"""
if 'export type ValidationDetail' not in source:
    if action_block not in source:
        raise SystemExit('ValidationAction block not found')
    source = source.replace(action_block, detail_block, 1)

item_old = """  title?: string;
  message: string;
  actions?: ValidationAction[];
};
"""
item_new = """  title?: string;
  message: string;
  details?: ValidationDetail[];
  actions?: ValidationAction[];
};
"""
if 'details?: ValidationDetail[];' not in source:
    if item_old not in source:
        raise SystemExit('ValidationItem fields not found')
    source = source.replace(item_old, item_new, 1)

# Replace duplicate-cost detail type with item-level evidence.
type_pattern = re.compile(
    r"export type DuplicateDevelopmentCostDetail = \{.*?\n\};",
    re.S,
)
type_replacement = """export type DuplicateDevelopmentCostItem = {
  id: string;
  label: string;
  amount: number;
  matchedTerms?: string[];
};

export type DuplicateDevelopmentCostDetail = {
  kind: DevelopmentCostKind;
  centralCostIds: string[];
  centralLabels: string[];
  centralAmount: number;
  componentUnitIds: string[];
  componentLabels: string[];
  componentAmount: number;
  centralItems: DuplicateDevelopmentCostItem[];
  componentItems: DuplicateDevelopmentCostItem[];
  matchedTerms: string[];
  reviewState: 'onbeoordeeld';
};"""
source, type_count = type_pattern.subn(type_replacement, source, count=1)
if type_count != 1:
    raise SystemExit(f'DuplicateDevelopmentCostDetail replacement count: {type_count}')

# Replace kind config with exact match terms.
config_pattern = re.compile(
    r"const KIND_CONFIG: Record<DevelopmentCostKind, \{.*?\n\};",
    re.S,
)
config_replacement = """const KIND_CONFIG: Record<DevelopmentCostKind, {
  field: 'renovation_costs' | 'splitting_costs' | 'transformation_costs';
  componentLabel: string;
  terms: Array<{ label: string; pattern: RegExp }>;
}> = {
  renovatie: {
    field: 'renovation_costs',
    componentLabel: 'renovatiekosten per component',
    terms: [
      { label: 'renovatie', pattern: /renovat/ },
      { label: 'verbouw', pattern: /verbouw/ },
    ],
  },
  splitsing: {
    field: 'splitting_costs',
    componentLabel: 'splitsingskosten per component',
    terms: [
      { label: 'splitsing', pattern: /splits/ },
    ],
  },
  transformatie: {
    field: 'transformation_costs',
    componentLabel: 'transformatie-/sloop-/nieuwbouwkosten per component',
    terms: [
      { label: 'transformatie', pattern: /transformat/ },
      { label: 'sloop', pattern: /sloop/ },
      { label: 'nieuwbouw', pattern: /nieuwbouw/ },
      { label: 'bouwkosten', pattern: /bouwkosten/ },
    ],
  },
};

function matchingTerms(cost: ScenarioCost, kind: DevelopmentCostKind): string[] {
  const text = centralCostText(cost);
  return KIND_CONFIG[kind].terms
    .filter((term) => term.pattern.test(text))
    .map((term) => term.label);
}"""
source, config_count = config_pattern.subn(config_replacement, source, count=1)
if config_count != 1:
    raise SystemExit(f'KIND_CONFIG replacement count: {config_count}')

# Replace the duplicate finder implementation.
finder_pattern = re.compile(
    r"export function findDuplicateDevelopmentCostDetails\(\n  costs: ScenarioCost\[],\n  units: SellOffUnit\[],\n\): DuplicateDevelopmentCostDetail\[] \{.*?\n\}",
    re.S,
)
finder_replacement = """export function findDuplicateDevelopmentCostDetails(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): DuplicateDevelopmentCostDetail[] {
  const details: DuplicateDevelopmentCostDetail[] = [];

  for (const kind of Object.keys(KIND_CONFIG) as DevelopmentCostKind[]) {
    const cfg = KIND_CONFIG[kind];
    const centralMatches = costs.filter((cost) => (
      costAmount(cost) > 0
      && !isContingencyCost(cost)
      && matchingTerms(cost, kind).length > 0
    ));
    const componentMatches = units.filter((unit) => positive(unitRecord(unit)[cfg.field]));
    if (centralMatches.length === 0 || componentMatches.length === 0) continue;

    const centralItems: DuplicateDevelopmentCostItem[] = centralMatches.map((cost) => ({
      id: cost.id,
      label: costLabel(cost),
      amount: costAmount(cost),
      matchedTerms: matchingTerms(cost, kind),
    }));
    const componentItems: DuplicateDevelopmentCostItem[] = componentMatches.map((unit) => ({
      id: unit.id,
      label: unitLabel(unit),
      amount: Number(unitRecord(unit)[cfg.field] ?? 0),
    }));
    const matchedTerms = [...new Set(centralItems.flatMap((item) => item.matchedTerms ?? []))];

    details.push({
      kind,
      centralCostIds: centralItems.map((item) => item.id),
      centralLabels: centralItems.map((item) => item.label),
      centralAmount: centralItems.reduce((sum, item) => sum + item.amount, 0),
      componentUnitIds: componentItems.map((item) => item.id),
      componentLabels: componentItems.map((item) => item.label),
      componentAmount: componentItems.reduce((sum, item) => sum + item.amount, 0),
      centralItems,
      componentItems,
      matchedTerms,
      reviewState: 'onbeoordeeld',
    });
  }

  return details;
}"""
source, finder_count = finder_pattern.subn(finder_replacement, source, count=1)
if finder_count != 1:
    raise SystemExit(f'findDuplicateDevelopmentCostDetails replacement count: {finder_count}')

# Replace the warning construction with structured evidence.
warning_pattern = re.compile(
    r"  const duplicateDetails = findDuplicateDevelopmentCostDetails\(c\.costs, sellOffUnits\);\n  for \(const detail of duplicateDetails\) \{.*?\n  \}",
    re.S,
)
warning_replacement = """  const duplicateDetails = findDuplicateDevelopmentCostDetails(c.costs, sellOffUnits);
  for (const detail of duplicateDetails) {
    const matchedText = detail.matchedTerms.length > 0
      ? detail.matchedTerms.map((term) => `“${term}”`).join(', ')
      : detail.kind;
    const centralDetails: ValidationDetail[] = detail.centralItems.map((item) => ({
      label: 'Algemene kostenpost',
      value: `${item.label} — ${formatEur(item.amount)}`,
      note: item.matchedTerms && item.matchedTerms.length > 0
        ? `Tekstmatch: ${item.matchedTerms.map((term) => `“${term}”`).join(', ')}`
        : undefined,
      tone: 'warning',
    }));
    const componentDetails: ValidationDetail[] = detail.componentItems.map((item) => ({
      label: 'Componentkosten',
      value: `${item.label} — ${formatEur(item.amount)}`,
      note: `Ingevoerd als ${KIND_CONFIG[detail.kind].componentLabel}.`,
      tone: 'neutral',
    }));

    out.push({
      level: 'warning',
      category: 'now',
      title: `Controleer mogelijke dubbele ${detail.kind}kosten`,
      message: `De module vond een automatische tekstmatch op ${matchedText}. Dit is nog geen bevestigde dubbeling. Controleer of de algemene kostenpost dezelfde werkzaamheden en grondslag bevat als de componentkosten.`,
      details: [
        {
          label: 'Waarom gemeld',
          value: `Er staat ${formatEur(detail.centralAmount)} aan algemene ${detail.kind}kosten naast ${formatEur(detail.componentAmount)} aan ${KIND_CONFIG[detail.kind].componentLabel}.`,
          note: 'Onvoorzien, contingency en risicoreserveringen worden vooraf uitgesloten en veroorzaken deze melding niet.',
          tone: 'info',
        },
        ...centralDetails,
        ...componentDetails,
        {
          label: 'Wat moet je doen?',
          value: 'Vergelijk de scope. Verwijder of verlaag één invoer wanneer dezelfde werkzaamheden dubbel zijn opgenomen. Laat beide staan wanneer de scopes aantoonbaar verschillen en leg dat verschil vast in omschrijving en bron.',
          tone: 'neutral',
        },
      ],
      actions: [
        { label: 'Naar algemene kostenpost', sectionId: 'sec-kosten', targetId: `cost-${detail.centralCostIds[0]}` },
        { label: 'Naar componentkosten', sectionId: 'sec-strategie', targetId: `strategy-unit-${detail.componentUnitIds[0]}`, openTarget: true },
      ],
    });
  }"""
source, warning_count = warning_pattern.subn(warning_replacement, source, count=1)
if warning_count != 1:
    raise SystemExit(f'duplicate warning replacement count: {warning_count}')

validation_path.write_text(source)

# Render structured details in the action list.
list_path = Path('src/components/vastgoedrekenen/NogTeControleren.tsx')
list_source = list_path.read_text()
actions_anchor = """            {item.actions && item.actions.length > 0 && (
              <div className="mt-2 ml-12 flex flex-wrap gap-2">
"""
details_block = """            {item.details && item.details.length > 0 && (
              <dl className="mt-2 ml-7 sm:ml-12 overflow-hidden rounded-md border bg-muted/15 divide-y divide-border/60">
                {item.details.map((detail, detailIndex) => (
                  <div key={`${detail.label}-${detailIndex}`} className="grid grid-cols-1 gap-0.5 px-2.5 py-2 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{detail.label}</dt>
                    <dd className={`min-w-0 text-[11px] leading-snug ${
                      detail.tone === 'warning'
                        ? 'text-amber-900 dark:text-amber-200'
                        : detail.tone === 'info'
                          ? 'text-primary'
                          : 'text-foreground'
                    }`}>
                      <span className="block break-words">{detail.value}</span>
                      {detail.note && <span className="mt-0.5 block break-words text-[10px] text-muted-foreground">{detail.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {item.actions && item.actions.length > 0 && (
              <div className="mt-2 ml-12 flex flex-wrap gap-2">
"""
if 'item.details && item.details.length > 0' not in list_source:
    if actions_anchor not in list_source:
        raise SystemExit('NogTeControleren actions anchor not found')
    list_source = list_source.replace(actions_anchor, details_block, 1)
list_path.write_text(list_source)

# Strengthen regression tests with exact evidence.
test_path = Path('src/test/vastgoedrekenen/actionableValidation.test.ts')
test_source = test_path.read_text()
old_assertions = """    expect(item?.message).toContain('Centrale transformatieraming');
    expect(item?.message).toContain('1 component(en)');
    expect(item?.actions).toHaveLength(2);
"""
new_assertions = """    expect(item?.message).toContain('automatische tekstmatch');
    expect(item?.message).toContain('geen bevestigde dubbeling');
    expect(item?.details?.find((detail) => detail.label === 'Algemene kostenpost')?.value).toContain('Centrale transformatieraming');
    expect(item?.details?.find((detail) => detail.label === 'Componentkosten')?.value).toContain('Piet Heinstraat 89');
    expect(item?.details?.find((detail) => detail.label === 'Waarom gemeld')?.value).toContain('€ 300.000');
    expect(item?.actions).toHaveLength(2);
"""
if old_assertions not in test_source:
    raise SystemExit('actionableValidation duplicate assertions not found')
test_source = test_source.replace(old_assertions, new_assertions, 1)

insert_anchor = """    expect(item?.actions?.[1]).toMatchObject({
      targetId: 'strategy-unit-unit-2',
      openTarget: true,
    });
  });
"""
extra_test = insert_anchor + """

  it('legt per regel vast welk woord de overlapmelding activeerde', () => {
    const details = findDuplicateDevelopmentCostDetails([
      cost({
        id: 'cost-bouw',
        cost_category: 'Algemene bouwkosten',
        description: 'Nieuwbouw casco',
        amount: 250_000,
        reliability_status: 'hoog',
      }),
    ], [
      unit({ id: 'unit-bouw', unit_label: 'Nieuwbouwdeel', transformation_costs: 400_000 }),
    ]);

    expect(details).toHaveLength(1);
    expect(details[0].matchedTerms).toEqual(expect.arrayContaining(['nieuwbouw', 'bouwkosten']));
    expect(details[0].centralItems[0]).toMatchObject({ id: 'cost-bouw', amount: 250_000 });
    expect(details[0].componentItems[0]).toMatchObject({ id: 'unit-bouw', amount: 400_000 });
    expect(details[0].reviewState).toBe('onbeoordeeld');
  });
"""
if "legt per regel vast welk woord" not in test_source:
    if insert_anchor not in test_source:
        raise SystemExit('extra test insertion anchor not found')
    test_source = test_source.replace(insert_anchor, extra_test, 1)
test_path.write_text(test_source)

ux_path = Path('src/test/ui/actionableValidationUx.test.ts')
ux_source = ux_path.read_text()
ux_anchor = """    expect(list).toContain('action.openTarget');
"""
ux_replacement = """    expect(list).toContain('action.openTarget');
    expect(list).toContain('item.details && item.details.length > 0');
    expect(list).toContain('Waarom gemeld');
"""
if "item.details && item.details.length > 0" not in ux_source:
    if ux_anchor not in ux_source:
        raise SystemExit('UX test anchor not found')
    ux_source = ux_source.replace(ux_anchor, ux_replacement, 1)
ux_path.write_text(ux_source)
