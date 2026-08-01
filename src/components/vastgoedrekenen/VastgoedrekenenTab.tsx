import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Building2,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Layers3,
  LayoutDashboard,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
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

type CaseWorkspaceTab = 'overview' | 'scope' | 'scenarios' | 'results';

const CASE_WORKSPACE_TABS: Array<{
  value: CaseWorkspaceTab;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  { value: 'overview', label: 'Overzicht', description: 'Kern van de case', icon: LayoutDashboard },
  { value: 'scope', label: 'Object & uitgangspunten', description: 'Scope en basisinvoer', icon: Building2 },
  { value: 'scenarios', label: "Scenario's", description: 'Uitwerken en doorrekenen', icon: Layers3 },
  { value: 'results', label: 'Resultaten & vergelijking', description: 'Scenario’s naast elkaar', icon: BarChart3 },
];

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

function MetricCard({ label, value, helper }: { label: string; value: ReactNode; helper?: string }) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-sm">
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</div>
        {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
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
  const [workspaceTab, setWorkspaceTab] = useState<CaseWorkspaceTab>('overview');
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    setActiveScenarioId((current) => (
      current && scenarios.some((scenario) => scenario.id === current)
        ? current
        : scenarios[0]?.id ?? null
    ));
  }, [scenarios]);

  if (!calculation) return <p className="text-sm text-muted-foreground">Quickscan wordt geladen…</p>;

  const proposition = resolveAnalysisPropositionMetadata(calculation as unknown as Record<string, unknown>);
  const untypedSupabase = supabase as unknown as { from: (table: string) => any };
  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0] ?? null;

  function openScenario(id: string) {
    setActiveScenarioId(id);
    setWorkspaceTab('scenarios');
  }

  async function duplicateAndOpen(id: string) {
    setDuplicatingId(id);
    try {
      const duplicate = await duplicateScenario(id);
      if (!duplicate) return;
      const snapshotsCopied = await cloneScenarioKengetalSnapshots(id, duplicate.id);
      if (snapshotsCopied) openScenario(duplicate.id);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function createAndOpenScenario() {
    const created = await createScenario({ scenario_name: `Scenario ${scenarios.length + 1}` });
    if (created) openScenario(created.id);
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

  const analysisSettings = (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="border-b border-border/50 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Case-instellingen</p>
          <CardTitle className="mt-1 text-base">Basis van de analyse</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
        <MobileFieldGroup label="Naam quickscan">
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
          helper="Compatibiliteitsveld voor bestaande scenario’s. Nieuwe strategiekeuzes staan per scenario."
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
        <div className="md:col-span-2 lg:col-span-4">
          <AnalysisPropositionSettings
            analysis={calculation}
            onChangeType={(type) => updateCalculation(propositionPersistencePatch({ propositionType: type }))}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as CaseWorkspaceTab)} className="space-y-5" data-testid="vastgoedrekenen-case-workspace">
      <div className="sticky top-2 z-20 overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.07] via-background to-accent/[0.05] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  Vastgoedcase
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {VR_STATUS_LABELS[calculation.status]}
                </span>
              </div>
              <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {calculation.calculation_name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {VR_STRATEGY_LABELS[calculation.main_strategy]} · {calculation.object_type === 'mixed_use' ? 'Mixed-use' : 'Enkelvoudig'} · {scenarios.length} scenario{scenarios.length === 1 ? '' : "'s"}
              </p>
            </div>
            <Button onClick={createAndOpenScenario} className="shrink-0 shadow-sm">
              <Plus className="mr-1.5 h-4 w-4" /> Nieuw scenario
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto px-2 py-2 sm:px-3">
          <TabsList className="inline-flex h-auto min-w-max gap-1 bg-transparent p-0">
            {CASE_WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="group min-h-[52px] min-w-[150px] justify-start gap-2 rounded-lg border border-transparent px-3 py-2 text-left data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[state=active]:text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{tab.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{tab.description}</span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>

      <TabsContent value="overview" className="mt-0 space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Scenario's" value={scenarios.length} helper="Beschikbaar binnen deze case" />
          <MetricCard label="Objectstructuur" value={calculation.object_type === 'mixed_use' ? 'Mixed-use' : 'Enkelvoudig'} helper="Bepaalt de invoerstructuur" />
          <MetricCard label="Propositie" value={proposition.propositionType === 'renovate_and_sell' ? 'Renoveren & verkopen' : 'Reguliere analyse'} helper="Actieve analysetypologie" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          {analysisSettings}
          <Card className="border-border/60 bg-muted/20 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">Volgende stap</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Werk de objectuitgangspunten bij of open direct een scenario om de businesscase door te rekenen.
              </p>
              <Button variant="outline" className="w-full justify-between" onClick={() => setWorkspaceTab('scope')}>
                Object & uitgangspunten <ChevronRight className="h-4 w-4" />
              </Button>
              <Button className="w-full justify-between" onClick={() => setWorkspaceTab('scenarios')}>
                Naar scenario’s <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="scope" className="mt-0 space-y-5">
        {analysisSettings}
        <AnalysisScopeSettings analysis={calculation} onSave={saveAnalysisScope} />
      </TabsContent>

      <TabsContent value="results" className="mt-0">
        <ScenarioVergelijking
          scenarios={scenarios}
          taxSettings={taxSettings}
          objectType={calculation.object_type}
          objectArea={objectArea}
          objectWoz={objectWoz}
          objectEnergyLabel={objectEnergyLabel}
          objectBouwjaar={objectBouwjaar}
          objectRawType={objectRawType}
          onSelectScenario={openScenario}
        />
      </TabsContent>

      <TabsContent value="scenarios" className="mt-0">
        {scenarios.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <Layers3 className="h-9 w-9 text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold">Nog geen scenario’s</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Maak een eerste scenario aan om strategie, aannames en financiële uitkomsten uit te werken.</p>
              <Button className="mt-4" onClick={createAndOpenScenario}>
                <Plus className="mr-1.5 h-4 w-4" /> Eerste scenario maken
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="h-fit border-border/60 shadow-sm xl:sticky xl:top-[168px]">
              <CardHeader className="border-b border-border/50 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Scenario’s</p>
                    <CardTitle className="mt-1 text-base">Selecteer werkblad</CardTitle>
                  </div>
                  <Button size="icon" variant="outline" onClick={createAndOpenScenario} title="Nieuw scenario">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-2">
                {scenarios.map((scenario) => {
                  const taxonomy = resolvePersistedScenarioTaxonomy(scenario as unknown as Record<string, unknown>);
                  const selected = scenario.id === activeScenario?.id;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setActiveScenarioId(scenario.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        selected
                          ? 'border-primary/35 bg-primary/[0.07] shadow-sm'
                          : 'border-transparent bg-muted/30 hover:border-border hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{scenario.scenario_name}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                            {getBusinessCaseLabel(taxonomy.value.businessCase)} · {getInterventionLabel(taxonomy.value.intervention)}
                          </p>
                        </div>
                        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{VR_STATUS_LABELS[scenario.status]}</span>
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{getDispositionLabel(taxonomy.value.disposition)}</span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {activeScenario && (
              <Card className="min-w-0 overflow-hidden border-border/60 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-gradient-to-r from-muted/50 to-background pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Actief scenario</p>
                      <CardTitle className="mt-1 truncate text-lg">{activeScenario.scenario_name}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{VR_STRATEGY_LABELS[activeScenario.strategy_type]} · {VR_STATUS_LABELS[activeScenario.status]}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={duplicatingId === activeScenario.id}
                      onClick={() => duplicateAndOpen(activeScenario.id)}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      {duplicatingId === activeScenario.id ? 'Kopiëren…' : 'Dupliceren'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-5">
                  <Tabs defaultValue="setup" className="space-y-5">
                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-1">
                      <TabsList className="inline-flex h-auto min-w-max gap-1 bg-transparent p-0">
                        <TabsTrigger value="setup" className="gap-2 px-3 py-2">
                          <FileSpreadsheet className="h-4 w-4" /> Opzet & classificatie
                        </TabsTrigger>
                        <TabsTrigger value="assumptions" className="gap-2 px-3 py-2">
                          <SlidersHorizontal className="h-4 w-4" /> Kengetallen & aannames
                        </TabsTrigger>
                        <TabsTrigger value="calculation" className="gap-2 px-3 py-2">
                          <BarChart3 className="h-4 w-4" /> Doorrekenen
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="setup" className="mt-0 space-y-4">
                      <ScenarioTaxonomyPanel
                        scenario={activeScenario}
                        onSave={(patch) => saveScenarioTaxonomy(activeScenario.id, patch)}
                        onSyncCompatibility={(patch) => syncScenarioCompatibility(activeScenario.id, patch)}
                      />
                      {proposition.propositionType === 'renovate_and_sell' && (
                        <RenovateAndSellPanel scenario={activeScenario} onSaved={refetch} />
                      )}
                    </TabsContent>

                    <TabsContent value="assumptions" className="mt-0">
                      <ScenarioKengetallenPanel scenario={activeScenario} onUpdateScenario={updateScenario} />
                    </TabsContent>

                    <TabsContent value="calculation" className="mt-0">
                      <ScenarioEditor
                        scenario={activeScenario}
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
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
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
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/[0.06] via-background to-background pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Analysewerkruimte</p>
              <CardTitle className="mt-1 text-lg">Vastgoedrekenen</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Selecteer een analyse en werk de case uit in overzichtelijke werkbladen.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'begeleid' | 'compact' | 'expert')}>
                <SelectTrigger className="h-9 w-full bg-background sm:w-[145px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="begeleid">Begeleid</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full shadow-sm sm:w-auto" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Nieuwe analyse
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
          <CardContent className="flex gap-2 overflow-x-auto p-3">
            {calculations.map((calculation) => (
              <button
                key={calculation.id}
                onClick={() => selectQuickscan(calculation.id)}
                className={`min-w-[190px] rounded-lg border px-3 py-2.5 text-left transition-all ${
                  active === calculation.id
                    ? 'border-primary/35 bg-primary/[0.07] shadow-sm'
                    : 'border-border/50 bg-card hover:border-primary/25 hover:bg-muted/30'
                }`}
              >
                <p className="truncate text-sm font-semibold">{calculation.calculation_name}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{VR_STATUS_LABELS[calculation.status]}</span>
                  <span>·</span>
                  <span className="truncate">{VR_STRATEGY_LABELS[calculation.main_strategy]}</span>
                </div>
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <LayoutDashboard className="h-9 w-9 text-muted-foreground" />
            <h3 className="mt-3 text-base font-semibold">Nog geen analyse aangemaakt</h3>
            <p className="mt-1 text-sm text-muted-foreground">Maak een analyse aan om de vastgoedcase door te rekenen.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nieuwe analyse
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
