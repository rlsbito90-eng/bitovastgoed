import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { computeCostBreakdown } from '@/lib/vastgoedrekenen/investering';
import {
  resolveScenarioCostCashflowTiming,
  scenarioCostCashflowTimingPatch,
  type ScenarioCostCashflowTimingMethod,
} from '@/lib/vastgoedrekenen/scenarioCostCashflowTiming';
import { buildScenarioUnleveredCashflow } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import type { Component, Scenario, ScenarioCost, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { fmtEur } from './format';
import ScenarioUnleveredCashflowPreview from './ScenarioUnleveredCashflowPreview';

type Props = {
  units: SellOffUnit[];
  components: Component[];
};

type SavedOutput = {
  total_transfer_tax: number | null;
  total_acquisition_costs: number | null;
  total_costs: number | null;
  total_investment: number | null;
};

type TimingDraft = {
  method: ScenarioCostCashflowTimingMethod | '';
  startMonth: string;
  endMonth: string;
  paymentMonth: string;
};

function scenarioIdFrom(props: Props): string | null {
  const fromUnit = (props.units[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id;
  const fromComponent = (props.components[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id;
  return fromUnit ?? fromComponent ?? null;
}

function toDraft(cost: ScenarioCost): TimingDraft {
  const timing = resolveScenarioCostCashflowTiming(cost);
  return {
    method: timing.method ?? '',
    startMonth: timing.startMonth == null ? '' : String(timing.startMonth),
    endMonth: timing.endMonth == null ? '' : String(timing.endMonth),
    paymentMonth: timing.paymentMonth == null ? '' : String(timing.paymentMonth),
  };
}

export default function ScenarioUnleveredCashflowWorkspace(props: Props) {
  const scenarioId = scenarioIdFrom(props);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
  const [savedOutput, setSavedOutput] = useState<SavedOutput | null>(null);
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [editCostId, setEditCostId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimingDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!scenarioId) {
      setScenario(null);
      setCosts([]);
      setSavedOutput(null);
      setTimeHorizonMonths(null);
      return;
    }

    setLoading(true);
    const untyped = supabase as unknown as { from: (table: string) => any };
    const scenarioResult = await untyped
      .from('calculation_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .maybeSingle();

    if (scenarioResult.error || !scenarioResult.data) {
      toast.error('Scenariokasstroom kon het opgeslagen scenario niet laden.');
      setLoading(false);
      return;
    }

    const [costResult, outputResult, analysisResult] = await Promise.all([
      untyped.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      untyped.from('calculation_outputs').select('total_transfer_tax,total_acquisition_costs,total_costs,total_investment').eq('scenario_id', scenarioId).maybeSingle(),
      untyped.from('real_estate_calculations').select('time_horizon_months').eq('id', scenarioResult.data.calculation_id).maybeSingle(),
    ]);

    setScenario(scenarioResult.data as Scenario);
    setCosts((costResult.data ?? []) as ScenarioCost[]);
    setSavedOutput((outputResult.data as SavedOutput | null) ?? null);
    const horizon = Number(analysisResult.data?.time_horizon_months ?? Number.NaN);
    setTimeHorizonMonths(Number.isInteger(horizon) && horizon > 0 ? horizon : null);
    setLoading(false);
  }, [scenarioId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const result = useMemo(() => {
    if (!scenario) {
      return buildScenarioUnleveredCashflow({
        scenario: { purchase_price: null, financing_costs: null, unforeseen_percentage: null } as Scenario,
        costs: [],
        strategyUnits: props.units,
        timeHorizonMonths,
        savedOutput: null,
      });
    }
    return buildScenarioUnleveredCashflow({
      scenario,
      costs,
      strategyUnits: props.units,
      timeHorizonMonths,
      savedOutput,
    });
  }, [scenario, costs, props.units, timeHorizonMonths, savedOutput]);

  const editCost = editCostId ? costs.find((cost) => cost.id === editCostId) ?? null : null;
  const unforeseenPercentage = Number(scenario?.unforeseen_percentage ?? 0);
  const positiveCosts = costs.filter((cost) => computeCostBreakdown(cost, unforeseenPercentage).includedInInvestment > 0);
  const timedCosts = positiveCosts.filter((cost) => resolveScenarioCostCashflowTiming(cost, timeHorizonMonths).valid).length;

  function openEditor(cost: ScenarioCost) {
    setEditCostId(cost.id);
    setDraft(toDraft(cost));
  }

  function closeEditor() {
    if (saving) return;
    setEditCostId(null);
    setDraft(null);
  }

  async function saveTiming() {
    if (!editCost || !draft) return;
    setSaving(true);
    try {
      const patch = scenarioCostCashflowTimingPatch({
        method: draft.method,
        startMonth: draft.startMonth,
        endMonth: draft.endMonth,
        paymentMonth: draft.paymentMonth,
      });
      const untyped = supabase as unknown as { from: (table: string) => any };
      const { error } = await untyped.from('scenario_costs').update(patch).eq('id', editCost.id);
      if (error) throw new Error(error.message);
      toast.success('Kasstroomtiming kostenpost opgeslagen');
      setEditCostId(null);
      setDraft(null);
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Timing opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  if (!scenarioId) return null;

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-md border bg-muted/20 p-3" aria-label="Timing algemene projectkosten">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Timing algemene projectkosten</h4>
              <Badge variant={positiveCosts.length === timedCosts ? 'default' : 'outline'}>
                {timedCosts}/{positiveCosts.length} getimed
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Alleen de timing wordt hier opgeslagen. Bedrag, btw en onvoorzien blijven afkomstig uit de
              bestaande opgeslagen kostenpost. Niet-opgeslagen wijzigingen in het kostenformulier tellen pas mee na Scenario opslaan.
            </p>
          </div>
          <p className="text-xs text-muted-foreground sm:text-right">
            {timeHorizonMonths ? `Horizon ${timeHorizonMonths} maanden` : 'Geen horizon ingesteld'}
          </p>
        </div>

        {positiveCosts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Geen algemene kostenposten met een positief investeringsbedrag.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {positiveCosts.map((cost) => {
              const timing = resolveScenarioCostCashflowTiming(cost, timeHorizonMonths);
              const amount = computeCostBreakdown(cost, unforeseenPercentage).includedInInvestment;
              const timingLabel = timing.method === 'single'
                ? `Eenmalig in maand ${timing.paymentMonth}`
                : timing.method === 'linear'
                  ? `Lineair maand ${timing.startMonth}–${timing.endMonth}`
                  : 'Nog niet vastgelegd';
              return (
                <div key={cost.id} className="rounded-md border bg-card p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{timing.label}</p>
                      <p className="font-mono-data text-muted-foreground">{fmtEur(amount)}</p>
                      <p className={timing.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
                        {timingLabel}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEditor(cost)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Timing
                    </Button>
                  </div>
                  {timing.warnings.length > 0 && (
                    <p className="mt-2 text-amber-700 dark:text-amber-300">{timing.warnings[0]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ScenarioUnleveredCashflowPreview result={result} loading={loading} />

      <Dialog open={editCost !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-lg">
          {editCost && draft && (
            <>
              <DialogHeader>
                <DialogTitle>Kasstroomtiming — {resolveScenarioCostCashflowTiming(editCost).label}</DialogTitle>
                <DialogDescription>
                  Maanden worden gerekend vanaf de Quickscan-peildatum. Er wordt niets automatisch ingevuld.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Timingmethode</Label>
                  <Select
                    value={draft.method || undefined}
                    onValueChange={(value) => setDraft({
                      ...draft,
                      method: value as ScenarioCostCashflowTimingMethod,
                      startMonth: value === 'single' ? '' : draft.startMonth,
                      endMonth: value === 'single' ? '' : draft.endMonth,
                      paymentMonth: value === 'linear' ? '' : draft.paymentMonth,
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="Kies methode" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Eenmalig in één maand</SelectItem>
                      <SelectItem value="linear">Lineair over een periode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {draft.method === 'single' && (
                  <div className="space-y-1.5">
                    <Label>Betaalmaand</Label>
                    <Input type="number" min={0} max={1200} value={draft.paymentMonth} onChange={(event) => setDraft({ ...draft, paymentMonth: event.target.value })} />
                  </div>
                )}

                {draft.method === 'linear' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Startmaand</Label>
                      <Input type="number" min={0} max={1200} value={draft.startMonth} onChange={(event) => setDraft({ ...draft, startMonth: event.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Eindmaand</Label>
                      <Input type="number" min={0} max={1200} value={draft.endMonth} onChange={(event) => setDraft({ ...draft, endMonth: event.target.value })} />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeEditor} disabled={saving}>Annuleren</Button>
                <Button onClick={saveTiming} disabled={saving || draft.method === ''}>
                  {saving ? 'Opslaan…' : 'Timing opslaan'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
