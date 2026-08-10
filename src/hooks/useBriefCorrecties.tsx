import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

/**
 * Haal een brief uit de actieve briefworkflow zonder de historie te wissen.
 * Dit is bewust een soft-delete, ook voor een reeds verzonden brief wanneer
 * die per ongeluk aan de verkeerde geadresseerde / workflow is gekoppeld.
 */
export function useVerwijderBriefUitWorkflow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (brief: OffMarketBrief): Promise<OffMarketBrief> => {
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

      return data as OffMarketBrief;
    },
    onSuccess: (brief) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', brief.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off_market_brief_events', brief.signaal_id] });
    },
  });
}

/**
 * Verwijder een foutief geregistreerde respons van een brief.
 * De append-only briefevents blijven bestaan en krijgen een correctie-event;
 * het automatisch aangemaakte contactmoment voor precies deze respons wordt
 * waar mogelijk verwijderd zodat de zichtbare tijdlijn ook wordt hersteld.
 */
export function useVerwijderBriefRespons() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (brief: OffMarketBrief): Promise<OffMarketBrief> => {
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

      // Een retour-post registratie zet verzendstatus op `retour`. Bij het
      // verwijderen van die foutieve respons herstellen we de verzendstatus.
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

      // RegistreerResponsDialog gebruikt deze deterministische system_key.
      // Alleen dat automatisch gegenereerde contactmoment wordt verwijderd.
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

      return data as OffMarketBrief;
    },
    onSuccess: (brief) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', brief.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off_market_brief_events', brief.signaal_id] });
      qc.invalidateQueries({ queryKey: ['contact_moments'] });
    },
  });
}
