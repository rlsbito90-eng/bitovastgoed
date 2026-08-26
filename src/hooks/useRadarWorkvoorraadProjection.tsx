import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WerkvoorraadStatus } from '@/hooks/useAcquisitieSelectie';

const sb = supabase as any;

export interface RadarWerkvoorraadProjectie {
  signaalId: string;
  status: WerkvoorraadStatus;
  reden: string;
  volgendeActieOp?: string | null;
  partijMatchBeoordelen?: boolean;
}

async function projecteer(items: RadarWerkvoorraadProjectie[]) {
  const { data: auth } = await supabase.auth.getUser();
  const actor = auth.user?.id ?? null;
  const now = new Date().toISOString();
  const resultaten: RadarWerkvoorraadProjectie[] = [];

  for (const item of items) {
    const { error } = await sb
      .from('off_market_acquisitie_selectie')
      .update({
        werkvoorraad_status: item.status,
        werkvoorraad_reden: item.status === 'actief' ? null : item.reden,
        werkvoorraad_volgende_actie_op: item.status === 'eerder_benaderd'
          ? item.volgendeActieOp ?? null
          : null,
        werkvoorraad_bijgewerkt_op: now,
        werkvoorraad_bijgewerkt_door: actor,
      })
      .eq('signaal_id', item.signaalId)
      .is('archived_at', null);
    if (error) throw error;

    if (item.partijMatchBeoordelen) {
      const bestaand = await sb
        .from('off_market_partij_match_besluiten')
        .select('id')
        .eq('signaal_id', item.signaalId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bestaand.error) throw bestaand.error;
      if (!bestaand.data) {
        const besluit = await sb.from('off_market_partij_match_besluiten').insert({
          signaal_id: item.signaalId,
          status: 'pending',
          reden: item.reden,
          bron: 'radar_briefwizard',
        });
        if (besluit.error) throw besluit.error;
      }
    }

    resultaten.push(item);
  }
  return resultaten;
}

export function useRadarWorkvoorraadProjection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projecteer,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['off-market-acquisitie-selectie'] }),
        qc.invalidateQueries({ queryKey: ['radar-party-campaign-context'] }),
      ]);
    },
  });
}
