import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ObjectFeeForecast {
  percentage?: number;
  bedrag?: number;
  structuur?: string;
}

const toForecast = (row: any): ObjectFeeForecast => ({
  percentage: row?.verwachte_fee_pct != null ? Number(row.verwachte_fee_pct) : undefined,
  bedrag: row?.verwachte_fee_bedrag != null ? Number(row.verwachte_fee_bedrag) : undefined,
  structuur: row?.verwachte_fee_structuur ?? undefined,
});

export function useObjectFeeForecast(objectId: string | undefined) {
  const [forecast, setForecast] = useState<ObjectFeeForecast>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!objectId) {
      setForecast({});
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('objecten')
        .select('verwachte_fee_pct, verwachte_fee_bedrag, verwachte_fee_structuur')
        .eq('id', objectId)
        .single();
      if (error) throw error;
      setForecast(toForecast(data));
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (next: ObjectFeeForecast) => {
    if (!objectId) throw new Error('Object ontbreekt');
    setSaving(true);
    try {
      const payload = {
        verwachte_fee_pct: next.percentage ?? null,
        verwachte_fee_bedrag: next.bedrag ?? null,
        verwachte_fee_structuur: next.structuur?.trim() || null,
      };
      const { data, error } = await (supabase as any)
        .from('objecten')
        .update(payload)
        .eq('id', objectId)
        .select('verwachte_fee_pct, verwachte_fee_bedrag, verwachte_fee_structuur')
        .single();
      if (error) throw error;
      const saved = toForecast(data);
      setForecast(saved);
      return saved;
    } finally {
      setSaving(false);
    }
  }, [objectId]);

  return { forecast, setForecast, loading, saving, save, reload };
}
