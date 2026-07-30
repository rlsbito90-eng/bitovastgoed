import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RefreshCw, Save, ShieldAlert, WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelectChips from '@/components/object/MultiSelectChips';
import PlainLanguageHelp from './PlainLanguageHelp';
import { useControlledTaxonomy } from '@/hooks/useControlledTaxonomy';
import { useDataStore } from '@/hooks/useDataStore';
import { useGebiedsvoorkeuren } from '@/hooks/useGebiedsvoorkeuren';
import { useScenarioInputProfile } from '@/hooks/useScenarioInputProfile';
import { gebiedspad } from '@/lib/acquisitie/gebiedsvoorkeuren';
import { taxonomyLabel, taxonomyOptionsFor, type TaxonomyDimension } from '@/lib/vastgoedrekenen/controlledTaxonomy';
import {
  buildProfileApplicationCandidates,
  deriveScenarioInputContextSuggestion,
  rankKengetallenForContext,
  type ScenarioInputContextDraft,
  type ScenarioProfileCode,
} from '@/lib/vastgoedrekenen/inputProfiles';
import type { KengetalBand, ScenarioKengetalSnapshot, VastgoedrekenenKengetal } from '@/lib/vastgoedrekenen/kengetallen';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import { toast } from 'sonner';

const PROFILE_LABELS: Record<ScenarioProfileCode, string> = {
  conservative: 'Conservatief',
  base: 'Basis',
  optimistic: 'Optimistisch',
};

const MATCH_LABELS = {
  exact: 'Specifieke match',
  broad: 'Algemeen toepasbaar',
  incomplete: 'Meer context nodig',
  mismatch: 'Past niet',
  expired: 'Bron verlopen',
} as const;

type Props = {
  scenario: Scenario;
  entries: VastgoedrekenenKengetal[];
  snapshots: ScenarioKengetalSnapshot[];
  onApply: (
    entry: VastgoedrekenenKengetal,
    band: Exclude<KengetalBand, 'handmatig'>,
  ) => Promise<boolean>;
};

function contextComparable(context: ScenarioInputContextDraft | null | undefined): string {
  if (!context) return '';
  return JSON.stringify({
    asset_type_code: context.asset_type_code,
    strategy_code: context.strategy_code,
    project_phase_code: context.project_phase_code,
    risk_class_code: context.risk_class_code,
    quality_level_code: context.quality_level_code,
    complexity_code: context.complexity_code,
    location_type_code: context.location_type_code,
    market_condition_code: context.market_condition_code,
    scenario_profile_code: context.scenario_profile_code,
    location_keys: [...(context.location_keys ?? [])].sort(),
  });
}

function numberText(value: number | null, unit: string): string {
  if (value == null) return '—';
  const formatted = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(value);
  return unit === '€' ? `€ ${formatted}` : `${formatted}${unit === '%' ? '%' : ` ${unit}`}`;
}

export default function ScenarioInputProfileWorkspace({ scenario, entries, snapshots, onApply }: Props) {
  const { options, loading: taxonomyLoading } = useControlledTaxonomy();
  const { preferences } = useGebiedsvoorkeuren();
  const store = useDataStore();
  const object = store.getObjectById(scenario.object_id);
  const {
    context,
    geoLocationKeys,
    loading,
    saving,
    save,
    recordApplication,
  } = useScenarioInputProfile(scenario.id, scenario.object_id);
  const [draft, setDraft] = useState<ScenarioInputContextDraft | null>(null);
  const [suggestionReasons, setSuggestionReasons] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [overwriteCodes, setOverwriteCodes] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const matchingPreferenceKeys = useMemo(() => {
    const place = object?.plaats?.trim().toLocaleLowerCase('nl-NL') ?? '';
    const province = object?.provincie?.trim().toLocaleLowerCase('nl-NL') ?? '';
    return preferences
      .filter((item) => item.active)
      .filter((item) => {
        const municipality = item.municipality_name?.trim().toLocaleLowerCase('nl-NL') ?? '';
        const preferenceProvince = item.province_name?.trim().toLocaleLowerCase('nl-NL') ?? '';
        return (place && municipality === place) || (province && preferenceProvince === province);
      })
      .map((item) => item.location_key);
  }, [object?.plaats, object?.provincie, preferences]);

  const suggestedLocationKeys = useMemo(
    () => Array.from(new Set([...geoLocationKeys, ...matchingPreferenceKeys])),
    [geoLocationKeys, matchingPreferenceKeys],
  );

  const suggestion = useMemo(() => deriveScenarioInputContextSuggestion({
    scenarioId: scenario.id,
    scenario: scenario as unknown as Record<string, unknown>,
    objectType: object?.type ?? null,
    locationKeys: suggestedLocationKeys,
  }), [object?.type, scenario, suggestedLocationKeys]);

  useEffect(() => {
    if (loading) return;
    if (context) {
      setDraft({
        scenario_id: context.scenario_id,
        asset_type_code: context.asset_type_code,
        strategy_code: context.strategy_code,
        project_phase_code: context.project_phase_code,
        risk_class_code: context.risk_class_code,
        quality_level_code: context.quality_level_code,
        complexity_code: context.complexity_code,
        location_type_code: context.location_type_code,
        market_condition_code: context.market_condition_code,
        scenario_profile_code: context.scenario_profile_code,
        location_keys: [...context.location_keys],
        derivation_notes: { ...context.derivation_notes },
        schema_version: context.schema_version,
      });
      setSuggestionReasons([]);
    } else {
      setDraft(suggestion.context);
      setSuggestionReasons(suggestion.reasons);
    }
  }, [context, loading, scenario.id, suggestion]);

  const matches = useMemo(
    () => draft ? rankKengetallenForContext(entries, draft) : [],
    [draft, entries],
  );
  const candidates = useMemo(
    () => draft ? buildProfileApplicationCandidates({
      matches,
      scenario: scenario as unknown as Record<string, unknown>,
      snapshots,
    }) : [],
    [draft, matches, scenario, snapshots],
  );

  const candidateSignature = candidates.map((item) => `${item.match.kengetal.code}:${item.match.selectedBand}:${item.conflict}:${item.match.applicable}`).join('|');
  useEffect(() => {
    setSelectedCodes(new Set(candidates.filter((item) => item.selectedByDefault).map((item) => item.match.kengetal.code)));
    setOverwriteCodes(new Set());
    // candidateSignature is deliberately the stable reset boundary for a changed profile/match set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateSignature]);

  if (!draft) {
    return (
      <Card className="mb-4 border-primary/20">
        <CardContent className="p-4 text-xs text-muted-foreground">Invoerprofiel laden…</CardContent>
      </Card>
    );
  }

  const savedComparable = contextComparable(context ? {
    scenario_id: context.scenario_id,
    asset_type_code: context.asset_type_code,
    strategy_code: context.strategy_code,
    project_phase_code: context.project_phase_code,
    risk_class_code: context.risk_class_code,
    quality_level_code: context.quality_level_code,
    complexity_code: context.complexity_code,
    location_type_code: context.location_type_code,
    market_condition_code: context.market_condition_code,
    scenario_profile_code: context.scenario_profile_code,
    location_keys: context.location_keys,
    derivation_notes: context.derivation_notes,
    schema_version: context.schema_version,
  } : null);
  const dirty = contextComparable(draft) !== savedComparable;
  const applicableCount = candidates.filter((item) => item.match.applicable).length;
  const incompleteCount = matches.filter((item) => item.status === 'incomplete').length;
  const mismatchedCount = matches.filter((item) => item.status === 'mismatch' || item.status === 'expired').length;

  const areaOptions = Array.from(new Map([
    ...preferences.filter((item) => item.active).map((item) => [item.location_key, { value: item.location_key, label: gebiedspad(item) }] as const),
    ...geoLocationKeys.map((key) => [key, { value: key, label: `Gekoppeld gebied ${key}` }] as const),
  ]).values());

  function update<K extends keyof ScenarioInputContextDraft>(key: K, value: ScenarioInputContextDraft[K]) {
    setDraft((current) => current ? ({ ...current, [key]: value }) : current);
  }

  function applySuggestion() {
    setDraft(suggestion.context);
    setSuggestionReasons(suggestion.reasons);
  }

  function toggleSelected(code: string, checked: boolean) {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (checked) next.add(code); else next.delete(code);
      return next;
    });
  }

  function toggleOverwrite(code: string, checked: boolean) {
    setOverwriteCodes((current) => {
      const next = new Set(current);
      if (checked) next.add(code); else next.delete(code);
      return next;
    });
  }

  async function applyProfile() {
    if (!context || dirty) {
      toast.error('Sla het invoerprofiel eerst op, zodat de gebruikte context controleerbaar blijft.');
      return;
    }
    const selected = candidates.filter((item) => selectedCodes.has(item.match.kengetal.code));
    if (selected.length === 0) {
      toast.error('Selecteer minimaal één toepasbaar kengetal.');
      return;
    }

    setApplying(true);
    const appliedItems: Array<Record<string, unknown>> = [];
    const skippedItems: Array<Record<string, unknown>> = [];
    let failed = false;
    try {
      for (const candidate of selected) {
        const code = candidate.match.kengetal.code;
        if (!candidate.match.applicable || !candidate.match.selectedBand) {
          skippedItems.push({ code, reason: candidate.match.blocker ?? 'Niet toepasbaar' });
          continue;
        }
        if (candidate.conflict === 'untracked_value' && !overwriteCodes.has(code)) {
          skippedItems.push({ code, reason: 'Bestaande niet-getraceerde waarde niet overschreven' });
          continue;
        }
        const ok = await onApply(candidate.match.kengetal, candidate.match.selectedBand);
        if (!ok) {
          failed = true;
          skippedItems.push({ code, reason: 'Opslaan of toepassen mislukt' });
          break;
        }
        appliedItems.push({
          code,
          band: candidate.match.selectedBand,
          value: candidate.match.selectedValue,
          scenario_field: candidate.match.kengetal.scenario_veld,
          register_version: candidate.match.kengetal.versie,
          overwrite_authorized: overwriteCodes.has(code),
        });
      }

      await recordApplication({
        contextSnapshot: draft,
        appliedItems,
        skippedItems,
        status: failed ? (appliedItems.length > 0 ? 'partial' : 'failed') : 'completed',
      });

      if (failed) toast.error('Het profiel is gedeeltelijk toegepast. Controleer de vastgelegde momentopnamen.');
      else toast.success(`${appliedItems.length} kengetal${appliedItems.length === 1 ? '' : 'len'} toegepast. Niet-geselecteerde of geblokkeerde waarden zijn niet gewijzigd.`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card className="mb-4 border-primary/25">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <ClipboardCheck className="h-4 w-4" /> Gecontroleerd invoerprofiel
              <Badge variant={context && !dirty ? 'default' : 'secondary'}>
                {context && !dirty ? 'Opgeslagen context' : 'Nog niet opgeslagen'}
              </Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Rangschikt kengetallen op vaste codes. Een voorstel verandert pas iets nadat je het profiel opslaat en de waarden selecteert.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={applySuggestion}>
              <WandSparkles className="mr-1 h-4 w-4" /> Voorstel uit scenario en object
            </Button>
            <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save(draft)}>
              <Save className="mr-1 h-4 w-4" /> {saving ? 'Opslaan…' : 'Profiel opslaan'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PlainLanguageHelp
          what="Dit profiel beschrijft welk soort object en project je beoordeelt. De CRM gebruikt die keuzes om passende kengetallen bovenaan te zetten."
          why="Een transformatie in een stadswijk vraagt andere aannames dan een logistieke hal op een snelweglocatie. Vaste keuzes maken latere vergelijking en onderzoek mogelijk."
          action="Controleer het voorstel, vul ontbrekende kenmerken aan en sla het profiel op. Selecteer daarna alleen de kengetallen die je echt wilt gebruiken."
          example="Bij ‘Kantoor’, ‘Transformeren’, ‘Quickscan’ en ‘Hoog risico’ krijgen kengetallen met precies die classificaties een hogere matchscore."
          warning="Opslaan van het profiel vult nog geen bedragen of percentages in. Een bestaande scenariowaarde zonder kengetal-snapshot wordt nooit standaard geselecteerd voor overschrijving."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ProfileSelect label="Scenarioprofiel" dimension="scenario_profile" value={draft.scenario_profile_code} options={options} required onChange={(value) => update('scenario_profile_code', value as ScenarioProfileCode)} />
          <ProfileSelect label="Assettype" dimension="asset_type" value={draft.asset_type_code} options={options} onChange={(value) => update('asset_type_code', value)} />
          <ProfileSelect label="Strategie" dimension="strategy" value={draft.strategy_code} options={options} onChange={(value) => update('strategy_code', value)} />
          <ProfileSelect label="Projectfase" dimension="project_phase" value={draft.project_phase_code} options={options} onChange={(value) => update('project_phase_code', value)} />
          <ProfileSelect label="Risicoklasse" dimension="risk_class" value={draft.risk_class_code} options={options} onChange={(value) => update('risk_class_code', value)} />
          <ProfileSelect label="Kwaliteitsniveau" dimension="quality_level" value={draft.quality_level_code} options={options} onChange={(value) => update('quality_level_code', value)} />
          <ProfileSelect label="Complexiteit" dimension="complexity" value={draft.complexity_code} options={options} onChange={(value) => update('complexity_code', value)} />
          <ProfileSelect label="Locatietype" dimension="location_type" value={draft.location_type_code} options={options} onChange={(value) => update('location_type_code', value)} />
          <ProfileSelect label="Marktomstandigheid" dimension="market_condition" value={draft.market_condition_code} options={options} onChange={(value) => update('market_condition_code', value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Gemeente, wijk of buurt</Label>
          <MultiSelectChips
            options={areaOptions}
            value={draft.location_keys}
            onChange={(value) => update('location_keys', value)}
            emptyLabel="Nog geen opgeslagen gebiedsvoorkeur of gekoppelde geo-code beschikbaar."
          />
          <p className="text-[10px] text-muted-foreground">Een gebied uit de Off-Market Radar wordt alleen als context voorgesteld; het maakt geen automatische voorkeur of kengetalwaarde aan.</p>
        </div>

        {suggestionReasons.length > 0 && (
          <div className="rounded-md border border-blue-500/25 bg-blue-500/5 p-3 text-xs text-blue-900 dark:text-blue-200">
            <p className="font-medium">Waarom dit is voorgesteld</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{suggestionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" /> {applicableCount} toepasbaar</Badge>
          <Badge variant="outline"><RefreshCw className="mr-1 h-3 w-3" /> {incompleteCount} mist context</Badge>
          <Badge variant="outline">{mismatchedCount} niet passend/verlopen</Badge>
          <Badge variant="secondary">Profiel: {PROFILE_LABELS[draft.scenario_profile_code]}</Badge>
        </div>

        <div className="space-y-2">
          {candidates.filter((item) => item.match.status !== 'mismatch').map((candidate) => {
            const code = candidate.match.kengetal.code;
            const selected = selectedCodes.has(code);
            const overwriteAllowed = overwriteCodes.has(code);
            return (
              <div key={code} className={`rounded-md border p-3 ${candidate.match.applicable ? '' : 'bg-muted/20'}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-2">
                    <Checkbox
                      checked={selected}
                      disabled={!candidate.match.applicable || (candidate.conflict === 'untracked_value' && !overwriteAllowed)}
                      onCheckedChange={(value) => toggleSelected(code, value === true)}
                      aria-label={`${candidate.match.kengetal.naam} selecteren`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{candidate.match.kengetal.naam}</p>
                        <Badge variant={candidate.match.status === 'exact' ? 'default' : 'outline'}>{MATCH_LABELS[candidate.match.status]}</Badge>
                        <Badge variant="outline">match {candidate.match.scorePercentage}%</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Voorstel: <span className="font-medium text-foreground">{candidate.match.selectedBand ?? 'geen profielband'}</span>
                        {' · '}{numberText(candidate.match.selectedValue, candidate.match.kengetal.eenheid)}
                        {' · '}bron {candidate.match.kengetal.bron_naam}, peildatum {candidate.match.kengetal.bron_peildatum}
                      </p>
                      {candidate.match.reasons.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{candidate.match.reasons.join(' · ')}</p>}
                      {candidate.match.blocker && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{candidate.match.blocker}</p>}
                      {candidate.conflict === 'tracked_snapshot' && (
                        <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">Vervangt een bestaande getraceerde kengetal-snapshot van {numberText(candidate.currentValue, candidate.match.kengetal.eenheid)}.</p>
                      )}
                    </div>
                  </div>
                  {candidate.conflict === 'untracked_value' && (
                    <label className="flex max-w-sm items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-xs text-amber-900 dark:text-amber-200">
                      <Checkbox checked={overwriteAllowed} onCheckedChange={(value) => toggleOverwrite(code, value === true)} />
                      <span>
                        <span className="font-medium">Bestaande waarde bewust overschrijven</span><br />
                        Huidig: {numberText(candidate.currentValue, candidate.match.kengetal.eenheid)}. Er is geen kengetal-snapshot die de herkomst verklaart.
                      </span>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {mismatchedCount > 0 && (
          <p className="text-[11px] text-muted-foreground">Niet-passende en verlopen kengetallen blijven in het centrale register staan, maar worden niet voorgeselecteerd voor dit scenario.</p>
        )}

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Het toepassen legt per waarde opnieuw bron, peildatum, bandbreedte en registerversie vast.</span>
          </div>
          <Button
            type="button"
            disabled={applying || taxonomyLoading || dirty || !context || selectedCodes.size === 0}
            onClick={() => void applyProfile()}
          >
            <ClipboardCheck className="mr-1 h-4 w-4" /> {applying ? 'Toepassen…' : 'Geselecteerde profielwaarden toepassen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSelect({
  label,
  dimension,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string;
  dimension: TaxonomyDimension;
  value: string | null;
  options: Parameters<typeof taxonomyOptionsFor>[0];
  required?: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? '__none__'} onValueChange={(next) => onChange(next === '__none__' ? null : next)}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="__none__">Nog niet gekozen</SelectItem>}
          {taxonomyOptionsFor(options, dimension).map((option) => (
            <SelectItem key={option.option_code} value={option.option_code}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && <p className="text-[10px] text-muted-foreground">Code: {value} · {taxonomyLabel(options, dimension, value)}</p>}
    </div>
  );
}
