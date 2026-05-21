import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useObjectCalculations, useQuickscanDetail, useTaxSettings } from '@/hooks/useVastgoedrekenen';
import { useVastgoedrekenenPrefs } from '@/hooks/useVastgoedrekenenPrefs';
import ScenarioEditor from './ScenarioEditor';
import ScenarioVergelijking from './ScenarioVergelijking';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';

type Props = {
  objectId: string;
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectRawType?: string | null;
};


function QuickscanDetail({ calculationId, taxSettings, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, viewMode }: {
  calculationId: string;
  taxSettings: ReturnType<typeof useTaxSettings>['settings'];
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  viewMode: 'begeleid' | 'compact' | 'expert';
}) {
  const { calculation, scenarios, updateCalculation, createScenario, updateScenario, deleteScenario } = useQuickscanDetail(calculationId);
  const [openScenarios, setOpenScenarios] = useState<Set<string>>(new Set());
  if (!calculation) return <p className="text-sm text-muted-foreground">Quickscan wordt geladen…</p>;

  function toggle(id: string) {
    const next = new Set(openScenarios);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpenScenarios(next);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Naam quickscan</Label>
              <Input value={calculation.calculation_name} onChange={(e) => updateCalculation({ calculation_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={calculation.status} onValueChange={(v) => updateCalculation({ status: v as typeof calculation.status })}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Hoofdstrategie</Label>
              <Select value={calculation.main_strategy} onValueChange={(v) => updateCalculation({ main_strategy: v as typeof calculation.main_strategy })}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VR_STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Objecttype</Label>
              <Select value={calculation.object_type} onValueChange={(v) => updateCalculation({ object_type: v as typeof calculation.object_type })}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enkelvoudig">Enkelvoudig</SelectItem>
                  <SelectItem value="mixed_use">Mixed-use</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createScenario({ scenario_name: `Scenario ${scenarios.length + 1}` })}>
              <Plus className="h-4 w-4 mr-1" /> Nieuw scenario
            </Button>
          </div>
        </CardHeader>
      </Card>

      <ScenarioVergelijking
        scenarios={scenarios}
        taxSettings={taxSettings}
        objectType={calculation.object_type}
        objectArea={objectArea}
        objectWoz={objectWoz}
        objectEnergyLabel={objectEnergyLabel}
        objectBouwjaar={objectBouwjaar}
      />

      <div className="space-y-3">
        {scenarios.map((s) => {
          const open = openScenarios.has(s.id);
          return (
            <div key={s.id} className="border rounded-md overflow-hidden">
              <button type="button" onClick={() => toggle(s.id)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium">{s.scenario_name}</span>
                  <span className="text-xs text-muted-foreground">{VR_STRATEGY_LABELS[s.strategy_type]}</span>
                </span>
                <span className="text-xs text-muted-foreground">{VR_STATUS_LABELS[s.status]}</span>
              </button>
              {open && (
                <div className="p-4">
                  <ScenarioEditor
                    scenario={s}
                    taxSettings={taxSettings}
                    objectType={calculation.object_type}
                    objectArea={objectArea}
                    objectWoz={objectWoz}
                    objectEnergyLabel={objectEnergyLabel}
                    objectBouwjaar={objectBouwjaar}
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

export default function VastgoedrekenenTab({ objectId, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar }: Props) {
  const { calculations, create, remove } = useObjectCalculations(objectId);
  const { settings: taxSettings } = useTaxSettings();
  const { viewMode, setViewMode } = useVastgoedrekenenPrefs();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ?? calculations[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Vastgoedrekenen</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'begeleid' | 'compact' | 'expert')}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="begeleid">Begeleid</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={async () => { const c = await create({ calculation_name: `Quickscan ${calculations.length + 1}` }); if (c) setActiveId(c.id); }}>
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
