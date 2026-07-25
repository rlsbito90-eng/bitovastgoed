from pathlib import Path
import re

# 1. Extend OVB diagnostics.
types_path = Path('src/lib/vastgoedrekenen/types.ts')
types = types_path.read_text()
types = types.replace(
"""  missingManualAmount: boolean;
};""",
"""  missingManualAmount: boolean;
  /** De actuele aankoopprijs ontbreekt; er kan nog geen OVB-bedrag worden bepaald. */
  missingPurchaseBasis: boolean;
  /** De toekomstige componentstrategie wordt alleen als indicatieve verdeelsleutel gebruikt. */
  usesFutureStrategyAllocation: boolean;
  /** Meerdere automatische verdeelmethoden door elkaar maken de componenttoerekening onbetrouwbaar. */
  mixedAllocationMethods: boolean;
};""",
1,
)
types_path.write_text(types)

# 2. Make OVB diagnostics acquisition-state aware.
ovb_path = Path('src/lib/vastgoedrekenen/ovb.ts')
ovb = ovb_path.read_text()
ovb = ovb.replace(
"""  missingManualAmount: boolean;
};""",
"""  missingManualAmount: boolean;
  missingPurchaseBasis: boolean;
  usesFutureStrategyAllocation: boolean;
  mixedAllocationMethods: boolean;
};""",
1,
)
ovb = ovb.replace(
"""  if (scenario.ovb_mode === 'per_component' && components.length > 0) {
    const totalArea = components.reduce((s, c) => s + (c.surface_gbo ?? 0), 0);
    const totalStrategyValue = components.reduce(""",
"""  if (scenario.ovb_mode === 'per_component' && components.length > 0) {
    const totalArea = components.reduce((s, c) => s + (c.surface_gbo ?? 0), 0);
    const totalCurrentAcquisitionValue = components.reduce((sum, component) => {
      const method = String(component.transfer_tax_allocation_method ?? 'value');
      return method === 'value' || method === 'extern'
        ? sum + Math.max(0, Number(component.allocated_component_value ?? 0))
        : sum;
    }, 0);
    const automaticMethods = new Set(
      components
        .map((component) => String(component.transfer_tax_allocation_method ?? 'value'))
        .filter((method) => method !== 'manual'),
    );
    const mixedAllocationMethods = automaticMethods.size > 1;
    const totalStrategyValue = components.reduce(""",
1,
)
ovb = ovb.replace(
"""          missingValueBasis: false,
          missingStrategyBasis: false,
          missingManualAmount: !hasAmount,
        };""",
"""          missingValueBasis: false,
          missingStrategyBasis: false,
          missingManualAmount: !hasAmount,
          missingPurchaseBasis: false,
          usesFutureStrategyAllocation: false,
          mixedAllocationMethods,
        };""",
1,
)
ovb = ovb.replace(
"""      let basis = 0;
      let missingValueBasis = false;
      let missingStrategyBasis = false;
      if (allocMethod === 'm2') {""",
"""      let basis = 0;
      let missingValueBasis = false;
      let missingStrategyBasis = false;
      const missingPurchaseBasis = purchase <= 0;
      if (allocMethod === 'm2') {""",
1,
)
ovb = ovb.replace(
"""      } else if (allocMethod === 'extern') {
        basis = Number(c.allocated_component_value ?? 0);
      } else {
        // 'value' (default)
        basis = Number(c.allocated_component_value ?? 0);
        if (basis <= 0) missingValueBasis = true;
      }
""",
"""      } else if (allocMethod === 'extern' || allocMethod === 'value') {
        // Huidige waarde bij verkrijging is uitsluitend de verdeelsleutel.
        // De fiscale grondslag blijft de actuele aankoopprijs en telt over alle
        // componenten op tot die aankoopprijs.
        const currentValue = Number(c.allocated_component_value ?? 0);
        if (currentValue > 0 && totalCurrentAcquisitionValue > 0 && purchase > 0) {
          basis = (purchase * currentValue) / totalCurrentAcquisitionValue;
        } else {
          missingValueBasis = currentValue <= 0 || totalCurrentAcquisitionValue <= 0;
        }
      }
""",
1,
)
ovb = ovb.replace(
"""      const amount = Math.round((basis * pct) / 100);
      return {
        id: c.id,
        amount,""",
"""      const amount = missingPurchaseBasis || mixedAllocationMethods
        ? 0
        : Math.round((basis * pct) / 100);
      return {
        id: c.id,
        amount,""",
1,
)
ovb = ovb.replace(
"""        missingValueBasis,
        missingStrategyBasis,
        missingManualAmount: false,
      };""",
"""        missingValueBasis,
        missingStrategyBasis,
        missingManualAmount: false,
        missingPurchaseBasis,
        usesFutureStrategyAllocation: allocMethod === 'strategy',
        mixedAllocationMethods,
      };""",
1,
)
ovb = ovb.replace(
"""    const missingBasisCount = perComponent.filter((p) => p.missingValueBasis || p.missingStrategyBasis || p.missingManualAmount).length;""",
"""    const missingBasisCount = perComponent.filter((p) => (
      p.missingValueBasis
      || p.missingStrategyBasis
      || p.missingManualAmount
      || p.missingPurchaseBasis
      || p.mixedAllocationMethods
      || p.usesFutureStrategyAllocation
    )).length;""",
1,
)
ovb_path.write_text(ovb)

# 3. Add actionable validation for missing purchase basis and future strategy allocation.
validation_path = Path('src/lib/vastgoedrekenen/validation.ts')
validation = validation_path.read_text()
needle = """  if (objectType === 'mixed_use' && scenario.ovb_mode !== 'per_component') {"""
insert = """  const purchaseBasis = Number(scenario.purchase_price ?? 0) > 0
    || Number(scenario.asking_price ?? 0) > 0;
  if (scenario.ovb_mode !== 'manual' && !purchaseBasis) {
    out.push({
      level: 'warning',
      category: 'now',
      title: 'Actuele aankoopbasis invullen',
      message: 'De OVB in Aankoop & investering staat op € 0 omdat zowel de beoogde aankoopprijs als de vraagprijs ontbreekt. De residuele solver kan OVB per kandidaat-koopsom herberekenen, maar de actuele scenario-investering heeft eerst een aankoopbasis nodig.',
      actions: [{ label: 'Open aankoop & investering', sectionId: 'sec-aankoop' }],
    });
  }

  if (scenario.ovb_mode === 'per_component') {
    const allocationMethods = new Set(
      components
        .map((component) => String(component.transfer_tax_allocation_method ?? 'value'))
        .filter((method) => method !== 'manual'),
    );
    if (allocationMethods.size > 1) {
      out.push({
        level: 'warning',
        category: 'now',
        title: 'Eén OVB-verdeelmethode kiezen',
        message: 'Er worden meerdere automatische OVB-verdeelmethoden door elkaar gebruikt. Kies één consistente methode voor de verkrijgingssituatie, zodat de totale grondslag exact aansluit op de aankoopprijs.',
        actions: [{ label: 'Open componenten', sectionId: 'sec-componenten' }],
      });
    }

    const strategyAllocated = components.filter((component) => component.transfer_tax_allocation_method === 'strategy');
    if (strategyAllocated.length > 0) {
      out.push({
        level: 'warning',
        category: 'now',
        title: 'Toekomstige waarde niet als standaard OVB-verdeling gebruiken',
        message: `${strategyAllocated.length} component(en) gebruiken de toekomstige strategiewaarde als indicatieve verdeelsleutel. De OVB wordt wel over de aankoopprijs berekend, maar de verdeling moet voor een harde bieding aansluiten op de huidige staat bij verkrijging. Gebruik bij voorkeur huidige componentwaarden of een externe verkrijgingswaardeverdeling.`,
        actions: [{
          label: 'Open eerste betreffende component',
          sectionId: 'sec-componenten',
          targetId: `componenten-unit-${strategyAllocated[0].id}`,
          openTarget: true,
        }],
      });
    }
  }

"""
if needle not in validation:
    raise SystemExit('validation insertion point not found')
validation = validation.replace(needle, insert + needle, 1)
validation_path.write_text(validation)

# 4. Make component OVB workflow explicit about acquisition-state basis.
component_path = Path('src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx')
component = component_path.read_text()
component = component.replace(
"""  const incompleteOvb = perComp ? ovbPerComponent.filter((d) => d.missingValueBasis || d.missingStrategyBasis || d.missingManualAmount) : [];""",
"""  const incompleteOvb = perComp ? ovbPerComponent.filter((d) => (
    d.missingValueBasis
    || d.missingStrategyBasis
    || d.missingManualAmount
    || d.missingPurchaseBasis
    || d.mixedAllocationMethods
    || d.usesFutureStrategyAllocation
  )) : [];""",
1,
)
component = component.replace(
"""                Controleer per component de waardegrondslag, classificatie en toerekeningsmethode. Klik een component om de OVB-invoer direct te openen.""",
"""                De OVB wordt berekend over de actuele aankoopprijs bij verkrijging. Componentwaarden zijn alleen verdeelsleutels voor die aankoopprijs; toekomstige eindwaarden zijn geen fiscale grondslag.""",
1,
)
component = component.replace(
"""            <WorkflowStep number="1" label="Waardegrondslag" text="Toegerekende waarde, m²-verdeling, componentstrategie of handmatig bedrag." />""",
"""            <WorkflowStep number="1" label="Aankoopbasis" text="Vul eerst vraagprijs of beoogde aankoopprijs in; zonder aankoopbasis blijft OVB € 0." />""",
1,
)
component = component.replace(
"""            <WorkflowStep number="2" label="Classificatie" text="Woning, hoofdverblijf of niet-woning per component." />
            <WorkflowStep number="3" label="Tarief" text="Automatisch tarief of alleen bij uitzondering een onderbouwde override." />
            <WorkflowStep number="4" label="Controle" text="Grondslag × tarief moet aansluiten op het berekende OVB-bedrag." />""",
"""            <WorkflowStep number="2" label="Verdeling huidige staat" text="Gebruik huidige componentwaarden bij verkrijging, een externe verdeling of indicatief m²." />
            <WorkflowStep number="3" label="Classificatie en tarief" text="Woning of niet-woning per component; override alleen onderbouwd." />
            <WorkflowStep number="4" label="Controle" text="De verdeelde grondslagen moeten samen aansluiten op de actuele aankoopprijs." />""",
1,
)
component = component.replace(
"""              const missing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);""",
"""              const missing = !!diag && (
                diag.missingValueBasis
                || diag.missingStrategyBasis
                || diag.missingManualAmount
                || diag.missingPurchaseBasis
                || diag.mixedAllocationMethods
                || diag.usesFutureStrategyAllocation
              );""",
1,
)
component = component.replace(
"""                : diag.missingValueBasis
                  ? 'Waardegrondslag ontbreekt.'""",
"""                : diag.missingPurchaseBasis
                  ? 'Actuele aankoopprijs ontbreekt; OVB kan nog niet worden berekend.'
                  : diag.mixedAllocationMethods
                    ? 'Meerdere verdeelmethoden door elkaar; kies één consistente methode.'
                    : diag.usesFutureStrategyAllocation
                      ? 'Toekomstige strategiewaarde wordt indicatief als verdeelsleutel gebruikt.'
                      : diag.missingValueBasis
                  ? 'Huidige waarde bij verkrijging ontbreekt.'""",
1,
)
component = component.replace(
"""  const ovbMissing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);""",
"""  const ovbMissing = !!diag && (
    diag.missingValueBasis
    || diag.missingStrategyBasis
    || diag.missingManualAmount
    || diag.missingPurchaseBasis
    || diag.mixedAllocationMethods
    || diag.usesFutureStrategyAllocation
  );""",
1,
)
component = component.replace(
"""                      <DrawerField label="Toegerekende waarde (€)">""",
"""                      <DrawerField label="Huidige componentwaarde bij verkrijging (€)">""",
1,
)
component = component.replace(
"""                            <SelectItem value="value">Op waarde (handmatige toerekening)</SelectItem>
                            <SelectItem value="m2">Op m² (verdeling vraagprijs)</SelectItem>
                            <SelectItem value="strategy" disabled={sellOffUnitsCount === 0}>Uit componentstrategie{sellOffUnitsCount === 0 ? ' — geen units' : ''}</SelectItem>
                            <SelectItem value="manual">Handmatig bedrag</SelectItem>""",
"""                            <SelectItem value="value">Huidige waarden bij verkrijging (aanbevolen)</SelectItem>
                            <SelectItem value="m2">Indicatief op m² van huidige staat</SelectItem>
                            <SelectItem value="strategy" disabled={sellOffUnitsCount === 0}>Toekomstige strategiewaarde — indicatief{sellOffUnitsCount === 0 ? ' — geen units' : ''}</SelectItem>
                            <SelectItem value="manual">Handmatig OVB-bedrag</SelectItem>""",
1,
)
component = component.replace(
"""                      {diag.missingValueBasis && <div>⚠ Toegerekende waarde ontbreekt — OVB komt op € 0. Vul "Toegerekende waarde" in, kies "Op m²", "Uit componentstrategie" of voer handmatig bedrag in.</div>}
                      {diag.missingStrategyBasis && <div>⚠ Geen waarde uit componentstrategie gevonden — koppel het component aan een sell_off_unit of kies een andere methode.</div>}
                      {diag.missingManualAmount && <div>⚠ Handmatig bedrag niet ingevuld — OVB komt op € 0.</div>}""",
"""                      {diag.missingPurchaseBasis && <div>⚠ Actuele aankoopbasis ontbreekt — vul vraagprijs of beoogde aankoopprijs in. De OVB blijft hier € 0 totdat die basis aanwezig is.</div>}
                      {diag.mixedAllocationMethods && <div>⚠ Meerdere automatische verdeelmethoden worden gecombineerd. Kies één consistente methode voor alle componenten.</div>}
                      {diag.usesFutureStrategyAllocation && <div>⚠ Toekomstige strategiewaarde wordt alleen als indicatieve verdeelsleutel gebruikt. Controleer de verdeling op basis van de huidige staat bij verkrijging.</div>}
                      {diag.missingValueBasis && <div>⚠ Huidige componentwaarde bij verkrijging ontbreekt — vul deze waarde in of kies indicatief m².</div>}
                      {diag.missingStrategyBasis && <div>⚠ Geen waarde uit componentstrategie gevonden — koppel het component of kies een huidige-staatmethode.</div>}
                      {diag.missingManualAmount && <div>⚠ Handmatig OVB-bedrag niet ingevuld — OVB komt op € 0.</div>}""",
1,
)
component = component.replace(
"""  const missing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);""",
"""  const missing = !!diag && (
    diag.missingValueBasis
    || diag.missingStrategyBasis
    || diag.missingManualAmount
    || diag.missingPurchaseBasis
    || diag.mixedAllocationMethods
    || diag.usesFutureStrategyAllocation
  );""",
1,
)
component_path.write_text(component)

# 5. Scenario workflow status and one-section default opening.
editor_path = Path('src/components/vastgoedrekenen/ScenarioEditor.tsx')
editor = editor_path.read_text()
editor = editor.replace(
"""        const compWarnings = outputs.ovbPerComponent.filter((p) => p.missingValueBasis || p.missingStrategyBasis || p.missingManualAmount).length;""",
"""        const compWarnings = outputs.ovbPerComponent.filter((p) => (
          p.missingValueBasis
          || p.missingStrategyBasis
          || p.missingManualAmount
          || p.missingPurchaseBasis
          || p.mixedAllocationMethods
          || p.usesFutureStrategyAllocation
        )).length;""",
1,
)
# Remove the old broad default-open block.
old_open_pattern = re.compile(
    r"\n        // Default open-heuristiek:.*?\n        const num = \(key: SectionKey\) => chapterNumber\(key\);",
    re.S,
)
editor, count = old_open_pattern.subn("\n        const num = (key: SectionKey) => chapterNumber(key);", editor, count=1)
if count != 1:
    raise SystemExit(f'old default-open block replacement count {count}')

old_meta = """        const subMeta: Record<SubSectionKey, { status: RailStatus; hint?: string; count?: number | null }> = {
          'sec-resultaat': { status: resultaatStatus, hint: cockpitStatus },
          'sec-waterfall': { status: 'ok', hint: waterfallHint },
          'sec-aankoop': { status: 'ok', hint: aankoopStatus },
          'sec-huur': { status: relToRailStatus(huurRelevance), hint: huurStatus },
          'sec-verkoop': { status: relToRailStatus(verkoopRelevance), hint: verkoopStatus },
          'sec-kosten': { status: 'ok', hint: kostenStatus },
          'sec-componenten': { status: relToRailStatus(compRelevance, false, compWarnings > 0), count: components.length, hint: compStatus },
          'sec-strategie': { status: relToRailStatus(strategyRelevance), count: sellOffUnits.length, hint: strategyStatus },
          'sec-wws': { status: relToRailStatus(wwsRelevance, false, wwsHasWarnings > 0), count: wwsUnits.length, hint: wwsStatus },
          'sec-onderbouwing': { status: relToRailStatus(undefined, blockerCount > 0, warningCount > 0), count: nogTeControleren.length, hint: onderbouwingStatus },
          'sec-score': { status: 'ok', hint: scoreStatus },
          'sec-notities': { status: 'ok', hint: notitiesStatus },
        };"""
new_meta = """        const statusWithActions = (sectionId: SubSectionKey, base: RailStatus): RailStatus => {
          const sectionIssues = nogTeControleren.filter((item) => (
            (item.category ?? 'now') === 'now'
            && item.actions?.some((action) => action.sectionId === sectionId)
          ));
          if (sectionIssues.some((item) => item.level === 'blocker')) return 'blocker';
          if (sectionIssues.some((item) => item.level === 'warning')) return 'aandacht';
          return base;
        };

        const subMeta: Record<SubSectionKey, { status: RailStatus; hint?: string; count?: number | null }> = {
          'sec-resultaat': { status: resultaatStatus, hint: cockpitStatus },
          'sec-waterfall': { status: statusWithActions('sec-waterfall', 'ok'), hint: waterfallHint },
          'sec-aankoop': { status: statusWithActions('sec-aankoop', 'ok'), hint: aankoopStatus },
          'sec-huur': { status: statusWithActions('sec-huur', relToRailStatus(huurRelevance)), hint: huurStatus },
          'sec-verkoop': { status: statusWithActions('sec-verkoop', relToRailStatus(verkoopRelevance)), hint: verkoopStatus },
          'sec-kosten': { status: statusWithActions('sec-kosten', 'ok'), hint: kostenStatus },
          'sec-componenten': { status: statusWithActions('sec-componenten', relToRailStatus(compRelevance, false, compWarnings > 0)), count: components.length, hint: compStatus },
          'sec-strategie': { status: statusWithActions('sec-strategie', relToRailStatus(strategyRelevance)), count: sellOffUnits.length, hint: strategyStatus },
          'sec-wws': { status: statusWithActions('sec-wws', relToRailStatus(wwsRelevance, false, wwsHasWarnings > 0)), count: wwsUnits.length, hint: wwsStatus },
          'sec-onderbouwing': { status: relToRailStatus(undefined, blockerCount > 0, warningCount > 0), count: nogTeControleren.length, hint: onderbouwingStatus },
          'sec-score': { status: statusWithActions('sec-score', 'ok'), hint: scoreStatus },
          'sec-notities': { status: statusWithActions('sec-notities', 'ok'), hint: notitiesStatus },
        };

        // Start rustig: standaard precies één relevante sectie open. Een eerder
        // handmatig geopende sectie wordt per scenario onthouden.
        const firstNowIssue = [
          ...nogTeControleren.filter((item) => (item.category ?? 'now') === 'now' && item.level === 'blocker'),
          ...nogTeControleren.filter((item) => (item.category ?? 'now') === 'now' && item.level === 'warning'),
        ].find((item) => item.actions?.some((action) => ALL_SUB_SECTION_KEYS.includes(action.sectionId as SubSectionKey)));
        const firstIssueSection = firstNowIssue?.actions?.find((action) => ALL_SUB_SECTION_KEYS.includes(action.sectionId as SubSectionKey))?.sectionId as SubSectionKey | undefined;
        const storageKey = `vastgoedrekenen:last-open-section:${s.id}`;
        const storedSection = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) as SubSectionKey | null : null;
        const preferredSection = storedSection && ALL_SUB_SECTION_KEYS.includes(storedSection) && subMeta[storedSection].status !== 'niet_relevant'
          ? storedSection
          : firstIssueSection ?? 'sec-resultaat';
        const defaultOpenMap = buildUniformOpenState(false);
        defaultOpenMap[preferredSection] = true;
        if (openInitRef.current !== s.id) {
          openInitRef.current = s.id;
          setOpenSections(defaultOpenMap);
        }
        const sectionProps = (key: SubSectionKey) => ({
          open: openSections[key] ?? defaultOpenMap[key] ?? false,
          onOpenChange: (next: boolean) => {
            if (next && typeof window !== 'undefined') window.localStorage.setItem(storageKey, key);
            setOpenSections((prev) => ({ ...prev, [key]: next }));
          },
          numberLabel: subNumber(key),
        });"""
if old_meta not in editor:
    raise SystemExit('subMeta block not found')
editor = editor.replace(old_meta, new_meta, 1)
editor = editor.replace(
"""                  <div className="col-span-full text-xs text-muted-foreground">OVB wordt per component berekend. Stel waarde en classificatie per component in (sectie Componenten/units hieronder).</div>""",
"""                  <div className="col-span-full rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
                    OVB wordt over de actuele aankoopprijs bij verkrijging berekend. Verdeel die aankoopprijs in Componenten/units op basis van de huidige staat. Toekomstige strategiewaarden zijn alleen een expliciete, indicatieve verdeelsleutel.
                  </div>""",
1,
)
editor_path.write_text(editor)

# 6. Hybrid number/check display in collapsed rail.
rail_path = Path('src/components/vastgoedrekenen/cockpit/SectionRail.tsx')
rail = rail_path.read_text()
old_collapsed = """                        <Icon className={`h-4 w-4 ${item.status === 'blocker' ? 'text-destructive' : item.status === 'aandacht' ? 'text-amber-600' : 'text-emerald-600'}`} />"""
new_collapsed = """                        {item.status === 'ok' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className={`flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-[9px] font-semibold font-mono-data ${
                            item.status === 'blocker'
                              ? 'border-destructive/50 bg-destructive/10 text-destructive'
                              : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                          }`}>
                            {item.number}
                          </span>
                        )}"""
if old_collapsed not in rail:
    raise SystemExit('collapsed icon block not found')
rail = rail.replace(old_collapsed, new_collapsed, 1)
rail_path.write_text(rail)

# 7. Tests.
test_path = Path('src/test/vastgoedrekenen/ovbAcquisitionWorkflow.test.ts')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import { computeScenarioOvb } from '@/lib/vastgoedrekenen/ovb';
import type { Component, Scenario } from '@/lib/vastgoedrekenen/types';

function scenario(patch: Partial<Scenario> = {}): Scenario {
  return {
    purchase_price: 1_000_000,
    ovb_mode: 'per_component',
    ovb_classification: 'mixed_use',
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    ...patch,
  } as Scenario;
}

function component(id: string, patch: Partial<Component> = {}): Component {
  return {
    id,
    component_type: 'appartement',
    allocated_component_value: null,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: 'woning_belegging',
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    surface_gbo: 0,
    ...patch,
  } as Component;
}

describe('OVB op actuele verkrijgingssituatie', () => {
  it('gebruikt huidige componentwaarden als verdeelsleutel voor de aankoopprijs', () => {
    const result = computeScenarioOvb(scenario(), [
      component('a', { allocated_component_value: 600_000 }),
      component('b', { allocated_component_value: 400_000, component_type: 'kantoor', transfer_tax_classification: 'niet_woning' }),
    ], null, 'mixed_use');

    expect(result.perComponent.map((row) => row.basisValue)).toEqual([600_000, 400_000]);
    expect(result.perComponent.reduce((sum, row) => sum + row.basisValue, 0)).toBe(1_000_000);
  });

  it('markeert ontbrekende aankoopprijs en toont daarom geen schijn-OVB', () => {
    const result = computeScenarioOvb(scenario({ purchase_price: null }), [
      component('a', { allocated_component_value: 600_000 }),
      component('b', { allocated_component_value: 400_000 }),
    ], null, 'mixed_use');

    expect(result.totalOvb).toBe(0);
    expect(result.missingBasisCount).toBe(2);
    expect(result.perComponent.every((row) => row.missingPurchaseBasis)).toBe(true);
  });

  it('markeert toekomstige strategiewaarde als indicatieve verdeelsleutel', () => {
    const result = computeScenarioOvb(scenario(), [
      component('a', { transfer_tax_allocation_method: 'strategy' }),
      component('b', { transfer_tax_allocation_method: 'strategy' }),
    ], null, 'mixed_use', new Map([['a', 700_000], ['b', 300_000]]));

    expect(result.perComponent.every((row) => row.usesFutureStrategyAllocation)).toBe(true);
    expect(result.missingBasisCount).toBe(2);
    expect(result.perComponent.reduce((sum, row) => sum + row.basisValue, 0)).toBe(1_000_000);
  });

  it('blokkeert een combinatie van verschillende automatische verdeelmethoden', () => {
    const result = computeScenarioOvb(scenario(), [
      component('a', { allocated_component_value: 600_000, transfer_tax_allocation_method: 'value' }),
      component('b', { surface_gbo: 100, transfer_tax_allocation_method: 'm2' }),
    ], null, 'mixed_use');

    expect(result.totalOvb).toBe(0);
    expect(result.perComponent.every((row) => row.mixedAllocationMethods)).toBe(true);
  });
});
""
)

ui_test_path = Path('src/test/ui/workflowRailOvbUx.test.ts')
ui_test_path.write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('rustige werkstroom en verkrijgings-OVB', () => {
  it('opent standaard één relevante of laatst gebruikte sectie', () => {
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(editor).toContain('vastgoedrekenen:last-open-section');
    expect(editor).toContain('const defaultOpenMap = buildUniformOpenState(false)');
    expect(editor).toContain('defaultOpenMap[preferredSection] = true');
  });

  it('leidt railstatus af uit concrete herstelacties', () => {
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(editor).toContain('statusWithActions');
    expect(editor).toContain("'sec-aankoop': { status: statusWithActions('sec-aankoop', 'ok')");
  });

  it('toont in ingeklapte rail een vinkje voor klaar en een nummer voor aandacht', () => {
    const rail = source('src/components/vastgoedrekenen/cockpit/SectionRail.tsx');
    expect(rail).toContain("item.status === 'ok'");
    expect(rail).toContain('{item.number}');
  });

  it('benoemt huidige staat en toekomstige strategiewaarde expliciet', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx');
    expect(table).toContain('Huidige componentwaarde bij verkrijging');
    expect(table).toContain('Toekomstige strategiewaarde — indicatief');
    expect(table).toContain('actuele aankoopprijs bij verkrijging');
  });
});
""
)
