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
import CreateAnalysisDialog from './CreateAnalysisDialog';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { RawTextInput } from './RawInputs';
import { PROPOSITION_DEFINITIONS, getPropositionLabel, type PropositionType } from '@/lib/vastgoedrekenen/propositions';
import { resolveAnalysisProposition } from '@/lib/vastgoedrekenen/propositions/analysisResolver';
import { updateAnalysisMetadata } from '@/lib/vastgoedrekenen/analysis/persistence';
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

function MobileFieldGroup({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <div className={`min-w-0 w-full space-y-1.5 ${className ?? ''}`}><Label className="block text-xs font-medium">{label}</Label><div className="min-w-0 w-full">{children}</div></div>;
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
  const { calculation, scenarios, updateCalculation, createScenario, updateScenario, deleteScenario, duplicateScenario, refetch } = useQuickscanDetail(calculationId);
  const [openScenarios, setOpenScenarios] = useState<Set<string>>(new Set());
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [pendingProposition, setPendingProposition] = useState<PropositionType | null>(null);

  if (!calculation) return <p className="text-sm text-muted-foreground">Analyse wordt geladen…</p>;
  const proposition = resolveAnalysisProposition(calculation as unknown as Record<string, unknown>);

  function toggle(id: string) {
    setOpenScenarios((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openAndScrollTo(id: string) {
    setOpenScenarios((prev) => new Set(prev).add(id));
    setTimeout(() => document.getElementById(`scenario-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  async function duplicateAndOpen(id: string) {
    setDuplicatingId(id);
    try {
      const duplicate = await duplicateScenario(id);
      if (!duplicate) return;
      if (await cloneScenarioKengetalSnapshots(id, duplicate.id)) openAndScrollTo(duplicate.id);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function confirmPropositionChange() {
    if (!pendingProposition) return;
    const confirmed = window.confirm('Het wijzigen van het propositietype past alleen de classificatie van deze analyse aan. Bestaande invoer, aannames en berekeningsuitkomsten worden niet gewijzigd of verwijderd.');
    if (!confirmed) { setPendingProposition(null); return; }
    try {
      await updateAnalysisMetadata(calculation.id, { proposition_type: pendingProposition });
      toast.success('Propositietype gewijzigd; scenario-invoer en uitkomsten zijn niet aangepast');
      setPendingProposition(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Propositietype wijzigen mislukt');
    }
  }

  return <div className="space-y-4">
    <Card><CardHeader className="pb-3"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      <MobileFieldGroup label="Naam analyse"><RawTextInput initialValue={calculation.calculation_name} onCommit={(value) => { const trimmed = value.trim(); if (trimmed && trimmed !== calculation.calculation_name) updateCalculation({ calculation_name: trimmed }); }} /></MobileFieldGroup>
      <MobileFieldGroup label="Propositietype"><Select value={pendingProposition ?? proposition.propositionType} onValueChange={(value) => setPendingProposition(value as PropositionType)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{PROPOSITION_DEFINITIONS.map((definition) => <SelectItem key={definition.type} value={definition.type}>{definition.label}</SelectItem>)}</SelectContent></Select>{pendingProposition && pendingProposition !== proposition.propositionType && <Button size="sm" variant="outline" className="mt-2 w-full" onClick={confirmPropositionChange}>Wijziging bevestigen</Button>}</MobileFieldGroup>
      <MobileFieldGroup label="Status"><Select value={calculation.status} onValueChange={(v) => updateCalculation({ status: v as typeof calculation.status })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(VR_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></MobileFieldGroup>
      <MobileFieldGroup label="Hoofdstrategie"><Select value={calculation.main_strategy} onValueChange={(v) => updateCalculation({ main_strategy: v as typeof calculation.main_strategy })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></MobileFieldGroup>
      <MobileFieldGroup label="Objecttype"><Select value={calculation.object_type} onValueChange={(v) => updateCalculation({ object_type: v as typeof calculation.object_type })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="enkelvoudig">Enkelvoudig</SelectItem><SelectItem value="mixed_use">Mixed-use</SelectItem></SelectContent></Select></MobileFieldGroup>
      <Button className="w-full lg:col-span-5 lg:justify-self-end lg:w-auto" onClick={() => createScenario({ scenario_name: `Scenario ${scenarios.length + 1}` })}><Plus className="h-4 w-4 mr-1" /> Nieuw scenario</Button>
    </div></CardHeader></Card>

    <ScenarioVergelijking scenarios={scenarios} taxSettings={taxSettings} objectType={calculation.object_type} objectArea={objectArea} objectWoz={objectWoz} objectEnergyLabel={objectEnergyLabel} objectBouwjaar={objectBouwjaar} objectRawType={objectRawType} onSelectScenario={openAndScrollTo} />

    <div className="space-y-3">{scenarios.map((scenario) => {
      const open = openScenarios.has(scenario.id);
      const duplicating = duplicatingId === scenario.id;
      return <div key={scenario.id} id={`scenario-${scenario.id}`} className="border rounded-md scroll-mt-20"><div className="flex items-stretch bg-muted/30"><button type="button" onClick={() => toggle(scenario.id)} className="min-w-0 flex-1 flex items-center justify-between gap-3 px-4 py-3 text-left"><span className="flex items-center gap-2">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-medium">{scenario.scenario_name}</span><span className="text-xs text-muted-foreground hidden sm:inline">{VR_STRATEGY_LABELS[scenario.strategy_type]}</span></span><span className="text-xs text-muted-foreground">{VR_STATUS_LABELS[scenario.status]}</span></button><Button type="button" variant="ghost" size="sm" disabled={duplicating} onClick={() => duplicateAndOpen(scenario.id)}><Copy className="h-4 w-4 mr-1" />{duplicating ? 'Kopiëren…' : 'Dupliceren'}</Button></div>{open && <div className="p-4"><ScenarioKengetallenPanel scenario={scenario} onUpdateScenario={updateScenario} /><ScenarioEditor scenario={scenario} taxSettings={taxSettings} objectType={calculation.object_type} objectArea={objectArea} objectWoz={objectWoz} objectEnergyLabel={objectEnergyLabel} objectBouwjaar={objectBouwjaar} objectRawType={objectRawType} objectVraagprijs={objectVraagprijs} viewMode={viewMode} onUpdate={updateScenario} onDelete={deleteScenario} /></div>}</div>;
    })}{scenarios.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nog geen scenario's.</p>}</div>
  </div>;
}

export default function VastgoedrekenenTab(props: Props) {
  const { objectId, initialCalculationId } = props;
  const { calculations, refetch } = useObjectCalculations(objectId);
  const { settings: taxSettings } = useTaxSettings();
  const { viewMode, setViewMode } = useVastgoedrekenenPrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(initialCalculationId ?? null);

  useEffect(() => {
    if (initialCalculationId && calculations.some((calculation) => calculation.id === initialCalculationId)) setActiveId(initialCalculationId);
    else setActiveId((current) => current && calculations.some((calculation) => calculation.id === current) ? current : calculations[0]?.id ?? null);
  }, [calculations, initialCalculationId]);

  const active = activeId ?? calculations[0]?.id ?? null;
  function selectAnalysis(id: string) {
    setActiveId(id);
    const params = new URLSearchParams(location.search);
    params.set('tab', 'vastgoedrekenen');
    params.set('calculation', id);
    navigate({ pathname: location.pathname, search: `?${params.toString()}`, hash: '#vastgoedrekenen' }, { replace: true });
  }

  return <div className="space-y-4"><Card><CardHeader className="pb-3"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><CardTitle className="text-base">Vastgoedrekenen</CardTitle><div className="flex flex-col sm:flex-row gap-2"><Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}><SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="begeleid">Begeleid</SelectItem><SelectItem value="compact">Compact</SelectItem><SelectItem value="expert">Expert</SelectItem></SelectContent></Select><CreateAnalysisDialog objectId={objectId} onCreated={async (analysis) => { await refetch(); selectAnalysis(analysis.id); }} /></div></div></CardHeader>{calculations.length > 0 && <CardContent className="pt-0 flex flex-wrap gap-2">{calculations.map((calculation) => { const metadata = resolveAnalysisProposition(calculation as unknown as Record<string, unknown>); return <button key={calculation.id} onClick={() => selectAnalysis(calculation.id)} className={`text-xs px-3 py-1.5 rounded-full border ${active === calculation.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{calculation.calculation_name} <span className="opacity-60">· {getPropositionLabel(metadata.propositionType)}</span></button>; })}</CardContent>}</Card>{active ? <QuickscanDetail key={active} calculationId={active} taxSettings={taxSettings} objectArea={props.objectArea} objectWoz={props.objectWoz} objectEnergyLabel={props.objectEnergyLabel} objectBouwjaar={props.objectBouwjaar} objectRawType={props.objectRawType} objectVraagprijs={props.objectVraagprijs} viewMode={viewMode} /> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nog geen analyse aangemaakt.</CardContent></Card>}</div>;
}
