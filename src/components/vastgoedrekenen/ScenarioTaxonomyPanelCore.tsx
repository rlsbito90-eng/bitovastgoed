import { useEffect, useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2, Save, SplitSquareVertical } from 'lucide-react';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import { VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { SALE_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/verkoop';
import {
  BUSINESS_CASE_METADATA,
  DISPOSITION_METADATA,
  EXPANSION_SUBTYPE_METADATA,
  EXPLOITATION_MODE_METADATA,
  INTERVENTION_METADATA,
  ScenarioTaxonomyPersistenceError,
  buildLegacyCompatibilityPatch,
  isLegacyCompatibilityAligned,
  resolvePersistedScenarioTaxonomy,
  scenarioTaxonomyPersistencePatch,
  suggestLegacyScenarioCompatibility,
  type BusinessCase,
  type CanonicalScenarioTaxonomy,
  type Disposition,
  type ExpansionSubtype,
  type ExploitationMode,
  type Intervention,
  type ScenarioLegacyCompatibilityPatch,
  type ScenarioTaxonomyPersistencePatch,
} from '@/lib/vastgoedrekenen/taxonomy';

interface Props {
  scenario: Scenario;
  onSave: (patch: ScenarioTaxonomyPersistencePatch) => Promise<boolean>;
  onSyncCompatibility: (patch: ScenarioLegacyCompatibilityPatch) => Promise<boolean>;
}

const SOURCE_LABELS = {
  canonical: 'Canoniek opgeslagen',
  legacy: 'Afgeleid uit bestaande strategie',
  mixed: 'Gedeeltelijke historische classificatie',
} as const;

const BRIDGE_LABELS = {
  exact: 'Veilige vertaling',
  inferred: 'Benadering met waarschuwing',
  unsupported: 'Nieuwe rekenadapter nodig',
} as const;

function sameTaxonomy(a: CanonicalScenarioTaxonomy, b: CanonicalScenarioTaxonomy): boolean {
  return a.businessCase === b.businessCase
    && a.intervention === b.intervention
    && a.expansionSubtype === b.expansionSubtype
    && a.exploitation === b.exploitation
    && a.disposition === b.disposition;
}

export default function ScenarioTaxonomyPanel({ scenario, onSave, onSyncCompatibility }: Props) {
  const resolved = useMemo(
    () => resolvePersistedScenarioTaxonomy(scenario as unknown as Record<string, unknown>),
    [scenario],
  );
  const [draft, setDraft] = useState<CanonicalScenarioTaxonomy>(resolved.value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  useEffect(() => {
    setDraft(resolved.value);
    setError(null);
    setSyncOpen(false);
  }, [scenario.id, resolved.source, resolved.schemaVersion, resolved.value.businessCase, resolved.value.intervention, resolved.value.expansionSubtype, resolved.value.exploitation, resolved.value.disposition]);

  const dirty = resolved.source !== 'canonical' || !sameTaxonomy(draft, resolved.value);
  const bridge = useMemo(() => suggestLegacyScenarioCompatibility(draft), [draft]);
  const compatibilityPatch = useMemo(
    () => buildLegacyCompatibilityPatch(scenario as unknown as Record<string, unknown>, bridge),
    [scenario, bridge],
  );
  const compatibilityAligned = isLegacyCompatibilityAligned(
    scenario as unknown as Record<string, unknown>,
    bridge,
  );
  const currentStrategy = String(scenario.strategy_type ?? 'overig');
  const currentSaleStrategy = String((scenario as unknown as Record<string, unknown>).sale_strategy ?? 'geen_verkoop');

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

  async function syncCompatibility() {
    if (Object.keys(compatibilityPatch).length === 0) return;
    setSyncBusy(true);
    try {
      const saved = await onSyncCompatibility(compatibilityPatch);
      if (saved) setSyncOpen(false);
    } finally {
      setSyncBusy(false);
    }
  }

  const syncDisabledReason = resolved.source !== 'canonical' || dirty
    ? 'Sla de classificatie eerst op.'
    : bridge.status === 'unsupported'
      ? 'Voor deze combinatie bestaat nog geen veilige adapter naar de huidige rekenkern.'
      : compatibilityAligned
        ? 'De bestaande rekenvelden zijn al gekoppeld.'
        : null;

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
            Businesscase, fysieke ingreep, exploitatie en exit worden hier onafhankelijk vastgelegd. De bestaande strategievelden blijven tijdelijk de huidige rekenkern aansturen.
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

      <div className="rounded-md border bg-card p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold">Koppeling met bestaande rekenkern</p>
              <Badge
                variant={bridge.status === 'unsupported' ? 'outline' : compatibilityAligned ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {compatibilityAligned && bridge.status !== 'unsupported' ? 'Rekenvelden gekoppeld' : BRIDGE_LABELS[bridge.status]}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              De koppeling verandert uitsluitend de tijdelijke velden ‘legacy rekenstrategie’ en, wanneer eenduidig, ‘verkoopstrategie’. Zij verwijdert geen financiële invoer.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!syncDisabledReason}
            onClick={() => setSyncOpen(true)}
            className="w-full sm:w-auto"
          >
            <Link2 className="h-4 w-4 mr-1" />
            {compatibilityAligned && bridge.status !== 'unsupported' ? 'Rekenvelden gekoppeld' : 'Rekenvelden controleren'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md bg-muted/35 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Huidige rekenvelden</p>
            <p className="mt-1"><span className="text-muted-foreground">Strategie:</span> {VR_STRATEGY_LABELS[currentStrategy] ?? currentStrategy}</p>
            <p><span className="text-muted-foreground">Verkoop:</span> {SALE_STRATEGY_LABELS[currentSaleStrategy] ?? currentSaleStrategy}</p>
          </div>
          <div className="rounded-md bg-muted/35 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Voorgestelde vertaling</p>
            <p className="mt-1"><span className="text-muted-foreground">Strategie:</span> {bridge.strategyType ? (VR_STRATEGY_LABELS[bridge.strategyType] ?? bridge.strategyType) : 'Geen veilige vertaling'}</p>
            <p><span className="text-muted-foreground">Verkoop:</span> {bridge.saleStrategy ? (SALE_STRATEGY_LABELS[bridge.saleStrategy] ?? bridge.saleStrategy) : 'Ongewijzigd'}</p>
          </div>
        </div>

        <div className="text-[11px] leading-relaxed space-y-1">
          {bridge.reasons.map((reason) => <p key={reason}>{reason}</p>)}
          {bridge.warnings.map((warning) => <p key={warning} className="text-amber-700 dark:text-amber-300">⚠ {warning}</p>)}
          {syncDisabledReason && <p className="text-muted-foreground">{syncDisabledReason}</p>}
        </div>
      </div>

      <AlertDialog open={syncOpen} onOpenChange={setSyncOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rekencompatibiliteit toepassen?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                De huidige legacy rekenstrategie wijzigt van “{VR_STRATEGY_LABELS[currentStrategy] ?? currentStrategy}” naar “{bridge.strategyType ? (VR_STRATEGY_LABELS[bridge.strategyType] ?? bridge.strategyType) : '—'}”.
              </span>
              {bridge.saleStrategy && compatibilityPatch.sale_strategy && (
                <span className="block">
                  De verkoopstrategie wijzigt van “{SALE_STRATEGY_LABELS[currentSaleStrategy] ?? currentSaleStrategy}” naar “{SALE_STRATEGY_LABELS[bridge.saleStrategy] ?? bridge.saleStrategy}”.
                </span>
              )}
              <span className="block">
                Financiële invoer wordt niet verwijderd. De bestaande rekenkern kan na deze wijziging wel andere secties, heuristieken en uitkomsten activeren op basis van dezelfde invoer.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncBusy}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); syncCompatibility(); }} disabled={syncBusy}>
              {syncBusy ? 'Toepassen…' : 'Rekenvelden toepassen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
