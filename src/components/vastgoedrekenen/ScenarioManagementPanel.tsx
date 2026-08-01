import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = { scenario: Scenario };

export default function ScenarioManagementPanel({ scenario }: Props) {
  const [name, setName] = useState(scenario.scenario_name ?? '');
  const [strategy, setStrategy] = useState(scenario.strategy_type);
  const [status, setStatus] = useState(scenario.status);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setName(scenario.scenario_name ?? '');
    setStrategy(scenario.strategy_type);
    setStatus(scenario.status);
    setLastSavedAt(null);
  }, [scenario.id, scenario.scenario_name, scenario.strategy_type, scenario.status]);

  const trimmedName = name.trim();
  const dirty = useMemo(() => (
    trimmedName.length > 0 && (
      trimmedName !== (scenario.scenario_name ?? '').trim()
      || strategy !== scenario.strategy_type
      || status !== scenario.status
    )
  ), [trimmedName, strategy, status, scenario.scenario_name, scenario.strategy_type, scenario.status]);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('calculation_scenarios')
      .update({ scenario_name: trimmedName, strategy_type: strategy, status })
      .eq('id', scenario.id);
    setSaving(false);

    if (error) {
      toast.error('Scenario-instellingen opslaan mislukt');
      return;
    }

    setLastSavedAt(new Date());
    window.dispatchEvent(new CustomEvent('scenario-name-updated', {
      detail: { scenarioId: scenario.id, previousName: scenario.scenario_name ?? '', name: trimmedName },
    }));
    window.dispatchEvent(new CustomEvent('scenario-management-updated', {
      detail: { scenarioId: scenario.id, scenarioName: trimmedName, strategy, status },
    }));
    toast.success('Scenario-instellingen opgeslagen');
  }

  async function removeScenario() {
    const confirmed = window.confirm(`Scenario “${scenario.scenario_name || 'Naamloos scenario'}” definitief verwijderen?`);
    if (!confirmed) return;
    const { error } = await supabase.from('calculation_scenarios').delete().eq('id', scenario.id);
    if (error) {
      toast.error('Scenario verwijderen mislukt');
      return;
    }
    toast.success('Scenario verwijderd');
    window.location.reload();
  }

  return (
    <section data-scroll-section data-scroll-label="Scenario" data-scenario-management-panel className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            className="flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base font-semibold text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Geef het scenario een herkenbare naam"
          />
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Geef het scenario een korte, herkenbare naam.</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:items-center">
          <Select value={strategy} onValueChange={(value) => setStrategy(value as Scenario['strategy_type'])}>
            <SelectTrigger className="h-11 w-full xl:w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as Scenario['status'])}>
            <SelectTrigger className="h-11 w-full xl:w-[155px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(VR_STATUS_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" onClick={save} disabled={!dirty || saving} className="h-11 w-full xl:w-auto">
            <Save className="mr-1.5 h-4 w-4" />{saving ? 'Opslaan…' : 'Opslaan'}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('open-scenario-audit'))} className="h-11 w-full xl:w-auto">
            <ShieldCheck className="mr-1.5 h-4 w-4" />Controleer scenario
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={removeScenario} className="h-11 w-11 justify-self-end text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Scenario verwijderen</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {dirty ? (
          <span className="text-amber-700 dark:text-amber-300">● Wijzigingen niet opgeslagen</span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Opgeslagen</span>
        )}
        {lastSavedAt && <span className="text-muted-foreground">Laatst opgeslagen: {lastSavedAt.toLocaleTimeString('nl-NL')}</span>}
        <span className="hidden text-muted-foreground sm:inline">Berekeningen worden in Doorrekenen live bijgewerkt</span>
      </div>
    </section>
  );
}
