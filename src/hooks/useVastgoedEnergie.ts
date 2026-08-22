import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VastgoedEnergieSnapshot {
  id: string;
  bag_vbo_id: string;
  bag_nummeraanduiding_id: string | null;
  bag_pand_id: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  energielabel: string | null;
  gebouwklasse: string | null;
  gebruiksfunctie: string | null;
  energie_index: number | null;
  primair_fossiel_energiegebruik: number | null;
  registratiedatum: string | null;
  geldig_tot: string | null;
  status: string | null;
  match_kwaliteit: 'exact' | 'adres' | 'fallback' | 'onbekend';
  bron: string;
  bron_referentie: string | null;
  opgehaald_op: string;
}

export interface EnergieVerrijkArgs {
  bag_vbo_id: string;
  bag_nummeraanduiding_id?: string | null;
  bag_pand_id?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  force?: boolean;
}

const db = supabase as any;

export function useVastgoedEnergieSnapshot(bagVboId: string | null | undefined) {
  return useQuery({
    queryKey: ['vastgoed-energy-snapshot', bagVboId],
    enabled: !!bagVboId,
    queryFn: async () => {
      const { data, error } = await db
        .from('vastgoed_energielabel_snapshots')
        .select('id,bag_vbo_id,bag_nummeraanduiding_id,bag_pand_id,adres,postcode,plaats,energielabel,gebouwklasse,gebruiksfunctie,energie_index,primair_fossiel_energiegebruik,registratiedatum,geldig_tot,status,match_kwaliteit,bron,bron_referentie,opgehaald_op')
        .eq('bag_vbo_id', bagVboId)
        .order('opgehaald_op', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VastgoedEnergieSnapshot | null;
    },
    staleTime: 60_000,
  });
}

export function useVastgoedEnergieVerrijken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: EnergieVerrijkArgs) => {
      const { data, error } = await supabase.functions.invoke('vastgoed-energy-verrijk', {
        body: {
          ...args,
          force: args.force === true,
        },
      });
      if (error) throw new Error(error.message ?? 'Energielabel ophalen mislukt');
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; cached?: boolean; found?: boolean; snapshot?: VastgoedEnergieSnapshot };
    },
    onSuccess: (data, args) => {
      if (data?.snapshot) {
        qc.setQueryData(['vastgoed-energy-snapshot', args.bag_vbo_id], data.snapshot);
      } else {
        qc.invalidateQueries({ queryKey: ['vastgoed-energy-snapshot', args.bag_vbo_id] });
      }
    },
  });
}
