import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarRange, Save } from 'lucide-react';
import {
  AnalysisMetadataValidationError,
  analysisMetadataPersistencePatch,
  resolveAnalysisMetadata,
  type AnalysisMetadataPersistencePatch,
} from '@/lib/vastgoedrekenen/analysis';
import type { PersistedCalculationAnalysis } from '@/lib/vastgoedrekenen/types';

interface Props {
  analysis: PersistedCalculationAnalysis;
  onSave: (patch: AnalysisMetadataPersistencePatch) => Promise<boolean>;
}

export default function AnalysisScopeSettings({ analysis, onSave }: Props) {
  const resolved = useMemo(
    () => resolveAnalysisMetadata(analysis as unknown as Record<string, unknown>),
    [analysis],
  );
  const [question, setQuestion] = useState(resolved.analysisQuestion ?? '');
  const [valuationDate, setValuationDate] = useState(resolved.valuationDate ?? '');
  const [horizon, setHorizon] = useState(resolved.timeHorizonMonths?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQuestion(resolved.analysisQuestion ?? '');
    setValuationDate(resolved.valuationDate ?? '');
    setHorizon(resolved.timeHorizonMonths?.toString() ?? '');
    setError(null);
  }, [analysis.id, resolved.analysisQuestion, resolved.valuationDate, resolved.timeHorizonMonths]);

  const dirty = question.trim() !== (resolved.analysisQuestion ?? '')
    || valuationDate !== (resolved.valuationDate ?? '')
    || horizon.trim() !== (resolved.timeHorizonMonths?.toString() ?? '');

  const horizonYears = (() => {
    const months = Number(horizon);
    if (!Number.isInteger(months) || months <= 0) return null;
    return months / 12;
  })();

  async function save() {
    setError(null);
    let patch: AnalysisMetadataPersistencePatch;
    try {
      patch = analysisMetadataPersistencePatch({
        analysisQuestion: question,
        valuationDate,
        timeHorizonMonths: horizon,
      });
    } catch (caught) {
      setError(caught instanceof AnalysisMetadataValidationError ? caught.message : 'Controleer de analyse-instellingen.');
      return;
    }

    setBusy(true);
    try {
      await onSave(patch);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Scope van deze Quickscan</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Leg vast welke beslissing deze analyse moet ondersteunen en over welke periode scenario’s worden vergeleken.
          </p>
        </div>
        <Button type="button" size="sm" onClick={save} disabled={!dirty || busy} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-1" />{busy ? 'Opslaan…' : 'Scope opslaan'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_180px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`analysis-question-${analysis.id}`} className="text-xs">Analysevraag</Label>
          <Textarea
            id={`analysis-question-${analysis.id}`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Bijvoorbeeld: welke strategie levert binnen 5 jaar de hoogste waarde en vrije kasstroom op?"
            rows={3}
            className="resize-y"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`valuation-date-${analysis.id}`} className="text-xs">Peildatum</Label>
          <Input
            id={`valuation-date-${analysis.id}`}
            type="date"
            value={valuationDate}
            onChange={(event) => setValuationDate(event.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">Basisdatum van marktdata en aannames.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`horizon-${analysis.id}`} className="text-xs">Tijdshorizon (maanden)</Label>
          <Input
            id={`horizon-${analysis.id}`}
            inputMode="numeric"
            value={horizon}
            onChange={(event) => setHorizon(event.target.value)}
            placeholder="bijv. 60"
          />
          <p className="text-[10px] text-muted-foreground">
            {horizonYears == null ? 'Nog niet gekoppeld aan DCF.' : `${horizonYears.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} jaar · nog niet gekoppeld aan DCF.`}
          </p>
        </div>
      </div>

      {resolved.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {resolved.warnings.join(' ')}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
