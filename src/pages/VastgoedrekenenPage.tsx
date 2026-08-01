import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator } from 'lucide-react';
import KengetallenRegisterPanel from '@/components/vastgoedrekenen/KengetallenRegisterPanel';
import RegisterPackageLockSummary from '@/components/vastgoedrekenen/RegisterPackageLockSummary';
import SourceImportPanel from '@/components/vastgoedrekenen/SourceImportPanel';
import SourcePackagesPanel from '@/components/vastgoedrekenen/SourcePackagesPanel';
import StandardRegisterCoverageCard from '@/components/vastgoedrekenen/StandardRegisterCoverageCard';
import GebiedsvoorkeurenPanel from '@/components/admin/GebiedsvoorkeurenPanel';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { useDataStore } from '@/hooks/useDataStore';
import type { Calculation } from '@/lib/vastgoedrekenen/types';
import { buildQuickscanObjectHref } from '@/lib/vastgoedrekenen/quickscanNavigation';
import { sortQuickscansByLatestActivity } from '@/lib/vastgoedrekenen/quickscanOverview';

type OverviewCalculation = Calculation & {
  object_naam?: string;
  latest_activity_at: number;
};

export default function VastgoedrekenenPage() {
  const [items, setItems] = useState<OverviewCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const store = useDataStore();

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
        title="Vastgoedrekenen"
        subtitle="Quickscans en beheer zijn gescheiden, zodat je alleen ziet wat je op dat moment nodig hebt."
      />

      <Tabs defaultValue="quickscans" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-grid min-w-max grid-cols-5">
            <TabsTrigger value="quickscans">Quickscans</TabsTrigger>
            <TabsTrigger value="kengetallen">Kengetallen</TabsTrigger>
            <TabsTrigger value="bronpakketten">Bronpakketten</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="gebieden">Gebieden</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="quickscans" className="mt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : items.length === 0 ? (
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
          )}
        </TabsContent>

        <TabsContent value="kengetallen" className="mt-0 space-y-4">
          <StandardRegisterCoverageCard />
          <RegisterPackageLockSummary />
          <KengetallenRegisterPanel />
        </TabsContent>

        <TabsContent value="bronpakketten" className="mt-0">
          <SourcePackagesPanel />
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <SourceImportPanel />
        </TabsContent>

        <TabsContent value="gebieden" className="mt-0">
          <Card>
            <CardContent className="p-4">
              <GebiedsvoorkeurenPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
