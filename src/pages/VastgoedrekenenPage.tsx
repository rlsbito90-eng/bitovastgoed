import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
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
        subtitle="Alle quickscans, scenarioanalyses, traceerbare kengetallen en strategische gebiedsvoorkeuren."
      />
      <SourcePackagesPanel />
      <SourceImportPanel />
      <StandardRegisterCoverageCard />
      <RegisterPackageLockSummary />
      <KengetallenRegisterPanel />
      <Card>
        <CardContent className="p-4">
          <GebiedsvoorkeurenPanel />
        </CardContent>
      </Card>
      {loading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Calculator className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nog geen quickscans aangemaakt. Open een object en ga naar het tabblad "Vastgoedrekenen".</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((calculation) => (
            <Link key={calculation.id} to={buildQuickscanObjectHref(calculation.object_id, calculation.id)} className="block">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-medium text-sm">{calculation.object_naam}</p>
                  <p className="text-xs text-muted-foreground">{calculation.calculation_name}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{VR_STATUS_LABELS[calculation.status]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{VR_STRATEGY_LABELS[calculation.main_strategy]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Betrouwbaarheid: {calculation.input_reliability}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
