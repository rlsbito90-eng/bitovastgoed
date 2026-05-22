import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Save, CheckCircle2 } from 'lucide-react';
import type { Scenario, ScenarioCost, Component, WwsUnit, TaxSettings } from '@/lib/vastgoedrekenen/types';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { computeWwsPoints } from '@/lib/vastgoedrekenen/wws';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS, VR_OVB_CLASSIFICATION_LABELS, VR_COMPONENT_LABELS } from '@/lib/vastgoedrekenen/defaults';
import {
  ASSUMPTION_PROFILE_LABELS, COST_STRUCTURE_LABELS, RENT_SOURCE_LABELS, MJOP_LABELS, RELIABILITY_LABELS,
  mapToAssumptionType, defaultProfileFor, getAssumptionSet,
  type AssumptionProfileKey, type PropertyAssumptionType,
} from '@/lib/vastgoedrekenen/profiles';
import { buildNogTeControleren, buildAannameWaarschuwingen } from '@/lib/vastgoedrekenen/validation';
import DealSnapshot from './DealSnapshot';
import HelpTooltip from './HelpTooltip';
import BerekeningUitleg from './BerekeningUitleg';
import RekenbasisBar from './RekenbasisBar';
import NoiOpbouw from './NoiOpbouw';
import NogTeControleren from './NogTeControleren';
import { fmtEur } from './format';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
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

function NumInput({ value, onChange, placeholder, suffix }: { value: number | null | undefined; onChange: (n: number | null) => void; placeholder?: string; suffix?: Suffix }) {
  return (
    <div className="relative w-full min-w-0">
      <Input
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`h-9 w-full min-w-0 ${suffix ? 'pr-9' : ''}`}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
    </div>
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

export default function ScenarioEditor(props: Props) {
  const { scenario, taxSettings, objectType, objectArea, viewMode, onUpdate, onDelete } = props;
  const [s, setS] = useState<Scenario>(scenario);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const skipDirtyOnce = useRef(true);
  useEffect(() => { skipDirtyOnce.current = true; setS(scenario); setDirty(false); }, [scenario]);

  const { components, costs, wwsUnits, refetch, upsertOutput } = useScenarioChildren(s.id);

  const propertyType: PropertyAssumptionType = useMemo(
    () => mapToAssumptionType(props.objectRawType ?? null, objectType),
    [props.objectRawType, objectType],
  );

  const outputs = useMemo(() => computeScenario({
    scenario: s,
    components, costs, wwsUnits,
    taxSettings,
    objectType,
    objectArea,
    objectWoz: props.objectWoz,
    objectEnergyLabel: props.objectEnergyLabel,
    objectBouwjaar: props.objectBouwjaar,
    propertyType,
  }), [s, components, costs, wwsUnits, taxSettings, objectType, objectArea, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, propertyType]);

  const nogTeControleren = useMemo(() => buildNogTeControleren({
    scenario: s, components, costs, wwsUnits, objectType, propertyType,
    hasWoz: !!props.objectWoz, hasEnergyLabel: !!props.objectEnergyLabel, hasBouwjaar: !!props.objectBouwjaar,
    energyLabel: props.objectEnergyLabel,
  }), [s, components, costs, wwsUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar]);

  const aannameWaarschuwingen = useMemo(() => buildAannameWaarschuwingen({
    scenario: s, components, costs, wwsUnits, objectType, propertyType,
    hasWoz: !!props.objectWoz, hasEnergyLabel: !!props.objectEnergyLabel, hasBouwjaar: !!props.objectBouwjaar,
    energyLabel: props.objectEnergyLabel,
  }, outputs.totalCorrectionPct), [s, components, costs, wwsUnits, objectType, propertyType, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar, outputs.totalCorrectionPct]);

  const patch = (p: Partial<Scenario>) => {
    setS((prev) => ({ ...prev, ...p }));
    if (skipDirtyOnce.current) { skipDirtyOnce.current = false; return; }
    setDirty(true);
  };

  // Aannameprofiel default zetten als er nog niets is
  useEffect(() => {
    if (!s.assumption_profile) {
      const def = defaultProfileFor(propertyType, s.strategy_type);
      patch({ assumption_profile: def });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType]);

  async function save() {
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
    });
    setDirty(false);
    setLastSavedAt(new Date());
    toast.success('Scenario opgeslagen');
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
  async function addCost() {
    await supabase.from('scenario_costs').insert({ scenario_id: s.id, cost_category: 'Renovatiekosten', amount: 0 });
    refetch();
  }
  async function updateCost(id: string, p: Partial<ScenarioCost>) {
    await supabase.from('scenario_costs').update(p).eq('id', id); refetch();
  }
  async function deleteCost(id: string) {
    await supabase.from('scenario_costs').delete().eq('id', id); refetch();
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
              <Input className="font-semibold text-base w-full" value={s.scenario_name} onChange={(e) => patch({ scenario_name: e.target.value })} />
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

      {/* Nog te controleren */}
      <NogTeControleren items={nogTeControleren} />

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

      {/* Deal Snapshot */}
      <DealSnapshot o={outputs} />

      {/* NOI-opbouw */}
      <NoiOpbouw scenario={s} o={outputs} />

      {/* Aankoopanalyse */}
      <Card>
        <CardHeader><CardTitle className="text-base">Aankoopanalyse</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          <MobileFieldGroup label="Vraagprijs (€)"><NumInput value={s.asking_price} onChange={(v) => patch({ asking_price: v })} placeholder="bijv. 1625000" suffix="€" /></MobileFieldGroup>
          <MobileFieldGroup label="Beoogde aankoopprijs (€)"><NumInput value={s.purchase_price} onChange={(v) => patch({ purchase_price: v })} placeholder="bijv. 1500000" suffix="€" /></MobileFieldGroup>
          <MobileFieldGroup label="Veiligheidsmarge (€)"><NumInput value={s.safety_margin} onChange={(v) => patch({ safety_margin: v })} placeholder="bijv. 25000" suffix="€" /></MobileFieldGroup>

          <MobileFieldGroup label={<span className="inline-flex items-center gap-1">OVB-classificatie {showHelp && <HelpTooltip text="Bij woningen die niet als hoofdverblijf worden gebruikt geldt standaard 8%. Bij niet-woningen 10,4%. Mixed-use: kies per component." />}</span>}>
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
              <MobileFieldGroup label="OVB-percentage handmatig (%)"><NumInput value={s.transfer_tax_percentage} onChange={(v) => patch({ transfer_tax_percentage: v })} placeholder="bijv. 8" suffix="%" /></MobileFieldGroup>
              <MobileFieldGroup label="OVB-bedrag handmatig (€)"><NumInput value={s.transfer_tax_amount} onChange={(v) => patch({ transfer_tax_amount: v })} placeholder="bijv. 130000" suffix="€" /></MobileFieldGroup>
              <div className="col-span-full text-xs text-amber-700 dark:text-amber-300">⚠ OVB is handmatig overschreven. Controleer dit bij twijfel met notaris/fiscalist.</div>
            </>
          )}
          {ovbMode === 'per_component' && (
            <div className="col-span-full text-xs text-muted-foreground">OVB wordt per component berekend. Stel waarde en classificatie per component in (sectie Componenten/units hieronder).</div>
          )}

          <MobileFieldGroup label="Aankoopfee (%) excl. btw"><NumInput value={s.buyer_fee_percentage} onChange={(v) => patch({ buyer_fee_percentage: v })} placeholder="bijv. 2" suffix="%" /></MobileFieldGroup>
          <MobileFieldGroup label="Notariskosten (€)"><NumInput value={s.notary_costs} onChange={(v) => patch({ notary_costs: v })} suffix="€" /></MobileFieldGroup>
          <MobileFieldGroup label="Advieskosten (€)"><NumInput value={s.advisory_costs} onChange={(v) => patch({ advisory_costs: v })} suffix="€" /></MobileFieldGroup>
          <MobileFieldGroup label="Due diligence (€)"><NumInput value={s.due_diligence_costs} onChange={(v) => patch({ due_diligence_costs: v })} suffix="€" /></MobileFieldGroup>
          <MobileFieldGroup label="Overige aankoopkosten (€)"><NumInput value={s.other_acquisition_costs} onChange={(v) => patch({ other_acquisition_costs: v })} suffix="€" /></MobileFieldGroup>
          <MobileFieldGroup label="Financieringskosten (€)"><NumInput value={s.financing_costs} onChange={(v) => patch({ financing_costs: v })} suffix="€" /></MobileFieldGroup>
        </CardContent>
        {showHelp && (
          <CardContent className="pt-0">
            <BerekeningUitleg>
              OVB = aankoopprijs (of componentwaarde) × OVB-percentage. Bij mixed-use wordt de OVB bij voorkeur per component toegerekend op basis van waarde.
              Standaardtarieven: 2% / 8% / 10,4%. Aanpasbaar via Gebruikersbeheer → Vastgoedrekenen-instellingen.
            </BerekeningUitleg>
          </CardContent>
        )}
      </Card>

      {/* Huuranalyse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Huuranalyse</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Deze percentages zijn quickscan-aannames. Ze zijn bedoeld om realistisch en waar nodig conservatief te rekenen, maar moeten vóór bieding worden gecontroleerd op basis van huurcontracten, onderhoudsstaat, servicekosten, VvE, objecttype, locatie en marktdata.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          <MobileFieldGroup label={<span className="inline-flex items-center gap-1">Huurbron {showHelp && <HelpTooltip text="Bepaalt welke huur leidend is voor de berekening." />}</span>}>
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
            <NumInput value={rentFromComponents ? Math.round(outputs.currentAnnualRent / 12) : s.current_monthly_rent} onChange={(v) => patch({ current_monthly_rent: v })} suffix="€" />
          </MobileFieldGroup>
          <MobileFieldGroup label="Markthuur per maand (€)" helper={rentFromComponents ? 'Opgeteld uit componenten' : undefined}>
            <NumInput value={rentFromComponents ? Math.round(outputs.marketAnnualRent / 12) : s.market_monthly_rent} onChange={(v) => patch({ market_monthly_rent: v })} suffix="€" />
          </MobileFieldGroup>
          <MobileFieldGroup label="Handmatige gecorrigeerde maandhuur (€)"><NumInput value={s.manual_corrected_monthly_rent} onChange={(v) => patch({ manual_corrected_monthly_rent: v })} suffix="€" /></MobileFieldGroup>

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
          <MobileFieldGroup label="Leegstand (%)"><NumInput value={s.vacancy_percentage} onChange={(v) => patch({ vacancy_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
          <MobileFieldGroup label="Exploitatie (%)"><NumInput value={s.operating_cost_percentage} onChange={(v) => patch({ operating_cost_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
          <MobileFieldGroup label="Onderhoud (%)"><NumInput value={s.maintenance_reserve_percentage} onChange={(v) => patch({ maintenance_reserve_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
          <MobileFieldGroup label="Beheer (%)"><NumInput value={s.management_cost_percentage} onChange={(v) => patch({ management_cost_percentage: v, assumption_profile: 'handmatig', assumptions_manual: true })} suffix="%" /></MobileFieldGroup>
          <MobileFieldGroup label="Overige jaarlijkse kosten (€)"><NumInput value={s.other_annual_costs} onChange={(v) => patch({ other_annual_costs: v })} suffix="€" /></MobileFieldGroup>
        </CardContent>
        {aannameWaarschuwingen.length > 0 && (
          <CardContent className="pt-0">
            <NogTeControleren items={aannameWaarschuwingen} title="Aanname-waarschuwingen" />
          </CardContent>
        )}
      </Card>

      {/* Controles + onderbouwing */}
      <Card>
        <CardHeader><CardTitle className="text-base">Controles & onderbouwing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
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
            <Input value={s.assumptions_source ?? ''} onChange={(e) => patch({ assumptions_source: e.target.value || null })} placeholder="bv. huurcontracten, MJOP, marktreport, ..." />
          </MobileFieldGroup>
          <MobileFieldGroup label="Reden profielkeuze" className="md:col-span-2 lg:col-span-3">
            <Input value={s.assumption_profile_reason ?? ''} onChange={(e) => patch({ assumption_profile_reason: e.target.value || null })} placeholder="Waarom dit profiel?" />
          </MobileFieldGroup>
        </CardContent>
      </Card>

      {/* Componenten */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Componenten / units ({components.length})</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Gebruik componenten wanneer een object uit meerdere delen bestaat (woningen, winkel, kantoor, bedrijfsunits, kelder, parkeerplaatsen, bergingen). Componenten werken door in huur, WWS, OVB per component, uitpondanalyse en prijs per m².
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addComponent} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Component</Button>
        </CardHeader>

        <CardContent className="space-y-3">
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
                <MobileFieldGroup label="Naam" className="lg:col-span-2"><Input className="h-9" value={c.component_name} onChange={(e) => updateComponent(c.id, { component_name: e.target.value })} /></MobileFieldGroup>
                <MobileFieldGroup label="Type">
                  <Select value={c.component_type} onValueChange={(v) => updateComponent(c.id, { component_type: v as Component['component_type'] })}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </MobileFieldGroup>
                <MobileFieldGroup label="GBO (m²)"><Input className="h-9" type="number" value={c.surface_gbo ?? ''} onChange={(e) => updateComponent(c.id, { surface_gbo: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
                <MobileFieldGroup label="Maandhuur (€)"><Input className="h-9" type="number" value={c.current_monthly_rent ?? ''} onChange={(e) => updateComponent(c.id, { current_monthly_rent: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
                <MobileFieldGroup label="Markthuur/maand (€)"><Input className="h-9" type="number" value={c.market_monthly_rent ?? ''} onChange={(e) => updateComponent(c.id, { market_monthly_rent: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
              </div>
              {ovbMode === 'per_component' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3 min-w-0">
                  <MobileFieldGroup label="Toegerekende waarde (€)"><Input className="h-9" type="number" value={c.allocated_component_value ?? ''} onChange={(e) => updateComponent(c.id, { allocated_component_value: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
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
                  <MobileFieldGroup label="OVB-% (override)"><Input className="h-9" type="number" value={c.transfer_tax_percentage ?? ''} onChange={(e) => updateComponent(c.id, { transfer_tax_percentage: e.target.value === '' ? null : Number(e.target.value), transfer_tax_manual_override: e.target.value !== '' })} /></MobileFieldGroup>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* WWS Units */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">WWS / huursegmentanalyse ({wwsUnits.length})</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {components.some((c) => c.component_type === 'woning' || c.component_type === 'appartement') && wwsUnits.length === 0 && (
              <Button size="sm" variant="outline" onClick={createWwsFromComponents} className="w-full sm:w-auto whitespace-normal sm:whitespace-nowrap text-left sm:text-center h-auto sm:h-9 py-2">Maak WWS-units uit wooncomponenten</Button>
            )}
            <Button size="sm" variant="outline" onClick={addWwsUnit} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Woonunit</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
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
                <MobileFieldGroup label="Naam"><Input className="h-9" value={u.unit_name} onChange={(e) => updateWwsUnit(u.id, { unit_name: e.target.value })} /></MobileFieldGroup>
                <MobileFieldGroup label="Woon m²"><Input className="h-9" type="number" value={u.living_area_m2 ?? ''} onChange={(e) => updateWwsUnit(u.id, { living_area_m2: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
                <MobileFieldGroup label="WOZ (€)"><Input className="h-9" type="number" value={u.woz_value ?? ''} onChange={(e) => updateWwsUnit(u.id, { woz_value: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
                <MobileFieldGroup label="Energielabel"><Input className="h-9" value={u.energy_label ?? ''} onChange={(e) => updateWwsUnit(u.id, { energy_label: e.target.value || null })} /></MobileFieldGroup>
                <MobileFieldGroup label="Maandhuur (€)"><Input className="h-9" type="number" value={u.current_monthly_rent ?? ''} onChange={(e) => updateWwsUnit(u.id, { current_monthly_rent: e.target.value === '' ? null : Number(e.target.value) })} /></MobileFieldGroup>
                <div className="min-w-0 w-full space-y-1.5">
                  <Label className="block text-xs font-medium leading-snug text-foreground whitespace-normal break-words">Punten / segment</Label>
                  <div className="min-h-9 flex items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono-data min-w-0 break-words">{u.wws_points ?? '—'} / {u.rent_segment ?? '—'}</div>
                </div>
              </div>
            </div>
          ))}
          {showHelp && (
            <BerekeningUitleg>
              WWS-puntenberekening is in V1 indicatief: woon-m² + bonussen voor overige m², buitenruimte, keuken/badkamer-kwaliteit, energielabel, WOZ en monumentstatus.
              Officiële WWS-toetsing blijft nodig. Segmenten: ≤143 punten sociaal, 144–186 middenhuur, ≥187 vrije sector.
            </BerekeningUitleg>
          )}
        </CardContent>
      </Card>

      {/* Kosten */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Kosten ({costs.length})</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto min-w-0">
            <div className="w-full sm:w-32 min-w-0">
              <MobileFieldGroup label="Onvoorzien (%)">
                <Input className="h-9" type="number" value={s.unforeseen_percentage ?? ''} onChange={(e) => patch({ unforeseen_percentage: e.target.value === '' ? null : Number(e.target.value) })} />
              </MobileFieldGroup>
            </div>
            <Button size="sm" variant="outline" onClick={addCost} className="w-full sm:w-auto"><Plus className="h-3.5 w-3.5 mr-1" /> Kostenpost</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {costs.length === 0 && <p className="text-xs text-muted-foreground">Voeg handmatige kostenposten toe (renovatie, transformatie, splitsing, verkoopkosten, etc.).</p>}
          {costs.map((c) => (
            <div key={c.id} className="border rounded-md p-3 sm:p-4 space-y-4 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">Kostenpost</p>
                <Button size="sm" variant="ghost" onClick={() => deleteCost(c.id)} className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Kostenpost verwijderen</span>
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 min-w-0">
                <MobileFieldGroup label="Categorie" className="lg:col-span-2"><Input className="h-9" value={c.cost_category} onChange={(e) => updateCost(c.id, { cost_category: e.target.value })} /></MobileFieldGroup>
                <MobileFieldGroup label="Omschrijving" className="lg:col-span-2"><Input className="h-9" value={c.description ?? ''} onChange={(e) => updateCost(c.id, { description: e.target.value || null })} /></MobileFieldGroup>
                <MobileFieldGroup label="Bedrag (€)"><Input className="h-9" type="number" value={c.amount ?? 0} onChange={(e) => updateCost(c.id, { amount: Number(e.target.value || 0) })} /></MobileFieldGroup>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">Totale kosten (incl. {Number(s.unforeseen_percentage ?? 0)}% onvoorzien): {fmtEur(outputs.totalCosts)}</p>
        </CardContent>
      </Card>

      {/* Biedingsadvies */}
      <Card>
        <CardHeader><CardTitle className="text-base">Biedingsadvies</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          <MobileFieldGroup label={<span className="inline-flex items-center gap-1">Gewenste BAR (%) {showHelp && <HelpTooltip text="Bruto aanvangsrendement op totale investering. Hoger = strenger bieden." />}</span>}><NumInput value={s.target_bar} onChange={(v) => patch({ target_bar: v })} suffix="%" /></MobileFieldGroup>
          <div className="col-span-full">
            <BerekeningUitleg>
              Max all-in waarde = gecorrigeerde jaarhuur / gewenste BAR. Daarna worden aankoopkosten, OVB, kosten, financieringskosten en veiligheidsmarge afgetrokken om tot de maximale bieding te komen.
            </BerekeningUitleg>
          </div>
        </CardContent>
      </Card>

      {/* Notities */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notities</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={s.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} placeholder="Eigen aantekeningen bij dit scenario..." rows={3} />
        </CardContent>
      </Card>
    </div>
  );
}
