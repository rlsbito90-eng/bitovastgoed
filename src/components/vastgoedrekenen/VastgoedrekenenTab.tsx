import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useObjectCalculations, useQuickscanDetail, useTaxSettings } from '@/hooks/useVastgoedrekenen';
import { cloneScenarioKengetalSnapshots } from '@/hooks/useKengetallenregister';
import { useVastgoedrekenenPrefs } from '@/hooks/useVastgoedrekenenPrefs';
import ScenarioEditor from './ScenarioEditor';
import ScenarioVergelijking from './ScenarioVergelijking';
import ScenarioKengetallenPanel from './ScenarioKengetallenPanel';
import ScenarioTaxonomyPanel from './ScenarioTaxonomyPanel';
import AnalysisScopeSettings from './AnalysisScopeSettings';
import RenovateAndSellPanel from './RenovateAndSellPanel';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { RawTextInput } from './RawInputs';
import AnalysisPropositionSettings from './AnalysisPropositionSettings';
import CreateAnalysisDialog from './CreateAnalysisDialog';
import {
  propositionPersistencePatch,
  resolveAnalysisPropositionMetadata,
  type AnalysisMetadataPersistencePatch,
} from '@/lib/vastgoedrekenen/analysis';
import {
  getBusinessCaseLabel,
  getDispositionLabel,
  getInterventionLabel,
  resolvePersistedScenarioTaxonomy,
  type ScenarioLegacyCompatibilityPatch,
  type ScenarioTaxonomyPersistencePatch,
} from '@/lib/vastgoedrekenen/taxonomy';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = {
  objectId: string;
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectRawType?: string | null;
  objectVraagprijs?: number | null;
  initialCalculationId?: string | null;
};

function MobileFieldGroup({ label, children, helper, className }: { label: ReactNode; children: ReactNode; helper?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 w-full space-y-1.5 ${className ?? ''}`}>
      <Label className="block text-xs font-medium leading-snug whitespace-normal break-words">{label}</Label>
      <div className="min-w-0 w-full [&_input]:w-full [&_input]:min-w-0 [&_[role=combobox]]:w-full [&_[role=combobox]]:min-w-0">
        {children}
      </div>
      {helper && <p className="text-[10px] leading-snug text-muted-foreground">{helper}</p>}
    </div>
  );
}

function QuickscanDetail({ calculationId, taxSettings, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, viewMode, objectRawType, objectVraagprijs }: {
  calculationId: string;
  taxSettings: ReturnType<typeof useTaxSettings>['settings'];
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  viewMode: 'begeleid' | 'compact' | 'expert';
  objectRawType?: string | null;
  objectVraagprijs?: number | null;
}) {
  const {
    calculation,
    scenarios,
    refetch,
    updateCalculation,
    createScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
  } = useQuickscanDetail(calculationId);
  const [openScenarios, setOpenScenarios] = useState<Set<string>>(new Set());
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  if (!calculation) return <p className="text-sm text-muted-foreground">Quickscan wordt geladen…</p>;

  const proposition = resolveAnalysisPropositionMetadata(calculation as unknown as Record<string, unknown>);
  const untypedSupabase = supabase as unknown as { from: (table: string) => any };

  function toggle(id: string) {
    const next = new Set(openScenarios);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpenScenarios(next);
  }

  function openAndScrollTo(id: string) {
    setOpenScenarios((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      const el = document.getElementById(`scenario-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  async function duplicateAndOpen(id: string) {
    setDuplicatingId(id);
    try {
      const duplicate = await duplicateScenario(id);
      if (!duplicate) return;
      const snapshotsCopied = await cloneScenarioKengetalSnapshots(id, duplicate.id);
      if (snapshotsCopied) openAndScrollTo(duplicate.id);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function saveAnalysisScope(patch: AnalysisMetadataPersistencePatch): Promise<boolean> {
    const { error } = await untypedSupabase
      .from('real_estate_calculations')
      .update(patch)
      .eq('id', calculation.id);
    if (error) {
      toast.error('Scope van de Quickscan opslaan mislukt');
      return false;
    }
    toast.success('Scope van de Quickscan opgeslagen');
    await refetch();
    return true;
  }

  async function saveScenarioTaxonomy(id: string, patch: ScenarioTaxonomyPersistencePatch): Promise<boolean> {
    const { error } = await untypedSupabase
      .from('calculation_scenarios')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast.error('Scenario-classificatie opslaan mislukt');
      return false;
    }
    toast.success('Scenario-classificatie opgeslagen');
    await refetch();
    return true;
  }

  async function syncScenarioCompatibility(id: string, patch: ScenarioLegacyCompatibilityPatch): Promise<boolean> {
    if (Object.keys(patch).length === 0) return true;
    const { error } = await untypedSupabase
      .from('calculation_scenarios')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast.error('Koppeling met de bestaande rekenkern mislukt');
      return false;
    }
    toast.success('Bestaande rekenvelden gekoppeld aan de scenario-classificatie');
    await refetch();
    return true;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
            <MobileFieldGroup label="Naam quickscan" className="md:col-span-2 lg:col-span-1 lg:flex-1">
              <RawTextInput
                initialValue={calculation.calculation_name}
                onCommit={(value) => {
                  const trimmed = value.trim();
                  if (trimmed && trimmed !== calculation.calculation_name) updateCalculation({ calculation_name: trimmed });
                }}
              />
            </MobileFieldGroup>
            <MobileFieldGroup label="Status">
              <Select value={calculation.status} onValueChange={(v) => updateCalculation({ status: v as typeof calculation.status })}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </MobileFieldGroup>
            <MobileFieldGroup
              label="Legacy hoofdstrategie"
              helper="Tijdelijk compatibiliteitsveld voor bestaande scenario’s en rekenlogica. Nieuwe strategiekeuzes staan per scenario."
            >
              <Select value={calculation.main_strategy} onValueChange={(v) => updateCalculation({ main_strategy: v as typeof calculation.main_strategy })}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </MobileFieldGroup>
            <MobileFieldGroup label="Objectstructuur">
              <Select value={calculation.object_type} onValueChange={(v) => updateCalculation({ object_type: v as typeof calculation.object_type })}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enkelvoudig">Enkelvoudig</SelectItem>
                  <SelectItem value="mixed_use">Mixed-use</SelectItem>
                </SelectContent>
              </Select>
            </MobileFieldGroup>
            <AnalysisPropositionSettings
              analysis={calculation}
              onChangeType={(type) => updateCalculation(propositionPersistencePatch({ propositionType: type }))}
            />
            <Button className="w-full md:w-auto md:col-span-2 lg:col-span-4 lg:justify-self-end" onClick={() => createScenario({ scenario_name: `Scenario ${scenarios.length + 1}` })}>
              <Plus className="h-4 w-4 mr-1" /> Nieuw scenario
            </Button>
          </div>
        </CardHeader>
      </Card>

      <AnalysisScopeSettings analysis={calculation} onSave={saveAnalysisScope} />

      <ScenarioVergelijking
        scenarios={scenarios}
        taxSettings={taxSettings}
        objectType={calculation.object_type}
        objectArea={objectArea}
        objectWoz={objectWoz}
        objectEnergyLabel={objectEnergyLabel}
        objectBouwjaar={objectBouwjaar}
        objectRawType={objectRawType}
        onSelectScenario={openAndScrollTo}
      />

      <div className="space-y-3">
        {scenarios.map((s) => {
          const open = openScenarios.has(s.id);
          const duplicating = duplicatingId === s.id;
          const taxonomy = resolvePersistedScenarioTaxonomy(s as unknown as Record<string, unknown>);
          const taxonomySummary = `${taxonomy.source === 'canonical' ? '' : 'Afgeleid · '}${getBusinessCaseLabel(taxonomy.value.businessCase)} · ${getInterventionLabel(taxonomy.value.intervention)} · ${getDispositionLabel(taxonomy.value.disposition)}`;
          return (
            <div key={s.id} id={`scenario-${s.id}`} className="border rounded-md scroll-mt-20">
              <div className="flex items-stretch bg-muted/30 hover:bg-muted/50">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="min-w-0 flex-1 flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex items-center gap-2">
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="font-medium truncate">{s.scenario_name}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline truncate" title={`Legacy rekenstrategie: ${VR_STRATEGY_LABELS[s.strategy_type]}`}>
                      {taxonomySummary}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{VR_STATUS_LABELS[s.status]}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto rounded-none border-l px-3"
                  disabled={duplicating}
                  onClick={() => duplicateAndOpen(s.id)}
                  title="Kopieer het laatst opgeslagen scenario inclusief onderliggende invoer en kengetal-snapshots"
                >
                  <Copy className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{duplicating ? 'Kopiëren…' : 'Dupliceren'}</span>
                </Button>
              </div>
              {open && (
                <div className="p-4">
                  <ScenarioTaxonomyPanel
                    scenario={s}
                    onSave={(patch) => saveScenarioTaxonomy(s.id, patch)}
                    onSyncCompatibility={(patch) => syncScenarioCompatibility(s.id, patch)}
                  />
                  {proposition.propositionType === 'renovate_and_sell' && (
                    <RenovateAndSellPanel scenario={s} onSaved={refetch} />
                  )}
                  <ScenarioKengetallenPanel scenario={s} onUpdateScenario={updateScenario} />
                  <ScenarioEditor
                    scenario={s}
                    taxSettings={taxSettings}
                    objectType={calculation.object_type}
                    objectArea={objectArea}
                    objectWoz={objectWoz}
                    objectEnergyLabel={objectEnergyLabel}
                    objectBouwjaar={objectBouwjaar}
                    objectRawType={objectRawType}
                    objectVraagprijs={objectVraagprijs}
                    viewMode={viewMode}
                    onUpdate={updateScenario}
                    onDelete={deleteScenario}
                  />
                </div>
              )}
            </div>
          );
        })}
        {scenarios.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nog geen scenario's. Maak een eerste scenario aan om te beginnen.</p>
        )}
      </div>
    </div>
  );
}

export default function VastgoedrekenenTab({ objectId, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, objectRawType, objectVraagprijs, initialCalculationId }: Props) {
  const { calculations, createAnalysis } = useObjectCalculations(objectId);
  const { settings: taxSettings } = useTaxSettings();
  const { viewMode, setViewMode } = useVastgoedrekenenPrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(initialCalculationId ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (initialCalculationId && calculations.some((calculation) => calculation.id === initialCalculationId)) {
      setActiveId(initialCalculationId);
      return;
    }
    setActiveId((current) => (
      current && calculations.some((calculation) => calculation.id === current)
        ? current
        : calculations[0]?.id ?? null
    ));
  }, [calculations, initialCalculationId]);

  const active = activeId ?? calculations[0]?.id ?? null;

  function selectQuickscan(id: string) {
    setActiveId(id);
    const params = new URLSearchParams(location.search);
    params.set('tab', 'vastgoedrekenen');
    params.set('calculation', id);
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
      hash: '#vastgoedrekenen',
    }, { replace: true });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">Vastgoedrekenen</CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'begeleid' | 'compact' | 'expert')}>
                <SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="begeleid">Begeleid</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nieuwe analyse
              </Button>
              <CreateAnalysisDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                defaultName={`Analyse ${calculations.length + 1}`}
                onCreate={async (input) => { const c = await createAnalysis(input); if (c) selectQuickscan(c.id); }}
              />
            </div>
          </div>
        </CardHeader>

        {calculations.length > 0 && (
          <CardContent className="pt-0 flex flex-wrap gap-2">
            {calculations.map((c) => (
              <button key={c.id} onClick={() => selectQuickscan(c.id)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
                {c.calculation_name} <span className="opacity-60">· {VR_STATUS_LABELS[c.status]}</span>
              </button>
            ))}
          </CardContent>
        )}
      </Card>

      {active ? (
        <QuickscanDetail
          key={active}
          calculationId={active}
          taxSettings={taxSettings}
          objectArea={objectArea}
          objectWoz={objectWoz}
          objectEnergyLabel={objectEnergyLabel}
          objectBouwjaar={objectBouwjaar}
          objectRawType={objectRawType}
          objectVraagprijs={objectVraagprijs}
          viewMode={viewMode}
        />
      ) : (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nog geen analyse aangemaakt. Klik op "Nieuwe analyse" om te starten.
        </CardContent></Card>
      )}
    </div>
  );
}
