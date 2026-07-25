from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))

# --- Hook: fetch and CRUD for acquisition structure ---
path = 'src/hooks/useVastgoedrekenen.tsx'
replace_once(path,
"""import type {
  Calculation, Scenario, Component, ScenarioCost, WwsUnit,
  SellOffUnit, RiskItem, CalcOutput, TaxSettings,
} from '@/lib/vastgoedrekenen/types';""",
"""import type {
  Calculation, Scenario, Component, ScenarioCost, WwsUnit,
  SellOffUnit, RiskItem, CalcOutput, TaxSettings,
} from '@/lib/vastgoedrekenen/types';
import type { AcquisitionComponent, AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';""")

replace_once(path,
"""export function useScenarioChildren(scenarioId: string | undefined) {
  const [components, setComponents] = useState<Component[]>([]);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);""",
"""export function useScenarioChildren(scenarioId: string | undefined) {
  const [components, setComponents] = useState<Component[]>([]);
  const [acquisitionComponents, setAcquisitionComponents] = useState<AcquisitionComponent[]>([]);
  const [acquisitionUnitLinks, setAcquisitionUnitLinks] = useState<AcquisitionUnitLink[]>([]);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);""")

replace_once(path,
"""    const [c, k, w, so, r, o] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('calculation_outputs').select('*').eq('scenario_id', scenarioId).maybeSingle(),
    ]);
    setComponents((c.data ?? []) as Component[]);
    setCosts((k.data ?? []) as ScenarioCost[]);
    setWwsUnits((w.data ?? []) as WwsUnit[]);
    setSellOffUnits((so.data ?? []) as SellOffUnit[]);
    setRisks((r.data ?? []) as RiskItem[]);
    setOutput((o.data as CalcOutput) ?? null);""",
"""    const untyped = supabase as unknown as { from: (table: string) => any };
    const [c, acq, acqLinks, k, w, so, r, o] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', scenarioId).order('created_at'),
      untyped.from('calculation_acquisition_components').select('*').eq('scenario_id', scenarioId).order('sort_order').order('created_at'),
      untyped.from('calculation_acquisition_unit_links').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('calculation_outputs').select('*').eq('scenario_id', scenarioId).maybeSingle(),
    ]);
    setComponents((c.data ?? []) as Component[]);
    // 42P01 = migratie nog niet toegepast. In dat geval blijft het legacy OVB-pad actief.
    setAcquisitionComponents(acq.error ? [] : (acq.data ?? []) as AcquisitionComponent[]);
    setAcquisitionUnitLinks(acqLinks.error ? [] : (acqLinks.data ?? []) as AcquisitionUnitLink[]);
    setCosts((k.data ?? []) as ScenarioCost[]);
    setWwsUnits((w.data ?? []) as WwsUnit[]);
    setSellOffUnits((so.data ?? []) as SellOffUnit[]);
    setRisks((r.data ?? []) as RiskItem[]);
    setOutput((o.data as CalcOutput) ?? null);""")

insert_before = """  // --- Componentstrategie (sell_off_units) ---"""
acq_crud = """  // --- Verkrijgingsstructuur (feitelijke situatie bij aankoop) ---
  const createAcquisitionComponent = useCallback(async (patch: Partial<AcquisitionComponent> = {}) => {
    if (!scenarioId) return null;
    const untyped = supabase as unknown as { from: (table: string) => any };
    const payload = {
      scenario_id: scenarioId,
      component_name: patch.component_name ?? 'Nieuw verkrijgingscomponent',
      component_type: patch.component_type ?? 'overig',
      transfer_tax_allocation_method: patch.transfer_tax_allocation_method ?? 'value',
      transfer_tax_classification: patch.transfer_tax_classification ?? null,
      sort_order: acquisitionComponents.length,
      ...patch,
    };
    const { data, error } = await untyped.from('calculation_acquisition_components').insert(payload).select('*').single();
    if (error) {
      toast.error(error.code === '42P01'
        ? 'Verkrijgingsstructuur is nog niet beschikbaar. Pas eerst de nieuwe Supabase-migratie toe.'
        : mapDbError(error, 'Verkrijgingscomponent aanmaken mislukt'));
      return null;
    }
    await fetchAll();
    return data as AcquisitionComponent;
  }, [scenarioId, acquisitionComponents.length, fetchAll]);

  const updateAcquisitionComponent = useCallback(async (id: string, patch: Partial<AcquisitionComponent>) => {
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error } = await untyped.from('calculation_acquisition_components').update(stripUndefinedEntries(patch)).eq('id', id);
    if (error) toast.error(mapDbError(error, 'Verkrijgingscomponent wijzigen mislukt'));
    else await fetchAll();
  }, [fetchAll]);

  const deleteAcquisitionComponent = useCallback(async (id: string) => {
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error } = await untyped.from('calculation_acquisition_components').delete().eq('id', id);
    if (error) toast.error(mapDbError(error, 'Verkrijgingscomponent verwijderen mislukt'));
    else await fetchAll();
  }, [fetchAll]);

  const setAcquisitionComponentLinks = useCallback(async (acquisitionComponentId: string, sellOffUnitIds: string[]) => {
    if (!scenarioId) return;
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error: deleteError } = await untyped
      .from('calculation_acquisition_unit_links')
      .delete()
      .eq('acquisition_component_id', acquisitionComponentId);
    if (deleteError) {
      toast.error(mapDbError(deleteError, 'Koppelingen wijzigen mislukt'));
      return;
    }
    if (sellOffUnitIds.length > 0) {
      const rows = sellOffUnitIds.map((sellOffUnitId) => ({
        scenario_id: scenarioId,
        acquisition_component_id: acquisitionComponentId,
        sell_off_unit_id: sellOffUnitId,
      }));
      const { error: insertError } = await untyped.from('calculation_acquisition_unit_links').insert(rows);
      if (insertError) {
        toast.error(mapDbError(insertError, 'Koppelingen opslaan mislukt'));
        await fetchAll();
        return;
      }
    }
    await fetchAll();
  }, [scenarioId, fetchAll]);

"""
file = Path(path)
text = file.read_text()
if insert_before not in text:
    raise SystemExit('Hook insertion point not found')
file.write_text(text.replace(insert_before, acq_crud + insert_before, 1))

replace_once(path,
"""    components, costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
    createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents,""",
"""    components, acquisitionComponents, acquisitionUnitLinks, costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
    createAcquisitionComponent, updateAcquisitionComponent, deleteAcquisitionComponent, setAcquisitionComponentLinks,
    createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents,""")

# --- OVB pure function accepts acquisition components and exact rounded allocation ---
path = 'src/lib/vastgoedrekenen/ovb.ts'
replace_once(path,
"""import type { Component, Scenario, TaxSettings } from './types';""",
"""import type { Scenario, TaxSettings } from './types';
import type { TransferTaxComponent } from './acquisition';""")
replace_once(path, """  components: Component[],""", """  components: TransferTaxComponent[],""")
replace_once(path, """    const perComponent: OvbPerComponent[] = components.map((c) => {""", """    let perComponent: OvbPerComponent[] = components.map((c) => {""")
replace_once(path,
"""    const missingBasisCount = perComponent.filter((p) => (
      p.missingValueBasis""",
"""    // Rond componentgrondslagen af zonder dat de som € 1 afwijkt van de aankoopprijs.
    // Alleen veilig bij volledig automatische, bruikbare grondslagen.
    const canReconcileBasis = purchase > 0
      && components.every((component) => component.transfer_tax_allocation_method !== 'manual')
      && perComponent.every((row) => !row.missingValueBasis && !row.missingStrategyBasis && !row.missingPurchaseBasis && !row.mixedAllocationMethods);
    if (canReconcileBasis && perComponent.length > 0) {
      const roundedTotal = perComponent.reduce((sum, row) => sum + row.basisValue, 0);
      const difference = Math.round(purchase) - roundedTotal;
      if (difference !== 0) {
        const lastIndex = perComponent.length - 1;
        const last = perComponent[lastIndex];
        const adjustedBasis = Math.max(0, last.basisValue + difference);
        perComponent = perComponent.map((row, index) => index === lastIndex
          ? { ...row, basisValue: adjustedBasis, amount: Math.round((adjustedBasis * row.pct) / 100) }
          : row);
      }
    }

    const missingBasisCount = perComponent.filter((p) => (
      p.missingValueBasis""")

# --- Residual solver accepts generic transfer-tax components ---
path = 'src/lib/vastgoedrekenen/residueel.ts'
replace_once(path,
"""  Component,
  ResidualBindingTarget,""",
"""  ResidualBindingTarget,""")
replace_once(path,
"""} from './types';
import { computeAcquisitionCosts }""",
"""} from './types';
import type { TransferTaxComponent } from './acquisition';
import { computeAcquisitionCosts }""")
replace_once(path, """  components: Component[];""", """  components: TransferTaxComponent[];""")

# --- Compute chooses acquisition structure when present ---
path = 'src/lib/vastgoedrekenen/compute.ts'
replace_once(path,
"""import type { Component, Scenario, ScenarioCost, WwsUnit, TaxSettings, ComputedOutputs, SellOffUnit } from './types';""",
"""import type { Component, Scenario, ScenarioCost, WwsUnit, TaxSettings, ComputedOutputs, SellOffUnit } from './types';
import type { AcquisitionComponent, TransferTaxComponent } from './acquisition';""")
replace_once(path,
"""  components: Component[];
  costs: ScenarioCost[];""",
"""  components: Component[];
  /** Optionele feitelijke verkrijgingsstructuur. Zodra gevuld leidend voor OVB. */
  acquisitionComponents?: AcquisitionComponent[];
  costs: ScenarioCost[];""")
replace_once(path,
"""  // --- OVB ---
  const ovbObjectType:""",
"""  // --- OVB ---
  // Een aparte verkrijgingsstructuur is leidend. Zonder nieuwe invoer blijft het
  // bestaande componentmodel als backwards-compatible fallback functioneren.
  const ovbComponents: TransferTaxComponent[] = (ctx.acquisitionComponents?.length ?? 0) > 0
    ? (ctx.acquisitionComponents as TransferTaxComponent[])
    : (components as TransferTaxComponent[]);
  const hasSeparateAcquisitionStructure = (ctx.acquisitionComponents?.length ?? 0) > 0;
  const ovbObjectType:""")
replace_once(path,
"""  const ovb = computeScenarioOvb(scenario, components, taxSettings, ovbObjectType, strategyValueByComponentId);""",
"""  const ovb = computeScenarioOvb(
    scenario,
    ovbComponents,
    taxSettings,
    ovbObjectType,
    hasSeparateAcquisitionStructure ? undefined : strategyValueByComponentId,
  );""")
replace_once(path,
"""  if (scenario.ovb_mode === 'per_component') {
    if (components.length === 0) residualCriticalIssues.push('OVB per component is gekozen, maar componenten ontbreken.');
    for (const component of components) {""",
"""  if (scenario.ovb_mode === 'per_component') {
    if (ovbComponents.length === 0) residualCriticalIssues.push('OVB per component is gekozen, maar verkrijgingscomponenten ontbreken.');
    for (const component of ovbComponents) {""")
replace_once(path,
"""      components,
      taxSettings,""",
"""      components: ovbComponents,
      taxSettings,""")
replace_once(path,
"""      strategyValueByComponentId: strategy.enabled ? strategyValueByComponentId : undefined,""",
"""      strategyValueByComponentId: strategy.enabled && !hasSeparateAcquisitionStructure ? strategyValueByComponentId : undefined,""")

# --- Validation uses acquisition components for OVB only ---
path = 'src/lib/vastgoedrekenen/validation.ts'
replace_once(path,
"""import type { Component, Scenario, ScenarioCost, SellOffUnit, WwsUnit } from './types';""",
"""import type { Component, Scenario, ScenarioCost, SellOffUnit, WwsUnit } from './types';
import type { AcquisitionComponent } from './acquisition';""")
replace_once(path,
"""  components: Component[];
  costs: ScenarioCost[];""",
"""  components: Component[];
  acquisitionComponents?: AcquisitionComponent[];
  costs: ScenarioCost[];""")
replace_once(path,
"""  const { scenario, components, wwsUnits, sellOffUnits = [], objectType } = c;""",
"""  const { scenario, components, acquisitionComponents = [], wwsUnits, sellOffUnits = [], objectType } = c;
  const ovbComponents = acquisitionComponents.length > 0 ? acquisitionComponents : components;
  const hasSeparateAcquisitionStructure = acquisitionComponents.length > 0;""")
replace_once(path,
"""      components
        .map((component) => String(component.transfer_tax_allocation_method ?? 'value'))""",
"""      ovbComponents
        .map((component) => String(component.transfer_tax_allocation_method ?? 'value'))""")
replace_once(path,
"""    const strategyAllocated = components.filter((component) => component.transfer_tax_allocation_method === 'strategy');""",
"""    const strategyAllocated = hasSeparateAcquisitionStructure
      ? []
      : components.filter((component) => component.transfer_tax_allocation_method === 'strategy');""")
replace_once(path,
"""    const zonderWaarde = components.filter((x) => !x.allocated_component_value && !x.surface_gbo);""",
"""    const zonderWaarde = ovbComponents.filter((x) => !x.allocated_component_value && !x.surface_gbo && x.transfer_tax_allocation_method !== 'manual');""")
replace_once(path,
"""          targetId: `componenten-unit-${zonderWaarde[0].id}`,""",
"""          targetId: hasSeparateAcquisitionStructure
            ? `acquisition-component-${zonderWaarde[0].id}`
            : `componenten-unit-${zonderWaarde[0].id}`,""")

validation_file = Path(path)
validation = validation_file.read_text()
marker = """  const vatTreatments = activeVatTreatments(c.costs);"""
addition = """  if (hasSeparateAcquisitionStructure) {
    const unsupportedExemptions = acquisitionComponents.filter((component) => (
      component.transfer_tax_classification === 'vrijgesteld'
      && !String(component.source_note ?? component.notes ?? '').trim()
    ));
    if (unsupportedExemptions.length > 0) {
      out.push({
        level: 'warning',
        category: 'now',
        title: 'OVB-vrijstelling onderbouwen',
        message: `${unsupportedExemptions.length} verkrijgingscomponent(en) staan op “Vrijgesteld / n.v.t.” zonder bron of toelichting. Leg vast waarom op het huidige verkrijgingsdeel geen OVB wordt gerekend.`,
        actions: [{
          label: 'Open eerste vrijgestelde verkrijgingscomponent',
          sectionId: 'sec-componenten',
          targetId: `acquisition-component-${unsupportedExemptions[0].id}`,
          openTarget: true,
        }],
      });
    }
  }

"""
if marker not in validation:
    raise SystemExit('Validation exemption insertion marker not found')
validation_file.write_text(validation.replace(marker, addition + marker, 1))

# --- Scenario editor integration ---
path = 'src/components/vastgoedrekenen/ScenarioEditor.tsx'
replace_once(path,
"""import ComponentenTable from './cockpit/ComponentenTable';""",
"""import ComponentenTable from './cockpit/ComponentenTable';
import AcquisitionComponentsTable from './cockpit/AcquisitionComponentsTable';""")
replace_once(path,
"""  const { components, costs, wwsUnits, sellOffUnits, loading: childrenLoading, refetch, upsertOutput, createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents } = useScenarioChildren(s.id);""",
"""  const {
    components, acquisitionComponents, acquisitionUnitLinks, costs, wwsUnits, sellOffUnits,
    loading: childrenLoading, refetch, upsertOutput,
    createAcquisitionComponent, updateAcquisitionComponent, deleteAcquisitionComponent, setAcquisitionComponentLinks,
    createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents,
  } = useScenarioChildren(s.id);
  const hasSeparateAcquisitionStructure = acquisitionComponents.length > 0;""")
replace_once(path,
"""    scenario: s,
    components, costs: draftCosts, wwsUnits,""",
"""    scenario: s,
    components, acquisitionComponents, costs: draftCosts, wwsUnits,""")
replace_once(path,
"""  }), [s, components, draftCosts, wwsUnits, sellOffUnits, taxSettings, objectType, objectArea, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, propertyType]);""",
"""  }), [s, components, acquisitionComponents, draftCosts, wwsUnits, sellOffUnits, taxSettings, objectType, objectArea, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, propertyType]);""")
replace_once(path,
"""    scenario: s, components, costs: draftCosts, wwsUnits, sellOffUnits, objectType, propertyType,""",
"""    scenario: s, components, acquisitionComponents, costs: draftCosts, wwsUnits, sellOffUnits, objectType, propertyType,""")
replace_once(path,
"""  }), [s, components, draftCosts, wwsUnits, sellOffUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, dirty]);""",
"""  }), [s, components, acquisitionComponents, draftCosts, wwsUnits, sellOffUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, dirty]);""")
replace_once(path,
"""                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Berekende OVB</p>""",
"""                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Totale berekende OVB</p>""")
replace_once(path,
"""                    OVB wordt over de actuele aankoopprijs bij verkrijging berekend. Verdeel die aankoopprijs in Componenten/units op basis van de huidige staat. Toekomstige strategiewaarden zijn alleen een expliciete, indicatieve verdeelsleutel.""",
"""                    OVB wordt over de actuele aankoopprijs bij verkrijging berekend. {hasSeparateAcquisitionStructure
                      ? `De aparte verkrijgingsstructuur met ${acquisitionComponents.length} huidig(e) deel/delen is leidend; toekomstige strategie-units bepalen de OVB niet.`
                      : 'Er is nog geen aparte verkrijgingsstructuur. OVB valt daarom tijdelijk terug op de bestaande projectcomponenten.'}""")
replace_once(path,
"""                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                   <p className="text-xs text-muted-foreground max-w-xl">
                     Gebruik componenten wanneer een object uit meerdere delen bestaat. Componenten werken door in huur, WWS, OVB per component, uitpondanalyse en prijs per m².
                   </p>
                   <Button size="sm" variant="outline" onClick={addComponent} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Component</Button>
                 </div>""",
"""                 {ovbMode === 'per_component' && (
                   <AcquisitionComponentsTable
                     components={acquisitionComponents}
                     links={acquisitionUnitLinks}
                     strategyUnits={sellOffUnits}
                     ovbPerComponent={outputs.ovbPerComponent}
                     purchasePrice={Number(s.purchase_price ?? 0)}
                     onCreate={createAcquisitionComponent}
                     onUpdate={updateAcquisitionComponent}
                     onDelete={deleteAcquisitionComponent}
                     onSetLinks={setAcquisitionComponentLinks}
                   />
                 )}
                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
                   <p className="text-xs text-muted-foreground max-w-xl">
                     Projectcomponenten/rekenunits werken door in huur, WWS, toekomstige strategie, ontwikkelkosten en prijs per m². Zodra een aparte verkrijgingsstructuur bestaat, worden deze units niet meer voor OVB gebruikt.
                   </p>
                   <Button size="sm" variant="outline" onClick={addComponent} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Projectcomponent</Button>
                 </div>""")
replace_once(path,
"""                   ovbPerComponent={outputs.ovbPerComponent}
                   ovbMode={ovbMode}""",
"""                   ovbPerComponent={hasSeparateAcquisitionStructure ? [] : outputs.ovbPerComponent}
                   ovbMode={hasSeparateAcquisitionStructure ? 'auto' : ovbMode}""")
replace_once(path,
"""                 asking={s.asking_price}
                 onCreate={createStrategyUnit}""",
"""                 onCreate={createStrategyUnit}""")

# --- Component strategy KPIs: remove misleading comparison with asking price ---
path = 'src/components/vastgoedrekenen/ComponentStrategyTable.tsx'
replace_once(path, """  asking: number | null | undefined;
""", "")
replace_once(path,
"""function ComponentStrategyTable({ units, components, asking, onCreate, onUpdate, onDelete, onImport }: Props) {
  const totals = useMemo(() => aggregateStrategy(units), [units]);
  const hasUnits = units.length > 0;
  const askingPrice = Number(asking ?? 0);""",
"""function ComponentStrategyTable({ units, components, onCreate, onUpdate, onDelete, onImport }: Props) {
  const totals = useMemo(() => aggregateStrategy(units), [units]);
  const hasUnits = units.length > 0;
  const hasSale = totals.grossDevelopmentValue > totals.holdValue;
  const hasHold = totals.holdValue > 0;""")
replace_once(path,
"""      {hasUnits && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Tile label="Behoudwaarde" value={fmtEur(totals.holdValue)} />
          <Tile label="Netto verkoopopbrengst" value={fmtEur(totals.netSaleProceeds)} />
          <Tile label="Totale scenariowaarde" value={fmtEur(totals.scenarioValue)} accent />
          <Tile
            label="Verschil met vraagprijs"
            value={askingPrice > 0 ? `${totals.scenarioValue >= askingPrice ? '+' : '−'} ${fmtEur(Math.abs(totals.scenarioValue - askingPrice))}` : '—'}
            tone={askingPrice > 0 ? (totals.scenarioValue >= askingPrice ? 'positive' : 'negative') : undefined}
          />
        </div>
      )}""",
"""      {hasUnits && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {hasSale && <Tile label="Bruto verkoopwaarde" value={fmtEur(totals.grossDevelopmentValue - totals.holdValue)} />}
          {hasSale && <Tile label="Verkoop- en juridische kosten" value={fmtEur(totals.componentDispositionCosts)} />}
          {hasSale && <Tile label="Netto verkoopopbrengst" value={fmtEur(totals.netSaleProceeds)} />}
          {hasHold && <Tile label="Behoudwaarde" value={fmtEur(totals.holdValue)} />}
          <Tile label="Totale scenariowaarde" value={fmtEur(totals.scenarioValue)} accent />
        </div>
      )}""")

# --- Tests ---
Path('src/test/vastgoedrekenen/acquisitionStructure.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import { computeScenarioOvb } from '@/lib/vastgoedrekenen/ovb';
import type { AcquisitionComponent } from '@/lib/vastgoedrekenen/acquisition';
import type { Scenario } from '@/lib/vastgoedrekenen/types';

const scenario = { purchase_price: 1_850_000, ovb_mode: 'per_component', ovb_classification: 'mixed_use' } as Scenario;

function acquisition(id: string, value: number, classification: AcquisitionComponent['transfer_tax_classification']): AcquisitionComponent {
  return {
    id,
    scenario_id: 'scenario',
    component_name: id,
    component_type: classification === 'niet_woning' ? 'horeca' : 'appartement',
    floor_or_location: null,
    surface_gbo: null,
    surface_vvo: null,
    surface_bvo: null,
    allocated_component_value: value,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: classification,
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    source_note: null,
    reliability_status: null,
    notes: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  };
}

describe('aparte verkrijgingsstructuur', () => {
  it('verdeelt de aankoopprijs exact over huidige verkrijgingscomponenten', () => {
    const result = computeScenarioOvb(scenario, [
      acquisition('horeca', 250_000, 'niet_woning'),
      acquisition('bestaande-woningen', 600_000, 'woning_belegging'),
      acquisition('ontwikkeldeel', 1_000_000, 'woning_belegging'),
    ], null, 'mixed_use');

    expect(result.perComponent.reduce((sum, row) => sum + row.basisValue, 0)).toBe(1_850_000);
    expect(result.totalOvb).toBeGreaterThan(0);
  });

  it('behandelt één vrijgesteld verkrijgingsdeel als één fiscale regel, ongeacht toekomstige unitverdeling', () => {
    const result = computeScenarioOvb(scenario, [
      acquisition('bestaand', 850_000, 'niet_woning'),
      acquisition('ontwikkeldeel', 1_000_000, 'vrijgesteld'),
    ], null, 'mixed_use');

    expect(result.perComponent).toHaveLength(2);
    expect(result.perComponent.find((row) => row.id === 'ontwikkeldeel')?.amount).toBe(0);
  });
});
""")

Path('src/test/ui/acquisitionStructureUx.test.ts').write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('verkrijgingsstructuur UX', () => {
  it('scheidt verkrijging van toekomstige strategie-units', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx');
    expect(table).toContain('Verkrijgingsstructuur & OVB');
    expect(table).toContain('Gekoppelde toekomstige strategie-units');
    expect(table).toContain('Totale berekende OVB');
  });

  it('gebruikt verkrijgingscomponenten als optioneel leidend OVB-pad', () => {
    const compute = source('src/lib/vastgoedrekenen/compute.ts');
    expect(compute).toContain('hasSeparateAcquisitionStructure');
    expect(compute).toContain('ovbComponents');
  });

  it('toont geen misleidend verschil met vraagprijs in de componentstrategie', () => {
    const strategy = source('src/components/vastgoedrekenen/ComponentStrategyTable.tsx');
    expect(strategy).not.toContain('Verschil met vraagprijs');
    expect(strategy).toContain('Bruto verkoopwaarde');
    expect(strategy).toContain('Verkoop- en juridische kosten');
  });
});
""")
