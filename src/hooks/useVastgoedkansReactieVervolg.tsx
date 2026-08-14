import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { VastgoedkansStatus } from '@/lib/vastgoedkansen';

const sb = supabase as any;

export interface PasReactieVervolgToeInput {
  vastgoedkansId: string;
  status: VastgoedkansStatus;
  volgendeActieOmschrijving: string;
  volgendeActieDatum: string | null;
}

async function pasReactieVervolgToe(input: PasReactieVervolgToeInput) {
  const { data, error } = await sb
    .from('vastgoedkansen')
    .update({
      status: input.status,
      volgende_actie_omschrijving: input.volgendeActieOmschrijving,
      volgende_actie_datum: input.volgendeActieDatum,
    })
    .eq('id', input.vastgoedkansId)
    .is('archived_at', null)
    .select('id,status,volgende_actie_omschrijving,volgende_actie_datum')
    .single();
  if (error) throw error;
  return data;
}

export function useVastgoedkansReactieVervolg() {
  return useMutation({ mutationFn: pasReactieVervolgToe });
}
