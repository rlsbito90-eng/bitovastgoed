import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { RoutingResult } from '@/lib/offMarket/acquisitie/partyCampaign';
import {
  decodeSynthetischeRadarPartijId,
  parseRadarPartijSleutel,
} from '@/lib/offMarket/acquisitie/partyIdentity';

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

async function resolveRealEigenaarId(eigenaarId: string, signaalId: string): Promise<string> {
  const identityKey = decodeSynthetischeRadarPartijId(eigenaarId);
  let realId = eigenaarId;

  if (identityKey) {
    const bestaand = await sb
      .from('eigenaren')
      .select('id')
      .eq('dedupe_sleutel', identityKey)
      .is('archived_at', null)
      .maybeSingle();
    if (bestaand.error) throw bestaand.error;

    if (bestaand.data?.id) {
      realId = bestaand.data.id;
    } else {
      const parsed = parseRadarPartijSleutel(identityKey);
      const displayNaam = parsed.bedrijfsnaam || parsed.naam || 'Onbekende partij';
      const insert = await sb.from('eigenaren').insert({
        partij_type: parsed.partijType,
        naam: displayNaam,
        bedrijfsnaam: parsed.bedrijfsnaam,
        adres: parsed.adres,
        postcode: parsed.postcode,
        bron: 'radar_briefadres',
        bron_betrouwbaarheid: 90,
        dedupe_sleutel: identityKey,
        bron_details: { identity_basis: 'naam_of_bedrijfsnaam_plus_volledig_postadres' },
      }).select('id').single();
      if (insert.error) {
        const retry = await sb.from('eigenaren')
          .select('id')
          .eq('dedupe_sleutel', identityKey)
          .is('archived_at', null)
          .maybeSingle();
        if (retry.error || !retry.data?.id) throw insert.error;
        realId = retry.data.id;
      } else {
        realId = insert.data.id;
      }
    }
  }

  const bestaandLink = await sb.from('eigenaar_koppelingen')
    .select('id')
    .eq('eigenaar_id', realId)
    .eq('signaal_id', signaalId)
    .maybeSingle();
  if (bestaandLink.error) throw bestaandLink.error;
  if (!bestaandLink.data) {
    const link = await sb.from('eigenaar_koppelingen').insert({
      eigenaar_id: realId,
      signaal_id: signaalId,
      rol: 'rechthebbende',
      bron: identityKey ? 'radar_briefadres' : 'radar_campaign_confirm',
      betrouwbaarheid: identityKey ? 90 : 95,
    });
    if (link.error) {
      const retry = await sb.from('eigenaar_koppelingen')
        .select('id')
        .eq('eigenaar_id', realId)
        .eq('signaal_id', signaalId)
        .maybeSingle();
      if (retry.error || !retry.data) throw link.error;
    }
  }

  return realId;
}

function kiesBestaandeCampagne(rows: any[]): any | null {
  if (!rows.length) return null;
  const rang: Record<string, number> = { warm: 5, actief: 4, gepauzeerd: 3, afgerond_geen_reactie: 2, afgesloten: 1 };
  return [...rows].sort((a, b) => {
    const status = (rang[b.status] ?? 0) - (rang[a.status] ?? 0);
    if (status !== 0) return status;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  })[0];
}

/**
 * Wordt alleen aangeroepen na een expliciete gebruikersactie in de briefwizard.
 * Een nieuw signaal kan hierdoor nooit zelfstandig een campagne starten.
 */
async function persistRouting(input: PersistRadarRoutingInput) {
  const actor = await userId();
  const realEigenaarId = await resolveRealEigenaarId(input.eigenaarId, input.signaal.id);

  const { data: campagnes, error: leesFout } = await sb
    .from('off_market_benadercampagnes')
    .select('*')
    .eq('eigenaar_id', realEigenaarId)
    .eq('doelstelling', DOELSTELLING)
    .order('created_at', { ascending: false });
  if (leesFout) throw leesFout;

  let campagne = kiesBestaandeCampagne(campagnes ?? []);
  if (!campagne && input.routing.outcome === 'nieuwe_campagne_brief_1') {
    const { data, error } = await sb
      .from('off_market_benadercampagnes')
      .insert({
        eigenaar_id: realEigenaarId,
        doelstelling: DOELSTELLING,
        status: 'actief',
        contact_status: 'cold',
        huidige_stap: input.gekozenStap ?? 'brief_1',
        routing_reden: input.reden || input.routing.reden,
      })
      .select('*')
      .single();
    if (error) {
      const retry = await sb
        .from('off_market_benadercampagnes')
        .select('*')
        .eq('eigenaar_id', realEigenaarId)
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
    return { campagneId: null, bundled: false, eigenaarId: realEigenaarId };
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
  } else {
    const { error } = await sb.from('off_market_campagne_objecten')
      .update({
        relevantiescore: input.routing.nieuwObjectScore.score,
        score_uitleg: {
          redenen: input.routing.nieuwObjectScore.redenen,
          betrouwbaarheid: input.routing.nieuwObjectScore.betrouwbaarheid,
        },
        noemen_in_volgend_contact: input.routing.outcome === 'meenemen_in_vervolgbrief',
        reden_toevoeging: input.reden || input.routing.reden,
      })
      .eq('id', bestaandObject.id);
    if (error) throw error;
  }

  if (input.gekozenStap && campagne.status === 'actief') {
    const { error } = await sb
      .from('off_market_benadercampagnes')
      .update({ huidige_stap: input.gekozenStap, routing_reden: input.reden || input.routing.reden })
      .eq('id', campagne.id);
    if (error) throw error;
  }

  const event = await sb.from('off_market_campagne_events').insert({
    campagne_id: campagne.id,
    eigenaar_id: realEigenaarId,
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
  if (event.error) throw event.error;

  return { campagneId: campagne.id as string, bundled: true, eigenaarId: realEigenaarId };
}

async function switchPrimary(input: { campagneId: string; signaalId: string; reden: string }) {
  const { data, error } = await sb.rpc('off_market_set_primary_object', {
    p_campagne_id: input.campagneId,
    p_signaal_id: input.signaalId,
    p_reden: input.reden,
  });
  if (error) throw error;
  return data;
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

export function useSwitchRadarPrimaryObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: switchPrimary,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['radar-party-campaign-context'] });
    },
  });
}
