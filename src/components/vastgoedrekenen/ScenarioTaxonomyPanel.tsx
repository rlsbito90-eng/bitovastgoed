import { useEffect, useState, type ComponentProps } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ScenarioTaxonomyPanelCore from './ScenarioTaxonomyPanelCore';

type Props = ComponentProps<typeof ScenarioTaxonomyPanelCore>;

export default function ScenarioTaxonomyPanel(props: Props) {
  const { scenario } = props;
  const [nameDraft, setNameDraft] = useState(scenario.scenario_name ?? '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setNameDraft(scenario.scenario_name ?? '');
  }, [scenario.id, scenario.scenario_name]);

  const normalizedName = nameDraft.trim();
  const currentName = (scenario.scenario_name ?? '').trim();
  const nameDirty = normalizedName.length > 0 && normalizedName !== currentName;

  async function saveScenarioName() {
    if (!nameDirty || savingName) return;

    setSavingName(true);
    const { error } = await supabase
      .from('calculation_scenarios')
      .update({ scenario_name: normalizedName })
      .eq('id', scenario.id);
    setSavingName(false);

    if (error) {
      toast.error('Scenarionaam opslaan mislukt');
      return;
    }

    window.dispatchEvent(new CustomEvent('scenario-name-updated', {
      detail: {
        scenarioId: scenario.id,
        previousName: currentName,
        name: normalizedName,
      },
    }));
    toast.success('Scenarionaam opgeslagen');
  }

  return (
    <div className="space-y-4">
      <section
        data-scroll-section
        data-scroll-label="Scenario"
        className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor={`scenario-name-${scenario.id}`} className="text-xs font-semibold">
              Scenarionaam
            </Label>
            <input
              id={`scenario-name-${scenario.id}`}
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  saveScenarioName();
                }
              }}
              className="flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base font-semibold text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Geef het scenario een herkenbare naam"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Deze naam wordt gebruikt in de scenarioselectie, vergelijking en resultaten.
            </p>
          </div>
          <Button
            type="button"
            onClick={saveScenarioName}
            disabled={!nameDirty || savingName}
            className="w-full sm:w-auto"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {savingName ? 'Opslaan…' : 'Naam opslaan'}
          </Button>
        </div>
      </section>

      <ScenarioTaxonomyPanelCore {...props} />
    </div>
  );
}
