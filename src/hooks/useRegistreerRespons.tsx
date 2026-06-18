// Registreer een responsstatus op een bestaande brief.
// Schrijft response-velden op `off_market_brieven` + audit-event.
// Maakt optioneel een vervolgcontactmoment en/of vervolgtaak aan.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import type { Responsstatus } from '@/lib/offMarket/brieven/respons';
import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

export interface RegistreerResponsInput {
  brief_id: string;
  signaal_id: string;
  geadresseerde_key?: string | null;
  campagne_stap?: string | null;
  responsstatus: Responsstatus;
  responsdatum: string;          // YYYY-MM-DD
  respons_kanaal?: Kanaal | null;
  respons_samenvatting?: string | null;
}

export function useRegistreerRespons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegistreerResponsInput): Promise<OffMarketBrief> => {
      const patch: any = {
        responsstatus: input.responsstatus,
        responsdatum: input.responsdatum,
        respons_kanaal: input.respons_kanaal ?? null,
        respons_samenvatting: input.respons_samenvatting ?? null,
      };
      // Retour post zet ook verzendstatus.
      if (input.responsstatus === 'retour_post') {
        patch.verzendstatus = 'retour';
      }
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .update(patch)
        .eq('id', input.brief_id)
        .select()
        .single();
      if (error) throw new Error(error.message);

      await logBriefEvent({
        signaal_id: input.signaal_id,
        brief_id: input.brief_id,
        geadresseerde_key: input.geadresseerde_key ?? null,
        campagne_stap: input.campagne_stap ?? null,
        kanaal: input.respons_kanaal ?? null,
        event_type: input.responsstatus === 'retour_post' ? 'returned_mail' : 'response_received',
        status: input.responsstatus,
        metadata: { samenvatting: input.respons_samenvatting ?? null },
      });

      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off_market_brief_events', b.signaal_id] });
    },
  });
}
