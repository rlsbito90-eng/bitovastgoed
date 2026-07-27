import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Info, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import type { GuardedScenarioPatch } from '@/lib/vastgoedrekenen/saveGuards';
import {
  comparativeExitScenarioPatch,
  computeComparativeValuation,
  type ComparativeMethod,
  type ComparativePriceType,
  type ComparativeReferenceInput,
} from '@/lib/vastgoedrekenen/comparativeValuation';
import { resolveAnalysisPropositionMetadata } from '@/lib/vastgoedrekenen/analysis';
import { getPropositionDefinition } from '@/lib/vastgoedrekenen/propositions';

type ReferenceRow = {
  id: string;
  adres: string;
  plaats: string;
  asset_class: string;
  m2: number;
  vraagprijs: number;
  prijs_per_m2: number | null;
  price_type?: ComparativePriceType | null;
  transaction_date?: string | null;
  valuation_date?: string | null;
  source_reference?: string | null;
  source_reliability?: 'high' | 'medium' | 'low' | 'unknown' | null;
};

type DraftReference = ReferenceRow & {
  included: boolean;
  locationPct: number;
  sizePct: number;
  conditionPct: number;
  energyPct: number;
  occupancyPct: number;
  otherPct: number;
  weight: number;
};

type Props = {
  scenario: Scenario;
  onUpdateScenario: (id: string, patch: GuardedScenarioPatch) => Promise<void>;
};

const money = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const untyped = supabase as unknown as { from: (table: string) => any };

export default function ComparativeValuationPanel({ scenario, onUpdateScenario }: Props) {
  const rec = scenario as unknown as Record<string, unknown>;
  const [supported, setSupported] = useState(false);
  const [references, setReferences] = useState<DraftReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<ComparativeMethod>('median');
  const [purpose, setPurpose] = useState<'current_market_value' | 'exit_value' | 'component_value'>('current_market_value');
  const [subjectAreaM2, setSubjectAreaM2] = useState(Number(rec.sale_sellable_m2 ?? rec.renovation_area_m2 ?? 0));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const analysisRes = await untyped.from('real_estate_calculations').select('proposition_type, proposition_schema_version').eq('id', scenario.calculation_id).single();
      if (!active) return;
      const metadata = resolveAnalysisPropositionMetadata(analysisRes.data ?? {});
      const definition = getPropositionDefinition(metadata.propositionType);
      const isSupported = definition.leadingValuationMethods.includes('comparative_market');
      setSupported(isSupported);
      if (!isSupported) { setLoading(false); return; }
      if (metadata.propositionType === 'renovate_and_sell') setPurpose('exit_value');

      const refsRes = await untyped.from('referentie_objecten').select('*').is('soft_deleted_at', null).order('updated_at', { ascending: false }).limit(50);
      if (!active) return;
      setReferences((refsRes.data ?? []).map((row: ReferenceRow) => ({
        ...row,
        included: false,
        locationPct: 0,
        sizePct: 0,
        conditionPct: 0,
        energyPct: 0,
        occupancyPct: 0,
        otherPct: 0,
        weight: 1,
      })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [scenario.calculation_id]);

  const inputReferences: ComparativeReferenceInput[] = useMemo(() => references.map((reference) => ({
    id: reference.id,
    included: reference.included,
    price: Number(reference.vraagprijs ?? 0),
    areaM2: Number(reference.m2 ?? 0),
    unitPrice: reference.prijs_per_m2 == null ? null : Number(reference.prijs_per_m2),
    priceType: reference.price_type ?? 'asking_price',
    transactionDate: reference.transaction_date,
    valuationDate: reference.valuation_date,
    sourceReference: reference.source_reference,
    sourceReliability: reference.source_reliability,
    weight: reference.weight,
    adjustments: {
      locationPct: reference.locationPct,
      sizePct: reference.sizePct,
      conditionPct: reference.conditionPct,
      energyPct: reference.energyPct,
      occupancyPct: reference.occupancyPct,
      otherPct: reference.otherPct,
    },
  })), [references]);

  const result = useMemo(() => computeComparativeValuation({
    subjectAreaM2,
    basis: 'per_m2',
    method,
    valuationDate: new Date().toISOString().slice(0, 10),
    references: inputReferences,
  }), [subjectAreaM2, method, inputReferences]);

  const updateReference = (id: string, patch: Partial<DraftReference>) => setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, ...patch } : reference));

  async function saveValuation() {
    if (!result.valid) { toast.error('Los eerst de blokkerende waarderingsmeldingen op.'); return; }
    setSaving(true);
    try {
      const valuationRes = await untyped.from('comparative_valuations').insert({
        calculation_id: scenario.calculation_id,
        scenario_id: scenario.id,
        object_id: scenario.object_id,
        purpose,
        basis: 'per_m2',
        method,
        subject_area_m2: subjectAreaM2,
        indicated_unit_value: result.centralUnitValue,
        indicated_total_value: result.indicatedTotalValue,
        lower_value: result.lowerTotalValue,
        upper_value: result.upperTotalValue,
        reliability: result.reliability,
        valuation_date: new Date().toISOString().slice(0, 10),
      }).select('id').single();
      if (valuationRes.error || !valuationRes.data) throw new Error(valuationRes.error?.message ?? 'Waardering opslaan mislukt');

      const adjustedById = new Map(result.adjustedUnitValues.map((value) => [value.referenceId, value]));
      const snapshots = references.filter((reference) => reference.included).map((reference) => ({
        valuation_id: valuationRes.data.id,
        reference_object_id: reference.id,
        included: true,
        snapshot_address: reference.adres,
        snapshot_place: reference.plaats,
        snapshot_asset_class: reference.asset_class,
        snapshot_price_type: reference.price_type ?? 'asking_price',
        snapshot_price: reference.vraagprijs,
        snapshot_area_m2: reference.m2,
        snapshot_unit_price: reference.prijs_per_m2,
        snapshot_transaction_date: reference.transaction_date,
        snapshot_valuation_date: reference.valuation_date,
        snapshot_source_reference: reference.source_reference,
        snapshot_source_reliability: reference.source_reliability,
        location_adjustment_pct: reference.locationPct,
        size_adjustment_pct: reference.sizePct,
        condition_adjustment_pct: reference.conditionPct,
        energy_adjustment_pct: reference.energyPct,
        occupancy_adjustment_pct: reference.occupancyPct,
        other_adjustment_pct: reference.otherPct,
        adjusted_unit_price: adjustedById.get(reference.id)?.adjustedUnitValue ?? null,
        weight: reference.weight,
      }));
      const snapshotRes = await untyped.from('comparative_valuation_references').insert(snapshots);
      if (snapshotRes.error) {
        await untyped.from('comparative_valuations').delete().eq('id', valuationRes.data.id);
        throw new Error(`Referentiesnapshot opslaan mislukt: ${snapshotRes.error.message}`);
      }
      setSavedAt(new Date().toISOString());
      toast.success('Comparatieve waardering en referentiesnapshots opgeslagen');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Waardering opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  async function applyExitValue() {
    const patch = comparativeExitScenarioPatch(result, subjectAreaM2);
    await onUpdateScenario(scenario.id, patch as GuardedScenarioPatch);
    setConfirmOpen(false);
    toast.success('Comparatieve waarde toegepast als leidende verkoopwaarde');
  }

  if (loading) return <Card className="mb-4"><CardContent className="p-4 text-xs text-muted-foreground">Comparatieve waardering laden…</CardContent></Card>;
  if (!supported) return null;

  const selected = references.filter((reference) => reference.included);
  const oldUnitValue = Number(rec.sale_price_per_m2 ?? 0);

  return (
    <Card className="mb-4 border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Comparatieve marktwaardering</CardTitle>
        <p className="text-xs text-muted-foreground">Scenario-specifieke indicatie met bevroren referenties. Dit is geen taxatie.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Doel</Label><Select value={purpose} onValueChange={(value) => setPurpose(value as typeof purpose)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current_market_value">Huidige marktwaarde</SelectItem><SelectItem value="exit_value">Exitwaarde / GDV</SelectItem><SelectItem value="component_value">Componentwaarde</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Waarderingsoppervlak (m²)</Label><Input type="number" min="0" value={subjectAreaM2 || ''} onChange={(event) => setSubjectAreaM2(numberValue(event.target.value))} /></div>
          <div className="space-y-1.5"><Label>Methode</Label><Select value={method} onValueChange={(value) => setMethod(value as ComparativeMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="median">Mediaan</SelectItem><SelectItem value="weighted_average">Gewogen gemiddelde</SelectItem></SelectContent></Select></div>
        </div>

        <div className="space-y-2">
          {references.map((reference) => {
            const adjusted = result.adjustedUnitValues.find((value) => value.referenceId === reference.id);
            return <div key={reference.id} className={`rounded-md border p-3 ${reference.included ? 'border-primary/40 bg-primary/[0.03]' : 'bg-muted/20'}`}>
              <div className="flex items-start gap-3">
                <Checkbox checked={reference.included} onCheckedChange={(checked) => updateReference(reference.id, { included: checked === true })} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{reference.adres} · {reference.plaats}</p><span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{reference.price_type === 'transaction_price' ? 'Transactieprijs' : reference.price_type === 'valuation' ? 'Taxatiewaarde' : 'Vraagprijs'}</span></div>
                  <p className="text-xs text-muted-foreground mt-1">{money(reference.vraagprijs)} · {reference.m2} m² · oorspronkelijk {money(reference.prijs_per_m2)}/m² · bron {reference.source_reference || 'ontbreekt'}</p>
                  {reference.included && <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mt-3">
                    {([['Locatie', 'locationPct'], ['Omvang', 'sizePct'], ['Staat', 'conditionPct'], ['Energie', 'energyPct'], ['Verhuur', 'occupancyPct'], ['Overig', 'otherPct'], ['Gewicht', 'weight']] as const).map(([label, key]) => <div key={key} className="space-y-1"><Label className="text-[10px]">{label}{key === 'weight' ? '' : ' %'}</Label><Input type="number" step="0.5" value={reference[key]} onChange={(event) => updateReference(reference.id, { [key]: numberValue(event.target.value) })} /></div>)}
                  </div>}
                  {adjusted && <p className="mt-2 text-xs font-medium">Gecorrigeerd: {money(adjusted.adjustedUnitValue)}/m² ({adjusted.totalAdjustmentPct >= 0 ? '+' : ''}{adjusted.totalAdjustmentPct}%)</p>}
                </div>
              </div>
            </div>;
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Referenties</p><p className="font-semibold">{selected.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Hoofdwaarde €/m²</p><p className="font-semibold">{money(result.centralUnitValue)}</p></div>
          <div><p className="text-xs text-muted-foreground">Indicatieve totaalwaarde</p><p className="font-semibold">{money(result.indicatedTotalValue)}</p></div>
          <div><p className="text-xs text-muted-foreground">Bandbreedte</p><p className="font-semibold">{money(result.lowerTotalValue)} – {money(result.upperTotalValue)}</p></div>
        </div>

        <div className="rounded-md border p-3 text-xs space-y-1"><p className="font-medium flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Betrouwbaarheid: {result.reliability}</p>{result.issues.map((issue) => <p key={`${issue.code}-${issue.referenceId ?? ''}`} className={issue.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}>• {issue.message}</p>)}{result.explanation.map((line) => <p key={line} className="text-muted-foreground">• {line}</p>)}</div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">{savedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Opgeslagen {new Date(savedAt).toLocaleString('nl-NL')}</span>}</div>
          <div className="flex flex-col sm:flex-row gap-2"><Button variant="outline" disabled={saving || !result.valid} onClick={saveValuation}><Save className="h-4 w-4 mr-1" /> {saving ? 'Opslaan…' : 'Waardering opslaan'}</Button>{purpose === 'exit_value' && <Button disabled={!result.valid} onClick={() => setConfirmOpen(true)}>Toepassen als verkoopwaarde</Button>}</div>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent><DialogHeader><DialogTitle>Comparatieve waarde toepassen?</DialogTitle><DialogDescription>Alleen de leidende verkoopbron wordt aangepast. Alternatieve verkoopwaarden worden niet gewist.</DialogDescription></DialogHeader><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Huidige €/m²</span><strong>{money(oldUnitValue)}</strong></div><div className="flex justify-between"><span>Nieuwe €/m²</span><strong>{money(result.centralUnitValue)}</strong></div><div className="flex justify-between"><span>Nieuwe bruto verkoopwaarde/GDV</span><strong>{money(result.indicatedTotalValue)}</strong></div><div className="flex justify-between"><span>Verschil €/m²</span><strong>{money((result.centralUnitValue ?? 0) - oldUnitValue)}</strong></div><p className="text-xs text-muted-foreground">Verkoopkosten blijven apart en worden niet in deze waardering afgetrokken.</p></div><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuleren</Button><Button onClick={applyExitValue}>Bevestigen en toepassen</Button></DialogFooter></DialogContent></Dialog>
    </Card>
  );
}
