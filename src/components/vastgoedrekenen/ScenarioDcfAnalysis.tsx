import { useEffect, useMemo, useState } from 'react';
import { Calculator, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { buildScenarioDcf } from '@/lib/vastgoedrekenen/scenarioDcf';
import {
  resolveScenarioDcfSettings,
  scenarioDcfSettingsPatch,
} from '@/lib/vastgoedrekenen/scenarioDcfSettings';
import type { ScenarioUnleveredCashflowResult } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtNum, fmtPct } from './format';

type Props = {
  scenario: Scenario | null;
  cashflow: ScenarioUnleveredCashflowResult;
  loading?: boolean;
  onSaved: () => Promise<void>;
};

type DcfDraft = {
  annualDiscountRatePct: string;
  source: string;
  notes: string;
};

function draftFromScenario(scenario: Scenario | null): DcfDraft {
  if (!scenario) return { annualDiscountRatePct: '', source: '', notes: '' };
  const settings = resolveScenarioDcfSettings(scenario);
  return {
    annualDiscountRatePct: settings.annualDiscountRatePct == null
      ? ''
      : String(settings.annualDiscountRatePct).replace('.', ','),
    source: settings.source ?? '',
    notes: settings.notes ?? '',
  };
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono-data text-sm font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ScenarioDcfAnalysis({ scenario, cashflow, loading = false, onSaved }: Props) {
  const [draft, setDraft] = useState<DcfDraft>(() => draftFromScenario(scenario));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftFromScenario(scenario));
  }, [scenario]);

  const settings = useMemo(
    () => resolveScenarioDcfSettings(scenario ?? {}),
    [scenario],
  );
  const result = useMemo(
    () => buildScenarioDcf(cashflow, settings),
    [cashflow, settings],
  );

  async function saveSettings() {
    if (!scenario?.id) return;
    setSaving(true);
    try {
      const patch = scenarioDcfSettingsPatch({
        annualDiscountRatePct: draft.annualDiscountRatePct,
        source: draft.source,
        notes: draft.notes,
      });
      const untyped = supabase as unknown as { from: (table: string) => any };
      const { error } = await untyped
        .from('calculation_scenarios')
        .update(patch)
        .eq('id', scenario.id);
      if (error) throw new Error(error.message);
      toast.success('DCF-instellingen opgeslagen');
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'DCF-instellingen opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  const npvBadge = result.netPresentValue == null
    ? null
    : result.netPresentValue >= 0
      ? 'NCW positief'
      : 'NCW negatief';

  return (
    <section className="space-y-4 rounded-md border bg-card p-3" aria-label="Ongefinancierde DCF-analyse">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">DCF en ongefinancierd rendement</h4>
            <Badge variant={result.readyForDcf ? 'default' : 'outline'}>
              {loading ? 'Gegevens laden…' : result.readyForDcf ? 'DCF gereed' : 'Geblokkeerd'}
            </Badge>
            {npvBadge && (
              <Badge variant={result.netPresentValue != null && result.netPresentValue >= 0 ? 'default' : 'destructive'}>
                {npvBadge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Maand 0 blijft onverdisconteerd. De jaarlijkse voet is effectief; maandfactoren worden
            exact afgeleid. Deze analyse bevat geen lening, rente, aflossing of eigen-vermogensrendement.
          </p>
        </div>
        <p className="text-xs text-muted-foreground sm:text-right">
          {settings.valid
            ? `${fmtPct(settings.annualDiscountRatePct, 2)} per jaar · ${settings.source}`
            : 'Nog geen geldige voet opgeslagen'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr_1fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="dcf-rate">Jaarlijkse disconteringsvoet</Label>
          <div className="relative">
            <Input
              id="dcf-rate"
              inputMode="decimal"
              value={draft.annualDiscountRatePct}
              onChange={(event) => setDraft({ ...draft, annualDiscountRatePct: event.target.value })}
              placeholder="bijv. 8,50"
              className="pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dcf-source">Bron of onderbouwing</Label>
          <Input
            id="dcf-source"
            value={draft.source}
            onChange={(event) => setDraft({ ...draft, source: event.target.value })}
            placeholder="bijv. interne rendementseis, marktbenchmark of taxatieadvies"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dcf-notes">Toelichting — optioneel</Label>
          <Input
            id="dcf-notes"
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            placeholder="Risicopremie, peildatum of gehanteerde bandbreedte"
          />
        </div>
        <Button onClick={saveSettings} disabled={saving || !scenario?.id}>
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? 'Opslaan…' : 'DCF opslaan'}
        </Button>
      </div>

      {result.readyForDcf && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Tile label="NCW" value={fmtEur(result.netPresentValue)} hint={`bij ${fmtPct(result.annualDiscountRatePct, 2)}`} />
            <Tile
              label="Unlevered IRR"
              value={result.unleveredIrrAnnualPct == null ? 'Niet eenduidig' : fmtPct(result.unleveredIrrAnnualPct, 2)}
              hint="jaarlijks effectief"
            />
            <Tile label="Kasstroommultiple" value={result.investmentMultiple == null ? '—' : `${fmtNum(result.investmentMultiple, 2)}×`} />
            <Tile label="Piek kapitaalbehoefte" value={fmtEur(result.peakCapitalRequirement)} />
            <Tile label="Terugverdienmaand" value={result.paybackMonth == null ? 'Niet binnen horizon' : `Maand ${result.paybackMonth}`} />
            <Tile label="Verdisconteerd terugverdiend" value={result.discountedPaybackMonth == null ? 'Niet binnen horizon' : `Maand ${result.discountedPaybackMonth}`} />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Totale instroom" value={fmtEur(result.totalInflows)} />
            <Tile label="Totale uitstroom" value={fmtEur(result.totalOutflows)} />
            <Tile label="Aandeel terminale waarde" value={fmtPct(result.terminalValueSharePct, 1)} />
            <Tile label="Kasstroomduur" value={result.durationMonths == null ? '—' : `${result.durationMonths} maanden`} />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[760px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Nominale kasstroom</TableHead>
                  <TableHead className="text-right">Contante waarde</TableHead>
                  <TableHead className="text-right">Cumulatieve contante waarde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.periods.map((period) => (
                  <TableRow key={period.periodIndex}>
                    <TableCell className="font-medium">{period.label}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.nominalCashflow)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.presentValue)}</TableCell>
                    <TableCell className="text-right font-mono-data font-semibold">{fmtEur(period.cumulativePresentValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!loading && result.blockers.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">DCF-analyse nog geblokkeerd</p>
          <div className="mt-1 space-y-1">
            {result.blockers.slice(0, 14).map((blocker, index) => <p key={index}>• {blocker}</p>)}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <details className="rounded-md border p-3 text-xs">
          <summary className="cursor-pointer font-medium">Aandachtspunten ({result.warnings.length})</summary>
          <div className="mt-2 space-y-1 text-muted-foreground">
            {result.warnings.slice(0, 16).map((warning, index) => <p key={index}>• {warning}</p>)}
          </div>
        </details>
      )}

      <p className="text-[11px] text-muted-foreground">
        NCW is de som van de verdisconteerde ongefinancierde projectkasstromen. Unlevered IRR is alleen
        beschikbaar bij een conventionele, eenduidige kasstroom. Dit is geen taxatie en geen levered rendement.
      </p>
    </section>
  );
}
