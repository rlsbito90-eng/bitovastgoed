import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import type { Scenario, ScenarioCost, Component, WwsUnit, TaxSettings } from '@/lib/vastgoedrekenen/types';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { computeWwsPoints } from '@/lib/vastgoedrekenen/wws';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS, VR_OVB_CLASSIFICATION_LABELS, VR_COMPONENT_LABELS } from '@/lib/vastgoedrekenen/defaults';
import DealSnapshot from './DealSnapshot';
import HelpTooltip from './HelpTooltip';
import BerekeningUitleg from './BerekeningUitleg';
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
  viewMode: 'begeleid' | 'compact' | 'expert';
  onUpdate: (id: string, patch: Partial<Scenario>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function NumInput({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (n: number | null) => void; placeholder?: string }) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="h-9"
    />
  );
}

export default function ScenarioEditor(props: Props) {
  const { scenario, taxSettings, objectType, objectArea, viewMode, onUpdate, onDelete } = props;
  const [s, setS] = useState<Scenario>(scenario);
  useEffect(() => setS(scenario), [scenario]);

  const { components, costs, wwsUnits, refetch, upsertOutput } = useScenarioChildren(s.id);

  const outputs = useMemo(() => computeScenario({
    scenario: s,
    components, costs, wwsUnits,
    taxSettings,
    objectType,
    objectArea,
    objectWoz: props.objectWoz,
    objectEnergyLabel: props.objectEnergyLabel,
    objectBouwjaar: props.objectBouwjaar,
  }), [s, components, costs, wwsUnits, taxSettings, objectType, objectArea, props.objectWoz, props.objectEnergyLabel, props.objectBouwjaar]);

  const patch = (p: Partial<Scenario>) => setS((prev) => ({ ...prev, ...p }));

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
    // Recompute punten/segment client-side wanneer relevante velden wijzigen
    const unit = wwsUnits.find((u) => u.id === id);
    let extra: Partial<WwsUnit> = {};
    if (unit) {
      const merged = { ...unit, ...p } as WwsUnit;
      const res = computeWwsPoints(merged, Number(taxSettings?.wws_euro_per_point ?? 6));
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

  const showHelp = viewMode === 'begeleid';

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input className="font-semibold text-base" value={s.scenario_name} onChange={(e) => patch({ scenario_name: e.target.value })} />
              {showHelp && <p className="text-xs text-muted-foreground mt-1">Geef het scenario een korte, herkenbare naam.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={s.strategy_type} onValueChange={(v) => patch({ strategy_type: v as Scenario['strategy_type'] })}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={s.status} onValueChange={(v) => patch({ status: v as Scenario['status'] })}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="default" onClick={save}>Opslaan</Button>
              <Button variant="outline" size="icon" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Deal Snapshot bovenaan */}
      <DealSnapshot o={outputs} />

      {/* Aankoopanalyse */}
      <Card>
        <CardHeader><CardTitle className="text-base">Aankoopanalyse</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>Vraagprijs</Label><NumInput value={s.asking_price} onChange={(v) => patch({ asking_price: v })} /></div>
          <div><Label>Beoogde aankoopprijs</Label><NumInput value={s.purchase_price} onChange={(v) => patch({ purchase_price: v })} /></div>
          <div><Label>Veiligheidsmarge</Label><NumInput value={s.safety_margin} onChange={(v) => patch({ safety_margin: v })} /></div>

          <div>
            <Label className="flex items-center gap-1">OVB-classificatie {showHelp && <HelpTooltip text="Bij woningen die niet als hoofdverblijf worden gebruikt geldt standaard 8%. Bij niet-woningen 10,4%. Mixed-use: kies per component." />}</Label>
            <Select value={s.ovb_classification} onValueChange={(v) => patch({ ovb_classification: v as Scenario['ovb_classification'] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(VR_OVB_CLASSIFICATION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>OVB-modus</Label>
            <Select value={s.ovb_mode} onValueChange={(v) => patch({ ovb_mode: v as Scenario['ovb_mode'] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatisch</SelectItem>
                <SelectItem value="manual">Handmatig</SelectItem>
                <SelectItem value="per_component">Per component</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>OVB-percentage (override)</Label>
            <NumInput value={s.transfer_tax_percentage} onChange={(v) => patch({ transfer_tax_percentage: v })} placeholder="bv. 8" />
          </div>

          <div><Label>Aankoopfee % (excl. btw)</Label><NumInput value={s.buyer_fee_percentage} onChange={(v) => patch({ buyer_fee_percentage: v })} /></div>
          <div><Label>Notariskosten</Label><NumInput value={s.notary_costs} onChange={(v) => patch({ notary_costs: v })} /></div>
          <div><Label>Advieskosten</Label><NumInput value={s.advisory_costs} onChange={(v) => patch({ advisory_costs: v })} /></div>
          <div><Label>Due diligence</Label><NumInput value={s.due_diligence_costs} onChange={(v) => patch({ due_diligence_costs: v })} /></div>
          <div><Label>Overige aankoopkosten</Label><NumInput value={s.other_acquisition_costs} onChange={(v) => patch({ other_acquisition_costs: v })} /></div>
          <div><Label>Financieringskosten</Label><NumInput value={s.financing_costs} onChange={(v) => patch({ financing_costs: v })} /></div>
        </CardContent>
        {showHelp && (
          <CardContent className="pt-0">
            <BerekeningUitleg>
              OVB = aankoopprijs (of componentwaarde) × OVB-percentage. Bij mixed-use wordt de OVB bij voorkeur per component toegerekend op basis van waarde.
              Voor V1: standaardtarieven 2% / 8% / 10,4%. Centraal aanpasbaar via Gebruikersbeheer → Vastgoedrekenen-instellingen.
            </BerekeningUitleg>
          </CardContent>
        )}
      </Card>

      {/* Huuranalyse */}
      <Card>
        <CardHeader><CardTitle className="text-base">Huuranalyse</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>Huidige maandhuur</Label><NumInput value={s.current_monthly_rent} onChange={(v) => patch({ current_monthly_rent: v })} /></div>
          <div><Label>Markthuur per maand</Label><NumInput value={s.market_monthly_rent} onChange={(v) => patch({ market_monthly_rent: v })} /></div>
          <div><Label>Handmatige gecorrigeerde maandhuur</Label><NumInput value={s.manual_corrected_monthly_rent} onChange={(v) => patch({ manual_corrected_monthly_rent: v })} /></div>
          <div>
            <Label className="flex items-center gap-1">Huur voor berekening {showHelp && <HelpTooltip text="Bij wonen + sociaal/middenhuur wordt standaard de WWS-huur gebruikt. Anders huidig of markt." />}</Label>
            <Select value={s.rent_choice ?? 'huidig'} onValueChange={(v) => patch({ rent_choice: v as Scenario['rent_choice'] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="huidig">Huidige huur</SelectItem>
                <SelectItem value="markt">Markthuur</SelectItem>
                <SelectItem value="wws">WWS-gecorrigeerd</SelectItem>
                <SelectItem value="handmatig">Handmatig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Leegstand %</Label><NumInput value={s.vacancy_percentage} onChange={(v) => patch({ vacancy_percentage: v })} /></div>
          <div><Label>Exploitatie %</Label><NumInput value={s.operating_cost_percentage} onChange={(v) => patch({ operating_cost_percentage: v })} /></div>
          <div><Label>Onderhoud %</Label><NumInput value={s.maintenance_reserve_percentage} onChange={(v) => patch({ maintenance_reserve_percentage: v })} /></div>
          <div><Label>Beheer %</Label><NumInput value={s.management_cost_percentage} onChange={(v) => patch({ management_cost_percentage: v })} /></div>
          <div><Label>Overige jaarlijkse kosten</Label><NumInput value={s.other_annual_costs} onChange={(v) => patch({ other_annual_costs: v })} /></div>
        </CardContent>
      </Card>

      {/* Componenten */}
      {(objectType === 'mixed_use' || components.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Componenten / units ({components.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={addComponent}><Plus className="h-3.5 w-3.5 mr-1" /> Component</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {components.length === 0 && <p className="text-xs text-muted-foreground">Nog geen componenten. Bij mixed-use is dit aanbevolen.</p>}
            {components.map((c) => (
              <div key={c.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end border rounded-md p-2">
                <div className="col-span-2"><Label className="text-xs">Naam</Label><Input className="h-8" value={c.component_name} onChange={(e) => updateComponent(c.id, { component_name: e.target.value })} /></div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={c.component_type} onValueChange={(v) => updateComponent(c.id, { component_type: v as Component['component_type'] })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">m² GBO</Label><Input className="h-8" type="number" value={c.surface_gbo ?? ''} onChange={(e) => updateComponent(c.id, { surface_gbo: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Maandhuur</Label><Input className="h-8" type="number" value={c.current_monthly_rent ?? ''} onChange={(e) => updateComponent(c.id, { current_monthly_rent: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                <div className="flex items-end justify-end"><Button size="icon" variant="ghost" onClick={() => deleteComponent(c.id)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* WWS Units */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">WWS / huursegmentanalyse ({wwsUnits.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={addWwsUnit}><Plus className="h-3.5 w-3.5 mr-1" /> Woonunit</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {wwsUnits.length === 0 && <p className="text-xs text-muted-foreground">Voeg een woonunit toe om indicatieve WWS-punten en het huursegment te bepalen.</p>}
          {wwsUnits.map((u) => (
            <div key={u.id} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-end border rounded-md p-2">
              <div><Label className="text-xs">Naam</Label><Input className="h-8" value={u.unit_name} onChange={(e) => updateWwsUnit(u.id, { unit_name: e.target.value })} /></div>
              <div><Label className="text-xs">Woon m²</Label><Input className="h-8" type="number" value={u.living_area_m2 ?? ''} onChange={(e) => updateWwsUnit(u.id, { living_area_m2: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">WOZ</Label><Input className="h-8" type="number" value={u.woz_value ?? ''} onChange={(e) => updateWwsUnit(u.id, { woz_value: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Energielabel</Label><Input className="h-8" value={u.energy_label ?? ''} onChange={(e) => updateWwsUnit(u.id, { energy_label: e.target.value || null })} /></div>
              <div><Label className="text-xs">Maandhuur</Label><Input className="h-8" type="number" value={u.current_monthly_rent ?? ''} onChange={(e) => updateWwsUnit(u.id, { current_monthly_rent: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="text-xs">
                <Label className="text-xs">Punten / segment</Label>
                <div className="h-8 flex items-center font-mono-data">{u.wws_points ?? '—'} / {u.rent_segment ?? '—'}</div>
              </div>
              <div className="flex items-end justify-end"><Button size="icon" variant="ghost" onClick={() => deleteWwsUnit(u.id)}><Trash2 className="h-4 w-4" /></Button></div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Kosten ({costs.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Onvoorzien %</Label>
            <Input className="h-8 w-20" type="number" value={s.unforeseen_percentage ?? ''} onChange={(e) => patch({ unforeseen_percentage: e.target.value === '' ? null : Number(e.target.value) })} />
            <Button size="sm" variant="outline" onClick={addCost}><Plus className="h-3.5 w-3.5 mr-1" /> Kostenpost</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {costs.length === 0 && <p className="text-xs text-muted-foreground">Voeg handmatige kostenposten toe (renovatie, transformatie, splitsing, verkoopkosten, etc.).</p>}
          {costs.map((c) => (
            <div key={c.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end border rounded-md p-2">
              <div className="col-span-2"><Label className="text-xs">Categorie</Label><Input className="h-8" value={c.cost_category} onChange={(e) => updateCost(c.id, { cost_category: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Omschrijving</Label><Input className="h-8" value={c.description ?? ''} onChange={(e) => updateCost(c.id, { description: e.target.value || null })} /></div>
              <div><Label className="text-xs">Bedrag</Label><Input className="h-8" type="number" value={c.amount ?? 0} onChange={(e) => updateCost(c.id, { amount: Number(e.target.value || 0) })} /></div>
              <div className="flex items-end justify-end"><Button size="icon" variant="ghost" onClick={() => deleteCost(c.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">Totale kosten (incl. {Number(s.unforeseen_percentage ?? 0)}% onvoorzien): {fmtEur(outputs.totalCosts)}</p>
        </CardContent>
      </Card>

      {/* Biedingsadvies */}
      <Card>
        <CardHeader><CardTitle className="text-base">Biedingsadvies</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label className="flex items-center gap-1">Gewenste BAR % {showHelp && <HelpTooltip text="Bruto aanvangsrendement op totale investering. Hoger = strenger bieden." />}</Label><NumInput value={s.target_bar} onChange={(v) => patch({ target_bar: v })} /></div>
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
