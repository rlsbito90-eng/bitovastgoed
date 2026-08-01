import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator } from 'lucide-react';
import KengetallenRegisterPanel from '@/components/vastgoedrekenen/KengetallenRegisterPanel';
import RegisterPackageLockSummary from '@/components/vastgoedrekenen/RegisterPackageLockSummary';
import SourceImportPanel from '@/components/vastgoedrekenen/SourceImportPanel';
import SourcePackagesPanel from '@/components/vastgoedrekenen/SourcePackagesPanel';
import StandardRegisterCoverageCard from '@/components/vastgoedrekenen/StandardRegisterCoverageCard';
import GebiedsvoorkeurenPanel from '@/components/admin/GebiedsvoorkeurenPanel';
import StartSectie from '@/components/vastgoedrekenen/workspace/StartSectie';
import ProjectenCasesSectie from '@/components/vastgoedrekenen/workspace/ProjectenCasesSectie';
import type { OverviewCalculation } from '@/components/vastgoedrekenen/workspace/types';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { useDataStore } from '@/hooks/useDataStore';
import type { Calculation } from '@/lib/vastgoedrekenen/types';
import { buildQuickscanObjectHref } from '@/lib/vastgoedrekenen/quickscanNavigation';
import { sortQuickscansByLatestActivity } from '@/lib/vastgoedrekenen/quickscanOverview';
import {
  VR_WORKSPACE_LABELS,
  VR_WORKSPACE_NAV_ITEMS,
  buildVrWorkspaceHref,
  resolveVrWorkspaceSection,
} from '@/lib/vastgoedrekenen/workspaceNavigation';

const SECTIE_SUBTITELS: Record<string, string> = {
  start: 'Compact dagelijks overzicht van je rekenwerk.',
  projecten: 'Alle berekeningen in één lijst met preview.',
  quickscans: 'Snelle berekeningen, gesorteerd op laatste activiteit.',
  scenarios: "Scenario's beheer je binnen een case.",
  resultaten: 'Resultaten bekijk je binnen een case.',
  bibliotheek: 'Kengetallen en gebiedsvoorkeuren.',
  bronbeheer: 'Bronpakketten en import.',
};

function DoorverwijzingCard({ tekst }: { tekst: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-10 text-center">
        <Calculator className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{tekst}</p>
        <Button asChild size="sm">
          <Link to={buildVrWorkspaceHref('projecten')}>Naar Projecten &amp; cases</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VastgoedrekenenPage() {
  const [items, setItems] = useState<OverviewCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const store = useDataStore();
  const location = useLocation();
  const sectie = useMemo(() => resolveVrWorkspaceSection(location.search), [location.search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: calculations } = await supabase
        .from('real_estate_calculations')
        .select('*')
        .limit(200);

      const calculationRows = (calculations ?? []) as Calculation[];
      const calculationIds = calculationRows.map((calculation) => calculation.id);
      const scenarioActivities = calculationIds.length === 0
        ? []
        : ((await supabase
            .from('calculation_scenarios')
            .select('calculation_id, created_at, updated_at')
            .in('calculation_id', calculationIds)).data ?? []);

      const ordered = sortQuickscansByLatestActivity(calculationRows, scenarioActivities);
      const list = ordered.map((calculation) => {
        const obj = store.getObjectById(calculation.object_id);
        return { ...calculation, object_naam: obj?.titel ?? '—' };
      });

      setItems(list);
      setLoading(false);
    })();
  }, [store]);

  return (
    <div className="page-shell space-y-4">
      <PageHeader
        title={`Vastgoedrekenen — ${VR_WORKSPACE_LABELS[sectie]}`}
        subtitle={SECTIE_SUBTITELS[sectie]}
      />

      {/* Sectienavigatie binnen de pagina (aanvullend op het submenu in de zijbalk) */}
      <div className="overflow-x-auto pb-1">
        <nav className="flex min-w-max gap-1" aria-label="Vastgoedrekenen secties">
          {VR_WORKSPACE_NAV_ITEMS.map((item) => (
            <Link
              key={item.section}
              to={item.href}
              data-testid={`vr-sectie-link-${item.section}`}
              aria-current={item.section === sectie ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                item.section === sectie
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {loading && sectie !== 'bibliotheek' && sectie !== 'bronbeheer' ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : (
        <>
          {sectie === 'start' && <StartSectie items={items} />}

          {sectie === 'projecten' && <ProjectenCasesSectie items={items} />}

          {sectie === 'quickscans' && (
            items.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <Calculator className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nog geen quickscans aangemaakt. Open een object en ga naar het tabblad "Vastgoedrekenen".</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((calculation) => (
                  <Link key={calculation.id} to={buildQuickscanObjectHref(calculation.object_id, calculation.id)} className="block">
                    <Card className="h-full transition-colors hover:border-primary/50">
                      <CardContent className="space-y-1.5 p-4">
                        <p className="text-sm font-medium">{calculation.object_naam}</p>
                        <p className="text-xs text-muted-foreground">{calculation.calculation_name}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{VR_STATUS_LABELS[calculation.status]}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{VR_STRATEGY_LABELS[calculation.main_strategy]}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Betrouwbaarheid: {calculation.input_reliability}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )
          )}

          {sectie === 'scenarios' && (
            <DoorverwijzingCard tekst="Scenario's horen bij een specifieke case en beheer je binnen het tabblad Vastgoedrekenen van het object. Kies eerst een case." />
          )}

          {sectie === 'resultaten' && (
            <DoorverwijzingCard tekst="Resultaten worden per case berekend en getoond binnen de case zelf. Open een case om de resultaten te bekijken." />
          )}

          {sectie === 'bibliotheek' && (
            <Tabs defaultValue="kengetallen" className="space-y-4">
              <TabsList>
                <TabsTrigger value="kengetallen">Kengetallen</TabsTrigger>
                <TabsTrigger value="gebieden">Gebieden</TabsTrigger>
              </TabsList>
              <TabsContent value="kengetallen" className="mt-0 space-y-4">
                <StandardRegisterCoverageCard />
                <RegisterPackageLockSummary />
                <KengetallenRegisterPanel />
              </TabsContent>
              <TabsContent value="gebieden" className="mt-0">
                <Card>
                  <CardContent className="p-4">
                    <GebiedsvoorkeurenPanel />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {sectie === 'bronbeheer' && (
            <Tabs defaultValue="bronpakketten" className="space-y-4">
              <TabsList>
                <TabsTrigger value="bronpakketten">Bronpakketten</TabsTrigger>
                <TabsTrigger value="import">Import</TabsTrigger>
              </TabsList>
              <TabsContent value="bronpakketten" className="mt-0">
                <SourcePackagesPanel />
              </TabsContent>
              <TabsContent value="import" className="mt-0">
                <SourceImportPanel />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
