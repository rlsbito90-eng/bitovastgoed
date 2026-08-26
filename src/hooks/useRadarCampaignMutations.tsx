import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { RoutingResult } from '@/lib/offMarket/acquisitie/partyCampaign';

const sb = supabase as any;
const DOELSTELLING = 'radar_acquisitie';

export interface PersistRadarRoutingInput {
  eigenaarId: string;
  signaal: OffMarketSignaal;
  routing: RoutingResult;
  gekozenStap: 'brief_1' | 'brief_2' | 'brief_3' | null;
  reden?: string | null;
}

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Wordt alleen aangeroepen na een expliciete gebruikersactie in de briefwizard.
 * Geen nieuw signaal kan hierdoor op zichzelf een campagne starten.
 */
async function persistRouting(input: PersistRadarRoutingInput) {
  const actor = await userId();
  let { data: campagnes, error: leesFout } = await sb
    .from('off_market_benadercampagnes')
    .select('*')
    .eq('eigenaar_id', input.eigenaarId)
    .eq('doelstelling', DOELSTELLING)
    .in('status', ['actief', 'gepauzeerd', 'warm'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (leesFout) throw leesFout;

  let campagne = campagnes?.[0] ?? null;
  if (!campagne && input.routing.outcome === 'nieuwe_campagne_brief_1') {
    const { data, error } = await sb
      .from('off_market_benadercampagnes')
      .insert({
        eigenaar_id: input.eigenaarId,
        doelstelling: DOELSTELLING,
        status: 'actief',
        contact_status: 'cold',
        huidige_stap: input.gekozenStap ?? 'brief_1',
        routing_reden: input.reden || input.routing.reden,
      })
      .select('*')
      .single();
    if (error) {
      // Concurrent/idempotent pad: een andere actie kan de unieke actieve campagne
      // net hebben aangemaakt. Lees dan die rij terug, maak nooit een tweede.
      const retry = await sb
        .from('off_market_benadercampagnes')
        .select('*')
        .eq('eigenaar_id', input.eigenaarId)
        .eq('doelstelling', DOELSTELLING)
        .in('status', ['actief', 'gepauzeerd'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (retry.error || !retry.data) throw error;
      campagne = retry.data;
    } else {
      campagne = data;
    }
  }

  if (!campagne) {
    // Een geblokkeerd/afgerond dossier wordt niet stil heropend.
    return { campagneId: null, bundled: false };
  }

  const { data: bestaandObject, error: objectLeesFout } = await sb
    .from('off_market_campagne_objecten')
    .select('id,rol')
    .eq('campagne_id', campagne.id)
    .eq('signaal_id', input.signaal.id)
    .maybeSingle();
  if (objectLeesFout) throw objectLeesFout;

  if (!bestaandObject) {
    const { count: primaryCount, error: countError } = await sb
      .from('off_market_campagne_objecten')
      .select('id', { count: 'exact', head: true })
      .eq('campagne_id', campagne.id)
      .eq('rol', 'primary');
    if (countError) throw countError;
    const rol = (primaryCount ?? 0) === 0 ? 'primary' : 'context';
    const { error } = await sb.from('off_market_campagne_objecten').insert({
      campagne_id: campagne.id,
      signaal_id: input.signaal.id,
      rol,
      eerste_signaal_op: (input.signaal as any).created_at ?? new Date().toISOString(),
      sterkste_signaalsoort: String((input.signaal as any).vergunningtype ?? (input.signaal as any).type_signaal ?? '') || null,
      relevantiescore: input.routing.nieuwObjectScore.score,
      score_uitleg: {
        redenen: input.routing.nieuwObjectScore.redenen,
        betrouwbaarheid: input.routing.nieuwObjectScore.betrouwbaarheid,
      },
      signaal_ids: [input.signaal.id],
      reden_toevoeging: input.reden || input.routing.reden,
      noemen_in_volgend_contact: input.routing.outcome === 'meenemen_in_vervolgbrief',
    });
    if (error) throw error;
  }

  if (input.gekozenStap && campagne.status === 'actief') {
    const { error } = await sb
      .from('off_market_benadercampagnes')
      .update({ huidige_stap: input.gekozenStap, routing_reden: input.reden || input.routing.reden })
      .eq('id', campagne.id);
    if (error) throw error;
  }

  await sb.from('off_market_campagne_events').insert({
    campagne_id: campagne.id,
    eigenaar_id: input.eigenaarId,
    signaal_id: input.signaal.id,
    event_type: input.routing.outcome === 'nieuwe_campagne_brief_1' ? 'campaign_started' : 'signal_routed',
    reden: input.reden || input.routing.reden,
    metadata: {
      outcome: input.routing.outcome,
      brief_advies: input.routing.briefAdvies,
      gekozen_stap: input.gekozenStap,
      object_score: input.routing.nieuwObjectScore.score,
      hoofdobject_wissel_voorgesteld: input.routing.nieuwHoofdobjectVoorstellen,
    },
    aangemaakt_door: actor,
  });

  return { campagneId: campagne.id as string, bundled: true };
}

export function usePersistRadarCampaignRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: persistRouting,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['radar-party-campaign-context'] }),
        qc.invalidateQueries({ queryKey: ['off-market-acquisitie-selectie'] }),
      ]);
    },
  });
}
