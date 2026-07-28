import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, SplitSquareVertical } from 'lucide-react';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import {
  BUSINESS_CASE_METADATA,
  DISPOSITION_METADATA,
  EXPANSION_SUBTYPE_METADATA,
  EXPLOITATION_MODE_METADATA,
  INTERVENTION_METADATA,
  ScenarioTaxonomyPersistenceError,
  resolvePersistedScenarioTaxonomy,
  scenarioTaxonomyPersistencePatch,
  type BusinessCase,
  type CanonicalScenarioTaxonomy,
  type Disposition,
  type ExpansionSubtype,
  type ExploitationMode,
  type Intervention,
  type ScenarioTaxonomyPersistencePatch,
} from '@/lib/vastgoedrekenen/taxonomy';

interface Props {
  scenario: Scenario;
  onSave: (patch: ScenarioTaxonomyPersistencePatch) => Promise<boolean>;
}

const SOURCE_LABELS = {
  canonical: 'Canoniek opgeslagen',
  legacy: 'Afgeleid uit bestaande strategie',
  mixed: 'Gedeeltelijke historische classificatie',
} as const;

function sameTaxonomy(a: CanonicalScenarioTaxonomy, b: CanonicalScenarioTaxonomy): boolean {
  return a.businessCase === b.businessCase
    && a.intervention === b.intervention
    && a.expansionSubtype === b.expansionSubtype
    && a.exploitation === b.exploitation
    && a.disposition === b.disposition;
}

export default function ScenarioTaxonomyPanel({ scenario, onSave }: Props) {
  const resolved = useMemo(
    () => resolvePersistedScenarioTaxonomy(scenario as unknown as Record<string, unknown>),
    [scenario],
  );
  const [draft, setDraft] = useState<CanonicalScenarioTaxonomy>(resolved.value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(resolved.value);
    setError(null);
  }, [scenario.id, resolved.source, resolved.schemaVersion, resolved.value.businessCase, resolved.value.intervention, resolved.value.expansionSubtype, resolved.value.exploitation, resolved.value.disposition]);

  const dirty = resolved.source !== 'canonical' || !sameTaxonomy(draft, resolved.value);

  function setIntervention(intervention: Intervention) {
    setDraft((current) => ({
      ...current,
      intervention,
      expansionSubtype: intervention === 'expand' ? current.expansionSubtype : null,
    }));
  }

  async function save() {
    setError(null);
    let patch: ScenarioTaxonomyPersistencePatch;
    try {
      patch = scenarioTaxonomyPersistencePatch(draft);
    } catch (caught) {
      setError(caught instanceof ScenarioTaxonomyPersistenceError ? caught.message : 'Controleer de scenario-classificatie.');
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
    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/[0.025] p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SplitSquareVertical className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Scenario-classificatie</h3>
            <Badge variant={resolved.source === 'canonical' ? 'default' : 'secondary'} className="text-[10px]">
              {SOURCE_LABELS[resolved.source]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Businesscase, fysieke ingreep, exploitatie en exit worden hier onafhankelijk vastgelegd. De bestaande strategie-dropdown blijft voorlopig alleen voor rekencompatibiliteit.
          </p>
        </div>
        <Button type="button" size="sm" onClick={save} disabled={!dirty || busy} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-1" />
          {busy ? 'Opslaan…' : resolved.source === 'canonical' ? 'Classificatie opslaan' : 'Classificatie vastleggen'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Businesscase</Label>
          <Select value={draft.businessCase} onValueChange={(value) => setDraft((current) => ({ ...current, businessCase: value as BusinessCase }))}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BUSINESS_CASE_METADATA).map(([value, metadata]) => (
                <SelectItem key={value} value={value}>{metadata.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">{BUSINESS_CASE_METADATA[draft.businessCase].description}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Fysieke ingreep</Label>
          <Select value={draft.intervention} onValueChange={(value) => setIntervention(value as Intervention)}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(INTERVENTION_METADATA).map(([value, metadata]) => (
                <SelectItem key={value} value={value}>{metadata.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">{INTERVENTION_METADATA[draft.intervention].description}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Type uitbreiding</Label>
          <Select
            value={draft.expansionSubtype ?? '__none__'}
            disabled={draft.intervention !== 'expand'}
            onValueChange={(value) => setDraft((current) => ({
              ...current,
              expansionSubtype: value === '__none__' ? null : value as ExpansionSubtype,
            }))}
          >
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Kies uitbreiding" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nog niet gekozen</SelectItem>
              {Object.entries(EXPANSION_SUBTYPE_METADATA).map(([value, metadata]) => (
                <SelectItem key={value} value={value}>{metadata.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {draft.intervention !== 'expand'
              ? 'Alleen van toepassing bij Uitbreiden.'
              : draft.expansionSubtype
                ? EXPANSION_SUBTYPE_METADATA[draft.expansionSubtype].description
                : 'Kies bijvoorbeeld Optoppen of Aanbouwen / uitbouwen.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Exploitatievorm</Label>
          <Select value={draft.exploitation} onValueChange={(value) => setDraft((current) => ({ ...current, exploitation: value as ExploitationMode }))}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(EXPLOITATION_MODE_METADATA).map(([value, metadata]) => (
                <SelectItem key={value} value={value}>{metadata.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">{EXPLOITATION_MODE_METADATA[draft.exploitation].description}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Disposition / exit</Label>
          <Select value={draft.disposition} onValueChange={(value) => setDraft((current) => ({ ...current, disposition: value as Disposition }))}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DISPOSITION_METADATA).map(([value, metadata]) => (
                <SelectItem key={value} value={value}>{metadata.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">{DISPOSITION_METADATA[draft.disposition].description}</p>
        </div>
      </div>

      {resolved.source !== 'canonical' && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
          Controleer de afgeleide keuzes en leg ze daarna expliciet vast. Alleen deze classificatievelden worden opgeslagen; financiële invoer en rekenuitkomsten blijven ongewijzigd.
        </div>
      )}
      {resolved.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {resolved.warnings.join(' ')}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
