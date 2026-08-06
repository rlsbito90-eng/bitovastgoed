import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';

export type Opvolgkeuze = 'taak_plannen' | 'bewust_overslaan';

export interface BriefOpvolgkeuzeInput {
  briefId: string;
  signaalId: string;
  geadresseerdeKey?: string | null;
  campagneStap?: string | null;
  kanaal?: string | null;
  keuze: Opvolgkeuze;
  opvolgdatum?: string | null;
  gekoppeldeTaakId?: string | null;
  overslaReden?: string | null;
}

export function valideerOpvolgkeuze(input: BriefOpvolgkeuzeInput): string | null {
  if (input.keuze === 'taak_plannen') {
    if (!input.opvolgdatum) return 'Kies een opvolgdatum.';
    if (!input.gekoppeldeTaakId) return 'De opvolgtaak kon niet worden gekoppeld.';
    return null;
  }
  if (!(input.overslaReden ?? '').trim()) {
    return 'Leg vast waarom opvolging bewust wordt overgeslagen.';
  }
  return null;
}

export function useBriefOpvolgkeuze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BriefOpvolgkeuzeInput): Promise<void> => {
      const fout = valideerOpvolgkeuze(input);
      if (fout) throw new Error(fout);

      const overslaan = input.keuze === 'bewust_overslaan';
      const patch = overslaan
        ? { opvolgdatum: null, gekoppelde_taak_id: null }
        : {
            opvolgdatum: input.opvolgdatum,
            gekoppelde_taak_id: input.gekoppeldeTaakId,
          };

      const { error } = await (supabase as any)
        .from('off_market_brieven')
        .update(patch)
        .eq('id', input.briefId);
      if (error) throw new Error(error.message);

      if (overslaan) {
        await logBriefEvent({
          signaal_id: input.signaalId,
          brief_id: input.briefId,
          geadresseerde_key: input.geadresseerdeKey ?? null,
          campagne_stap: input.campagneStap ?? null,
          kanaal: input.kanaal ?? 'post',
          event_type: 'follow_up_skipped',
          status: 'bewust_overgeslagen',
          metadata: { reden: input.overslaReden!.trim() },
        });
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', input.signaalId] });
    },
  });
}
