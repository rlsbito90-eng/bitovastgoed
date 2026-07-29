import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapDbError } from '@/lib/errors';
import { toast } from 'sonner';
import type { ControlledTaxonomyOption } from '@/lib/vastgoedrekenen/controlledTaxonomy';

function taxonomyTable() {
  return (supabase as unknown as { from: (table: string) => any }).from('vastgoedrekenen_taxonomie_opties');
}

function normalize(row: unknown): ControlledTaxonomyOption {
  const item = row as ControlledTaxonomyOption;
  return {
    ...item,
    sort_order: Number(item.sort_order ?? 0),
    version: Number(item.version ?? 1),
    active: item.active !== false,
    system_managed: item.system_managed !== false,
  };
}

export function useControlledTaxonomy() {
  const [options, setOptions] = useState<ControlledTaxonomyOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await taxonomyTable()
      .select('*')
      .order('dimension_code')
      .order('sort_order')
      .order('label');
    if (error) {
      toast.error(mapDbError(error, 'Dropdownopties konden niet worden geladen. Is de Fase 6A-migratie toegepast?'));
      setOptions([]);
    } else {
      setOptions((data ?? []).map(normalize));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return { options, loading, refetch };
}
