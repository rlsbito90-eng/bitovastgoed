import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export type VastgoedkansTaakPrioriteit = 'laag' | 'normaal' | 'hoog' | 'urgent';
export type VastgoedkansTaakStatus = 'open' | 'in_uitvoering' | 'wacht_op_reactie';

export interface VastgoedkansLijstTaak {
  id: string;
  vastgoedkans_id: string;
  titel: string;
  deadline: string | null;
  prioriteit: VastgoedkansTaakPrioriteit;
  status: VastgoedkansTaakStatus;
  created_at: string;
}

const PRIORITEIT_RANG: Record<VastgoedkansTaakPrioriteit, number> = {
  laag: 0,
  normaal: 1,
  hoog: 2,
  urgent: 3,
};

export function vergelijkVastgoedkansTaken(a: VastgoedkansLijstTaak, b: VastgoedkansLijstTaak): number {
  if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
  if (a.deadline && !b.deadline) return -1;
  if (!a.deadline && b.deadline) return 1;
  const prioriteit = PRIORITEIT_RANG[b.prioriteit] - PRIORITEIT_RANG[a.prioriteit];
  if (prioriteit !== 0) return prioriteit;
  return a.created_at.localeCompare(b.created_at);
}

export function kiesLeidendeVastgoedkansTaak(taken: VastgoedkansLijstTaak[]): VastgoedkansLijstTaak | null {
  if (taken.length === 0) return null;
  return [...taken].sort(vergelijkVastgoedkansTaken)[0] ?? null;
}

async function haalOpenVastgoedkansTaken(): Promise<VastgoedkansLijstTaak[]> {
  const { data, error } = await sb
    .from('taken')
    .select('id,vastgoedkans_id,titel,deadline,prioriteit,status,created_at')
    .not('vastgoedkans_id', 'is', null)
    .is('soft_deleted_at', null)
    .in('status', ['open', 'in_uitvoering', 'wacht_op_reactie']);
  if (error) throw error;
  return (data ?? []) as VastgoedkansLijstTaak[];
}

export function useVastgoedkansLijstTaken() {
  const query = useQuery({
    queryKey: ['vastgoedkansen', 'open-taken'],
    queryFn: haalOpenVastgoedkansTaken,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const taakPerKansId = useMemo(() => {
    const groepen = new Map<string, VastgoedkansLijstTaak[]>();
    for (const taak of query.data ?? []) {
      const bestaand = groepen.get(taak.vastgoedkans_id) ?? [];
      bestaand.push(taak);
      groepen.set(taak.vastgoedkans_id, bestaand);
    }
    const resultaat = new Map<string, VastgoedkansLijstTaak>();
    for (const [vastgoedkansId, taken] of groepen) {
      const leidend = kiesLeidendeVastgoedkansTaak(taken);
      if (leidend) resultaat.set(vastgoedkansId, leidend);
    }
    return resultaat;
  }, [query.data]);

  return {
    taakPerKansId,
    isLoading: query.isLoading,
    error: query.error,
  };
}
