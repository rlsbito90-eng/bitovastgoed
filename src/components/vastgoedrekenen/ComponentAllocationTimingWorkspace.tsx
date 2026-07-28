import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, GitBranch, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import {
  HOLD_STRATEGIES,
  SALE_STRATEGIES,
  STRATEGY_LABELS,
  type ComponentStrategyKey,
} from '@/lib/vastgoedrekenen/componentStrategy';
import {
  analyzeComponentAllocationTiming,
  buildComponentAllocationSplit,
  componentAllocationTimingPatch,
  resolveComponentAllocationTiming,
  type ComponentAllocationTimingRecord,
} from '@/lib/vastgoedrekenen/componentAllocationTiming';
import { supabase } from '@/integrations/supabase/client';

const DEVELOPMENT_STRATEGIES = new Set<ComponentStrategyKey>([
  'renoveren_verkopen',
  'renoveren_aanhouden',
  'splitsen_verkopen',
  'transformeren_verkopen',
  'transformeren_aanhouden',
  'sloop_nieuwbouw_verkopen',
  'sloop_nieuwbouw_aanhouden',
]);

type Props = {
  units: SellOffUnit[];
  onCreate: (patch?: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  /** Testoverride; zonder override wordt de horizon read-only via het scenario opgehaald. */
  timeHorizonMonthsOverride?: number | null;
  /** Testadapter voor de read-back na de eerste split-update. */
  verifySplitUpdate?: (
    id: string,
    expected: { allocationPercentage: number; schemaVersion: number },
  ) => Promise<boolean>;
};

type TimingDraft = {
  allocation: string;
  developmentStart: string;
  developmentEnd: string;
  rentStart: string;
  saleReceipt: string;
  terminalExit: string;
};

type SplitCandidate = {
  unit: SellOffUnit;
  firstShare: number;
  secondShare: number;
  currentPatch: Record<string, unknown>;
  clonePatch: Record<string, unknown>;
  originalPatch: Record<string, unknown>;
};

function record(unit: SellOffUnit): ComponentAllocationTimingRecord {
  return unit as unknown as ComponentAllocationTimingRecord;
}

function raw(unit: SellOffUnit): Record<string, unknown> {
  return unit as unknown as Record<string, unknown>;
}

function toDraft(unit: SellOffUnit): TimingDraft {
  const resolved = resolveComponentAllocationTiming(record(unit));
  const month = (value: number | null) => (value == null ? '' : String(value));
  return {
    allocation: String(resolved.allocationPercentage),
    developmentStart: month(resolved.developmentStartMonth),
    developmentEnd: month(resolved.developmentEndMonth),
    rentStart: month(resolved.rentStartMonth),
    saleReceipt: month(resolved.saleReceiptMonth),
    terminalExit: month(resolved.terminalExitMonth),
  };
}

function strategyFlags(unit: SellOffUnit) {
  const strategy = (raw(unit).strategy as ComponentStrategyKey | null) ?? 'later_beslissen';
  return {
    strategy,
    isDevelopment: DEVELOPMENT_STRATEGIES.has(strategy),
    isSale: SALE_STRATEGIES.includes(strategy),
    isHold: HOLD_STRATEGIES.includes(strategy),
  };
}

function groupStatusLabel(status: 'complete' | 'underallocated' | 'overallocated') {
  if (status === 'complete') return 'Compleet';
  if (status === 'underallocated') return 'Onderverdeeld';
  return 'Oververdeeld';
}

function groupTone(status: 'complete' | 'underallocated' | 'overallocated') {
  if (status === 'complete') {
    return 'border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200';
  }
  return 'border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200';
}

export default function ComponentAllocationTimingWorkspace({
  units,
  onCreate,
  onUpdate,
  timeHorizonMonthsOverride,
  verifySplitUpdate,
}: Props) {
  const [loadedHorizon, setLoadedHorizon] = useState<number | null>(null);
  const [horizonLoading, setHorizonLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimingDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [splitCandidate, setSplitCandidate] = useState<SplitCandidate | null>(null);
  const [splitting, setSplitting] = useState(false);

  const scenarioId = (units[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id ?? null;
  const timeHorizonMonths = timeHorizonMonthsOverride !== undefined
    ? timeHorizonMonthsOverride
    : loadedHorizon;

  useEffect(() => {
    if (timeHorizonMonthsOverride !== undefined || !scenarioId) return;

    let cancelled = false;
    const untyped = supabase as unknown as { from: (table: string) => any };

    async function loadHorizon() {
      setHorizonLoading(true);
      const scenarioResult = await untyped
        .from('calculation_scenarios')
        .select('calculation_id')
        .eq('id', scenarioId)
        .maybeSingle();

      if (cancelled) return;
      if (scenarioResult.error || !scenarioResult.data?.calculation_id) {
        setLoadedHorizon(null);
        setHorizonLoading(false);
        return;
      }

      const analysisResult = await untyped
        .from('real_estate_calculations')
        .select('time_horizon_months')
        .eq('id', scenarioResult.data.calculation_id)
        .maybeSingle();

      if (cancelled) return;
      const value = Number(analysisResult.data?.time_horizon_months ?? Number.NaN);
      setLoadedHorizon(Number.isFinite(value) && value > 0 ? value : null);
      setHorizonLoading(false);
    }

    void loadHorizon();
    return () => {
      cancelled = true;
    };
  }, [scenarioId, timeHorizonMonthsOverride]);

  const analysis = useMemo(
    () => analyzeComponentAllocationTiming(units.map(record), timeHorizonMonths),
    [units, timeHorizonMonths],
  );
  const editUnit = editId ? units.find((unit) => unit.id === editId) ?? null : null;
  const completeGroups = analysis.groups.filter((group) => group.status === 'complete').length;
  const underGroups = analysis.groups.filter((group) => group.status === 'underallocated').length;
  const overGroups = analysis.groups.filter((group) => group.status === 'overallocated').length;

  function openEditor(unit: SellOffUnit) {
    setEditId(unit.id);
    setDraft(toDraft(unit));
  }

  function closeEditor() {
    if (saving) return;
    setEditId(null);
    setDraft(null);
  }

  async function saveTiming() {
    if (!editUnit || !draft) return;
    setSaving(true);
    try {
      const patch = componentAllocationTimingPatch({
        allocationPercentage: draft.allocation,
        developmentStartMonth: draft.developmentStart,
        developmentEndMonth: draft.developmentEnd,
        rentStartMonth: draft.rentStart,
        saleReceiptMonth: draft.saleReceipt,
        terminalExitMonth: draft.terminalExit,
      });
      const preview = resolveComponentAllocationTiming(
        { ...record(editUnit), ...patch },
        timeHorizonMonths,
      );

      await onUpdate(editUnit.id, patch as unknown as Record<string, unknown>);
      const horizonWarnings = preview.warnings.filter((warning) =>
        warning.includes('buiten de Quickscan-horizon'),
      );
      if (horizonWarnings.length > 0) toast.warning(horizonWarnings.join(' '));
      toast.success('Allocatie en timing opgeslagen');
      setEditId(null);
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Allocatie en timing konden niet worden opgeslagen.',
      );
    } finally {
      setSaving(false);
    }
  }

  function prepareSplit(unit: SellOffUnit) {
    try {
      const split = buildComponentAllocationSplit(record(unit));
      const original = raw(unit);
      setSplitCandidate({
        unit,
        firstShare: Number(split.currentPatch.allocation_percentage),
        secondShare: Number(split.clonePatch.allocation_percentage),
        currentPatch: split.currentPatch,
        clonePatch: split.clonePatch,
        originalPatch: {
          allocation_percentage: original.allocation_percentage ?? null,
          allocation_timing_schema_version: original.allocation_timing_schema_version ?? null,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Deze allocatie kan niet worden gesplitst.',
      );
    }
  }

  async function persistedUpdateMatches(candidate: SplitCandidate): Promise<boolean> {
    if (verifySplitUpdate) {
      return verifySplitUpdate(candidate.unit.id, {
        allocationPercentage: candidate.firstShare,
        schemaVersion: 1,
      });
    }

    const untyped = supabase as unknown as { from: (table: string) => any };
    const result = await untyped
      .from('sell_off_units')
      .select('allocation_percentage, allocation_timing_schema_version')
      .eq('id', candidate.unit.id)
      .maybeSingle();

    if (result.error || !result.data) return false;
    return Number(result.data.allocation_percentage) === candidate.firstShare
      && Number(result.data.allocation_timing_schema_version) === 1;
  }

  async function restoreOriginalAllocation(candidate: SplitCandidate) {
    await onUpdate(candidate.unit.id, candidate.originalPatch);
  }

  async function confirmSplit() {
    if (!splitCandidate) return;
    const candidate = splitCandidate;
    setSplitting(true);

    try {
      await onUpdate(candidate.unit.id, candidate.currentPatch);
      const updateVerified = await persistedUpdateMatches(candidate);

      if (!updateVerified) {
        await restoreOriginalAllocation(candidate);
        setSplitCandidate(null);
        toast.error(
          'Splitsen gestopt: het eerste allocatiedeel kon niet worden bevestigd. De oorspronkelijke allocatie is hersteld.',
        );
        return;
      }

      const created = await onCreate(candidate.clonePatch);
      if (!created) {
        await restoreOriginalAllocation(candidate);
        setSplitCandidate(null);
        toast.error(
          'Tweede allocatiedeel aanmaken mislukt. De oorspronkelijke allocatie is hersteld.',
        );
        return;
      }

      toast.success(`Allocatie gesplitst in ${candidate.firstShare}% en ${candidate.secondShare}%`);
      setSplitCandidate(null);
    } catch (error) {
      try {
        await restoreOriginalAllocation(candidate);
      } catch {
        // De centrale CRUD-callback toont zelf de databasefout.
      }
      setSplitCandidate(null);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Splitsen mislukt. De oorspronkelijke allocatie is zo mogelijk hersteld.',
      );
    } finally {
      setSplitting(false);
    }
  }

  if (units.length === 0) return null;

  return (
    <section
      className="space-y-3 rounded-md border bg-muted/20 p-3"
      aria-label="Allocatie en timing"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Allocatie & timing</h4>
            <Badge variant={analysis.readyForPeriodicCashflow ? 'default' : 'outline'}>
              {analysis.readyForPeriodicCashflow
                ? 'Gereed voor kasstroommodel'
                : 'Nog niet compleet'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Verdeel een component over meerdere strategieën en leg vast wanneer ontwikkeling,
            huur en verkoop plaatsvinden. Deze invoer wijzigt in deze fase de huidige
            scenariowaarde nog niet.
          </p>
        </div>
        <div className="text-xs text-muted-foreground sm:text-right">
          <p>{analysis.groups.length} allocatiegroep(en)</p>
          <p>
            {horizonLoading
              ? 'Horizon laden…'
              : timeHorizonMonths
                ? `Quickscan-horizon: ${timeHorizonMonths} maanden`
                : 'Geen Quickscan-horizon ingesteld'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <StatusTile label="Compleet" value={completeGroups} positive />
        <StatusTile label="Onderverdeeld" value={underGroups} warning={underGroups > 0} />
        <StatusTile label="Oververdeeld" value={overGroups} warning={overGroups > 0} />
      </div>

      <div className="space-y-2">
        {analysis.groups.map((group) => (
          <div
            key={group.componentKey}
            className={`rounded-md border px-3 py-2 text-xs ${groupTone(group.status)}`}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium">{group.labels.join(' + ')}</p>
                <p className="opacity-80">{group.unitIds.length} regel(s)</p>
              </div>
              <div className="flex items-center gap-2 sm:text-right">
                <Badge variant="outline">{groupStatusLabel(group.status)}</Badge>
                <span className="font-mono-data font-semibold">
                  {group.totalAllocationPercentage}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {analysis.units.map((resolved) => {
          const unit = units.find((candidate) => candidate.id === resolved.unitId);
          if (!unit) return null;
          const flags = strategyFlags(unit);
          const timing = [
            resolved.developmentStartMonth != null
              ? `start ${resolved.developmentStartMonth}`
              : null,
            resolved.developmentEndMonth != null
              ? `oplevering ${resolved.developmentEndMonth}`
              : null,
            resolved.rentStartMonth != null ? `huur ${resolved.rentStartMonth}` : null,
            resolved.saleReceiptMonth != null ? `verkoop ${resolved.saleReceiptMonth}` : null,
            resolved.terminalExitMonth != null ? `exit ${resolved.terminalExitMonth}` : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div key={unit.id} className="space-y-2 rounded-md border bg-card p-3 text-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium">{resolved.label}</p>
                  <p className="text-muted-foreground">
                    {STRATEGY_LABELS[flags.strategy] ?? flags.strategy}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">{resolved.allocationPercentage}%</Badge>
                  {resolved.completeForStrategy ? (
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600"
                      aria-label="Timing compleet"
                    />
                  ) : (
                    <AlertTriangle
                      className="h-4 w-4 text-amber-600"
                      aria-label="Timing incompleet"
                    />
                  )}
                </div>
              </div>

              <p className="break-words text-muted-foreground">
                {timing || 'Nog geen timing vastgelegd'}
              </p>

              {resolved.warnings.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-amber-700 dark:text-amber-300">
                    {resolved.warnings.length} aandachtspunt(en)
                  </summary>
                  <div className="mt-1 space-y-1 text-amber-800 dark:text-amber-200">
                    {resolved.warnings.slice(0, 6).map((warning, index) => (
                      <p key={index}>• {warning}</p>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditor(unit)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Timing bewerken
                </Button>
                <Button size="sm" variant="outline" onClick={() => prepareSplit(unit)}>
                  <GitBranch className="mr-1 h-3.5 w-3.5" /> Splits allocatie
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {analysis.warnings.length > 0 && (
        <details className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <summary className="cursor-pointer font-medium">
            Alle allocatie- en timingwaarschuwingen ({analysis.warnings.length})
          </summary>
          <div className="mt-2 space-y-1">
            {analysis.warnings.slice(0, 12).map((warning, index) => (
              <p key={index}>• {warning}</p>
            ))}
          </div>
        </details>
      )}

      <Dialog open={editUnit !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editUnit && draft && (() => {
            const flags = strategyFlags(editUnit);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Allocatie & timing — {resolveComponentAllocationTiming(record(editUnit)).label}
                  </DialogTitle>
                  <DialogDescription>
                    Maanden worden gerekend vanaf de peildatum van de Quickscan. Openen of
                    sluiten schrijft niets automatisch weg.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DraftField
                    label="Allocatie van component (%)"
                    value={draft.allocation}
                    onChange={(value) => setDraft({ ...draft, allocation: value })}
                  />
                  {flags.isDevelopment && (
                    <>
                      <DraftField
                        label="Ontwikkelstart (maand)"
                        value={draft.developmentStart}
                        onChange={(value) => setDraft({ ...draft, developmentStart: value })}
                      />
                      <DraftField
                        label="Oplevering/einde ontwikkeling (maand)"
                        value={draft.developmentEnd}
                        onChange={(value) => setDraft({ ...draft, developmentEnd: value })}
                      />
                    </>
                  )}
                  {flags.isSale && (
                    <DraftField
                      label="Ontvangst verkoopopbrengst (maand)"
                      value={draft.saleReceipt}
                      onChange={(value) => setDraft({ ...draft, saleReceipt: value })}
                    />
                  )}
                  {flags.isHold && (
                    <>
                      <DraftField
                        label="Start huurkasstroom (maand)"
                        value={draft.rentStart}
                        onChange={(value) => setDraft({ ...draft, rentStart: value })}
                      />
                      <DraftField
                        label="Optionele terminale exit (maand)"
                        value={draft.terminalExit}
                        onChange={(value) => setDraft({ ...draft, terminalExit: value })}
                      />
                    </>
                  )}
                </div>

                {timeHorizonMonths && (
                  <p className="text-xs text-muted-foreground">
                    Quickscan-horizon: {timeHorizonMonths} maanden. Waarden buiten deze horizon
                    worden gewaarschuwd, niet automatisch aangepast.
                  </p>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={closeEditor} disabled={saving}>
                    Annuleren
                  </Button>
                  <Button onClick={() => void saveTiming()} disabled={saving}>
                    {saving ? 'Opslaan…' : 'Allocatie & timing opslaan'}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={splitCandidate !== null}
        onOpenChange={(open) => !open && !splitting && setSplitCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allocatie splitsen?</AlertDialogTitle>
            <AlertDialogDescription>
              {splitCandidate
                ? `De huidige allocatie wordt gesplitst in ${splitCandidate.firstShare}% en ${splitCandidate.secondShare}%. Bedragen, oppervlakten, strategie, timing en de huidige scenariowaarde worden niet aangepast.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={splitting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmSplit()} disabled={splitting}>
              {splitting ? 'Splitsen…' : 'Splits allocatie'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StatusTile({
  label,
  value,
  positive,
  warning,
}: {
  label: string;
  value: number;
  positive?: boolean;
  warning?: boolean;
}) {
  const tone = positive && value > 0
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : warning
      ? 'border-amber-500/30 bg-amber-500/5'
      : '';

  return (
    <div className={`rounded-md border bg-card p-2 ${tone}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono-data text-sm font-semibold">{value}</p>
    </div>
  );
}

function DraftField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="block text-xs font-medium leading-snug">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      />
    </div>
  );
}
