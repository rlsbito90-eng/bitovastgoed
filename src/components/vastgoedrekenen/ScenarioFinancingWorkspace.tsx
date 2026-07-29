import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { buildScenarioUnleveredCashflow } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import {
  buildScenarioFinancing,
  type FinancingDrawMethod,
  type FinancingFacilityType,
  type FinancingInterestMethod,
  type FinancingRepaymentMethod,
  type ScenarioFinancingFacility,
} from '@/lib/vastgoedrekenen/scenarioFinancing';
import {
  buildFinancingFacilityPayload,
  type FinancingFacilityDraft,
} from '@/lib/vastgoedrekenen/scenarioFinancingPersistence';
import type { Component, Scenario, ScenarioCost, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtNum, fmtPct } from './format';

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

type Draft = FinancingFacilityDraft & { localId: string };

const FACILITY_LABELS: Record<FinancingFacilityType, string> = {
  acquisition: 'Aankoopfinanciering',
  development: 'Bouw- of ontwikkelfinanciering',
  bridge: 'Overbruggingsfinanciering',
  mortgage: 'Langlopende hypotheek',
  other: 'Overig',
};

function scenarioIdFrom(props: Props): string | null {
  const fromUnit = (props.units[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id;
  const fromComponent = (props.components[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id;
  return fromUnit ?? fromComponent ?? null;
}

function displayNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

function draftFromFacility(facility: ScenarioFinancingFacility): Draft {
  return {
    localId: facility.id,
    id: facility.id,
    scenarioId: facility.scenario_id,
    facilityName: facility.facility_name,
    facilityType: facility.facility_type,
    commitmentAmount: displayNumber(facility.commitment_amount),
    drawMethod: facility.draw_method,
    drawStartMonth: displayNumber(facility.draw_start_month),
    annualInterestRatePct: displayNumber(facility.annual_interest_rate_pct),
    interestMethod: facility.interest_method,
    arrangementFeePct: displayNumber(facility.arrangement_fee_pct),
    arrangementFeeAmount: displayNumber(facility.arrangement_fee_amount),
    repaymentMethod: facility.repayment_method,
    amortizationStartMonth: displayNumber(facility.amortization_start_month),
    maturityMonth: displayNumber(facility.maturity_month),
    source: facility.source,
    notes: facility.notes ?? '',
    sortOrder: facility.sort_order,
  };
}

function newDraft(scenarioId: string, index: number): Draft {
  return {
    localId: `draft-${Date.now()}-${index}`,
    id: null,
    scenarioId,
    facilityName: `Financiering ${index + 1}`,
    facilityType: 'acquisition',
    commitmentAmount: '',
    drawMethod: 'single_month',
    drawStartMonth: '0',
    annualInterestRatePct: '',
    interestMethod: 'cash',
    arrangementFeePct: '',
    arrangementFeeAmount: '',
    repaymentMethod: 'bullet',
    amortizationStartMonth: '',
    maturityMonth: '',
    source: '',
    notes: '',
    sortOrder: index,
  };
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono-data text-sm font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ScenarioFinancingWorkspace(props: Props) {
  const scenarioId = scenarioIdFrom(props);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
  const [savedOutput, setSavedOutput] = useState<SavedOutput | null>(null);
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<number | null>(null);
  const [facilities, setFacilities] = useState<ScenarioFinancingFacility[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!scenarioId) return;
    setLoading(true);
    const untyped = supabase as unknown as { from: (table: string) => any };
    const scenarioResult = await untyped.from('calculation_scenarios').select('*').eq('id', scenarioId).maybeSingle();
    if (scenarioResult.error || !scenarioResult.data) {
      toast.error('Financiering kon het opgeslagen scenario niet laden.');
      setLoading(false);
      return;
    }

    const [costResult, outputResult, analysisResult, facilityResult] = await Promise.all([
      untyped.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      untyped.from('calculation_outputs').select('total_transfer_tax,total_acquisition_costs,total_costs,total_investment').eq('scenario_id', scenarioId).maybeSingle(),
      untyped.from('real_estate_calculations').select('time_horizon_months').eq('id', scenarioResult.data.calculation_id).maybeSingle(),
      untyped.from('scenario_financing_facilities').select('*').eq('scenario_id', scenarioId).order('sort_order').order('created_at'),
    ]);

    setScenario(scenarioResult.data as Scenario);
    setCosts((costResult.data ?? []) as ScenarioCost[]);
    setSavedOutput((outputResult.data as SavedOutput | null) ?? null);
    const horizon = Number(analysisResult.data?.time_horizon_months ?? Number.NaN);
    setTimeHorizonMonths(Number.isInteger(horizon) && horizon > 0 ? horizon : null);
    const nextFacilities = (facilityResult.data ?? []) as ScenarioFinancingFacility[];
    setFacilities(nextFacilities);
    setDrafts(nextFacilities.map(draftFromFacility));
    if (facilityResult.error && facilityResult.error.code !== '42P01') {
      toast.error('Financieringsfaciliteiten konden niet worden geladen.');
    }
    setLoading(false);
  }, [scenarioId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const unlevered = useMemo(() => buildScenarioUnleveredCashflow({
    scenario: scenario ?? ({ purchase_price: null, financing_costs: null, unforeseen_percentage: null } as Scenario),
    costs,
    strategyUnits: props.units,
    timeHorizonMonths,
    savedOutput,
  }), [scenario, costs, props.units, timeHorizonMonths, savedOutput]);

  const result = useMemo(() => buildScenarioFinancing({
    cashflow: unlevered,
    facilities,
    legacyFinancingCosts: scenario?.financing_costs,
  }), [unlevered, facilities, scenario?.financing_costs]);

  function patchDraft(localId: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => draft.localId === localId ? { ...draft, ...patch } : draft));
  }

  async function saveDraft(draft: Draft) {
    if (!scenarioId) return;
    setSavingId(draft.localId);
    try {
      const payload = buildFinancingFacilityPayload({ ...draft, scenarioId });
      const untyped = supabase as unknown as { from: (table: string) => any };
      const query = draft.id
        ? untyped.from('scenario_financing_facilities').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', draft.id)
        : untyped.from('scenario_financing_facilities').insert(payload);
      const { error } = await query;
      if (error) throw new Error(error.message);
      toast.success('Financieringsfaciliteit opgeslagen');
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Financieringsfaciliteit opslaan mislukt.');
    } finally {
      setSavingId(null);
    }
  }

  async function removeDraft(draft: Draft) {
    if (!draft.id) {
      setDrafts((current) => current.filter((item) => item.localId !== draft.localId));
      return;
    }
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error } = await untyped.from('scenario_financing_facilities').delete().eq('id', draft.id);
    if (error) {
      toast.error('Financieringsfaciliteit verwijderen mislukt.');
      return;
    }
    toast.success('Financieringsfaciliteit verwijderd');
    await fetchAll();
  }

  if (!scenarioId) return null;

  return (
    <section className="space-y-4 rounded-md border bg-card p-3" aria-label="Financiering en rendement op eigen vermogen">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Financiering en equitykasstroom</h4>
            <Badge variant={result.ready ? 'default' : 'outline'}>
              {loading ? 'Gegevens laden…' : result.ready ? 'Financiering gereed' : 'Nog niet gereed'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            De financiering ligt als aparte laag bovenop de ongefinancierde projectkasstroom. Opnames
            dekken alleen negatieve projectkasstromen; ongebruikte leenruimte wordt niet als opbrengst geboekt.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDrafts((current) => [...current, newDraft(scenarioId, current.length)])}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Financiering toevoegen
        </Button>
      </div>

      <div className="space-y-3">
        {drafts.map((draft, index) => (
          <div key={draft.localId} className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium">Financieringsfaciliteit {index + 1}</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDraft(draft)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Naam">
                <Input value={draft.facilityName} onChange={(event) => patchDraft(draft.localId, { facilityName: event.target.value })} />
              </Field>
              <Field label="Type financiering">
                <Select value={draft.facilityType} onValueChange={(value) => patchDraft(draft.localId, { facilityType: value as FinancingFacilityType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FACILITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Maximaal leenbedrag (€)" hint="Dit is een limiet. Alleen werkelijk benodigde opnames tellen mee.">
                <Input inputMode="decimal" value={String(draft.commitmentAmount ?? '')} onChange={(event) => patchDraft(draft.localId, { commitmentAmount: event.target.value })} />
              </Field>
              <Field label="Jaarlijkse rente (%)">
                <Input inputMode="decimal" value={String(draft.annualInterestRatePct ?? '')} onChange={(event) => patchDraft(draft.localId, { annualInterestRatePct: event.target.value })} />
              </Field>

              <Field label="Opnamemethode">
                <Select value={draft.drawMethod} onValueChange={(value) => patchDraft(draft.localId, { drawMethod: value as FinancingDrawMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_month">Alleen in één maand</SelectItem>
                    <SelectItem value="project_deficit">Naar behoefte bij projecttekorten</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Eerste opnamemaand">
                <Input inputMode="numeric" value={String(draft.drawStartMonth ?? '')} onChange={(event) => patchDraft(draft.localId, { drawStartMonth: event.target.value })} />
              </Field>
              <Field label="Rentebehandeling">
                <Select value={draft.interestMethod} onValueChange={(value) => patchDraft(draft.localId, { interestMethod: value as FinancingInterestMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Maandelijks uit eigen middelen betalen</SelectItem>
                    <SelectItem value="capitalized">Bij de schuld optellen</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Eindmaand / looptijd">
                <Input inputMode="numeric" value={String(draft.maturityMonth ?? '')} onChange={(event) => patchDraft(draft.localId, { maturityMonth: event.target.value })} />
              </Field>

              <Field label="Aflossingswijze">
                <Select
                  value={draft.repaymentMethod}
                  onValueChange={(value) => patchDraft(draft.localId, {
                    repaymentMethod: value as FinancingRepaymentMethod,
                    amortizationStartMonth: value === 'bullet' ? '' : draft.amortizationStartMonth,
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bullet">Aflossingsvrij tot eindmaand</SelectItem>
                    <SelectItem value="linear">Lineair aflossen</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {draft.repaymentMethod === 'linear' && (
                <Field label="Startmaand aflossing">
                  <Input inputMode="numeric" value={String(draft.amortizationStartMonth ?? '')} onChange={(event) => patchDraft(draft.localId, { amortizationStartMonth: event.target.value })} />
                </Field>
              )}
              <Field label="Afsluitkosten (%)" hint="Gebruik dit óf een vast bedrag.">
                <Input inputMode="decimal" value={String(draft.arrangementFeePct ?? '')} onChange={(event) => patchDraft(draft.localId, { arrangementFeePct: event.target.value })} />
              </Field>
              <Field label="Afsluitkosten vast (€)" hint="Gebruik dit óf een percentage.">
                <Input inputMode="decimal" value={String(draft.arrangementFeeAmount ?? '')} onChange={(event) => patchDraft(draft.localId, { arrangementFeeAmount: event.target.value })} />
              </Field>

              <Field label="Bron of onderbouwing" hint="Bijvoorbeeld indicatieve term sheet, offerte of interne financieringsaanname.">
                <Input value={draft.source} onChange={(event) => patchDraft(draft.localId, { source: event.target.value })} />
              </Field>
              <Field label="Toelichting">
                <Input value={draft.notes ?? ''} onChange={(event) => patchDraft(draft.localId, { notes: event.target.value })} />
              </Field>
              <div className="flex items-end lg:col-span-2">
                <Button type="button" className="w-full lg:w-auto" disabled={savingId === draft.localId} onClick={() => saveDraft(draft)}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {savingId === draft.localId ? 'Opslaan…' : draft.id ? 'Wijzigingen opslaan' : 'Financiering opslaan'}
                </Button>
              </div>
            </div>
          </div>
        ))}
        {drafts.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nog geen financiering vastgelegd. De ongefinancierde uitkomsten blijven leidend totdat je een faciliteit opslaat.
          </p>
        )}
      </div>

      {result.ready && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Metric label="Piek schuld" value={fmtEur(result.peakDebt)} />
            <Metric label="LTC" value={result.loanToCostPct === null ? '—' : fmtPct(result.loanToCostPct, 1)} hint="piek schuld / projectinvestering" />
            <Metric label="Piek eigen geld" value={fmtEur(result.peakEquityRequirement)} />
            <Metric label="Levered IRR" value={result.leveredIrrAnnualPct === null ? 'Niet eenduidig' : fmtPct(result.leveredIrrAnnualPct, 2)} />
            <Metric label="Equity multiple" value={result.equityMultiple === null ? '—' : `${fmtNum(result.equityMultiple, 2)}×`} />
            <Metric label="Totale rente" value={fmtEur(result.totalCashInterest + result.totalCapitalizedInterest)} />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Metric label="Opgenomen schuld" value={fmtEur(result.totalDebtDraws)} />
            <Metric label="Rente betaald" value={fmtEur(result.totalCashInterest)} />
            <Metric label="Rente bijgeschreven" value={fmtEur(result.totalCapitalizedInterest)} />
            <Metric label="Afsluitkosten" value={fmtEur(result.totalArrangementFees)} />
            <Metric label="Afgelost" value={fmtEur(result.totalPrincipalRepayment)} />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[980px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Projectkasstroom</TableHead>
                  <TableHead className="text-right">Opnames</TableHead>
                  <TableHead className="text-right">Rente cash</TableHead>
                  <TableHead className="text-right">Rente bij schuld</TableHead>
                  <TableHead className="text-right">Afsluitkosten</TableHead>
                  <TableHead className="text-right">Aflossing</TableHead>
                  <TableHead className="text-right">Eindschuld</TableHead>
                  <TableHead className="text-right">Equitykasstroom</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.periods.map((period) => (
                  <TableRow key={period.periodIndex}>
                    <TableCell className="font-medium">{period.label}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.unleveredCashflow)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.debtDraws)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.cashInterest)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.capitalizedInterest)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.arrangementFees)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.principalRepayment)}</TableCell>
                    <TableCell className="text-right font-mono-data font-semibold">{fmtEur(period.closingDebtBalance)}</TableCell>
                    <TableCell className="text-right font-mono-data font-semibold">{fmtEur(period.equityCashflow)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!loading && result.blockers.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">Financieringsanalyse nog niet gereed</p>
          <div className="mt-1 space-y-1">{result.blockers.slice(0, 16).map((blocker, index) => <p key={index}>• {blocker}</p>)}</div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <details className="rounded-md border p-3 text-xs">
          <summary className="cursor-pointer font-medium">Aandachtspunten ({result.warnings.length})</summary>
          <div className="mt-2 space-y-1 text-muted-foreground">{result.warnings.slice(0, 18).map((warning, index) => <p key={index}>• {warning}</p>)}</div>
        </details>
      )}

      <p className="text-[11px] text-muted-foreground">
        Rente wordt berekend over de schuld aan het begin van de maand. Nieuwe opnames dragen vanaf de
        volgende maand rente. LTV en DSCR worden pas toegevoegd wanneer hun waardebasis en netto
        exploitatiekasstroom expliciet en controleerbaar zijn.
      </p>
    </section>
  );
}
