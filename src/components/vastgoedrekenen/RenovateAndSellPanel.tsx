import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Hammer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import type { RenovateAndSellInput, RenovationCostBasis, RenovateAndSellSaleValueSource } from '@/lib/vastgoedrekenen/propositions';
import {
  OTHER_PROJECT_COST_KEY,
  RENOVATION_COST_KEY,
  TEMPORARY_INCOME_WARNING,
  saveRenovateAndSellInput,
} from '@/lib/vastgoedrekenen/propositions';
import { renovateAndSellCostNote } from '@/lib/vastgoedrekenen/propositions/adapters/saveRenovateAndSell';

type Props = {
  scenario: Scenario;
  onSaved: () => Promise<unknown> | void;
};

const numberValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min="0" step="1" value={value || ''} onChange={(event) => onChange(numberValue(event.target.value))} />
    </div>
  );
}

export default function RenovateAndSellPanel({ scenario, onSaved }: Props) {
  const rec = scenario as unknown as Record<string, unknown>;
  const [busy, setBusy] = useState(false);
  const [renovationCostBasis, setRenovationCostBasis] = useState<RenovationCostBasis>('total');
  const [saleValueSource, setSaleValueSource] = useState<RenovateAndSellSaleValueSource>((rec.sale_price_source as RenovateAndSellSaleValueSource) ?? 'total');
  const [purchasePrice, setPurchasePrice] = useState(numberValue(rec.purchase_price));
  const [renovationAreaM2, setRenovationAreaM2] = useState(numberValue(rec.renovation_area_m2));
  const [renovationCostsTotal, setRenovationCostsTotal] = useState(0);
  const [renovationCostsPerM2, setRenovationCostsPerM2] = useState(0);
  const [otherProjectCosts, setOtherProjectCosts] = useState(0);
  const [unforeseenPercentage, setUnforeseenPercentage] = useState(numberValue(rec.unforeseen_percentage));
  const [financingCosts, setFinancingCosts] = useState(numberValue(rec.financing_costs));
  const [projectDurationMonths, setProjectDurationMonths] = useState(numberValue(rec.project_duration_months));
  const [grossSaleValue, setGrossSaleValue] = useState(numberValue(rec.sale_price_total));
  const [saleValuePerM2, setSaleValuePerM2] = useState(numberValue(rec.sale_price_per_m2));
  const [sellableAreaM2, setSellableAreaM2] = useState(numberValue(rec.sale_sellable_m2));
  const [saleCostsPercentage, setSaleCostsPercentage] = useState(numberValue(rec.sale_costs_percentage));
  const [saleOtherCosts, setSaleOtherCosts] = useState(numberValue(rec.sale_other_costs));
  const [targetMarginAmount, setTargetMarginAmount] = useState(numberValue(rec.sale_target_margin_amount));
  const [targetMarginPercentageOfGdv, setTargetMarginPercentageOfGdv] = useState(numberValue(rec.sale_target_margin_percentage));
  const [targetRoiPercentage, setTargetRoiPercentage] = useState(numberValue(rec.sale_target_roi_percentage));
  const [temporaryProjectIncome, setTemporaryProjectIncome] = useState(numberValue(rec.temporary_project_income));
  const [temporaryProjectIncomeCosts, setTemporaryProjectIncomeCosts] = useState(numberValue(rec.temporary_project_income_costs));

  useEffect(() => {
    let active = true;
    const loadCosts = async () => {
      const { data } = await supabase.from('scenario_costs').select('*').eq('scenario_id', scenario.id);
      if (!active) return;
      for (const row of data ?? []) {
        if (row.notes === renovateAndSellCostNote({ ownershipKey: RENOVATION_COST_KEY, category: 'bouwkosten', description: '', amount: 0, source: 'proposition:renovate_and_sell' })) {
          setRenovationCostsTotal(numberValue(row.amount));
        }
        if (row.notes === renovateAndSellCostNote({ ownershipKey: OTHER_PROJECT_COST_KEY, category: 'overig', description: '', amount: 0, source: 'proposition:renovate_and_sell' })) {
          setOtherProjectCosts(numberValue(row.amount));
        }
      }
    };
    loadCosts();
    return () => { active = false; };
  }, [scenario.id]);

  const indicatedGdv = useMemo(() => saleValueSource === 'per_m2'
    ? saleValuePerM2 * sellableAreaM2
    : grossSaleValue, [saleValueSource, saleValuePerM2, sellableAreaM2, grossSaleValue]);

  async function save() {
    const input: RenovateAndSellInput = {
      purchasePrice,
      renovationAreaM2,
      renovationCostBasis,
      renovationCostsTotal,
      renovationCostsPerM2,
      otherProjectCosts,
      unforeseenPercentage,
      financingCosts,
      projectDurationMonths: projectDurationMonths || undefined,
      saleValueSource,
      grossSaleValue,
      saleValuePerM2,
      sellableAreaM2,
      saleCostsPercentage,
      saleOtherCosts,
      targetMarginAmount,
      targetMarginPercentageOfGdv,
      targetRoiPercentage,
      temporaryProjectIncome,
      temporaryProjectIncomeCosts,
      sources: [],
    };
    setBusy(true);
    try {
      const result = await saveRenovateAndSellInput(scenario, input);
      if (!result.ok) {
        toast.error('message' in result ? result.message : 'Opslaan mislukt');
        return;
      }
      toast.success('Renovatiepropositie opgeslagen');
      const warnings = 'warnings' in result ? result.warnings : [];
      warnings.forEach((warning) => toast.warning(warning));
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4 border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Hammer className="h-4 w-4" /> Renoveren en doorverkopen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MoneyField label="Aankoopprijs" value={purchasePrice} onChange={setPurchasePrice} />
          <MoneyField label="Renovatieoppervlak (m²)" value={renovationAreaM2} onChange={setRenovationAreaM2} />
          <MoneyField label="Looptijd (maanden)" value={projectDurationMonths} onChange={setProjectDurationMonths} />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Kostengrondslag renovatie</Label>
              <Select value={renovationCostBasis} onValueChange={(value) => setRenovationCostBasis(value as RenovationCostBasis)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="total">Totaalbedrag</SelectItem><SelectItem value="per_m2">Per m²</SelectItem></SelectContent>
              </Select>
            </div>
            {renovationCostBasis === 'total'
              ? <MoneyField label="Renovatiekosten totaal" value={renovationCostsTotal} onChange={setRenovationCostsTotal} />
              : <MoneyField label="Renovatiekosten per m²" value={renovationCostsPerM2} onChange={setRenovationCostsPerM2} />}
            <MoneyField label="Overige projectkosten" value={otherProjectCosts} onChange={setOtherProjectCosts} />
            <MoneyField label="Onvoorzien (%)" value={unforeseenPercentage} onChange={setUnforeseenPercentage} />
            <MoneyField label="Financieringskosten" value={financingCosts} onChange={setFinancingCosts} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Bron verkoopwaarde</Label>
            <Select value={saleValueSource} onValueChange={(value) => setSaleValueSource(value as RenovateAndSellSaleValueSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="total">Totaal</SelectItem><SelectItem value="per_m2">Prijs per m²</SelectItem></SelectContent>
            </Select>
          </div>
          {saleValueSource === 'total' ? (
            <MoneyField label="Bruto verkoopwaarde (GDV)" value={grossSaleValue} onChange={setGrossSaleValue} />
          ) : (
            <>
              <MoneyField label="Verkoopwaarde per m²" value={saleValuePerM2} onChange={setSaleValuePerM2} />
              <MoneyField label="Verkoopbaar oppervlak (m²)" value={sellableAreaM2} onChange={setSellableAreaM2} />
            </>
          )}
          <div className="rounded-md border bg-muted/30 p-3 text-sm"><span className="text-muted-foreground">Indicatieve bruto GDV</span><div className="font-semibold">{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(indicatedGdv)}</div></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MoneyField label="Verkoopkosten (%)" value={saleCostsPercentage} onChange={setSaleCostsPercentage} />
          <MoneyField label="Overige verkoopkosten" value={saleOtherCosts} onChange={setSaleOtherCosts} />
          <MoneyField label="Doelwinst (€)" value={targetMarginAmount} onChange={setTargetMarginAmount} />
          <MoneyField label="Winst op GDV (%)" value={targetMarginPercentageOfGdv} onChange={setTargetMarginPercentageOfGdv} />
          <MoneyField label="ROI op totale investering (%)" value={targetRoiPercentage} onChange={setTargetRoiPercentage} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MoneyField label="Tijdelijke projectinkomsten" value={temporaryProjectIncome} onChange={setTemporaryProjectIncome} />
          <MoneyField label="Directe kosten tijdelijke inkomsten" value={temporaryProjectIncomeCosts} onChange={setTemporaryProjectIncomeCosts} />
        </div>
        {(temporaryProjectIncome > 0 || temporaryProjectIncomeCosts > 0) && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {TEMPORARY_INCOME_WARNING}
          </div>
        )}

        <div className="flex justify-end"><Button onClick={save} disabled={busy}>{busy ? 'Opslaan…' : 'Renovatiepropositie opslaan'}</Button></div>
      </CardContent>
    </Card>
  );
}
