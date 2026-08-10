import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

async function verwijderBriefUitWorkflow(brief: OffMarketBrief): Promise<OffMarketBrief> {
  const reden = brief.status === 'verstuurd'
    ? 'Handmatige correctie: verzonden brief verwijderd uit actieve workflow'
    : 'Handmatig verwijderd uit actieve briefworkflow';

  const { data, error } = await (supabase as any)
    .from('off_market_brieven')
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: reden,
    })
    .eq('id', brief.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logBriefEvent({
    signaal_id: brief.signaal_id,
    brief_id: brief.id,
    geadresseerde_key: brief.geadresseerde_key ?? null,
    campagne_stap: brief.campagne_stap ?? null,
    kanaal: brief.kanaal ?? null,
    event_type: 'archived',
    status: brief.status === 'verstuurd' ? 'correctie_verzonden_brief' : 'handmatig_verwijderd',
    metadata: {
      reden,
      correctie: true,
      oorspronkelijke_status: brief.status,
      gekoppelde_taak_id: brief.gekoppelde_taak_id ?? null,
    },
  });

  const resultaat = data as OffMarketBrief;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['off_market_brieven', resultaat.signaal_id] }),
    queryClient.invalidateQueries({ queryKey: ['off_market_brief_events', resultaat.signaal_id] }),
  ]);
  return resultaat;
}

async function verwijderBriefRespons(brief: OffMarketBrief): Promise<OffMarketBrief> {
  const { data: huidig, error: leesFout } = await (supabase as any)
    .from('off_market_brieven')
    .select('*')
    .eq('id', brief.id)
    .single();
  if (leesFout) throw new Error(leesFout.message);

  const responsdatum = huidig?.responsdatum ?? brief.responsdatum ?? null;
  const vorigeRespons = huidig?.responsstatus ?? brief.responsstatus ?? null;
  const kanaal = huidig?.kanaal ?? brief.kanaal ?? 'post';
  const huidigeVerzendstatus = huidig?.verzendstatus ?? brief.verzendstatus ?? null;

  const patch: Record<string, unknown> = {
    responsstatus: null,
    responsdatum: null,
    respons_kanaal: null,
    respons_samenvatting: null,
  };

  if (huidigeVerzendstatus === 'retour') {
    patch.verzendstatus = kanaal === 'email' ? 'verzonden' : 'gepost';
  }

  const { data, error } = await (supabase as any)
    .from('off_market_brieven')
    .update(patch)
    .eq('id', brief.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (responsdatum) {
    try {
      await (supabase as any)
        .from('contact_moments')
        .delete()
        .eq('system_key', `off_market_respons:${brief.id}:${responsdatum}`);
    } catch (e) {
      console.warn('Automatisch respons-contactmoment verwijderen mislukt', e);
    }
  }

  await logBriefEvent({
    signaal_id: brief.signaal_id,
    brief_id: brief.id,
    geadresseerde_key: brief.geadresseerde_key ?? null,
    campagne_stap: brief.campagne_stap ?? null,
    kanaal: brief.kanaal ?? null,
    event_type: 'response_received',
    status: 'respons_verwijderd',
    metadata: {
      correctie: true,
      vorige_responsstatus: vorigeRespons,
      vorige_responsdatum: responsdatum,
    },
  });

  const resultaat = data as OffMarketBrief;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['off_market_brieven', resultaat.signaal_id] }),
    queryClient.invalidateQueries({ queryKey: ['off_market_brief_events', resultaat.signaal_id] }),
    queryClient.invalidateQueries({ queryKey: ['contact_moments'] }),
  ]);
  return resultaat;
}

/**
 * Bewust dezelfde kleine interface als een React Query mutation. De kaart kan
 * daardoor ook in losse componenttests renderen zonder QueryClientProvider.
 */
export function useVerwijderBriefUitWorkflow() {
  return { mutateAsync: verwijderBriefUitWorkflow };
}

export function useVerwijderBriefRespons() {
  return { mutateAsync: verwijderBriefRespons };
}
