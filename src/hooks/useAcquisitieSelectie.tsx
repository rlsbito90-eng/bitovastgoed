// V1A — Persistente, centrale teamselectie voor de Off-Market Acquisitiemodule.
// Eén tabel: off_market_acquisitie_selectie. Soft-remove via archived_at.
// Hergebruikt patroon: heractiveer bestaand record bij dubbele toevoeging.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AcquisitieSelectieItem {
  id: string;
  signaal_id: string;
  toegevoegd_door: string | null;
  toegevoegd_op: string;
  notitie: string | null;
  archived_at: string | null;
}

const TABLE = 'off_market_acquisitie_selectie';
const LIST_KEY = ['off-market-acquisitie-selectie'] as const;

function invalidateAll(qc: ReturnType<typeof useQueryClient>, signaalId?: string) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
  qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
  qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
  if (signaalId) qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
}

/** Alle actieve (niet-gearchiveerde) selectie-items. */
export function useAcquisitieSelectie() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<AcquisitieSelectieItem[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .is('archived_at', null)
        .order('toegevoegd_op', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieSelectieItem[];
    },
  });
}

/** Set van signaal-ids in de actieve selectie. */
export function useActieveSelectieIds(): Set<string> {
  const { data = [] } = useAcquisitieSelectie();
  return useMemo(() => new Set(data.map(r => r.signaal_id)), [data]);
}

/** Actieve count — handig voor tab-label en badges. */
export function useAcquisitieSelectieCount(): number {
  const { data = [] } = useAcquisitieSelectie();
  return data.length;
}

/** Controleer of een specifiek signaal in de selectie zit. */
export function useIsInAcquisitieSelectie(signaalId: string | null | undefined): boolean {
  const ids = useActieveSelectieIds();
  if (!signaalId) return false;
  return ids.has(signaalId);
}

/**
 * Toevoegen aan selectie. Idempotent:
 * - bestaat al actief → no-op (geen tweede insert).
 * - bestaat alleen gearchiveerd → heractiveren (UPDATE: archived_at=null,
 *   toegevoegd_door/op vernieuwd). Zo blijft de partial unique index intact.
 */
export function useVoegToeAanAcquisitieSelectie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (signaalId: string): Promise<AcquisitieSelectieItem> => {
      const { data: u } = await supabase.auth.getUser();
      const door = u.user?.id ?? null;

      // Stap 1: bestaat al een rij voor dit signaal?
      const { data: bestaand, error: leesFout } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('signaal_id', signaalId)
        .order('toegevoegd_op', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leesFout) throw new Error(leesFout.message);

      if (bestaand && bestaand.archived_at === null) {
        return bestaand as AcquisitieSelectieItem;
      }

      if (bestaand && bestaand.archived_at !== null) {
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .update({
            archived_at: null,
            toegevoegd_door: door,
            toegevoegd_op: new Date().toISOString(),
          })
          .eq('id', bestaand.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as AcquisitieSelectieItem;
      }

      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ signaal_id: signaalId, toegevoegd_door: door })
        .select()
        .single();
      if (error) {
        // Race-conditie: tussen check en insert is concurrent een rij
        // verschenen. Lees opnieuw en retourneer de actieve rij.
        const { data: nu } = await (supabase as any)
          .from(TABLE)
          .select('*')
          .eq('signaal_id', signaalId)
          .is('archived_at', null)
          .maybeSingle();
        if (nu) return nu as AcquisitieSelectieItem;
        throw new Error(error.message);
      }
      return data as AcquisitieSelectieItem;
    },
    onSuccess: (item) => invalidateAll(qc, item.signaal_id),
  });
}

/** Soft-remove: zet archived_at op alle actieve rijen van het signaal. */
export function useVerwijderUitAcquisitieSelectie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (signaalId: string): Promise<{ signaal_id: string }> => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ archived_at: new Date().toISOString() })
        .eq('signaal_id', signaalId)
        .is('archived_at', null);
      if (error) throw new Error(error.message);
      return { signaal_id: signaalId };
    },
    onSuccess: (res) => invalidateAll(qc, res.signaal_id),
  });
}
