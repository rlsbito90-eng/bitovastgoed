import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import type { CopyVariantToewijzing } from '@/lib/acquisitie/copyExperimenten';
import type { AcquisitieBrief } from '@/hooks/useAcquisitieBrieven';

export type PandenverkennerAdresseerwijze = 'eigenaar_bekend' | 'eigenaar_objectadres';

export interface PandenverkennerBriefConceptInput {
  id?: string;
  vastgoedkans_id: string;
  campagne_stap?: 'brief_1' | 'brief_2';
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  geadresseerde_label?: string | null;
  adresseerwijze: PandenverkennerAdresseerwijze;
  verzendadres: string;
  objectadres?: string | null;
  objectomschrijving?: string | null;
  aanhef?: string | null;
  onderwerp?: string | null;
  brieftekst: string;
  copy?: CopyVariantToewijzing | null;
}

const TABLE = 'off_market_brieven';

export function useUpsertPandenverkennerBriefConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PandenverkennerBriefConceptInput): Promise<AcquisitieBrief> => {
      const vastgoedkansId = input.vastgoedkans_id.trim();
      if (!vastgoedkansId) throw new Error('Vastgoedkans-ID ontbreekt.');
      if (!input.brieftekst.trim()) throw new Error('Brieftekst is verplicht.');
      if (!input.verzendadres.trim()) throw new Error('Verzendadres is verplicht.');

      const { data: u } = await supabase.auth.getUser();
      const key = geadresseerdeKey({
        id: input.id ?? `_nieuw|${Date.now()}`,
        eigenaar_naam: input.eigenaar_naam ?? input.geadresseerde_label ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres,
      });

      let copyVariantId: string | null = null;
      if (input.copy) {
        const { data } = await (supabase as any)
          .from('acquisitie_copy_varianten')
          .select('id')
          .eq('profiel', input.copy.profiel)
          .eq('kanaal', 'post')
          .eq('campagne_stap', input.campagne_stap ?? 'brief_1')
          .eq('variant_code', input.copy.variantCode)
          .eq('actief', true)
          .maybeSingle();
        copyVariantId = data?.id ?? null;
      }

      const payload: Record<string, unknown> = {
        signaal_id: null,
        vastgoedkans_id: vastgoedkansId,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        geadresseerde_label: input.geadresseerde_label ?? null,
        adresseerwijze: input.adresseerwijze,
        verzendadres: input.verzendadres.trim(),
        objectadres: input.objectadres ?? null,
        objectomschrijving: input.objectomschrijving ?? null,
        aanhef: input.aanhef ?? null,
        onderwerp: input.onderwerp ?? null,
        brieftekst: input.brieftekst,
        aangemaakt_door: u.user?.id ?? null,
        geadresseerde_key: key,
        copy_variant_id: copyVariantId,
        copy_profiel: input.copy?.profiel ?? null,
        copy_variant_key: input.copy?.variantKey ?? null,
        copy_variant_code: input.copy?.variantCode ?? null,
        copy_hypothese: input.copy?.hypothese ?? null,
      };

      let brief: AcquisitieBrief;
      if (input.id) {
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .update(payload)
          .eq('id', input.id)
          .eq('vastgoedkans_id', vastgoedkansId)
          .eq('status', 'concept')
          .select()
          .single();
        if (error) throw new Error(error.message);
        brief = data as AcquisitieBrief;
      } else {
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .insert({
            ...payload,
            status: 'concept',
            kanaal: 'post',
            campagne_stap: input.campagne_stap ?? 'brief_1',
            verzendstatus: 'concept',
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        brief = data as AcquisitieBrief;
        await logBriefEvent({
          vastgoedkans_id: vastgoedkansId,
          brief_id: brief.id,
          geadresseerde_key: brief.geadresseerde_key ?? null,
          campagne_stap: brief.campagne_stap ?? 'brief_1',
          kanaal: 'post',
          event_type: 'concept_created',
          status: 'concept',
          metadata: {
            bron: 'pandenverkenner',
            adresseerwijze: input.adresseerwijze,
            copy_profiel: input.copy?.profiel ?? null,
            copy_variant_code: input.copy?.variantCode ?? null,
          },
        });
      }
      return brief;
    },
    onSuccess: (brief) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', 'vastgoedkans', brief.vastgoedkans_id] });
    },
  });
}
