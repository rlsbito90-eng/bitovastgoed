// Update verzendstatus-velden op een bestaande brief (geen insert).
// Wordt o.a. gebruikt door PDF-download (concept → pdf_gegenereerd).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isProgressie, type Verzendstatus } from '@/lib/offMarket/brieven/verzendstatus';
import { logBriefEvent, type BriefEventType } from '@/lib/offMarket/brieven/events';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

interface Input {
  id: string;
  signaal_id: string;
  geadresseerde_key?: string | null;
  campagne_stap?: string | null;
  kanaal?: string | null;
  nieuweStatus: Verzendstatus;
  printdatum?: string | null;
  event?: BriefEventType;
}

export function useUpdateVerzendstatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input): Promise<OffMarketBrief | null> => {
      // Lees huidige verzendstatus om downgrades te voorkomen.
      const { data: huidig, error: leesFout } = await (supabase as any)
        .from('off_market_brieven')
        .select('id,verzendstatus,signaal_id')
        .eq('id', input.id)
        .single();
      if (leesFout) throw new Error(leesFout.message);
      const huidigeStatus = (huidig?.verzendstatus ?? null) as Verzendstatus | null;
      if (!isProgressie(huidigeStatus, input.nieuweStatus)) {
        // Geen downgrade; alleen event loggen voor audit.
        if (input.event) {
          await logBriefEvent({
            signaal_id: input.signaal_id,
            brief_id: input.id,
            geadresseerde_key: input.geadresseerde_key ?? null,
            campagne_stap: input.campagne_stap ?? null,
            kanaal: input.kanaal ?? null,
            event_type: input.event,
            status: huidigeStatus,
          });
        }
        return null;
      }
      const patch: any = { verzendstatus: input.nieuweStatus };
      if (input.printdatum !== undefined) patch.printdatum = input.printdatum;
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .update(patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (input.event) {
        await logBriefEvent({
          signaal_id: input.signaal_id,
          brief_id: input.id,
          geadresseerde_key: input.geadresseerde_key ?? null,
          campagne_stap: input.campagne_stap ?? null,
          kanaal: input.kanaal ?? null,
          event_type: input.event,
          status: input.nieuweStatus,
        });
      }
      return data as OffMarketBrief;
    },
    onSuccess: (b, vars) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', vars.signaal_id] });
    },
  });
}
