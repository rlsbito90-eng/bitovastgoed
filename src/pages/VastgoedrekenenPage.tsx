import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { useDataStore } from '@/hooks/useDataStore';
import type { Calculation } from '@/lib/vastgoedrekenen/types';

export default function VastgoedrekenenPage() {
  const [items, setItems] = useState<(Calculation & { object_naam?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const store = useDataStore();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('real_estate_calculations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      const list = (data ?? []).map((c) => {
        const obj = store.getObjectById(c.object_id);
        return { ...c, object_naam: obj?.titel ?? '—' };
      });
      setItems(list);
      setLoading(false);
    })();
  }, [store]);

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Vastgoedrekenen"
        subtitle="Alle quickscans en scenarioanalyses per object."
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Calculator className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nog geen quickscans aangemaakt. Open een object en ga naar het tabblad "Vastgoedrekenen".</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <Link key={c.id} to={`/objecten/${c.object_id}#vastgoedrekenen`} className="block">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-medium text-sm">{c.calculation_name}</p>
                  <p className="text-xs text-muted-foreground">{c.object_naam}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{VR_STATUS_LABELS[c.status]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{VR_STRATEGY_LABELS[c.main_strategy]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Betrouwbaarheid: {c.input_reliability}</span>
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
