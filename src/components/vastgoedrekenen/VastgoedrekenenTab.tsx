import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useObjectCalculations, useQuickscanDetail, useTaxSettings } from '@/hooks/useVastgoedrekenen';
import { useVastgoedrekenenPrefs } from '@/hooks/useVastgoedrekenenPrefs';
import ScenarioEditor from './ScenarioEditor';
import ScenarioVergelijking from './ScenarioVergelijking';
import KengetallenRegisterPanel from './KengetallenRegisterPanel';
import ScenarioKengetallenPanel from './ScenarioKengetallenPanel';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { RawTextInput } from './RawInputs';

type Props = {
  objectId: string;
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectRawType?: string | null;
  objectVraagprijs?: number | null;
};

function MobileFieldGroup({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 w-full space-y-1.5 ${className ?? ''}`}>
      <Label className="block text-xs font-medium leading-snug whitespace-normal break-words">{label}</Label>
      <div className="min-w-0 w-full [&_input]:w-full [&_input]:min-w-0 [&_[role=combobox]]:w-full [&_[role=combobox]]:min-w-0">
        {children}
      </div>
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
    updateCalculation,
    createScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
  } = useQuickscanDetail(calculationId);
  const [openScenarios, setOpenScenarios] = useState<Set<string>>(new Set());
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  if (!calculation) return <p className="text-sm text-muted-foreground">Quickscan wordt geladen…</p>;

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
      if (duplicate) openAndScrollTo(duplicate.id);
    } finally {
      setDuplicatingId(null);
    }
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
            <MobileFieldGroup label="Hoofdstrategie">
              <Select value={calculation.main_strategy} onValueChange={(v) => updateCalculation({ main_strategy: v as typeof calculation.main_strategy })}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </MobileFieldGroup>
            <MobileFieldGroup label="Objecttype">
              <Select value={calculation.object_type} onValueChange={(v) => updateCalculation({ object_type: v as typeof calculation.object_type })}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enkelvoudig">Enkelvoudig</SelectItem>
                  <SelectItem value="mixed_use">Mixed-use</SelectItem>
                </SelectContent>
              </Select>
            </MobileFieldGroup>
            <Button className="w-full md:w-auto md:col-span-2 lg:col-span-4 lg:justify-self-end" onClick={() => createScenario({ scenario_name: `Scenario ${scenarios.length + 1}` })}>
              <Plus className="h-4 w-4 mr-1" /> Nieuw scenario
            </Button>
          </div>
        </CardHeader>
      </Card>

      <KengetallenRegisterPanel />

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
                    <span className="text-xs text-muted-foreground hidden sm:inline">{VR_STRATEGY_LABELS[s.strategy_type]}</span>
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
                  title="Kopieer het laatst opgeslagen scenario inclusief onderliggende invoer"
                >
                  <Copy className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{duplicating ? 'Kopiëren…' : 'Dupliceren'}</span>
                </Button>
              </div>
              {open && (
                <div className="p-4">
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

export default function VastgoedrekenenTab({ objectId, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, objectRawType, objectVraagprijs }: Props) {
  const { calculations, create } = useObjectCalculations(objectId);
  const { settings: taxSettings } = useTaxSettings();
  const { viewMode, setViewMode } = useVastgoedrekenenPrefs();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ?? calculations[0]?.id ?? null;

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
              <Button className="w-full sm:w-auto" onClick={async () => { const c = await create({ calculation_name: `Quickscan ${calculations.length + 1}` }); if (c) setActiveId(c.id); }}>
                <Plus className="h-4 w-4 mr-1" /> Nieuwe quickscan
              </Button>
            </div>
          </div>
        </CardHeader>

        {calculations.length > 0 && (
          <CardContent className="pt-0 flex flex-wrap gap-2">
            {calculations.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
                {c.calculation_name} <span className="opacity-60">· {VR_STATUS_LABELS[c.status]}</span>
              </button>
            ))}
          </CardContent>
        )}
      </Card>

      {active ? (
        <QuickscanDetail
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
          Nog geen quickscan aangemaakt. Klik op "Nieuwe quickscan" om te starten.
        </CardContent></Card>
      )}
    </div>
  );
}
