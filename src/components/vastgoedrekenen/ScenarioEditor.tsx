import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Save, CheckCircle2, RotateCw, ListChecks } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import UnitNavigator from './UnitNavigator';
import BulkFillDialog, { type BulkField } from './BulkFillDialog';
import type { Scenario, ScenarioCost, Component, WwsUnit, TaxSettings } from '@/lib/vastgoedrekenen/types';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { computeWwsPoints } from '@/lib/vastgoedrekenen/wws';
import { getWwsUnitStatus, WWS_SOURCE_LABEL, WWS_SCHEME_LABEL, WWS_RELIABILITY_LABEL, WWS_MISSING_LABEL } from '@/lib/vastgoedrekenen/wws/source';
import { suggestWwsMode, getEffectiveWwsMode, WWS_MODE_LABEL, WWS_MODE_DESCRIPTION, type WwsMode } from '@/lib/vastgoedrekenen/wws/mode';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS, VR_OVB_CLASSIFICATION_LABELS, VR_COMPONENT_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { SALE_STRATEGY_LABELS, SALE_FOCUSED_STRATEGIES, SALE_FOCUSED_SALE_STRATEGIES } from '@/lib/vastgoedrekenen/verkoop';
import {
  ASSUMPTION_PROFILE_LABELS, COST_STRUCTURE_LABELS, RENT_SOURCE_LABELS, MJOP_LABELS, RELIABILITY_LABELS,
  mapToAssumptionType, defaultProfileFor, getAssumptionSet,
  type AssumptionProfileKey, type PropertyAssumptionType,
} from '@/lib/vastgoedrekenen/profiles';
import { buildNogTeControleren, buildAannameWaarschuwingen } from '@/lib/vastgoedrekenen/validation';
import HelpTooltip from './HelpTooltip';
import BerekeningUitleg from './BerekeningUitleg';
import RekenbasisBar from './RekenbasisBar';
import NoiOpbouw from './NoiOpbouw';
import NogTeControleren from './NogTeControleren';
import ResultaatKaart from './ResultaatKaart';
import ComponentStrategyTable from './ComponentStrategyTable';
import { Section, SectionGroup, type SectionRelevance } from './Section';
import { fmtEur, fmtPct, fmtEurPerM2 } from './format';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { RawNumberInput, RawTextarea, RawTextInput, numberToRaw, parseRawNumber } from './RawInputs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AuditDialog from './audit/AuditDialog';
import type { AuditInput } from '@/lib/vastgoedrekenen/audit/runAudit';
import ManualZeroToggle from './ManualZeroToggle';
import { readManualZeroFields } from '@/lib/vastgoedrekenen/validation/fieldStatus';
import { formatUnitIdentity } from '@/lib/vastgoedrekenen/unitIdentity';

type Props = {
  scenario: Scenario;
  taxSettings: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectRawType?: string | null;
  viewMode: 'begeleid' | 'compact' | 'expert';
  onUpdate: (id: string, patch: Partial<Scenario>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type Suffix = '€' | '%' | 'm²' | 'maanden';

function NumInput({ value, onChange, onRawChange, placeholder, suffix }: { value: number | null | undefined; onChange: (n: number | null) => void; onRawChange?: (raw: string) => void; placeholder?: string; suffix?: Suffix }) {
  return (
    <RawNumberInput
      initialValue={numberToRaw(value)}
      placeholder={placeholder}
      suffix={suffix}
      className="h-9 w-full min-w-0"
      onRawChange={onRawChange}
      onCommit={(raw) => onChange(parseRawNumber(raw))}
    />
  );
}

/** Numeriek invoerveld + checkbox "Bewust € 0" voor optionele kostenvelden.
 *  Toont leeg wanneer waarde 0 is zonder "Bewust € 0"-marker, zodat default-0
 *  en bewuste 0 niet door elkaar gehaald worden. */
function NumZero({ value, onChange, onRawChange, placeholder, suffix, zeroActive, onZeroToggle }: { value: number | null | undefined; onChange: (n: number | null) => void; onRawChange?: (raw: string) => void; placeholder?: string; suffix?: Suffix; zeroActive: boolean; onZeroToggle: (next: boolean) => void }) {
  const displayValue = Number(value ?? NaN) === 0 && !zeroActive ? null : value;
  return (
    <div className="space-y-1">
      <NumInput value={displayValue} onChange={onChange} onRawChange={onRawChange} placeholder={placeholder ?? 'bijv. — leeg laten of bewust € 0'} suffix={suffix} />
      <ManualZeroToggle active={zeroActive} value={value} onToggle={onZeroToggle} />
    </div>
  );
}

function TextInput({ value, onChange, onRawChange, placeholder, className }: { value: string | null | undefined; onChange: (value: string | null) => void; onRawChange?: (raw: string) => void; placeholder?: string; className?: string }) {
  return (
    <RawTextInput
      initialValue={value ?? ''}
      placeholder={placeholder}
      className={className}
      onRawChange={onRawChange}
      onCommit={(raw) => onChange(raw || null)}
    />
  );
}

function MobileFieldGroup({ label, children, helper, className }: { label: ReactNode; children: ReactNode; helper?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 w-full space-y-1.5 ${className ?? ''}`}>
      <Label className="block text-xs font-medium leading-snug text-foreground whitespace-normal break-words">{label}</Label>
      <div className="min-w-0 w-full [&_input]:w-full [&_input]:min-w-0 [&_[role=combobox]]:w-full [&_[role=combobox]]:min-w-0">
        {children}
      </div>
      {helper && <p className="text-[10px] leading-snug text-muted-foreground whitespace-normal break-words">{helper}</p>}
    </div>
  );
}

function isScenarioShallowEqual(a: Scenario, b: Scenario): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Scenario>;
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function isTempCostId(id: string): boolean {
  return id.startsWith('temp-cost-');
}

function normalizeCost(cost: ScenarioCost) {
  const rec = cost as unknown as Record<string, unknown>;
  return {
    id: cost.id,
    cost_category: cost.cost_category ?? '',
    description: cost.description ?? null,
    amount: Number(cost.amount ?? 0),
    notes: cost.notes ?? null,
    reliability_status: cost.reliability_status ?? null,
    vat_applicable: cost.vat_applicable ?? null,
    calc_mode: (rec.calc_mode as string | null) ?? 'totaal',
    amount_per_m2: rec.amount_per_m2 != null ? Number(rec.amount_per_m2) : null,
    m2_basis: rec.m2_basis != null ? Number(rec.m2_basis) : null,
  };
}


function areScenarioCostsEqual(a: ScenarioCost[], b: ScenarioCost[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a.map(normalizeCost)) === JSON.stringify(b.map(normalizeCost));
}

export default function ScenarioEditor(props: Props) {
  const { scenario, taxSettings, objectType, objectArea, viewMode, onUpdate, onDelete } = props;
  const [s, setS] = useState<Scenario>(scenario);
  const [draftCosts, setDraftCosts] = useState<ScenarioCost[]>([]);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Baseline = laatst opgeslagen / geladen scenario. Wordt gebruikt om te bepalen
  // of het formulier dirty is na een commit (zo wordt revert naar origineel ook gedetecteerd).
  const baselineRef = useRef<Scenario>(scenario);
  const baselineCostsRef = useRef<ScenarioCost[]>([]);
  const costDraftDirtyRef = useRef(false);
  const deletedCostIdsRef = useRef<string[]>([]);
  const lastIdRef = useRef(scenario.id);
  useEffect(() => {
    if (lastIdRef.current !== scenario.id) {
      lastIdRef.current = scenario.id;
      baselineRef.current = scenario;
      setS(scenario);
      baselineCostsRef.current = [];
      costDraftDirtyRef.current = false;
      deletedCostIdsRef.current = [];
      setDraftCosts([]);
      setDirty(false);
    }
  }, [scenario]);

  const { components, costs, wwsUnits, sellOffUnits, loading: childrenLoading, refetch, upsertOutput, createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents } = useScenarioChildren(s.id);

  // Selectie + bulk-fill state voor WWS-units (UX-helpers, geen rekenlogica).
  const [selectedWwsIds, setSelectedWwsIds] = useState<Set<string>>(new Set());
  const [wwsBulkOpen, setWwsBulkOpen] = useState(false);
  function toggleWwsSelect(id: string) {
    setSelectedWwsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (childrenLoading || costDraftDirtyRef.current) return;
    baselineCostsRef.current = costs;
    setDraftCosts(costs);
    setDirty(!isScenarioShallowEqual(s, baselineRef.current));
  }, [childrenLoading, costs, s]);

  const propertyType: PropertyAssumptionType = useMemo(
    () => mapToAssumptionType(props.objectRawType ?? null, objectType),
    [props.objectRawType, objectType],
  );

  const outputs = useMemo(() => computeScenario({
    scenario: s,
    components, costs: draftCosts, wwsUnits,
    taxSettings,
    objectType,
    objectArea,
    objectWoz: props.objectWoz,
    objectEnergyLabel: props.objectEnergyLabel,
    objectBouwjaar: props.objectBouwjaar,
    propertyType,
  }), [s, components, draftCosts, wwsUnits, taxSettings, objectType, objectArea, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, propertyType]);

  const nogTeControleren = useMemo(() => buildNogTeControleren({
    scenario: s, components, costs: draftCosts, wwsUnits, sellOffUnits, objectType, propertyType,
    hasWoz: !!props.objectWoz, hasEnergyLabel: !!props.objectEnergyLabel, hasBouwjaar: !!props.objectBouwjaar,
    energyLabel: props.objectEnergyLabel, dirty,
  }), [s, components, draftCosts, wwsUnits, sellOffUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, dirty]);

  const aannameWaarschuwingen = useMemo(() => buildAannameWaarschuwingen({
    scenario: s, components, costs: draftCosts, wwsUnits, objectType, propertyType,
    hasWoz: !!props.objectWoz, hasEnergyLabel: !!props.objectEnergyLabel, hasBouwjaar: !!props.objectBouwjaar,
    energyLabel: props.objectEnergyLabel,
  }, outputs.totalCorrectionPct), [s, components, draftCosts, wwsUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, outputs.totalCorrectionPct]);

  // Patch = gecommitte wijziging (na blur / select / switch). Dirty wordt afgeleid
  // van een vergelijking met de baseline, zodat reverten naar origineel dirty wist.
  const patch = (p: Partial<Scenario>) => {
    setS((prev) => {
      const next = { ...prev, ...p } as Scenario;
      setDirty(!isScenarioShallowEqual(next, baselineRef.current) || !areScenarioCostsEqual(draftCosts, baselineCostsRef.current));
      return next;
    });
  };

  // Raw input change (per toetsaanslag): markeer direct als dirty, zodat de
  // Opslaan-knop bij de eerste wijziging actief wordt. Bij blur loopt dezelfde
  // wijziging door patch() en wordt dirty opnieuw correct berekend.
  const markDirtyFromRaw = () => {
    setDirty((prev) => (prev ? prev : true));
  };

  // Lijst met velden die door de gebruiker bewust op € 0 zijn gezet.
  // Bron: scenario.manual_zero_fields (jsonb-array). Gebruikt voor expliciete
  // statusbepaling (leeg vs. bewust nul) in audit & validatie.
  const manualZeroSet = useMemo(
    () => readManualZeroFields({ manual_zero_fields: (s as unknown as Record<string, unknown>).manual_zero_fields }),
    [s],
  );
  const isZero = (field: string) => manualZeroSet.has(field);
  const toggleZero = (field: keyof Scenario) => (on: boolean) => {
    const cur = new Set(manualZeroSet);
    if (on) cur.add(String(field)); else cur.delete(String(field));
    const next: Record<string, unknown> = {
      manual_zero_fields: Array.from(cur),
      [field]: on ? 0 : null,
    };
    patch(next as Partial<Scenario>);
  };

  const setCostDrafts = (updater: (prev: ScenarioCost[]) => ScenarioCost[], forceDirty = false) => {
    costDraftDirtyRef.current = true;
    setDraftCosts((prev) => {
      const next = updater(prev);
      const costsDirty = !areScenarioCostsEqual(next, baselineCostsRef.current);
      costDraftDirtyRef.current = forceDirty || costsDirty;
      if (!costsDirty) deletedCostIdsRef.current = [];
      setDirty(!isScenarioShallowEqual(s, baselineRef.current) || forceDirty || costsDirty);
      return next;
    });
  };

  // Aannameprofiel default zetten als er nog niets is — niet markeren als dirty.
  useEffect(() => {
    if (!s.assumption_profile) {
      const def = defaultProfileFor(propertyType, s.strategy_type);
      setS((prev) => ({ ...prev, assumption_profile: def }));
      baselineRef.current = { ...baselineRef.current, assumption_profile: def };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType]);

  async function save() {
    const savedCosts: ScenarioCost[] = [];
    for (const costId of deletedCostIdsRef.current) {
      if (!isTempCostId(costId)) {
        const { error } = await supabase.from('scenario_costs').delete().eq('id', costId);
        if (error) { toast.error('Kostenpost verwijderen mislukt'); return; }
      }
    }
    for (const cost of draftCosts) {
      const rec = cost as unknown as Record<string, unknown>;
      const payload = {
        scenario_id: s.id,
        cost_category: cost.cost_category || 'Kostenpost',
        description: cost.description,
        amount: Number(cost.amount ?? 0),
        notes: cost.notes,
        reliability_status: cost.reliability_status,
        vat_applicable: cost.vat_applicable,
        calc_mode: ((rec.calc_mode as string | null) ?? 'totaal'),
        amount_per_m2: (rec.amount_per_m2 as number | null) ?? null,
        m2_basis: (rec.m2_basis as number | null) ?? null,
      };

      if (isTempCostId(cost.id)) {
        const { data, error } = await supabase.from('scenario_costs').insert(payload).select('*').single();
        if (error) { toast.error('Kostenpost opslaan mislukt'); return; }
        if (data) savedCosts.push(data as ScenarioCost);
      } else {
        const { error } = await supabase.from('scenario_costs').update(payload).eq('id', cost.id);
        if (error) { toast.error('Kostenpost opslaan mislukt'); return; }
        savedCosts.push(cost);
      }
    }

    await onUpdate(s.id, {
      scenario_name: s.scenario_name, description: s.description, status: s.status, strategy_type: s.strategy_type,
      asking_price: s.asking_price, purchase_price: s.purchase_price,
      ovb_mode: s.ovb_mode, ovb_classification: s.ovb_classification, transfer_tax_percentage: s.transfer_tax_percentage, transfer_tax_amount: s.transfer_tax_amount,
      buyer_fee_percentage: s.buyer_fee_percentage, notary_costs: s.notary_costs, advisory_costs: s.advisory_costs, due_diligence_costs: s.due_diligence_costs, other_acquisition_costs: s.other_acquisition_costs, safety_margin: s.safety_margin,
      vacancy_percentage: s.vacancy_percentage, operating_cost_percentage: s.operating_cost_percentage, maintenance_reserve_percentage: s.maintenance_reserve_percentage, management_cost_percentage: s.management_cost_percentage,
      other_annual_costs: s.other_annual_costs, current_monthly_rent: s.current_monthly_rent, market_monthly_rent: s.market_monthly_rent, manual_corrected_monthly_rent: s.manual_corrected_monthly_rent, rent_choice: s.rent_choice,
      target_bar: s.target_bar, financing_costs: s.financing_costs, unforeseen_percentage: s.unforeseen_percentage,
      notes: s.notes,
      assumption_profile: s.assumption_profile, assumption_profile_reason: s.assumption_profile_reason,
      assumptions_manual: s.assumptions_manual, assumptions_source: s.assumptions_source, assumptions_reliability: s.assumptions_reliability,
      ...({ manual_zero_fields: (s as unknown as Record<string, unknown>).manual_zero_fields ?? [] } as Partial<Scenario>),
      cost_structure: s.cost_structure, incentive_reserve: s.incentive_reserve,
      mjop_present: s.mjop_present, contract_checked: s.contract_checked, service_costs_checked: s.service_costs_checked,
      rent_source: s.rent_source,
      // Verkoop / exit (nullable kolommen)
      ...((s as Record<string, unknown>) && {
        sale_strategy: (s as Record<string, unknown>).sale_strategy ?? null,
        sale_price_total: (s as Record<string, unknown>).sale_price_total ?? null,
        sale_price_per_m2: (s as Record<string, unknown>).sale_price_per_m2 ?? null,
        sale_price_per_unit: (s as Record<string, unknown>).sale_price_per_unit ?? null,
        sale_units_count: (s as Record<string, unknown>).sale_units_count ?? null,
        sale_sellable_m2: (s as Record<string, unknown>).sale_sellable_m2 ?? null,
        sale_costs_percentage: (s as Record<string, unknown>).sale_costs_percentage ?? null,
        sale_other_costs: (s as Record<string, unknown>).sale_other_costs ?? null,
        sale_exit_value_manual: (s as Record<string, unknown>).sale_exit_value_manual ?? null,
        sale_target_margin_amount: (s as Record<string, unknown>).sale_target_margin_amount ?? null,
        sale_target_margin_percentage: (s as Record<string, unknown>).sale_target_margin_percentage ?? null,
        sale_target_roi_percentage: (s as Record<string, unknown>).sale_target_roi_percentage ?? null,
        sale_target_exit_value: (s as Record<string, unknown>).sale_target_exit_value ?? null,
        sale_expected_period_months: (s as Record<string, unknown>).sale_expected_period_months ?? null,
        bid_basis: (s as Record<string, unknown>).bid_basis ?? null,
        sale_price_source: (s as Record<string, unknown>).sale_price_source ?? null,
        leading_valuation_track: (s as Record<string, unknown>).leading_valuation_track ?? 'auto',
      }) as Partial<Scenario>,

    });
    await upsertOutput({
      total_transfer_tax: outputs.totalTransferTax,
      total_acquisition_costs: outputs.totalAcquisitionCosts,
      total_costs: outputs.totalCosts,
      total_investment: outputs.totalInvestment,
      current_annual_rent: outputs.currentAnnualRent,
      market_annual_rent: outputs.marketAnnualRent,
      wws_corrected_annual_rent: outputs.wwsCorrectedAnnualRent,
      corrected_annual_rent: outputs.correctedAnnualRent,
      noi: outputs.noi,
      price_per_m2_gbo: outputs.pricePerM2Gbo,
      bar_purchase_price: outputs.barPurchasePrice,
      bar_total_investment: outputs.barTotalInvestment,
      factor_purchase_price: outputs.factorPurchasePrice,
      factor_total_investment: outputs.factorTotalInvestment,
      maximum_all_in_value: outputs.maximumAllInValue,
      maximum_bid: outputs.maximumBid,
      conservative_bid: outputs.conservativeBid,
      realistic_bid: outputs.realisticBid,
      aggressive_bid: outputs.aggressiveBid,
      not_interesting_above: outputs.notInterestingAbove,
      difference_with_asking_price: outputs.differenceWithAskingPrice,
      required_discount: outputs.requiredDiscount,
      deal_score: outputs.dealScore,
      risk_score: outputs.riskScore,
      complexity_score: outputs.complexityScore,
      input_reliability: outputs.inputReliability,
      conclusion: outputs.conclusion,
      recommended_next_step: outputs.recommendedNextStep,
      warnings: outputs.warnings as unknown as never,
      exit_value: outputs.exitValue,
      profit: outputs.netMargin,
      profit_margin: outputs.roi,
    });
    deletedCostIdsRef.current = [];
    costDraftDirtyRef.current = false;
    baselineRef.current = s;
    baselineCostsRef.current = savedCosts;
    setDraftCosts(savedCosts);
    setDirty(false);
    setLastSavedAt(new Date());
    toast.success('Scenario opgeslagen');
    refetch();
  }

  // --- Component CRUD ---
  async function addComponent() {
    await supabase.from('calculation_components').insert({
      scenario_id: s.id, component_name: 'Nieuw component', component_type: 'woning',
    });
    refetch();
  }
  async function updateComponent(id: string, p: Partial<Component>) {
    await supabase.from('calculation_components').update(p).eq('id', id); refetch();
  }
  async function deleteComponent(id: string) {
    await supabase.from('calculation_components').delete().eq('id', id); refetch();
  }

  // --- Cost CRUD ---
  function addCost() {
    const now = new Date().toISOString();
    setCostDrafts((prev) => ([...prev, {
      id: `temp-cost-${crypto.randomUUID()}`,
      scenario_id: s.id,
      cost_category: 'Renovatiekosten',
      description: null,
      amount: 0,
      notes: null,
      reliability_status: null,
      vat_applicable: null,
      created_at: now,
      updated_at: now,
      calc_mode: 'totaal',
      amount_per_m2: null,
      m2_basis: objectArea ?? null,
    } as unknown as ScenarioCost]));

  }
  function updateCost(id: string, p: Partial<ScenarioCost>, forceDirty = false) {
    setCostDrafts((prev) => prev.map((cost) => (cost.id === id ? { ...cost, ...p } as ScenarioCost : cost)), forceDirty);
  }
  function deleteCost(id: string) {
    if (!isTempCostId(id) && !deletedCostIdsRef.current.includes(id)) deletedCostIdsRef.current.push(id);
    setCostDrafts((prev) => prev.filter((cost) => cost.id !== id));
  }

  // --- WWS Unit CRUD ---
  // Helper: bereken WWS-puntenpayload voor een (deels) gevulde unit, zodat
  // geen unit zonder stille NULL-punten in de database belandt.
  function wwsExtras(u: Partial<WwsUnit>): Partial<WwsUnit> {
    const res = computeWwsPoints(u as WwsUnit, Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6));
    return {
      wws_points: res.punten,
      wws_max_monthly_rent: res.maxMonthlyRent,
      wws_max_annual_rent: res.maxAnnualRent,
      rent_segment: res.segment,
    };
  }
  async function addWwsUnit() {
    const base: Partial<WwsUnit> = { scenario_id: s.id, unit_name: 'Nieuwe woonunit', independent_unit: true };
    await supabase.from('residential_wws_units').insert({ ...base, ...wwsExtras(base) } as never);
    refetch();
  }
  async function updateWwsUnit(id: string, p: Partial<WwsUnit>) {
    const unit = wwsUnits.find((u) => u.id === id);
    let extra: Partial<WwsUnit> = {};
    if (unit) {
      const merged = { ...unit, ...p } as WwsUnit;
      const res = computeWwsPoints(merged, Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6));
      extra = {
        wws_points: res.punten,
        wws_max_monthly_rent: res.maxMonthlyRent,
        wws_max_annual_rent: res.maxAnnualRent,
        rent_segment: res.segment,
      };
    }
    await supabase.from('residential_wws_units').update({ ...p, ...extra }).eq('id', id);
    refetch();
  }
  // Veilige bulk-recompute: vult ontbrekende wws_points op basis van V1-logica.
  // Slaat units met handmatig overschreven punten (stored != computed > 1)
  // bewust over zodat geen expliciete keuze van de gebruiker verloren gaat.
  async function recomputeAllWwsUnits() {
    if (wwsUnits.length === 0) { toast.info('Geen WWS-units om te herberekenen.'); return; }
    let recomputed = 0;
    let skippedManual = 0;
    let missingInput = 0;
    const failures: string[] = [];
    for (const u of wwsUnits) {
      const status = getWwsUnitStatus(u, { euroPerPoint: Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6) });
      if (status.source === 'handmatig') { skippedManual += 1; continue; }
      const extras = wwsExtras(u);
      const { error } = await supabase.from('residential_wws_units').update(extras as never).eq('id', u.id);
      if (error) { failures.push(u.unit_name ?? u.id); continue; }
      recomputed += 1;
      // Tel units waarbij ondersteunende velden ontbreken (excl. de "punten" missing zelf).
      const stillMissing = status.missing.filter((m) => m !== 'punten');
      if (stillMissing.length > 0) missingInput += 1;
    }
    const parts = [
      `${recomputed} herberekend`,
      skippedManual > 0 ? `${skippedManual} overgeslagen (handmatig)` : null,
      missingInput > 0 ? `${missingInput} met ontbrekende input` : null,
    ].filter(Boolean).join(' · ');
    if (recomputed > 0) toast.success(`WWS-units bijgewerkt: ${parts}`);
    else toast.info(`Geen units bijgewerkt: ${parts}`);
    for (const f of failures) toast.error(`WWS-unit ${f}: bijwerken mislukt`);
    refetch();
  }

  // Herbereken één specifieke unit. Skipt unit als punten handmatig zijn overschreven.
  async function recomputeWwsUnit(id: string): Promise<'updated' | 'skipped' | 'error'> {
    const u = wwsUnits.find((x) => x.id === id);
    if (!u) return 'error';
    const status = getWwsUnitStatus(u, { euroPerPoint: Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6) });
    if (status.source === 'handmatig') { toast.info(`${u.unit_name}: handmatige punten — niet automatisch overschreven.`); return 'skipped'; }
    const { error } = await supabase.from('residential_wws_units').update(wwsExtras(u) as never).eq('id', id);
    if (error) { toast.error(`${u.unit_name}: bijwerken mislukt`); return 'error'; }
    toast.success(`${u.unit_name} herberekend.`);
    refetch();
    return 'updated';
  }

  // Herbereken alleen geselecteerde units.
  async function recomputeSelectedWwsUnits() {
    if (selectedWwsIds.size === 0) { toast.info('Geen units geselecteerd.'); return; }
    const epp = Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6);
    let updated = 0, skipped = 0, missing = 0, errors = 0;
    for (const id of selectedWwsIds) {
      const u = wwsUnits.find((x) => x.id === id);
      if (!u) continue;
      const status = getWwsUnitStatus(u, { euroPerPoint: epp });
      if (status.source === 'handmatig') { skipped += 1; continue; }
      const { error } = await supabase.from('residential_wws_units').update(wwsExtras(u) as never).eq('id', id);
      if (error) { errors += 1; continue; }
      updated += 1;
      if (status.missing.filter((m) => m !== 'punten').length > 0) missing += 1;
    }
    const parts = [
      `${updated} herberekend`,
      skipped > 0 ? `${skipped} overgeslagen (handmatig)` : null,
      missing > 0 ? `${missing} met ontbrekende input` : null,
      errors > 0 ? `${errors} fout(en)` : null,
    ].filter(Boolean).join(' · ');
    if (updated > 0) toast.success(`Geselecteerd: ${parts}`);
    else toast.info(`Geselecteerd: ${parts}`);
    refetch();
  }

  async function deleteWwsUnit(id: string) {
    await supabase.from('residential_wws_units').delete().eq('id', id); refetch();
  }

  async function createWwsFromComponents() {
    const woon = components.filter((c) => c.component_type === 'woning' || c.component_type === 'appartement');
    if (woon.length === 0) { toast.error('Geen wooncomponenten gevonden om WWS-units uit aan te maken.'); return; }

    // Skip wooncomponenten die al een WWS-unit hebben via component_id, zodat
    // de knop idempotent is en geen duplicaten aanmaakt.
    const reeds = new Set(
      wwsUnits.map((u) => (u as unknown as { component_id?: string | null }).component_id ?? '').filter(Boolean),
    );
    const teImporteren = woon.filter((c) => !reeds.has(c.id));
    if (teImporteren.length === 0) {
      toast.info('Alle wooncomponenten zijn al als WWS-unit aanwezig.');
      return;
    }

    // Fallback-helpers volgens specificatie.
    const pickSurface = (c: Component): { value: number | null; bron: 'gbo' | 'vvo' | 'bvo' | null } => {
      const gbo = Number(c.surface_gbo ?? 0);
      if (gbo > 0) return { value: gbo, bron: 'gbo' };
      const vvo = Number(c.surface_vvo ?? 0);
      if (vvo > 0) return { value: vvo, bron: 'vvo' };
      const bvo = Number(c.surface_bvo ?? 0);
      if (bvo > 0) return { value: bvo, bron: 'bvo' };
      return { value: null, bron: null };
    };
    const pickMonthlyRent = (c: Component): number | null => {
      const cm = Number(c.current_monthly_rent ?? 0);
      if (cm > 0) return cm;
      const ca = Number(c.current_annual_rent ?? 0);
      if (ca > 0) return Math.round(ca / 12);
      const mm = Number(c.market_monthly_rent ?? 0);
      if (mm > 0) return mm;
      const ma = Number(c.market_annual_rent ?? 0);
      if (ma > 0) return Math.round(ma / 12);
      return null;
    };

    const successes: string[] = [];
    const failures: Array<{ name: string; message: string }> = [];
    let missingSurface = 0;
    let missingRent = 0;
    let missingWoz = 0;
    let missingLabel = 0;

    for (const c of teImporteren) {
      const label = c.component_name?.trim() || 'Naamloze wooncomponent';
      const surface = pickSurface(c);
      const monthlyRent = pickMonthlyRent(c);
      const cRec = c as unknown as Record<string, unknown>;
      const energyLabel = (cRec.energy_label as string | null) ?? props.objectEnergyLabel ?? null;
      const woz = (cRec.woz_value as number | null) ?? props.objectWoz ?? null;
      const notes = (cRec.notes as string | null) ?? null;
      const floor = c.floor_or_location ?? null;

      const payload: Record<string, unknown> = {
        scenario_id: s.id,
        component_id: c.id,
        unit_name: label,
        living_area_m2: surface.value,
        current_monthly_rent: monthlyRent,
        woz_value: woz,
        energy_label: energyLabel,
        independent_unit: true,
        floor,
        notes,
      };
      // Bereken meteen WWS-punten zodat de unit niet als stille NULL in de DB belandt.
      Object.assign(payload, wwsExtras(payload as Partial<WwsUnit>));

      const { error } = await supabase.from('residential_wws_units').insert(payload as never);
      if (error) {
        failures.push({ name: label, message: error.message });
        continue;
      }
      successes.push(label);
      if (!surface.value) missingSurface += 1;
      if (!monthlyRent) missingRent += 1;
      if (!woz) missingWoz += 1;
      if (!energyLabel) missingLabel += 1;
    }

    if (successes.length > 0) {
      toast.success(`${successes.length} WWS-unit(s) aangemaakt uit wooncomponenten.`);
    }
    for (const f of failures) {
      toast.error(`WWS-unit ${f.name}: ${f.message}`);
    }
    const aanvullen: string[] = [];
    if (missingSurface > 0) aanvullen.push(`bij ${missingSurface} WWS-unit(s) ontbreekt woonoppervlakte`);
    if (missingRent > 0) aanvullen.push(`bij ${missingRent} WWS-unit(s) ontbreekt huur`);
    if (missingWoz > 0) aanvullen.push(`bij ${missingWoz} WWS-unit(s) ontbreekt WOZ`);
    if (missingLabel > 0) aanvullen.push(`bij ${missingLabel} WWS-unit(s) ontbreekt energielabel`);
    if (aanvullen.length > 0) {
      toast.warning(`Aanvullen aanbevolen:\n• ${aanvullen.join('\n• ')}`);
    }
    refetch();
  }

  function applyProfile(profile: AssumptionProfileKey) {
    const set = getAssumptionSet(propertyType, profile);
    if (set) {
      patch({
        assumption_profile: profile,
        vacancy_percentage: set.vacancy_percentage,
        operating_cost_percentage: set.operating_cost_percentage,
        maintenance_reserve_percentage: set.maintenance_reserve_percentage,
        management_cost_percentage: set.management_cost_percentage,
        assumptions_manual: false,
      });
    } else {
      patch({ assumption_profile: 'handmatig', assumptions_manual: true });
    }
  }

  const showHelp = viewMode === 'begeleid';
  const ovbMode = s.ovb_mode;
  const rentSource = (s.rent_source ?? 'handmatig') as keyof typeof RENT_SOURCE_LABELS;
  const rentFromComponents = rentSource === 'componenten';

  return (
    <div className="space-y-4">
      {/* Header + opslagstatus */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <TextInput value={s.scenario_name} onRawChange={markDirtyFromRaw} onChange={(value) => patch({ scenario_name: value ?? '' })} className="font-semibold text-base w-full" />
              {showHelp && <p className="text-xs text-muted-foreground mt-1">Geef het scenario een korte, herkenbare naam.</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto min-w-0">
              <Select value={s.strategy_type} onValueChange={(v) => patch({ strategy_type: v as Scenario['strategy_type'] })}>
                <SelectTrigger className="h-9 w-full lg:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={s.status} onValueChange={(v) => patch({ status: v as Scenario['status'] })}>
                <SelectTrigger className="h-9 w-full lg:w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="default" onClick={save} disabled={!dirty} className="w-full lg:w-auto">
                <Save className="h-4 w-4 mr-1" />Opslaan
              </Button>
              <AuditDialog
                buildInput={(): AuditInput => ({
                  scenario: s, components, costs: draftCosts, wwsUnits, strategyUnits: sellOffUnits,
                  taxSettings, objectType, objectArea,
                  objectWoz: props.objectWoz, objectEnergyLabel: props.objectEnergyLabel, objectBouwjaar: props.objectBouwjaar,
                  objectTitle: null, objectAddress: null, objectAskingPrice: null,
                  propertyType, dirty, hasUnsavedCosts: costDraftDirtyRef.current,
                  uiOutputs: outputs,
                })}
              />
              <Button variant="outline" size="icon" onClick={() => onDelete(s.id)} className="justify-self-end"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
            {dirty ? (
              <span className="text-amber-700 dark:text-amber-300">● Wijzigingen niet opgeslagen</span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Opgeslagen</span>
            )}
            {lastSavedAt && <span className="text-muted-foreground">Laatst opgeslagen: {lastSavedAt.toLocaleTimeString('nl-NL')}</span>}
            <span className="text-muted-foreground hidden sm:inline">Berekeningen live bijgewerkt</span>
          </div>
        </CardHeader>

      </Card>

      {/* Rekenbasis */}
      <RekenbasisBar scenario={s} outputs={outputs} />

      {/* Strategie-specifieke banner */}
      {(s.strategy_type === 'transformeren' || s.strategy_type === 'buy_transform_hold' || s.strategy_type === 'buy_transform_sell') && (
        <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs text-orange-900 dark:text-orange-200">
          Bij transformatie is lopende huur vaak niet leidend. De waarde zit vooral in toekomstige huur, verkoopwaarde, vergunning, bouwkosten, fasering en exit.
        </div>
      )}
      {(s.strategy_type === 'uitponden' || s.strategy_type === 'verkoop_per_unit' || s.strategy_type === 'buy_split_sell') && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-900 dark:text-blue-200">
          Bij uitponden is de netto verkoopopbrengst leidend. NOI is ondersteunend, maar niet de primaire waarderingsmethode.
        </div>
      )}

      {/* ===== Smart accordions ===== */}
      {(() => {
        const exploitatie = outputs.assessmentType === 'exploitatie';
        const verkoop = !exploitatie;
        const isMixed = objectType === 'mixed_use';
        const hasResidential = wwsUnits.length > 0
          || components.some((c) => c.component_type === 'woning' || c.component_type === 'appartement')
          || propertyType === 'residentieel' || propertyType === 'mixed_use';
        

        // === Status- + relevance/source-helpers per sectie (presentatie only) ===
        const rec = s as unknown as Record<string, unknown>;
        const saleStrategyRaw = (rec.sale_strategy as string | null) ?? 'geen_verkoop';
        const scenarioExitActive = saleStrategyRaw !== 'geen_verkoop';
        const strategyActive = sellOffUnits.length > 0;
        const leadingBasis = outputs.leadingMaxBasis; // 'huur' | 'verkoop' | 'strategie'
        const blockerCount = nogTeControleren.filter((i) => i.level === 'blocker').length;
        const warningCount = nogTeControleren.filter((i) => i.level === 'warning').length;

        // Sectie-relevance
        const huurRelevance: SectionRelevance =
          leadingBasis === 'huur' ? 'leidend' : exploitatie ? 'informatief' : 'niet_relevant';
        const verkoopRelevance: SectionRelevance =
          leadingBasis === 'verkoop' ? 'leidend' : scenarioExitActive ? 'informatief' : 'niet_relevant';
        const strategyRelevance: SectionRelevance =
          leadingBasis === 'strategie' ? 'leidend' : strategyActive ? 'informatief' : 'niet_relevant';
        const wwsHasWarnings = wwsUnits.length > 0 && (() => {
          // Tel units waarvan WWS-status indicatief/incompleet is.
          let warn = 0;
          for (const u of wwsUnits) {
            const st = getWwsUnitStatus(u as unknown as WwsUnit);
            if (st.reliability !== 'volledig') warn++;
          }
          return warn;
        })();
        const wwsRelevance: SectionRelevance =
          (hasResidential || wwsUnits.length > 0)
            ? (wwsHasWarnings ? 'aandacht' : 'informatief')
            : 'niet_relevant';
        const compRelevance: SectionRelevance =
          components.length > 0 ? (isMixed ? 'leidend' : 'informatief') : 'niet_relevant';

        // OVB samenvatting voor Aankoop-header
        const ovbPctTxt = (() => {
          const mode = (rec.ovb_mode as string | null) ?? 'auto';
          if (mode === 'per_component') return 'per component';
          if (mode === 'manual') return 'handmatig';
          const pct = Number(s.transfer_tax_percentage ?? 0);
          return pct > 0 ? `${pct.toFixed(1)}%` : '—';
        })();

        // Componenten-samenvatting (woningen vs commercieel)
        const compWonen = components.filter((c) => c.component_type === 'woning' || c.component_type === 'appartement').length;
        const compCommercieel = components.filter((c) => c.component_type && c.component_type !== 'woning' && c.component_type !== 'appartement').length;
        const compWarnings = outputs.ovbPerComponent.filter((p) => p.missingValueBasis || p.missingStrategyBasis || p.missingManualAmount).length;

        // Strategie netto contributie
        const strategyNet = outputs.scenarioValue || 0;

        // Statuses
        const aankoopStatus = `Investering ${fmtEur(outputs.totalInvestment)} · OVB ${fmtEur(outputs.totalTransferTax)} (${ovbPctTxt})`;
        const huurStatus = exploitatie
          ? `NOI ${fmtEur(outputs.noi)} · BAR TI ${fmtPct(outputs.barTotalInvestment)}`
          : 'Niet leidend voor dit verkoopscenario';
        const verkoopStatus = outputs.netSaleProceeds != null
          ? `Netto opbr. ${fmtEur(outputs.netSaleProceeds)}${outputs.roi != null ? ` · ROI ${outputs.roi.toFixed(1)}%` : ''}`
          : (scenarioExitActive ? 'Strategie gekozen, geen bedrag' : 'Geen verkoopdata');
        const kostenStatus = `${fmtEur(outputs.totalCosts)} incl. onvoorzien & btw`;
        const onderbouwingStatus = `${nogTeControleren.length} aandachtspunt(en) · betrouwbaarheid ${outputs.inputReliability}`;
        const compStatus = components.length === 0
          ? 'Geen componenten'
          : `${components.length} unit(s)${compWonen ? ` · ${compWonen} wonen` : ''}${compCommercieel ? ` · ${compCommercieel} commercieel` : ''}${compWarnings ? ` · ${compWarnings} waarschuwing${compWarnings === 1 ? '' : 'en'}` : ''}`;
        const wwsStatus = wwsUnits.length === 0
          ? 'Geen woonunits'
          : `${wwsUnits.length} woonunit(s)${wwsHasWarnings ? ` · ${wwsHasWarnings} indicatief/onvolledig` : ' · volledig'}`;
        const strategyStatus = sellOffUnits.length === 0
          ? 'Geen units'
          : `${sellOffUnits.length} unit(s) · netto ${fmtEur(strategyNet)}${outputs.roundsAtAsking != null ? (outputs.roundsAtAsking ? ' · OK' : ' · tekort') : ''}`;
        const scoreStatus = `${outputs.scoreLabel}`;
        const notitiesStatus = s.notes ? '1 notitie' : 'Geen notities';

        // Default open-heuristiek: open bij waarschuwingen/blockers of als de sectie leidend is
        const aankoopOpen = true; // altijd open — kerninvoer
        const huurOpen = exploitatie || huurRelevance === 'leidend';
        const verkoopOpen = verkoop || verkoopRelevance === 'leidend';
        const kostenOpen = draftCosts.length > 0 || outputs.totalCosts > 0;
        const compOpen = isMixed || compWarnings > 0 || compRelevance === 'leidend';
        const wwsOpen = wwsRelevance === 'aandacht';
        const strategyOpen = strategyActive;
        const onderbouwingOpen = blockerCount > 0 || warningCount > 0;



        return (
          <div className="space-y-3">
            {/* Scenario-cockpit: rekenspoor-indicator + leidende-spoor selector — direct boven het resultaat */}
            {(() => {
              const sr = s as unknown as Record<string, unknown>;
              const trackChoice = (sr.leading_valuation_track as string | null) ?? 'auto';
              const strategyActive = sellOffUnits.length > 0;
              const saleStrategyRaw = (sr.sale_strategy as string | null) ?? 'geen_verkoop';
              const scenarioExitActive = saleStrategyRaw !== 'geen_verkoop';

              // Rekenspoor (A scenario-level / B componentgedreven / C hybride).
              // Heuristiek puur visueel — geen rekenlogica.
              const sellStrats = new Set(['verkopen_leeg', 'verkopen_verhuurd', 'renoveren_verkopen', 'splitsen_verkopen', 'transformeren_verkopen']);
              const holdStrats = new Set(['aanhouden', 'renoveren_aanhouden', 'transformeren_aanhouden']);
              let hasSell = false, hasHold = false;
              for (const u of sellOffUnits) {
                const st = String((u as unknown as Record<string, unknown>).strategy ?? '');
                if (sellStrats.has(st)) hasSell = true;
                if (holdStrats.has(st)) hasHold = true;
              }
              const trackMode: 'scenario' | 'component' | 'hybride' =
                !strategyActive ? 'scenario' : (hasSell && hasHold) ? 'hybride' : 'component';
              const trackModeLabel = trackMode === 'scenario'
                ? 'Scenario-level rekenen'
                : trackMode === 'hybride' ? 'Hybride (sell + hold)' : 'Componentgedreven';
              const trackModeHint = trackMode === 'scenario'
                ? 'Geen componentstrategie ingericht — uitkomst komt uit scenario-velden (huur/BAR of verkoop/exit).'
                : trackMode === 'hybride'
                  ? 'Sommige units worden verkocht, andere aangehouden — componentstrategie is meestal leidend.'
                  : 'Units worden uniform behandeld — componentstrategie kan leidend zijn.';
              const trackModeCls = trackMode === 'scenario'
                ? 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-900/40 dark:text-slate-200'
                : trackMode === 'hybride'
                  ? 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-900/30 dark:text-violet-200'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200';

              const conflictUnresolved = trackChoice === 'auto' && strategyActive && scenarioExitActive;
              const containerCls = conflictUnresolved
                ? 'rounded-md border-2 border-amber-500/70 bg-amber-500/10 p-3 space-y-2'
                : 'rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2';

              return (
                <div className={containerCls}>
                  {/* Regel 1: rekenspoor-indicator */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Rekenspoor</span>
                    <span className={`px-2 py-0.5 rounded-full border ${trackModeCls}`}>{trackModeLabel}</span>
                    <span className="text-[11px] text-muted-foreground">{trackModeHint}</span>
                  </div>

                  {/* Regel 2: leidend-spoor selector */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">Scenario-uitkomst gebaseerd op:</span>
                    <Select
                      value={trackChoice}
                      onValueChange={(v) => {
                        patch({ leading_valuation_track: v } as unknown as Partial<Scenario>);
                        const label = v === 'huur_bar' ? 'Huur / BAR'
                          : v === 'scenario_exit' ? 'Scenario-level verkoop / exit'
                          : v === 'componentstrategie' ? 'Componentstrategie'
                          : 'Automatisch';
                        toast.success(`Scenario-uitkomst bijgewerkt op basis van ${label}.`);
                      }}
                    >
                      <SelectTrigger className="h-7 w-auto min-w-[260px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatisch (heuristiek)</SelectItem>
                        <SelectItem value="huur_bar">Huur / BAR</SelectItem>
                        <SelectItem value="scenario_exit" disabled={!scenarioExitActive}>
                          Scenario-level verkoop / exit{!scenarioExitActive ? ' — geen exit ingevuld' : ''}
                        </SelectItem>
                        <SelectItem value="componentstrategie" disabled={!strategyActive}>
                          Componentstrategie (per unit){!strategyActive ? ' — geen units' : ''}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[11px] text-muted-foreground">
                      Huidig leidend: <span className="text-foreground font-medium">{outputs.leadingMaxBasisLabel}</span>
                    </span>
                  </div>

                  {/* Regel 3 (alleen bij conflict): expliciete keuze vragen */}
                  {conflictUnresolved && (
                    <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                      <p className="font-medium mb-1">Kies expliciet welk spoor leidend is</p>
                      <p>
                        Zowel scenario-level verkoop/exit ({saleStrategyRaw}) als componentstrategie
                        ({sellOffUnits.length} unit{sellOffUnits.length === 1 ? '' : 's'}) zijn ingevuld.
                        De automatische heuristiek kan misleidend zijn — kies hierboven het leidende
                        spoor, of zet de verkoopstrategie op "Geen verkoop" als componentstrategie
                        leidend moet zijn.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 1. Resultaat & biedingsadvies — altijd zichtbaar bovenaan */}
            <ResultaatKaart o={outputs} s={s} />


            {/* 2. Aankoop & investering */}
            <SectionGroup step={2} title="Aankoop & uitgangspunten" hint="Vraagprijs, beoogde aankoop, OVB, financiering" />
            <Section title="Aankoop & investering" status={aankoopStatus} defaultOpen={aankoopOpen} source="Scenario" relevance="leidend">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0 pt-3">
                <MobileFieldGroup label="Vraagprijs (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.asking_price} onChange={(v) => patch({ asking_price: v })} placeholder="bijv. 1625000" suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Beoogde aankoopprijs (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.purchase_price} onChange={(v) => patch({ purchase_price: v })} placeholder="bijv. 1500000" suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Veiligheidsmarge (€)"><NumZero onRawChange={markDirtyFromRaw} value={s.safety_margin} onChange={(v) => patch({ safety_margin: v })} placeholder="bijv. 25000" suffix="€" zeroActive={isZero('safety_margin')} onZeroToggle={toggleZero('safety_margin')} /></MobileFieldGroup>

                <MobileFieldGroup label={<span className="inline-flex flex-wrap items-center gap-1 min-w-0">OVB-classificatie {showHelp && <HelpTooltip text="Bij woningen die niet als hoofdverblijf worden gebruikt geldt standaard 8%. Bij niet-woningen 10,4%. Mixed-use: kies per component." />}</span>}>
                  <Select value={s.ovb_classification} onValueChange={(v) => patch({ ovb_classification: v as Scenario['ovb_classification'] })}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(VR_OVB_CLASSIFICATION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </MobileFieldGroup>
                <MobileFieldGroup label="OVB-modus">
                  <Select value={s.ovb_mode} onValueChange={(v) => patch({ ovb_mode: v as Scenario['ovb_mode'] })}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatisch</SelectItem>
                      <SelectItem value="per_component">Per component</SelectItem>
                      <SelectItem value="manual">Handmatig</SelectItem>
                    </SelectContent>
                  </Select>
                </MobileFieldGroup>
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Berekende OVB</p>
                  <p className="text-sm font-semibold font-mono-data">{fmtEur(outputs.totalTransferTax)}</p>
                </div>

                {ovbMode === 'manual' && (
                  <>
                    <MobileFieldGroup label="OVB-percentage handmatig (%)"><NumInput onRawChange={markDirtyFromRaw} value={s.transfer_tax_percentage} onChange={(v) => patch({ transfer_tax_percentage: v })} placeholder="bijv. 8" suffix="%" /></MobileFieldGroup>
                    <MobileFieldGroup label="OVB-bedrag handmatig (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.transfer_tax_amount} onChange={(v) => patch({ transfer_tax_amount: v })} placeholder="bijv. 130000" suffix="€" /></MobileFieldGroup>
                    <div className="col-span-full text-xs text-amber-700 dark:text-amber-300">⚠ OVB is handmatig overschreven. Controleer dit bij twijfel met notaris/fiscalist.</div>
                  </>
                )}
                {ovbMode === 'per_component' && (
                  <div className="col-span-full text-xs text-muted-foreground">OVB wordt per component berekend. Stel waarde en classificatie per component in (sectie Componenten/units hieronder).</div>
                )}

                <MobileFieldGroup label="Aankoopfee (%) excl. btw"><NumZero onRawChange={markDirtyFromRaw} value={s.buyer_fee_percentage} onChange={(v) => patch({ buyer_fee_percentage: v })} placeholder="bijv. 2" suffix="%" zeroActive={isZero('buyer_fee_percentage')} onZeroToggle={toggleZero('buyer_fee_percentage')} /></MobileFieldGroup>
                <MobileFieldGroup label="Notariskosten (€)"><NumZero onRawChange={markDirtyFromRaw} value={s.notary_costs} onChange={(v) => patch({ notary_costs: v })} suffix="€" zeroActive={isZero('notary_costs')} onZeroToggle={toggleZero('notary_costs')} /></MobileFieldGroup>
                <MobileFieldGroup label="Advieskosten (€)"><NumZero onRawChange={markDirtyFromRaw} value={s.advisory_costs} onChange={(v) => patch({ advisory_costs: v })} suffix="€" zeroActive={isZero('advisory_costs')} onZeroToggle={toggleZero('advisory_costs')} /></MobileFieldGroup>
                <MobileFieldGroup label="Due diligence (€)"><NumZero onRawChange={markDirtyFromRaw} value={s.due_diligence_costs} onChange={(v) => patch({ due_diligence_costs: v })} suffix="€" zeroActive={isZero('due_diligence_costs')} onZeroToggle={toggleZero('due_diligence_costs')} /></MobileFieldGroup>
                <MobileFieldGroup label="Overige aankoopkosten (€)"><NumZero onRawChange={markDirtyFromRaw} value={s.other_acquisition_costs} onChange={(v) => patch({ other_acquisition_costs: v })} suffix="€" zeroActive={isZero('other_acquisition_costs')} onZeroToggle={toggleZero('other_acquisition_costs')} /></MobileFieldGroup>
                <MobileFieldGroup label="Financieringskosten (€)"><NumZero onRawChange={markDirtyFromRaw} value={s.financing_costs} onChange={(v) => patch({ financing_costs: v })} suffix="€" zeroActive={isZero('financing_costs')} onZeroToggle={toggleZero('financing_costs')} /></MobileFieldGroup>
              </div>
              {showHelp && (
                <div className="pt-3">
                  <BerekeningUitleg>
                    OVB = aankoopprijs (of componentwaarde) × OVB-percentage. Bij mixed-use wordt de OVB bij voorkeur per component toegerekend op basis van waarde.
                    Standaardtarieven OVB 2026: hoofdverblijf 2%, woning-belegging 8%, niet-woning 10,4%. Aanpasbaar via Gebruikersbeheer → Vastgoedrekenen-instellingen.
                  </BerekeningUitleg>
                </div>
              )}
            </Section>

            {/* 3. Huur & exploitatie */}
            <SectionGroup step={4} title="Opbrengsten" hint="Huur, exploitatie en verkoop / exit" />
            <Section title="Huur & exploitatie" status={huurStatus} defaultOpen={huurOpen} source={rentFromComponents ? 'Componenten' : 'Scenario (handmatig)'} relevance={huurRelevance}>
              <div className="pt-3 space-y-3">
                {(() => {
                  const hasComponentRent = components.some((cc) => Number(cc.current_annual_rent ?? 0) > 0 || Number(cc.current_monthly_rent ?? 0) > 0);
                  const hasScenarioRent = Number(s.current_monthly_rent ?? 0) > 0 || Number(s.market_monthly_rent ?? 0) > 0;
                  const conflict = hasComponentRent && rentSource === 'handmatig' && hasScenarioRent;
                  return (
                    <div className={`rounded-md border px-3 py-2 text-xs ${conflict ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200' : 'border-border bg-muted/30 text-muted-foreground'}`}>
                      <strong className="font-medium">Actieve huurbron:</strong> {RENT_SOURCE_LABELS[rentSource] ?? rentSource}
                      {conflict && <div className="mt-1">⚠ Zowel componenthuren als handmatige huur ingevuld. Kies welke huurbron leidend is om dubbele telling te voorkomen.</div>}
                    </div>
                  );
                })()}
                <NoiOpbouw scenario={s} o={outputs} />
                <p className="text-xs text-muted-foreground">
                  Deze percentages zijn quickscan-aannames. Controleer ze vóór bieding op basis van huurcontracten, onderhoudsstaat, servicekosten, VvE, objecttype, locatie en marktdata.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
                  <MobileFieldGroup label={<span className="inline-flex flex-wrap items-center gap-1 min-w-0">Huurbron {showHelp && <HelpTooltip text="Bepaalt welke huur leidend is voor de berekening." />}</span>}>
                    <Select value={rentSource} onValueChange={(v) => patch({ rent_source: v })}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(RENT_SOURCE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Aannameprofiel">
                    <Select value={s.assumption_profile ?? defaultProfileFor(propertyType, s.strategy_type)} onValueChange={(v) => applyProfile(v as AssumptionProfileKey)}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ASSUMPTION_PROFILE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Kostenstructuur / servicekosten">
                    <Select value={s.cost_structure ?? 'onbekend'} onValueChange={(v) => patch({ cost_structure: v })}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(COST_STRUCTURE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </MobileFieldGroup>

                  <MobileFieldGroup label="Huidige maandhuur (€)" helper={rentFromComponents ? 'Opgeteld uit componenten' : undefined}>
                    <NumInput onRawChange={markDirtyFromRaw} value={rentFromComponents ? Math.round(outputs.currentAnnualRent / 12) : s.current_monthly_rent} onChange={(v) => patch({ current_monthly_rent: v })} suffix="€" />
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Markthuur per maand (€)" helper={rentFromComponents ? 'Opgeteld uit componenten' : undefined}>
                    <NumInput onRawChange={markDirtyFromRaw} value={rentFromComponents ? Math.round(outputs.marketAnnualRent / 12) : s.market_monthly_rent} onChange={(v) => patch({ market_monthly_rent: v })} suffix="€" />
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Handmatige gecorrigeerde maandhuur (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.manual_corrected_monthly_rent} onChange={(v) => patch({ manual_corrected_monthly_rent: v })} suffix="€" /></MobileFieldGroup>

                  <MobileFieldGroup label="Huur voor berekening">
                    <Select value={s.rent_choice ?? 'huidig'} onValueChange={(v) => patch({ rent_choice: v as Scenario['rent_choice'] })}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="huidig">Huidige huur</SelectItem>
                        <SelectItem value="markt">Markthuur</SelectItem>
                        <SelectItem value="wws">WWS-gecorrigeerd</SelectItem>
                        <SelectItem value="handmatig">Handmatig</SelectItem>
                      </SelectContent>
                    </Select>
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Leegstand (%)"><NumInput onRawChange={markDirtyFromRaw} value={s.vacancy_percentage} onChange={(v) => patch({ vacancy_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
                  <MobileFieldGroup label="Exploitatie (%)"><NumInput onRawChange={markDirtyFromRaw} value={s.operating_cost_percentage} onChange={(v) => patch({ operating_cost_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
                  <MobileFieldGroup label="Onderhoud (%)"><NumInput onRawChange={markDirtyFromRaw} value={s.maintenance_reserve_percentage} onChange={(v) => patch({ maintenance_reserve_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
                  <MobileFieldGroup label="Beheer (%)"><NumInput onRawChange={markDirtyFromRaw} value={s.management_cost_percentage} onChange={(v) => patch({ management_cost_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
                  <MobileFieldGroup label="Overige jaarlijkse kosten (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.other_annual_costs} onChange={(v) => patch({ other_annual_costs: v })} suffix="€" /></MobileFieldGroup>
                </div>
                {aannameWaarschuwingen.length > 0 && (
                  <NogTeControleren items={aannameWaarschuwingen} title="Aanname-waarschuwingen" />
                )}
                {showHelp && (
                  <MobileFieldGroup label={<span className="inline-flex flex-wrap items-center gap-1 min-w-0">Gewenste BAR (%) {showHelp && <HelpTooltip text="Bruto aanvangsrendement op totale investering. Hoger = strenger bieden." />}</span>}>
                    <NumInput onRawChange={markDirtyFromRaw} value={s.target_bar} onChange={(v) => patch({ target_bar: v })} suffix="%" />
                  </MobileFieldGroup>
                )}
                {!showHelp && (
                  <MobileFieldGroup label="Gewenste BAR (%)"><NumInput onRawChange={markDirtyFromRaw} value={s.target_bar} onChange={(v) => patch({ target_bar: v })} suffix="%" /></MobileFieldGroup>
                )}
              </div>
            </Section>

            {/* 4. Verkoop / exit */}
            {(() => {
              const sr = s as unknown as Record<string, unknown>;
              const saleStrategy = (sr.sale_strategy as string | null) ?? 'geen_verkoop';
              const bidBasis = (sr.bid_basis as string | null) ?? 'huur';
              const trackChoice = (sr.leading_valuation_track as string | null) ?? 'auto';
              const setSale = (key: string, value: unknown) => patch({ [key]: value } as unknown as Partial<Scenario>);
              const strategyActive = sellOffUnits.length > 0;
              const scenarioExitActive = saleStrategy !== 'geen_verkoop';
              const dualTrackConflict = strategyActive && scenarioExitActive && trackChoice === 'auto';
              const TRACK_LABELS: Record<string, string> = {
                auto: 'Automatisch bepalen',
                huur_bar: 'Huur / BAR',
                scenario_exit: 'Scenario-level verkoop / exit',
                componentstrategie: 'Componentstrategie (per unit)',
              };
              return (
                <Section title="Verkoop / exit" status={verkoopStatus} defaultOpen={verkoopOpen} source="Scenario-level verkoop" relevance={verkoopRelevance}>
                  <div className="pt-3 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Vul hier verkoopopbrengst en exit-aannames in. Bij verkoopgerichte strategieën kan "Maximale bieding" worden gebaseerd op gewenste marge of ROI in plaats van BAR.
                    </p>

                    {/* Leidend waarderingsspoor */}
                    <div className={`rounded-md border px-3 py-2 text-xs space-y-2 ${
                      dualTrackConflict
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                        : 'border-primary/30 bg-primary/5'
                    }`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Leidend waarderingsspoor:</span>
                        <Select value={trackChoice} onValueChange={(v) => setSale('leading_valuation_track', v)}>
                          <SelectTrigger className="h-7 w-auto min-w-[220px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Automatisch (heuristiek)</SelectItem>
                            <SelectItem value="huur_bar">Huur / BAR</SelectItem>
                            <SelectItem value="scenario_exit">Scenario-level verkoop / exit</SelectItem>
                            <SelectItem value="componentstrategie" disabled={!strategyActive}>
                              Componentstrategie (per unit){!strategyActive ? ' — geen units' : ''}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[11px] opacity-80">
                          Huidig leidend: {outputs.leadingMaxBasisLabel}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-snug">
                        Bepaalt welke waarde leidend is voor "maximale aankoopprijs" en "rond te rekenen". Andere sporen blijven informatief zichtbaar in het scenario.
                      </p>
                      {dualTrackConflict && (
                        <p className="text-[11px] leading-snug">
                          ⚠ Scenario-level exit ({saleStrategy}) én componentstrategie ({sellOffUnits.length} unit{sellOffUnits.length === 1 ? '' : 's'}) zijn beide actief. Kies expliciet welk spoor leidend is — of zet de verkoopstrategie op "Geen verkoop" als componentstrategie leidend moet zijn.
                        </p>
                      )}
                      {trackChoice !== 'auto' && (
                        <p className="text-[11px] opacity-80">
                          Handmatige keuze actief: {TRACK_LABELS[trackChoice]}. Zet op "Automatisch" om de heuristiek te herstellen.
                        </p>
                      )}
                    </div>



                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
                      <MobileFieldGroup label="Verkoopstrategie">
                        <Select value={saleStrategy} onValueChange={(v) => setSale('sale_strategy', v)}>
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(SALE_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Verwachte verkooptermijn (maanden)">
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_expected_period_months as number | null} onChange={(v) => setSale('sale_expected_period_months', v)} suffix="maanden" />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Bid-basis voor maximale bieding" helper={bidBasis === 'verkoop' ? 'Max bieding wordt afgeleid van netto verkoopopbrengst minus gewenste marge.' : 'Max bieding wordt afgeleid van gecorrigeerde jaarhuur via BAR.'}>
                        <Select value={bidBasis} onValueChange={(v) => setSale('bid_basis', v)}>
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="huur">Huur / BAR (standaard)</SelectItem>
                            <SelectItem value="verkoop">Verkoop / exit</SelectItem>
                          </SelectContent>
                        </Select>
                      </MobileFieldGroup>

                      <MobileFieldGroup label="Verkoopprijs totaal (€)" helper={(sr.sale_price_source ?? null) === 'total' ? 'Handmatig totaal' : ((sr.sale_price_source ?? null) === 'per_m2' ? 'Automatisch berekend uit €/m² × m²' : undefined)}>
                        <NumInput
                          onRawChange={markDirtyFromRaw}
                          value={(sr.sale_price_source as string | null) === 'per_m2' && outputs.grossSaleProceeds != null
                            ? outputs.grossSaleProceeds
                            : (sr.sale_price_total as number | null)}
                          onChange={(v) => patch({ sale_price_total: v, sale_price_source: v != null && v > 0 ? 'total' : null } as unknown as Partial<Scenario>)}
                          placeholder="bijv. 2200000"
                          suffix="€"
                        />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Verkoopprijs per m² (€)" helper={(sr.sale_price_source ?? null) === 'per_m2' ? 'Handmatig €/m²' : (outputs.salePricePerM2 != null ? 'Automatisch berekend' : undefined)}>
                        <NumInput
                          onRawChange={markDirtyFromRaw}
                          value={(sr.sale_price_source as string | null) === 'per_m2'
                            ? (sr.sale_price_per_m2 as number | null)
                            : (outputs.salePricePerM2 ?? (sr.sale_price_per_m2 as number | null))}
                          onChange={(v) => patch({ sale_price_per_m2: v, sale_price_source: v != null && v > 0 ? 'per_m2' : null } as unknown as Partial<Scenario>)}
                          placeholder="bijv. 5500"
                          suffix="€"
                        />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Verkoopbare m²" helper={outputs.salePricePerM2 == null && (sr.sale_sellable_m2 == null || Number(sr.sale_sellable_m2) <= 0) ? 'Vul m² in voor €/m²-berekening' : undefined}>
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_sellable_m2 as number | null} onChange={(v) => setSale('sale_sellable_m2', v)} suffix="m²" />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Verkoopprijs per unit (€)">
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_price_per_unit as number | null} onChange={(v) => setSale('sale_price_per_unit', v)} placeholder="bijv. 350000" suffix="€" />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Aantal verkoopbare units">
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_units_count as number | null} onChange={(v) => setSale('sale_units_count', v)} />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Handmatige exitwaarde (€)" helper="Optioneel — overschrijft afgeleide netto verkoopopbrengst voor de exitwaarde-output.">
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_exit_value_manual as number | null} onChange={(v) => setSale('sale_exit_value_manual', v)} suffix="€" />
                      </MobileFieldGroup>

                      <MobileFieldGroup label="Verkoopkosten (%)" helper="Makelaars-/verkoopkosten als % van bruto opbrengst.">
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_costs_percentage as number | null} onChange={(v) => setSale('sale_costs_percentage', v)} placeholder="bijv. 1.5" suffix="%" />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Overige verkoopkosten (€)">
                        <div className="space-y-1">
                          <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_other_costs as number | null} onChange={(v) => setSale('sale_other_costs', v)} suffix="€" />
                          <ManualZeroToggle
                            active={isZero('sale_other_costs')}
                            value={sr.sale_other_costs as number | null}
                            onToggle={(on) => {
                              const cur = new Set(manualZeroSet);
                              if (on) cur.add('sale_other_costs'); else cur.delete('sale_other_costs');
                              setSale('sale_other_costs', on ? 0 : null);
                              patch({ ...({ manual_zero_fields: Array.from(cur) } as unknown as Partial<Scenario>) });
                            }}
                          />
                        </div>
                      </MobileFieldGroup>

                    </div>

                    <div className="border-t pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Doelstelling voor maximale bieding</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
                        <MobileFieldGroup label="Gewenste winst / marge (€)">
                          <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_target_margin_amount as number | null} onChange={(v) => setSale('sale_target_margin_amount', v)} suffix="€" />
                        </MobileFieldGroup>
                        <MobileFieldGroup label="Gewenste marge (%)">
                          <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_target_margin_percentage as number | null} onChange={(v) => setSale('sale_target_margin_percentage', v)} suffix="%" />
                        </MobileFieldGroup>
                        <MobileFieldGroup label="Gewenste ROI (%)">
                          <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_target_roi_percentage as number | null} onChange={(v) => setSale('sale_target_roi_percentage', v)} suffix="%" />
                        </MobileFieldGroup>
                        <MobileFieldGroup label="Target exitwaarde (€)">
                          <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_target_exit_value as number | null} onChange={(v) => setSale('sale_target_exit_value', v)} suffix="€" />
                        </MobileFieldGroup>
                      </div>
                    </div>

                    <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Bruto verkoopopbrengst</p>
                        <p className="font-mono-data font-semibold">{outputs.grossSaleProceeds != null ? fmtEur(outputs.grossSaleProceeds) : 'Onvoldoende gegevens'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Verkoopprijs /m²</p>
                        <p className="font-mono-data font-semibold">{outputs.salePricePerM2 != null ? fmtEurPerM2(outputs.salePricePerM2) : 'Onvoldoende gegevens'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Verkoopkosten</p>
                        <p className="font-mono-data">{outputs.saleCostsTotal != null ? fmtEur(outputs.saleCostsTotal) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Netto verkoop /m²</p>
                        <p className="font-mono-data">{outputs.netSaleProceedsPerM2 != null ? fmtEurPerM2(outputs.netSaleProceedsPerM2) : '—'}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Netto verkoopopbrengst</p>
                        <p className="font-mono-data font-semibold">{outputs.netSaleProceeds != null ? fmtEur(outputs.netSaleProceeds) : 'Onvoldoende gegevens'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Exitwaarde</p>
                        <p className="font-mono-data">{outputs.exitValue != null ? fmtEur(outputs.exitValue) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bruto marge</p>
                        <p className="font-mono-data">{outputs.grossMargin != null ? fmtEur(outputs.grossMargin) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Netto marge</p>
                        <p className={`font-mono-data font-semibold ${outputs.netMargin != null && outputs.netMargin < 0 ? 'text-destructive' : ''}`}>{outputs.netMargin != null ? fmtEur(outputs.netMargin) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ROI op totale investering</p>
                        <p className={`font-mono-data font-semibold ${outputs.roi != null && outputs.roi < 0 ? 'text-destructive' : ''}`}>{outputs.roi != null ? `${outputs.roi.toFixed(2)}%` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Verschil met aankoopprijs</p>
                        <p className="font-mono-data">{outputs.saleVsPurchase != null ? fmtEur(outputs.saleVsPurchase) : '—'}</p>
                      </div>
                    </div>

                    {outputs.bidBasisUsed === 'verkoop' && outputs.exitBasedMaxBid != null && (
                      <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
                        <p className="font-semibold text-sm">Maximale bieding op basis van exit: {fmtEur(outputs.exitBasedMaxBid)}</p>
                        <p className="text-muted-foreground mt-1">
                          Berekend als: netto verkoopopbrengst − gewenste marge/ROI − aankoopkosten − OVB − bouw-/renovatiekosten − financiering − veiligheidsmarge.
                          Bindende doelstelling: <span className="font-medium">{
                            outputs.exitBidBindingTarget === 'marge_euro' ? 'gewenste winst (€)' :
                            outputs.exitBidBindingTarget === 'marge_pct' ? 'gewenste marge (%)' :
                            outputs.exitBidBindingTarget === 'roi' ? 'gewenste ROI (%)' :
                            outputs.exitBidBindingTarget === 'target_exit' ? 'target exitwaarde' : '—'
                          }</span>.
                        </p>
                      </div>
                    )}
                  </div>
                </Section>
              );
            })()}

            {/* 5. Kosten & bouwkosten */}
            <SectionGroup step={5} title="Kosten & OVB" hint="Bouwkosten, btw en overdrachtsbelasting" />
            <Section title="Kosten & bouwkosten" status={kostenStatus} defaultOpen={kostenOpen} source="Kostenposten" relevance="informatief">
              <div className="pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div className="w-full sm:w-48">
                    <MobileFieldGroup label="Onvoorzien (%)">
                      <NumInput onRawChange={markDirtyFromRaw} value={s.unforeseen_percentage} onChange={(v) => patch({ unforeseen_percentage: v })} suffix="%" />
                    </MobileFieldGroup>
                  </div>
                  <Button size="sm" variant="outline" onClick={addCost} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Kostenpost</Button>
                </div>
                {draftCosts.length === 0 && <p className="text-xs text-muted-foreground">Voeg handmatige kostenposten toe (renovatie, transformatie, splitsing, verkoopkosten, etc.).</p>}
                {draftCosts.map((c) => {
                  const cr = c as unknown as Record<string, unknown>;
                  const mode = ((cr.calc_mode as string | null) ?? 'totaal');
                  const perM2 = (cr.amount_per_m2 as number | null) ?? null;
                  const basis = (cr.m2_basis as number | null) ?? null;
                  const effective = mode === 'per_m2' && perM2 && basis ? Math.round(perM2 * basis) : Number(c.amount ?? 0);
                  const derivedPerM2 = mode === 'totaal' && basis && basis > 0 && Number(c.amount ?? 0) > 0
                    ? Math.round(Number(c.amount) / basis)
                    : null;
                  const vatTreatment = ((cr.vat_treatment as string | null) ?? 'geen');
                  const vatPctField = (cr.vat_percentage as number | null) ?? null;
                  const vatManual = (cr.vat_amount_manual as number | null) ?? null;
                  const unforeseenPct = Number(s.unforeseen_percentage ?? 0);
                  const subtotalExVat = effective + Math.round((effective * unforeseenPct) / 100);
                  let vatAmount = 0;
                  if (vatTreatment === 'pct_21') vatAmount = Math.round((subtotalExVat * 21) / 100);
                  else if (vatTreatment === 'pct_9') vatAmount = Math.round((subtotalExVat * 9) / 100);
                  else if (vatTreatment === 'handmatig') {
                    vatAmount = vatManual && vatManual !== 0
                      ? Number(vatManual)
                      : Math.round((subtotalExVat * Number(vatPctField ?? 0)) / 100);
                  }
                  const postTotalInclVat = subtotalExVat + vatAmount;
                  return (
                  <div key={c.id} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-muted-foreground">Kostenpost</p>
                      <Button size="sm" variant="ghost" onClick={() => deleteCost(c.id)} className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Kostenpost verwijderen</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 min-w-0">
                      <MobileFieldGroup label="Categorie" className="lg:col-span-2">
                        <RawTextInput className="h-9" initialValue={c.cost_category} onRawChange={(raw) => updateCost(c.id, { cost_category: raw.trim() || 'Kostenpost' }, true)} onCommit={(raw) => updateCost(c.id, { cost_category: raw.trim() || 'Kostenpost' })} />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Omschrijving" className="lg:col-span-2">
                        <RawTextInput className="h-9" initialValue={c.description ?? ''} onRawChange={(raw) => updateCost(c.id, { description: raw.trim() || null }, true)} onCommit={(raw) => updateCost(c.id, { description: raw.trim() || null })} />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Berekeningswijze">
                        <Select value={mode} onValueChange={(v) => updateCost(c.id, { calc_mode: v } as unknown as Partial<ScenarioCost>, true)}>
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="totaal">Totaalbedrag</SelectItem>
                            <SelectItem value="per_m2">Per m²</SelectItem>
                          </SelectContent>
                        </Select>
                      </MobileFieldGroup>
                      <MobileFieldGroup label="m²-basis">
                        <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(basis)} onRawChange={(raw) => updateCost(c.id, { m2_basis: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>, true)} onCommit={(raw) => updateCost(c.id, { m2_basis: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>)} />
                      </MobileFieldGroup>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
                      {mode === 'totaal' ? (
                        <>
                          <MobileFieldGroup label="Bedrag totaal excl. btw (€)">
                            <RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.amount)} onRawChange={(raw) => updateCost(c.id, { amount: parseRawNumber(raw) ?? 0 }, true)} onCommit={(raw) => updateCost(c.id, { amount: parseRawNumber(raw) ?? 0 })} />
                          </MobileFieldGroup>
                          <MobileFieldGroup label="€/m² (afgeleid)">
                            <div className="min-h-9 flex items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono-data">
                              {derivedPerM2 != null ? fmtEurPerM2(derivedPerM2) : 'Vul m²-basis in'}
                            </div>
                          </MobileFieldGroup>
                        </>
                      ) : (
                        <>
                          <MobileFieldGroup label="Bouwkosten per m² excl. btw (€)">
                            <RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(perM2)} onRawChange={(raw) => updateCost(c.id, { amount_per_m2: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>, true)} onCommit={(raw) => updateCost(c.id, { amount_per_m2: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>)} />
                          </MobileFieldGroup>
                          <MobileFieldGroup label="Totaal excl. btw (afgeleid)">
                            <div className="min-h-9 flex items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono-data font-semibold">
                              {effective > 0 ? fmtEur(effective) : 'Vul €/m² en m²-basis in'}
                            </div>
                          </MobileFieldGroup>
                        </>
                      )}
                    </div>

                    {/* Btw-behandeling per kostenpost */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0 border-t pt-3">
                      <MobileFieldGroup label={<span className="inline-flex flex-wrap items-center gap-1 min-w-0">Btw over deze kostenpost {showHelp && <HelpTooltip text="Bouwkosten worden standaard exclusief btw ingevoerd. Geef aan of btw als kosten moet worden meegenomen. Bij btw-belaste exploitatie of verrekenbare btw kan btw mogelijk niet als kostenpost worden meegenomen. Controleer dit bij twijfel fiscaal." />}</span>}>
                        <Select
                          value={vatTreatment}
                          onValueChange={(v) => updateCost(c.id, {
                            vat_treatment: v,
                            vat_applicable: v !== 'geen' && v !== 'verrekenbaar',
                            vat_percentage: v === 'pct_21' ? 21 : v === 'pct_9' ? 9 : (v === 'handmatig' ? (vatPctField ?? 21) : null),
                          } as unknown as Partial<ScenarioCost>)}
                        >
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="geen">Niet meenemen (excl. btw)</SelectItem>
                            <SelectItem value="pct_21">21% meenemen</SelectItem>
                            <SelectItem value="pct_9">9% meenemen</SelectItem>
                            <SelectItem value="handmatig">Deels meenemen / handmatig</SelectItem>
                            <SelectItem value="verrekenbaar">Verrekenbaar (niet als kosten)</SelectItem>
                          </SelectContent>
                        </Select>
                      </MobileFieldGroup>
                      {vatTreatment === 'handmatig' && (
                        <>
                          <MobileFieldGroup label="Btw-percentage handmatig (%)">
                            <RawNumberInput className="h-9" initialValue={numberToRaw(vatPctField)} onRawChange={(raw) => updateCost(c.id, { vat_percentage: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>, true)} onCommit={(raw) => updateCost(c.id, { vat_percentage: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>)} />
                          </MobileFieldGroup>
                          <MobileFieldGroup label="Btw-bedrag handmatig (€)" helper="Overschrijft het percentage als ingevuld.">
                            <RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(vatManual)} onRawChange={(raw) => updateCost(c.id, { vat_amount_manual: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>, true)} onCommit={(raw) => updateCost(c.id, { vat_amount_manual: parseRawNumber(raw) } as unknown as Partial<ScenarioCost>)} />
                          </MobileFieldGroup>
                        </>
                      )}
                    </div>

                    {/* Btw-opbouw per kostenpost */}
                    <div className="rounded-md border bg-muted/20 p-3 text-xs font-mono-data grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-muted-foreground font-sans">Subtotaal excl. btw</p>
                        <p>{fmtEur(effective)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-sans">+ Onvoorzien ({unforeseenPct}%)</p>
                        <p>{fmtEur(Math.round((effective * unforeseenPct) / 100))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-sans">+ Btw {vatTreatment === 'geen' ? '(geen)' : vatTreatment === 'verrekenbaar' ? '(verrekenbaar)' : vatTreatment === 'pct_21' ? '(21%)' : vatTreatment === 'pct_9' ? '(9%)' : '(handmatig)'}</p>
                        <p>{fmtEur(vatAmount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-sans">Totaal incl. onvoorzien & btw</p>
                        <p className="font-semibold">{fmtEur(postTotalInclVat)}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}

                {/* Totaaloverzicht alle kostenposten */}
                {(() => {
                  const unforeseenPct = Number(s.unforeseen_percentage ?? 0);
                  const totalDirect = draftCosts.reduce((sum, c) => {
                    const cr = c as unknown as Record<string, unknown>;
                    const mode = ((cr.calc_mode as string | null) ?? 'totaal');
                    const pm = Number(cr.amount_per_m2 ?? 0);
                    const m2 = Number(cr.m2_basis ?? 0);
                    const eff = mode === 'per_m2' && pm > 0 && m2 > 0 ? Math.round(pm * m2) : Number(c.amount ?? 0);
                    return sum + eff;
                  }, 0);
                  const unforeseenEur = Math.round((totalDirect * unforeseenPct) / 100);
                  const subtotalExVat = totalDirect + unforeseenEur;
                  const vatTotal = Math.max(0, outputs.totalCosts - subtotalExVat);
                  const anyVat = draftCosts.some((c) => {
                    const tr = ((c as unknown as Record<string, unknown>).vat_treatment as string | null) ?? 'geen';
                    return tr !== 'geen' && tr !== 'verrekenbaar';
                  });
                  return (
                    <div className="rounded-md border bg-card p-3 text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotaal bouwkosten excl. btw</span><span className="font-mono-data">{fmtEur(totalDirect)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">+ Onvoorzien ({unforeseenPct}%)</span><span className="font-mono-data">{fmtEur(unforeseenEur)}</span></div>
                      <div className="flex justify-between border-t pt-1"><span>Subtotaal incl. onvoorzien, excl. btw</span><span className="font-mono-data">{fmtEur(subtotalExVat)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">+ Btw (meegenomen als kosten)</span><span className="font-mono-data">{fmtEur(vatTotal)}</span></div>
                      <div className="flex justify-between border-t pt-1 font-semibold"><span>Totale kosten incl. onvoorzien {anyVat || vatTotal > 0 ? '& btw' : ', excl. btw'}</span><span className="font-mono-data">{fmtEur(outputs.totalCosts)}</span></div>
                      {!anyVat && vatTotal === 0 && (
                        <p className="text-[11px] text-muted-foreground pt-1">Geen btw als kostenpost meegenomen. Stel "Btw over deze kostenpost" per post in om btw mee te rekenen in totale investering en maximale bieding.</p>
                      )}
                    </div>
                  );
                })()}

                {showHelp && (
                  <BerekeningUitleg>
                    Bouwkosten worden standaard <strong>exclusief btw</strong> ingevoerd. Onvoorzien wordt over de exclusieve bouwkosten berekend. Btw kan per kostenpost worden meegenomen (21%, 9%, handmatig of verrekenbaar). De gekozen behandeling werkt door in totale investering, maximale bieding, ROI, nettomarge, scenariovergelijking en auditrapport.
                    Bij btw-belaste exploitatie of verrekenbare btw kan btw mogelijk niet als kostenpost worden meegenomen — controleer dit bij twijfel fiscaal.
                  </BerekeningUitleg>
                )}
              </div>
            </Section>

            {/* 6. Componenten / units */}
            <SectionGroup step={3} title="Componenten & strategie" hint="Per-unit invoer + verkoop-/houdstrategie" />
            <Section title={`Componenten / units (${components.length})`} status={compStatus} defaultOpen={compOpen} source="Componenten" relevance={compRelevance}>
              <div className="pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Gebruik componenten wanneer een object uit meerdere delen bestaat. Componenten werken door in huur, WWS, OVB per component, uitpondanalyse en prijs per m².
                  </p>
                  <Button size="sm" variant="outline" onClick={addComponent} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Component</Button>
                </div>
                {components.length === 0 && <p className="text-xs text-muted-foreground">Nog geen componenten.</p>}
                {components.length > 0 && (
                  <UnitNavigator
                    anchorPrefix="componenten-unit"
                    units={components.map((c, idx) => {
                      const ident = formatUnitIdentity({ label: c.component_name, type: c.component_type, surface: c.surface_gbo as number | null }, idx);
                      const diag = outputs.ovbPerComponent.find((p) => p.id === c.id);
                      const ovbMissing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
                      return { id: c.id, label: ident.primary, meta: ident.meta.join(' · '), warning: ovbMissing };
                    })}
                  />
                )}
                {components.map((c, idx) => {
                  const ident = formatUnitIdentity({ label: c.component_name, type: c.component_type, surface: c.surface_gbo as number | null }, idx);
                  const diag = ovbMode === 'per_component' ? outputs.ovbPerComponent.find((p) => p.id === c.id) : null;
                  const ovbMissing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
                  // Header chips
                  const chipCls = (tone?: 'warning' | 'positive' | 'muted') =>
                    tone === 'warning' ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5'
                    : tone === 'positive' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5'
                    : 'border-border text-muted-foreground bg-muted/30';
                  const chips: { label: string; tone?: 'warning' | 'positive' | 'muted' }[] = [];
                  const monthly = Number(c.current_monthly_rent ?? 0);
                  if (monthly > 0) chips.push({ label: `huur ${fmtEur(monthly)}/mnd` });
                  if (diag) {
                    chips.push({ label: `OVB ${diag.pct.toFixed(diag.pct % 1 === 0 ? 0 : 1)}%`, tone: ovbMissing ? 'warning' : undefined });
                    if (ovbMissing) chips.push({ label: 'OVB-grondslag ontbreekt', tone: 'warning' });
                  }
                  return (
                    <div key={c.id} id={`componenten-unit-${c.id}`} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden scroll-mt-20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-xs font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</span>
                          <span className="text-sm font-semibold truncate">{ident.primary}</span>
                          {ident.meta.length > 0 && <span className="text-xs text-muted-foreground">· {ident.meta.join(' · ')}</span>}
                          {ovbMissing && <span className="text-amber-600 dark:text-amber-300" title="Ontbrekende invoer">⚠</span>}
                          {chips.map((cc, i) => (
                            <span key={i} className={`text-[11px] rounded-full border px-2 py-0.5 ${chipCls(cc.tone)}`}>{cc.label}</span>
                          ))}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => deleteComponent(c.id)} className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Component verwijderen</span>
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 min-w-0">
                        <MobileFieldGroup label="Naam" className="lg:col-span-2"><RawTextInput className="h-9" initialValue={c.component_name} onCommit={(raw) => updateComponent(c.id, { component_name: raw.trim() || 'Component' })} /></MobileFieldGroup>
                        <MobileFieldGroup label="Type">
                          <Select value={c.component_type} onValueChange={(v) => updateComponent(c.id, { component_type: v as Component['component_type'] })}>
                            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                          </Select>
                        </MobileFieldGroup>
                        <MobileFieldGroup label="GBO (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(c.surface_gbo)} onCommit={(raw) => updateComponent(c.id, { surface_gbo: parseRawNumber(raw) })} /></MobileFieldGroup>
                        <MobileFieldGroup label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.current_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { current_monthly_rent: parseRawNumber(raw) })} /></MobileFieldGroup>
                        <MobileFieldGroup label="Markthuur/maand (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.market_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { market_monthly_rent: parseRawNumber(raw) })} /></MobileFieldGroup>
                      </div>
                      {ovbMode === 'per_component' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3 min-w-0">
                          <MobileFieldGroup label="Toegerekende waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.allocated_component_value)} onCommit={(raw) => updateComponent(c.id, { allocated_component_value: parseRawNumber(raw) })} /></MobileFieldGroup>
                          <MobileFieldGroup label="OVB-classificatie">
                            <Select value={c.transfer_tax_classification ?? 'woning_belegging'} onValueChange={(v) => updateComponent(c.id, { transfer_tax_classification: v as Component['transfer_tax_classification'] })}>
                              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(VR_OVB_CLASSIFICATION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                          </MobileFieldGroup>
                          <MobileFieldGroup label="Toerekeningsmethode">
                            <Select value={c.transfer_tax_allocation_method ?? 'value'} onValueChange={(v) => updateComponent(c.id, { transfer_tax_allocation_method: v as Component['transfer_tax_allocation_method'] })}>
                              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="value">Op waarde (handmatige toerekening)</SelectItem>
                                <SelectItem value="m2">Op m² (verdeling vraagprijs)</SelectItem>
                                <SelectItem value="strategy" disabled={sellOffUnits.length === 0}>
                                  Uit componentstrategie{sellOffUnits.length === 0 ? ' — geen units' : ''}
                                </SelectItem>
                                <SelectItem value="manual">Handmatig bedrag</SelectItem>
                              </SelectContent>
                            </Select>
                          </MobileFieldGroup>
                          <MobileFieldGroup label="OVB-% (override)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(c.transfer_tax_percentage)} onCommit={(raw) => updateComponent(c.id, { transfer_tax_percentage: parseRawNumber(raw), transfer_tax_manual_override: raw.trim() !== '' })} /></MobileFieldGroup>
                        </div>
                      )}
                      {diag && (() => {
                        const missing = ovbMissing;
                        return (
                          <div className={`text-[11px] rounded-md border px-2 py-1.5 ${
                            missing
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                              : 'border-dashed bg-muted/30 text-muted-foreground'
                          }`}>
                            <span className="font-medium">OVB:</span>{' '}
                            methode <span className="font-mono-data">{diag.basisMethod}</span> ·{' '}
                            grondslag <span className="font-mono-data">€ {diag.basisValue.toLocaleString('nl-NL')}</span> ·{' '}
                            {diag.pct.toFixed(2)}% ·{' '}
                            bedrag <span className="font-mono-data">€ {diag.amount.toLocaleString('nl-NL')}</span>
                            {diag.missingValueBasis && <div>⚠ Toegerekende waarde ontbreekt — OVB komt op € 0. Vul "Toegerekende waarde" in, kies "Op m²", "Uit componentstrategie" of voer handmatig bedrag in.</div>}
                            {diag.missingStrategyBasis && <div>⚠ Geen waarde uit componentstrategie gevonden voor dit component — koppel het component aan een sell_off_unit of kies een andere methode.</div>}
                            {diag.missingManualAmount && <div>⚠ Handmatig bedrag niet ingevuld — OVB komt op € 0.</div>}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </Section>


            {/* 7. WWS / huursegmentanalyse */}
            <Section title={`WWS / huursegmentanalyse (${wwsUnits.length})`} status={wwsStatus} defaultOpen={false} hidden={!hasResidential && wwsUnits.length === 0}>
              <div className="pt-3 space-y-3">
                {(() => {
                  const wwsModeCtx = { scenario: s, components, strategyUnits: sellOffUnits, wwsUnits };
                  const suggestion = suggestWwsMode(wwsModeCtx);
                  const scenarioOverride = (s as unknown as { wws_mode_default?: WwsMode | null }).wws_mode_default ?? null;
                  const effective = scenarioOverride ?? suggestion.mode;
                  const tone =
                    effective === 'volledig_vereist' ? 'border-destructive/40 bg-destructive/5 text-destructive'
                    : effective === 'indicatief' ? 'border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200'
                    : 'border-muted bg-muted/40 text-muted-foreground';
                  return (
                    <div className={`rounded-md border px-3 py-2 text-xs space-y-2 ${tone}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Scenario-modus WWS:</span>
                        <Select
                          value={scenarioOverride ?? '__auto__'}
                          onValueChange={(v) => patch({ wws_mode_default: v === '__auto__' ? null : v } as unknown as Partial<Scenario>)}
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[180px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__auto__">Auto — {WWS_MODE_LABEL[suggestion.mode]}</SelectItem>
                            <SelectItem value="niet_nodig">{WWS_MODE_LABEL.niet_nodig}</SelectItem>
                            <SelectItem value="indicatief">{WWS_MODE_LABEL.indicatief}</SelectItem>
                            <SelectItem value="volledig_vereist">{WWS_MODE_LABEL.volledig_vereist}</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[11px] opacity-80">({scenarioOverride ? 'handmatig' : 'voorgesteld'})</span>
                      </div>
                      <div className="opacity-90">{WWS_MODE_DESCRIPTION[effective]}</div>
                      {suggestion.reasons.length > 0 && (
                        <div className="text-[11px] opacity-80">Reden voorstel: {suggestion.reasons.join(' ')}</div>
                      )}
                      {effective !== 'volledig_vereist' && (
                        <div className="text-[11px] opacity-80">De huidige WWS V1-berekening is altijd indicatief. Voor harde biedingen op verhuur is een Huurcommissie-check vereist.</div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end flex-wrap">

                  {components.some((c) => c.component_type === 'woning' || c.component_type === 'appartement') && wwsUnits.length === 0 && (
                    <Button size="sm" variant="outline" onClick={createWwsFromComponents} className="w-full sm:w-auto">Maak WWS-units uit wooncomponenten</Button>
                  )}
                  {wwsUnits.length > 0 && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setWwsBulkOpen(true)} className="w-full sm:w-auto">
                        <ListChecks className="h-3.5 w-3.5 mr-1" /> Bulk invullen
                      </Button>
                      <Button size="sm" variant="outline" onClick={recomputeSelectedWwsUnits} disabled={selectedWwsIds.size === 0} className="w-full sm:w-auto">
                        <RotateCw className="h-3.5 w-3.5 mr-1" /> Herbereken geselecteerd ({selectedWwsIds.size})
                      </Button>
                      <Button size="sm" variant="outline" onClick={recomputeAllWwsUnits} className="w-full sm:w-auto">Herbereken WWS-units</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={addWwsUnit} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Woonunit</Button>
                </div>
                {wwsUnits.length === 0 && <p className="text-xs text-muted-foreground">Voeg een woonunit toe om indicatieve WWS-punten en het huursegment te bepalen.</p>}
                {wwsUnits.length > 0 && (
                  <UnitNavigator
                    anchorPrefix="wws-unit"
                    units={wwsUnits.map((u, idx) => {
                      const st = getWwsUnitStatus(u, { euroPerPoint: Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6) });
                      const ident = formatUnitIdentity({ name: u.unit_name, type: 'woonunit', surface: u.living_area_m2 }, idx);
                      return { id: u.id, label: ident.primary, meta: ident.meta.join(' · '), warning: st.reliability !== 'volledig' };
                    })}
                  />
                )}
                {wwsUnits.map((u, idx) => {
                  const status = getWwsUnitStatus(u, { euroPerPoint: Number((taxSettings as { wws_euro_per_point?: number } | null)?.wws_euro_per_point ?? 6) });
                  const wwsModeCtxUnit = { scenario: s, components, strategyUnits: sellOffUnits, wwsUnits };
                  const unitModeRaw = (u as unknown as { wws_mode?: WwsMode | null }).wws_mode ?? null;
                  const unitModeEff = getEffectiveWwsMode(u, wwsModeCtxUnit);
                  const reliabilityColor =
                    status.reliability === 'volledig' ? 'text-emerald-700 dark:text-emerald-300'
                    : status.reliability === 'indicatief' ? 'text-amber-700 dark:text-amber-300'
                    : 'text-destructive';
                  const independentVal = (u as unknown as { independent_unit?: boolean | null }).independent_unit;
                  const ident = formatUnitIdentity({ name: u.unit_name, type: 'woonunit', surface: u.living_area_m2 }, idx);
                  const isSelected = selectedWwsIds.has(u.id);
                  // Reliability-chip voor WWS: indicatief / volledig / ontbreekt
                  const reliabilityChip: { label: string; tone?: 'positive' | 'warning' | 'muted' } =
                    status.reliability === 'volledig' ? { label: 'WWS volledig', tone: 'positive' }
                    : status.reliability === 'indicatief' ? { label: 'WWS indicatief', tone: 'warning' }
                    : { label: 'WWS ontbreekt', tone: 'warning' };
                  // Bouw header chips
                  const chips: { label: string; tone?: 'positive' | 'warning' | 'muted' }[] = [];
                  if (u.energy_label) chips.push({ label: `Label ${u.energy_label}` });
                  if (u.wws_points != null) chips.push({ label: `${u.wws_points} punten`, tone: 'positive' });
                  else chips.push({ label: 'punten ontbreken', tone: 'warning' });
                  if (u.rent_segment) chips.push({ label: String(u.rent_segment) });
                  chips.push(reliabilityChip);
                  if (status.source === 'handmatig') chips.push({ label: 'handmatig', tone: 'warning' });
                  const modeChipTone: 'positive' | 'warning' | undefined =
                    unitModeEff.mode === 'volledig_vereist' ? 'warning'
                    : unitModeEff.mode === 'niet_nodig' ? undefined
                    : 'positive';
                  chips.push({ label: `Modus: ${WWS_MODE_LABEL[unitModeEff.mode]}`, tone: modeChipTone });
                  const hasWarning = chips.some((c) => c.tone === 'warning');
                  const chipCls = (tone?: string) =>
                    tone === 'warning' ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5'
                    : tone === 'positive' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5'
                    : 'border-border text-muted-foreground bg-muted/30';
                  return (
                  <div key={u.id} id={`wws-unit-${u.id}`} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden scroll-mt-20">
                    <div className="flex items-start justify-between gap-3 sticky top-0 z-10 bg-card -mx-3 sm:-mx-4 -mt-3 sm:-mt-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 border-b">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleWwsSelect(u.id)} aria-label="Selecteer unit" />
                        <span className="text-xs font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</span>
                        <span className="text-sm font-semibold truncate">{ident.primary}</span>
                        {ident.meta.length > 0 && <span className="text-xs text-muted-foreground">· {ident.meta.join(' · ')}</span>}
                        {hasWarning && <span className="text-amber-600 dark:text-amber-300" title="Ontbrekende invoer of waarschuwing">⚠</span>}
                        {chips.map((c, i) => (
                          <span key={i} className={`text-[11px] rounded-full border px-2 py-0.5 ${chipCls(c.tone)}`}>{c.label}</span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => recomputeWwsUnit(u.id)} className="h-8 px-2 text-muted-foreground" title="Herbereken deze unit">
                          <RotateCw className="h-4 w-4" />
                          <span className="sr-only">Herbereken deze unit</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteWwsUnit(u.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Woonunit verwijderen</span>
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 min-w-0">
                      <MobileFieldGroup label="Naam"><RawTextInput className="h-9" initialValue={u.unit_name} onCommit={(raw) => updateWwsUnit(u.id, { unit_name: raw.trim() || 'Woonunit' })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Woon m²"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(u.living_area_m2)} onCommit={(raw) => updateWwsUnit(u.id, { living_area_m2: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <MobileFieldGroup label="WOZ (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(u.woz_value)} onCommit={(raw) => updateWwsUnit(u.id, { woz_value: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Energielabel"><RawTextInput className="h-9" initialValue={u.energy_label ?? ''} onCommit={(raw) => updateWwsUnit(u.id, { energy_label: raw.trim() || null })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(u.current_monthly_rent)} onCommit={(raw) => updateWwsUnit(u.id, { current_monthly_rent: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <div className="min-w-0 w-full space-y-1.5">
                        <Label className="block text-xs font-medium leading-snug text-foreground whitespace-normal break-words">Punten / segment</Label>
                        <div className="min-h-9 flex items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono-data min-w-0 break-words">
                          {u.wws_points ?? '—'} / {u.rent_segment ?? '—'}
                          {status.source === 'handmatig' && <span className="ml-2 text-[10px] text-amber-700 dark:text-amber-300">Handmatig — niet automatisch overschreven</span>}
                        </div>
                      </div>
                      <MobileFieldGroup label="Stelsel">
                        <Select
                          value={independentVal == null ? '' : independentVal ? 'zelfstandig' : 'onzelfstandig'}
                          onValueChange={(v) => updateWwsUnit(u.id, { independent_unit: v === 'zelfstandig' } as Partial<WwsUnit>)}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Kies stelsel" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zelfstandig">Zelfstandig</SelectItem>
                            <SelectItem value="onzelfstandig">Onzelfstandig (kamer)</SelectItem>
                          </SelectContent>
                        </Select>
                      </MobileFieldGroup>
                    </div>

                    {/* Bron- / status-regel — transparantie over herkomst en betrouwbaarheid */}
                    <div className="rounded-md bg-muted/30 border border-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span><span className="font-medium text-foreground">Bron punten:</span> {WWS_SOURCE_LABEL[status.source]}{status.source === 'handmatig' && status.computedPoints != null ? ` (CRM zou ${status.computedPoints} berekenen)` : ''}</span>
                        <span><span className="font-medium text-foreground">Stelsel:</span> {WWS_SCHEME_LABEL[status.scheme]}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span><span className="font-medium text-foreground">Beleidsversie:</span> {status.policyVersion}</span>
                        <span className={reliabilityColor}><span className="font-medium">Betrouwbaarheid:</span> {WWS_RELIABILITY_LABEL[status.reliability]}</span>
                      </div>
                      {status.missing.length > 0 && (
                        <div className="text-amber-700 dark:text-amber-300">
                          <span className="font-medium">Ontbrekend:</span> {status.missing.map((m) => WWS_MISSING_LABEL[m]).join(', ')}
                          {status.source === 'ontbreekt' && ' — vul WWS-punten in of voer een volledige Huurcommissie-check uit.'}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-muted/60">
                        <span className="font-medium text-foreground">WWS-modus:</span>
                        <Select
                          value={unitModeRaw ?? '__auto__'}
                          onValueChange={(v) => updateWwsUnit(u.id, { wws_mode: v === '__auto__' ? null : v } as unknown as Partial<WwsUnit>)}
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[180px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__auto__">Auto — {WWS_MODE_LABEL[suggestWwsMode(wwsModeCtxUnit).mode]}</SelectItem>
                            <SelectItem value="niet_nodig">{WWS_MODE_LABEL.niet_nodig}</SelectItem>
                            <SelectItem value="indicatief">{WWS_MODE_LABEL.indicatief}</SelectItem>
                            <SelectItem value="volledig_vereist">{WWS_MODE_LABEL.volledig_vereist}</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[11px] opacity-80">({unitModeEff.source})</span>
                        <span className="text-[11px] opacity-80 basis-full">{unitModeEff.reasons.join(' ')}</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {showHelp && (
                  <BerekeningUitleg>
                    WWS-puntenberekening is in V1 indicatief. Officiële WWS-toetsing blijft nodig. Segmenten: ≤143 punten sociaal, 144–186 middenhuur, ≥187 vrije sector.
                  </BerekeningUitleg>
                )}

                <BulkFillDialog
                  open={wwsBulkOpen}
                  onOpenChange={setWwsBulkOpen}
                  title="Bulk invullen — WWS-units"
                  fields={[
                    { key: 'energy_label', label: 'Energielabel', kind: 'select', options: ['A++++','A+++','A++','A+','A','B','C','D','E','F','G'].map((v) => ({ value: v, label: v })) },
                    { key: 'independent_unit', label: 'Stelsel', kind: 'select', options: [{ value: 'zelfstandig', label: 'Zelfstandig' }, { value: 'onzelfstandig', label: 'Onzelfstandig (kamer)' }] },
                    { key: 'woz_value', label: 'WOZ-waarde (€)', kind: 'number', suffix: '€' },
                    { key: 'current_monthly_rent', label: 'Maandhuur (€)', kind: 'number', suffix: '€' },
                    { key: 'living_area_m2', label: 'Woonoppervlakte (m²)', kind: 'number', suffix: 'm²' },
                  ] as BulkField[]}
                  units={wwsUnits.map((u) => ({ id: u.id, label: u.unit_name || 'Woonunit' }))}
                  selectedIds={selectedWwsIds}
                  scopes={['all', 'selected', 'empty']}
                  getValue={(unitId, key) => {
                    const u = wwsUnits.find((x) => x.id === unitId);
                    if (!u) return null;
                    return (u as unknown as Record<string, unknown>)[key];
                  }}
                  apply={async (unitId, key, value) => {
                    let patch: Partial<WwsUnit> = {};
                    if (key === 'independent_unit') patch = { independent_unit: value === 'zelfstandig' } as Partial<WwsUnit>;
                    else patch = { [key]: value } as Partial<WwsUnit>;
                    await updateWwsUnit(unitId, patch);
                  }}
                />
              </div>
            </Section>

            {/* 7b. Componentstrategie per scenario */}
            <Section title={`Componentstrategie (${sellOffUnits.length})`} status={sellOffUnits.length > 0 ? 'ok' : 'leeg'} defaultOpen={sellOffUnits.length > 0}>
              <ComponentStrategyTable
                units={sellOffUnits}
                components={components}
                asking={s.asking_price}
                onCreate={createStrategyUnit}
                onUpdate={updateStrategyUnit}
                onDelete={deleteStrategyUnit}
                onImport={importStrategyFromComponents}
              />
            </Section>

            {/* 8. Onderbouwing & betrouwbaarheid */}
            <Section title="Onderbouwing & betrouwbaarheid" status={onderbouwingStatus} defaultOpen={false}>
              <div className="pt-3 space-y-3">
                {nogTeControleren.length > 0 && <NogTeControleren items={nogTeControleren} />}
                {manualZeroSet.size > 0 && (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{manualZeroSet.size}</span> veld(en) bewust op € 0 gezet: <span className="font-mono">{Array.from(manualZeroSet).join(', ')}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
                  <MobileFieldGroup label="MJOP aanwezig">
                    <Select value={s.mjop_present ?? 'onbekend'} onValueChange={(v) => patch({ mjop_present: v })}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(MJOP_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Betrouwbaarheid aannames">
                    <Select value={s.assumptions_reliability ?? 'middel'} onValueChange={(v) => patch({ assumptions_reliability: v })}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(RELIABILITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </MobileFieldGroup>
                  <div className="flex items-center gap-3 min-w-0 rounded-md border bg-muted/20 p-3 md:pt-6 md:border-0 md:bg-transparent md:p-0">
                    <Switch checked={!!s.contract_checked} onCheckedChange={(v) => patch({ contract_checked: v })} />
                    <Label className="cursor-pointer leading-snug whitespace-normal break-words">Contractduur gecontroleerd</Label>
                  </div>
                  <div className="flex items-center gap-3 min-w-0 rounded-md border bg-muted/20 p-3 md:pt-6 md:border-0 md:bg-transparent md:p-0">
                    <Switch checked={!!s.service_costs_checked} onCheckedChange={(v) => patch({ service_costs_checked: v })} />
                    <Label className="cursor-pointer leading-snug whitespace-normal break-words">Servicekosten gecontroleerd</Label>
                  </div>
                  <div className="flex items-center gap-3 min-w-0 rounded-md border bg-muted/20 p-3 md:pt-6 md:border-0 md:bg-transparent md:p-0">
                    <Switch checked={!!s.incentive_reserve} onCheckedChange={(v) => patch({ incentive_reserve: v })} />
                    <Label className="cursor-pointer leading-snug whitespace-normal break-words">Incentive-reserve meegenomen</Label>
                  </div>
                  <MobileFieldGroup label="Bron / onderbouwing aannames" className="md:col-span-2 lg:col-span-3">
                    <TextInput value={s.assumptions_source} onRawChange={markDirtyFromRaw} onChange={(value) => patch({ assumptions_source: value })} placeholder="bv. huurcontracten, MJOP, marktreport, ..." />
                  </MobileFieldGroup>
                  <MobileFieldGroup label="Reden profielkeuze" className="md:col-span-2 lg:col-span-3">
                    <TextInput value={s.assumption_profile_reason} onRawChange={markDirtyFromRaw} onChange={(value) => patch({ assumption_profile_reason: value })} placeholder="Waarom dit profiel?" />
                  </MobileFieldGroup>
                </div>
              </div>
            </Section>

            {/* 9. Score-uitleg */}
            <Section title="Score-uitleg" status={scoreStatus} defaultOpen={false}>
              <div className="pt-3 text-xs leading-relaxed space-y-3">
                <div>
                  <p className="font-medium text-foreground">{outputs.scoreLabel}</p>
                  <p className="text-muted-foreground">{outputs.scoreReason}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="font-medium text-foreground mb-1">Positief</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {outputs.scorePositivePoints.length > 0
                        ? outputs.scorePositivePoints.map((p, i) => <li key={i}>• {p}</li>)
                        : <li>• Nog geen positief punt berekend.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Aandachtspunten</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {outputs.scoreAttentionPoints.length > 0
                        ? outputs.scoreAttentionPoints.map((p, i) => <li key={i}>• {p}</li>)
                        : <li>• Geen directe aandachtspunten.</li>}
                    </ul>
                  </div>
                </div>
                {outputs.warnings.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-300 space-y-1">
                    {outputs.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
                  </div>
                )}
              </div>
            </Section>

            {/* 10. Notities */}
            <Section title="Notities" status={notitiesStatus} defaultOpen={false}>
              <div className="pt-3">
                <RawTextarea initialValue={s.notes ?? ''} onRawChange={markDirtyFromRaw} onCommit={(value) => patch({ notes: value || null })} placeholder="Eigen aantekeningen bij dit scenario..." rows={3} />
              </div>
            </Section>
          </div>
        );
      })()}

    </div>
  );
}
