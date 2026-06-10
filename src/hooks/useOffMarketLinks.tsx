// Off-Market koppelingen: queries en mutaties die signaal-context overstijgen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const LIST_KEY = ['off-market-signalen'] as const;
const KPI_KEY = ['off-market-kpi'] as const;

function invalidate(qc: ReturnType<typeof useQueryClient>, signaalId?: string) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
  qc.invalidateQueries({ queryKey: KPI_KEY });
  if (signaalId) qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
}

/** Signalen waar deze relatie eigenaar van is (actief én archief). */
export function useSignalenVoorRelatie(relatieId: string | undefined) {
  return useQuery({
    queryKey: ['off-market-signalen-voor-relatie', relatieId],
    enabled: !!relatieId,
    queryFn: async (): Promise<OffMarketSignaal[]> => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .select('*')
        .eq('eigenaar_relatie_id', relatieId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as OffMarketSignaal[];
    },
  });
}

/** Signaal dat als oorsprong dient voor een object (gepromoot). */
export function useSignaalVoorObject(objectId: string | undefined) {
  return useQuery({
    queryKey: ['off-market-signaal-voor-object', objectId],
    enabled: !!objectId,
    queryFn: async (): Promise<OffMarketSignaal | null> => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .select('*')
        .eq('gekoppeld_object_id', objectId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as OffMarketSignaal | null) ?? null;
    },
  });
}

/** Koppel of ontkoppel een eigenaar/relatie aan een signaal. */
export function useLinkRelatieToSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ signaalId, relatieId }: { signaalId: string; relatieId: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('off_market_signalen')
        .update({ eigenaar_relatie_id: relatieId, updated_by: u.user?.id ?? null })
        .eq('id', signaalId)
        .select('*').single();
      if (error) throw error;
      return data as OffMarketSignaal;
    },
    onSuccess: (row) => invalidate(qc, row.id),
  });
}

export interface PromoteSignaalResult {
  objectId: string;
  kadasterMigrated: number;
  kadasterMigrationError: string | null;
  kadasterDocumentenMigrated: number;
  kadasterDocumentenMigrationError: string | null;
}

/**
 * Promoot een signaal naar een object via de bestaande RPC.
 * Idempotent: als signaal al gekoppeld is, geeft de RPC hetzelfde object_id terug.
 *
 * Optioneel: bestaande Kadasterrecords + Kadasterdocumenten (PDF) van het
 * signaal meenemen naar het nieuwe object. Beiden behouden `signaal_id`
 * (audit) en krijgen daarnaast `object_id`. Er wordt nooit een nieuwe
 * Kadaster-call gedaan en er worden geen PDF's gedupliceerd of opnieuw
 * geüpload.
 */
export function usePromoteSignaalToObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { signaalId: string; migrateKadaster?: boolean }): Promise<PromoteSignaalResult> => {
      const { signaalId, migrateKadaster = false } = vars;
      const { data, error } = await supabase
        .rpc('off_market_promote_to_object', { _signaal_id: signaalId });
      if (error) throw error;
      if (!data) throw new Error('Promote leverde geen object_id op');
      const objectId = data as string;

      let kadasterMigrated = 0;
      let kadasterMigrationError: string | null = null;
      let kadasterDocumentenMigrated = 0;
      let kadasterDocumentenMigrationError: string | null = null;

      if (migrateKadaster) {
        try {
          const { data: updated, error: upErr } = await (supabase as unknown as {
            from: (t: string) => {
              update: (v: Record<string, unknown>) => {
                eq: (k: string, v: string) => {
                  is: (k: string, v: null) => {
                    select: (c: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
                  };
                };
              };
            };
          })
            .from('kadaster_data_records')
            .update({ object_id: objectId })
            .eq('signaal_id', signaalId)
            .is('object_id', null)
            .select('id');
          if (upErr) throw new Error(upErr.message);
          kadasterMigrated = (updated ?? []).length;
        } catch (e) {
          kadasterMigrationError = e instanceof Error ? e.message : 'Onbekende fout';
        }

        try {
          const { data: updatedDocs, error: docErr } = await (supabase as unknown as {
            from: (t: string) => {
              update: (v: Record<string, unknown>) => {
                eq: (k: string, v: string) => {
                  is: (k: string, v: null) => {
                    select: (c: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
                  };
                };
              };
            };
          })
            .from('kadaster_documenten')
            .update({ object_id: objectId })
            .eq('signaal_id', signaalId)
            .is('object_id', null)
            .select('id');
          if (docErr) throw new Error(docErr.message);
          kadasterDocumentenMigrated = (updatedDocs ?? []).length;
        } catch (e) {
          kadasterDocumentenMigrationError = e instanceof Error ? e.message : 'Onbekende fout';
        }
      }

      return {
        objectId,
        kadasterMigrated,
        kadasterMigrationError,
        kadasterDocumentenMigrated,
        kadasterDocumentenMigrationError,
      };
    },
    onSuccess: (res, vars) => {
      invalidate(qc, vars.signaalId);
      qc.invalidateQueries({ queryKey: ['kadaster_data_records', 'signaal', vars.signaalId] });
      qc.invalidateQueries({ queryKey: ['kadaster_data_records', 'object', res.objectId] });
      qc.invalidateQueries({ queryKey: ['kadaster_documenten', 'signaal_id', vars.signaalId] });
      qc.invalidateQueries({ queryKey: ['kadaster_documenten', 'object_id', res.objectId] });
    },
  });
}
