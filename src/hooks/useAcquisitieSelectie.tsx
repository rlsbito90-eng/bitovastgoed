// V1A — Persistente, centrale teamselectie voor de Off-Market Acquisitiemodule.
// Eén tabel: off_market_acquisitie_selectie. Soft-remove via archived_at.
// Hergebruikt patroon: heractiveer bestaand record bij dubbele toevoeging.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AcquisitieSelectieItem {
  id: string;
  signaal_id: string | null;
  vastgoedkans_id: string | null;
  toegevoegd_door: string | null;
  toegevoegd_op: string;
  notitie: string | null;
  archived_at: string | null;
}

const TABLE = 'off_market_acquisitie_selectie';
const LIST_KEY = ['off-market-acquisitie-selectie'] as const;
const VERZONDEN_BRIEVEN_KEY = ['off-market-acquisitie-selectie', 'verzonden-brieven'] as const;

function invalidateAll(qc: ReturnType<typeof useQueryClient>, signaalId?: string) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
  qc.invalidateQueries({ queryKey: VERZONDEN_BRIEVEN_KEY });
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
  return useMemo(() => new Set(data.map(r => r.signaal_id).filter((id): id is string => typeof id === 'string' && id.length > 0)), [data]);
}

function useSignaalIdsMetVerzondenBrief(): Set<string> {
  const { data = [] } = useQuery({
    queryKey: VERZONDEN_BRIEVEN_KEY,
    queryFn: async (): Promise<Array<{ signaal_id: string }>> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .select('signaal_id')
        .is('archived_at', null)
        .eq('status', 'verstuurd');
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ signaal_id: string }>;
    },
  });
  return useMemo(() => new Set(data.map((row) => row.signaal_id)), [data]);
}

/**
 * Werkvoorraadtelling voor het tablabel.
 * Een selectie blijft meetellen tot minimaal één actieve brief expliciet als
 * `verstuurd` is geregistreerd. Een concept, gegenereerde of geprinte brief
 * blijft dus in de werkvoorraad staan.
 */
export function useAcquisitieSelectieCount(): number {
  const { data = [] } = useAcquisitieSelectie();
  const verzonden = useSignaalIdsMetVerzondenBrief();
  return useMemo(
    () => data.filter((item) => item.signaal_id === null || !verzonden.has(item.signaal_id)).length,
    [data, verzonden],
  );
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

/** Set van Vastgoedkans-ids in de actieve gedeelde acquisitieselectie. */
export function useActieveVastgoedkansSelectieIds(): Set<string> {
  const { data = [] } = useAcquisitieSelectie();
  return useMemo(
    () => new Set(data.map(r => r.vastgoedkans_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
    [data],
  );
}

/** Vastgoedkans toevoegen/heractiveren zonder een Off-Market-signaal te fabriceren. */
export function useVoegVastgoedkansToeAanAcquisitieSelectie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vastgoedkansId: string): Promise<AcquisitieSelectieItem> => {
      const { data: u } = await supabase.auth.getUser();
      const door = u.user?.id ?? null;
      const { data: bestaand, error: leesFout } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('vastgoedkans_id', vastgoedkansId)
        .order('toegevoegd_op', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leesFout) throw new Error(leesFout.message);
      if (bestaand && bestaand.archived_at === null) return bestaand as AcquisitieSelectieItem;
      if (bestaand) {
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .update({ archived_at: null, toegevoegd_door: door, toegevoegd_op: new Date().toISOString() })
          .eq('id', bestaand.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as AcquisitieSelectieItem;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ vastgoedkans_id: vastgoedkansId, signaal_id: null, toegevoegd_door: door })
        .select()
        .single();
      if (error) {
        const { data: nu } = await (supabase as any)
          .from(TABLE)
          .select('*')
          .eq('vastgoedkans_id', vastgoedkansId)
          .is('archived_at', null)
          .maybeSingle();
        if (nu) return nu as AcquisitieSelectieItem;
        throw new Error(error.message);
      }
      return data as AcquisitieSelectieItem;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Soft-remove van een Vastgoedkans uit dezelfde gedeelde selectie. */
export function useVerwijderVastgoedkansUitAcquisitieSelectie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vastgoedkansId: string): Promise<{ vastgoedkans_id: string }> => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ archived_at: new Date().toISOString() })
        .eq('vastgoedkans_id', vastgoedkansId)
        .is('archived_at', null);
      if (error) throw new Error(error.message);
      return { vastgoedkans_id: vastgoedkansId };
    },
    onSuccess: () => invalidateAll(qc),
  });
}
