import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Save, CheckCircle2 } from 'lucide-react';
import type { Scenario, ScenarioCost, Component, WwsUnit, TaxSettings } from '@/lib/vastgoedrekenen/types';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { computeWwsPoints } from '@/lib/vastgoedrekenen/wws';
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
import { Section } from './Section';
import { fmtEur, fmtPct, fmtEurPerM2 } from './format';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { RawNumberInput, RawTextarea, RawTextInput, numberToRaw, parseRawNumber } from './RawInputs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const { components, costs, wwsUnits, loading: childrenLoading, refetch, upsertOutput } = useScenarioChildren(s.id);

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
    scenario: s, components, costs: draftCosts, wwsUnits, objectType, propertyType,
    hasWoz: !!props.objectWoz, hasEnergyLabel: !!props.objectEnergyLabel, hasBouwjaar: !!props.objectBouwjaar,
    energyLabel: props.objectEnergyLabel,
  }), [s, components, draftCosts, wwsUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar]);

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
  async function addWwsUnit() {
    await supabase.from('residential_wws_units').insert({ scenario_id: s.id, unit_name: 'Nieuwe woonunit' });
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
  async function deleteWwsUnit(id: string) {
    await supabase.from('residential_wws_units').delete().eq('id', id); refetch();
  }

  async function createWwsFromComponents() {
    const woon = components.filter((c) => c.component_type === 'woning' || c.component_type === 'appartement');
    if (woon.length === 0) { toast.error('Geen wooncomponenten gevonden'); return; }
    for (const c of woon) {
      await supabase.from('residential_wws_units').insert({
        scenario_id: s.id,
        unit_name: c.component_name,
        living_area_m2: c.surface_gbo ?? null,
        current_monthly_rent: c.current_monthly_rent ?? null,
        woz_value: props.objectWoz ?? null,
        energy_label: props.objectEnergyLabel ?? null,
      });
    }
    toast.success(`${woon.length} WWS-unit(s) aangemaakt`);
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
        

        const huurStatus = exploitatie
          ? `NOI ${fmtEur(outputs.noi)} · BAR TI ${fmtPct(outputs.barTotalInvestment)}`
          : 'Niet leidend voor dit verkoopscenario';
        const verkoopStatus = outputs.netSaleProceeds != null
          ? `Netto opbr. ${fmtEur(outputs.netSaleProceeds)}${outputs.roi != null ? ` · ROI ${outputs.roi.toFixed(1)}%` : ''}`
          : 'Geen verkoopdata';
        const kostenStatus = `${fmtEur(outputs.totalCosts)} incl. onvoorzien`;
        const aankoopStatus = `Investering ${fmtEur(outputs.totalInvestment)}`;
        const onderbouwingStatus = `${nogTeControleren.length} aandachtspunt(en) · betrouwbaarheid ${outputs.inputReliability}`;
        const compStatus = `${components.length} component(en)`;
        const wwsStatus = `${wwsUnits.length} woonunit(s)`;
        const scoreStatus = `${outputs.scoreLabel}`;
        const notitiesStatus = s.notes ? '1 notitie' : 'Geen notities';

        return (
          <div className="space-y-3">
            {/* 1. Resultaat & biedingsadvies — altijd zichtbaar bovenaan */}
            <ResultaatKaart o={outputs} s={s} />

            {/* 2. Aankoop & investering */}
            <Section title="Aankoop & investering" status={aankoopStatus} defaultOpen>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0 pt-3">
                <MobileFieldGroup label="Vraagprijs (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.asking_price} onChange={(v) => patch({ asking_price: v })} placeholder="bijv. 1625000" suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Beoogde aankoopprijs (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.purchase_price} onChange={(v) => patch({ purchase_price: v })} placeholder="bijv. 1500000" suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Veiligheidsmarge (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.safety_margin} onChange={(v) => patch({ safety_margin: v })} placeholder="bijv. 25000" suffix="€" /></MobileFieldGroup>

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

                <MobileFieldGroup label="Aankoopfee (%) excl. btw"><NumInput onRawChange={markDirtyFromRaw} value={s.buyer_fee_percentage} onChange={(v) => patch({ buyer_fee_percentage: v })} placeholder="bijv. 2" suffix="%" /></MobileFieldGroup>
                <MobileFieldGroup label="Notariskosten (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.notary_costs} onChange={(v) => patch({ notary_costs: v })} suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Advieskosten (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.advisory_costs} onChange={(v) => patch({ advisory_costs: v })} suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Due diligence (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.due_diligence_costs} onChange={(v) => patch({ due_diligence_costs: v })} suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Overige aankoopkosten (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.other_acquisition_costs} onChange={(v) => patch({ other_acquisition_costs: v })} suffix="€" /></MobileFieldGroup>
                <MobileFieldGroup label="Financieringskosten (€)"><NumInput onRawChange={markDirtyFromRaw} value={s.financing_costs} onChange={(v) => patch({ financing_costs: v })} suffix="€" /></MobileFieldGroup>
              </div>
              {showHelp && (
                <div className="pt-3">
                  <BerekeningUitleg>
                    OVB = aankoopprijs (of componentwaarde) × OVB-percentage. Bij mixed-use wordt de OVB bij voorkeur per component toegerekend op basis van waarde.
                    Standaardtarieven: 2% / 8% / 10,4%. Aanpasbaar via Gebruikersbeheer → Vastgoedrekenen-instellingen.
                  </BerekeningUitleg>
                </div>
              )}
            </Section>

            {/* 3. Huur & exploitatie */}
            <Section title="Huur & exploitatie" status={huurStatus} defaultOpen={exploitatie}>
              <div className="pt-3 space-y-3">
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
              const setSale = (key: string, value: unknown) => patch({ [key]: value } as unknown as Partial<Scenario>);
              return (
                <Section title="Verkoop / exit" status={verkoopStatus} defaultOpen={verkoop}>
                  <div className="pt-3 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Vul hier verkoopopbrengst en exit-aannames in. Bij verkoopgerichte strategieën kan "Maximale bieding" worden gebaseerd op gewenste marge of ROI in plaats van BAR.
                    </p>

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
                        <NumInput onRawChange={markDirtyFromRaw} value={sr.sale_other_costs as number | null} onChange={(v) => setSale('sale_other_costs', v)} suffix="€" />
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
            <Section title="Kosten & bouwkosten" status={kostenStatus} defaultOpen>
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
                {draftCosts.map((c) => (
                  <div key={c.id} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-muted-foreground">Kostenpost</p>
                      <Button size="sm" variant="ghost" onClick={() => deleteCost(c.id)} className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Kostenpost verwijderen</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 min-w-0">
                      <MobileFieldGroup label="Categorie" className="lg:col-span-2">
                        <RawTextInput className="h-9" initialValue={c.cost_category} onRawChange={(raw) => updateCost(c.id, { cost_category: raw.trim() || 'Kostenpost' }, true)} onCommit={(raw) => updateCost(c.id, { cost_category: raw.trim() || 'Kostenpost' })} />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Omschrijving" className="lg:col-span-2">
                        <RawTextInput className="h-9" initialValue={c.description ?? ''} onRawChange={(raw) => updateCost(c.id, { description: raw.trim() || null }, true)} onCommit={(raw) => updateCost(c.id, { description: raw.trim() || null })} />
                      </MobileFieldGroup>
                      <MobileFieldGroup label="Bedrag (€)">
                        <RawNumberInput className="h-9" initialValue={numberToRaw(c.amount)} onRawChange={(raw) => updateCost(c.id, { amount: parseRawNumber(raw) ?? 0 }, true)} onCommit={(raw) => updateCost(c.id, { amount: parseRawNumber(raw) ?? 0 })} />
                      </MobileFieldGroup>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">Totale kosten (incl. {Number(s.unforeseen_percentage ?? 0)}% onvoorzien): {fmtEur(outputs.totalCosts)}</p>
                {showHelp && (
                  <BerekeningUitleg>
                    Max all-in waarde = gecorrigeerde jaarhuur / gewenste BAR. Daarna worden aankoopkosten, OVB, kosten, financieringskosten en veiligheidsmarge afgetrokken om tot de maximale bieding te komen.
                  </BerekeningUitleg>
                )}
              </div>
            </Section>

            {/* 6. Componenten / units */}
            <Section title={`Componenten / units (${components.length})`} status={compStatus} defaultOpen={isMixed}>
              <div className="pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Gebruik componenten wanneer een object uit meerdere delen bestaat. Componenten werken door in huur, WWS, OVB per component, uitpondanalyse en prijs per m².
                  </p>
                  <Button size="sm" variant="outline" onClick={addComponent} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Component</Button>
                </div>
                {components.length === 0 && <p className="text-xs text-muted-foreground">Nog geen componenten.</p>}
                {components.map((c) => (
                  <div key={c.id} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-muted-foreground">Component</p>
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
                      <MobileFieldGroup label="GBO (m²)"><RawNumberInput className="h-9" initialValue={numberToRaw(c.surface_gbo)} onCommit={(raw) => updateComponent(c.id, { surface_gbo: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Maandhuur (€)"><RawNumberInput className="h-9" initialValue={numberToRaw(c.current_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { current_monthly_rent: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Markthuur/maand (€)"><RawNumberInput className="h-9" initialValue={numberToRaw(c.market_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { market_monthly_rent: parseRawNumber(raw) })} /></MobileFieldGroup>
                    </div>
                    {ovbMode === 'per_component' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3 min-w-0">
                        <MobileFieldGroup label="Toegerekende waarde (€)"><RawNumberInput className="h-9" initialValue={numberToRaw(c.allocated_component_value)} onCommit={(raw) => updateComponent(c.id, { allocated_component_value: parseRawNumber(raw) })} /></MobileFieldGroup>
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
                              <SelectItem value="value">Op waarde</SelectItem>
                              <SelectItem value="m2">Op m² (verdeling vraagprijs)</SelectItem>
                              <SelectItem value="manual">Handmatig bedrag</SelectItem>
                            </SelectContent>
                          </Select>
                        </MobileFieldGroup>
                        <MobileFieldGroup label="OVB-% (override)"><RawNumberInput className="h-9" initialValue={numberToRaw(c.transfer_tax_percentage)} onCommit={(raw) => updateComponent(c.id, { transfer_tax_percentage: parseRawNumber(raw), transfer_tax_manual_override: raw.trim() !== '' })} /></MobileFieldGroup>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* 7. WWS / huursegmentanalyse */}
            <Section title={`WWS / huursegmentanalyse (${wwsUnits.length})`} status={wwsStatus} defaultOpen={false} hidden={!hasResidential && wwsUnits.length === 0}>
              <div className="pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
                  {components.some((c) => c.component_type === 'woning' || c.component_type === 'appartement') && wwsUnits.length === 0 && (
                    <Button size="sm" variant="outline" onClick={createWwsFromComponents} className="w-full sm:w-auto">Maak WWS-units uit wooncomponenten</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={addWwsUnit} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Woonunit</Button>
                </div>
                {wwsUnits.length === 0 && <p className="text-xs text-muted-foreground">Voeg een woonunit toe om indicatieve WWS-punten en het huursegment te bepalen.</p>}
                {wwsUnits.map((u) => (
                  <div key={u.id} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-muted-foreground">Woonunit</p>
                      <Button size="sm" variant="ghost" onClick={() => deleteWwsUnit(u.id)} className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Woonunit verwijderen</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 min-w-0">
                      <MobileFieldGroup label="Naam"><RawTextInput className="h-9" initialValue={u.unit_name} onCommit={(raw) => updateWwsUnit(u.id, { unit_name: raw.trim() || 'Woonunit' })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Woon m²"><RawNumberInput className="h-9" initialValue={numberToRaw(u.living_area_m2)} onCommit={(raw) => updateWwsUnit(u.id, { living_area_m2: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <MobileFieldGroup label="WOZ (€)"><RawNumberInput className="h-9" initialValue={numberToRaw(u.woz_value)} onCommit={(raw) => updateWwsUnit(u.id, { woz_value: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Energielabel"><RawTextInput className="h-9" initialValue={u.energy_label ?? ''} onCommit={(raw) => updateWwsUnit(u.id, { energy_label: raw.trim() || null })} /></MobileFieldGroup>
                      <MobileFieldGroup label="Maandhuur (€)"><RawNumberInput className="h-9" initialValue={numberToRaw(u.current_monthly_rent)} onCommit={(raw) => updateWwsUnit(u.id, { current_monthly_rent: parseRawNumber(raw) })} /></MobileFieldGroup>
                      <div className="min-w-0 w-full space-y-1.5">
                        <Label className="block text-xs font-medium leading-snug text-foreground whitespace-normal break-words">Punten / segment</Label>
                        <div className="min-h-9 flex items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono-data min-w-0 break-words">{u.wws_points ?? '—'} / {u.rent_segment ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {showHelp && (
                  <BerekeningUitleg>
                    WWS-puntenberekening is in V1 indicatief. Officiële WWS-toetsing blijft nodig. Segmenten: ≤143 punten sociaal, 144–186 middenhuur, ≥187 vrije sector.
                  </BerekeningUitleg>
                )}
              </div>
            </Section>

            {/* 8. Onderbouwing & betrouwbaarheid */}
            <Section title="Onderbouwing & betrouwbaarheid" status={onderbouwingStatus} defaultOpen={false}>
              <div className="pt-3 space-y-3">
                {nogTeControleren.length > 0 && <NogTeControleren items={nogTeControleren} />}
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
