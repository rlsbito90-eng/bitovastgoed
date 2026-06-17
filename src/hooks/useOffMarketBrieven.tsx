// React Query hooks voor de "Brief voorbereiden"-flow.
// Slaat conceptbrieven en verzonden brieven op in `off_market_brieven`.
//
// Gearchiveerde brieven (`archived_at IS NOT NULL`) worden standaard
// uitgefilterd. Verstuurde brieven worden nooit gearchiveerd.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OffMarketBrief {
  id: string;
  signaal_id: string;
  eigenaar_naam: string | null;
  eigenaar_bedrijfsnaam: string | null;
  verzendadres: string | null;
  objectadres: string | null;
  objectomschrijving: string | null;
  aanhef: string | null;
  onderwerp: string | null;
  brieftekst: string;
  status: 'concept' | 'verstuurd';
  verzonden_op: string | null;
  aangemaakt_door: string | null;
  created_at: string;
  updated_at: string;
  /** Soft-archive timestamp; null betekent actief/zichtbaar. */
  archived_at: string | null;
  archived_reason: string | null;
}

export interface BriefInsert {
  signaal_id: string;
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  objectadres?: string | null;
  objectomschrijving?: string | null;
  aanhef?: string | null;
  onderwerp?: string | null;
  brieftekst: string;
  status?: 'concept' | 'verstuurd';
}

const TABLE = 'off_market_brieven';

export function useOffMarketBrievenForSignaal(
  signaalId: string | null | undefined,
  opts: { includeArchived?: boolean } = {},
) {
  const includeArchived = !!opts.includeArchived;
  return useQuery({
    queryKey: ['off_market_brieven', signaalId, includeArchived ? 'all' : 'active'],
    enabled: !!signaalId,
    queryFn: async (): Promise<OffMarketBrief[]> => {
      let q: any = (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('signaal_id', signaalId);
      if (!includeArchived) q = q.is('archived_at', null);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as OffMarketBrief[];
    },
  });
}

export function useUpsertBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: BriefInsert & { id?: string },
    ): Promise<OffMarketBrief> => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        signaal_id: input.signaal_id,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres ?? null,
        objectadres: input.objectadres ?? null,
        objectomschrijving: input.objectomschrijving ?? null,
        aanhef: input.aanhef ?? null,
        onderwerp: input.onderwerp ?? null,
        brieftekst: input.brieftekst,
        status: input.status ?? 'concept',
        aangemaakt_door: u.user?.id ?? null,
      };
      if (input.id) {
        const { data, error } = await (supabase as any)
          .from(TABLE).update(payload).eq('id', input.id).select().single();
        if (error) throw new Error(error.message);
        return data as OffMarketBrief;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE).insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}

/**
 * Markeer brief als verstuurd. Postdatum is leidend voor `verzonden_op`
 * en bepaalt later ook de follow-up (postdatum + 21 dagen).
 *
 * - postdatum is YYYY-MM-DD (lokale datum); we bewaren als 12:00 UTC van
 *   die dag zodat tijdzone-shifts geen dag opschuiven.
 * - default is vandaag.
 */
export function useMarkBriefVerstuurd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: string | { id: string; postdatum?: string },
    ): Promise<OffMarketBrief> => {
      const id = typeof input === 'string' ? input : input.id;
      const postdatum = typeof input === 'string' ? undefined : input.postdatum;
      const iso = postdatum
        ? new Date(`${postdatum}T12:00:00.000Z`).toISOString()
        : new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ status: 'verstuurd', verzonden_op: iso })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}

/**
 * Archiveer een conceptbrief (soft-delete). Verstuurde brieven worden
 * geweigerd om historische data te beschermen.
 */
export function useArchiveerBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string; reden?: string },
    ): Promise<OffMarketBrief> => {
      // Defensief: haal eerst de brief op om status te valideren.
      const { data: bestaand, error: leesFout } = await (supabase as any)
        .from(TABLE).select('id,status,signaal_id').eq('id', input.id).single();
      if (leesFout) throw new Error(leesFout.message);
      if (bestaand?.status === 'verstuurd') {
        throw new Error('Verstuurde brieven kunnen niet worden gearchiveerd.');
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({
          archived_at: new Date().toISOString(),
          archived_reason: input.reden ?? 'testconcept opgeschoond',
        })
        .eq('id', input.id)
        .neq('status', 'verstuurd')
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}
