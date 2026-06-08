// React Query hook voor Kadaster-checks.
// - useLaatsteKadasterCheck: meest recente check per signaal
// - useKadasterCheck: roept edge function aan
// - useOvernameKadasterCheck: schrijft gekozen resultaat naar signaal +
//   markeert check als overgenomen
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KadasterCheckResponse, KadasterResultaat, KadasterModus } from '@/lib/offMarket/kadaster/types';

export interface KadasterCheckRow {
  id: string;
  signaal_id: string;
  uitgevoerd_op: string;
  modus: KadasterModus;
  zoekvariant: string | null;
  status: string;
  match_confidence: number | null;
  resultaten: KadasterResultaat[];
  gekozen_resultaat: KadasterResultaat | null;
  overgenomen_op: string | null;
}

export function useLaatsteKadasterCheck(signaalId: string | undefined) {
  return useQuery({
    queryKey: ['off-market-kadaster-check', signaalId],
    enabled: !!signaalId,
    queryFn: async (): Promise<KadasterCheckRow | null> => {
      const { data, error } = await supabase
        .from('off_market_kadaster_checks' as never)
        .select('*')
        .eq('signaal_id', signaalId!)
        .order('uitgevoerd_op', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as KadasterCheckRow | null) ?? null;
    },
  });
}

export interface KadasterCheckInvoke {
  signaal_id: string;
  zoekvariant_id?: string;
  handmatige_zoekterm?: string | null;
  modus?: KadasterModus;
}

export function useKadasterCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: KadasterCheckInvoke): Promise<KadasterCheckResponse> => {
      const { data, error } = await supabase.functions.invoke('off-market-kadaster-check', {
        body: input,
      });
      if (error) throw error;
      return data as KadasterCheckResponse;
    },
    onSuccess: (_resp, vars) => {
      qc.invalidateQueries({ queryKey: ['off-market-kadaster-check', vars.signaal_id] });
    },
  });
}

export interface OvernameInput {
  signaal_id: string;
  check_id: string;
  resultaat: KadasterResultaat;
}

/**
 * Schrijft het gekozen resultaat naar het signaal én markeert de
 * check-rij als overgenomen.
 *
 * Vult:
 *   eigenaar_naam, eigenaar_type, eigenaar_bedrijfsnaam,
 *   kadastrale_aanduiding, kadaster_check_op = now(),
 *   eigenaarbron = 'kadaster', eigenaarstatus = 'gevonden',
 *   eigenaar_bekend = true
 *
 * Relatie aanmaken gebeurt NIET hier; dat blijft een aparte handmatige actie.
 */
export function useOvernameKadasterCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ signaal_id, check_id, resultaat }: OvernameInput) => {
      const { data: u } = await supabase.auth.getUser();
      const nu = new Date().toISOString();

      const patch: Record<string, unknown> = {
        eigenaar_naam: resultaat.eigenaar_naam,
        kadastrale_aanduiding: resultaat.kadastrale_aanduiding,
        kadaster_check_op: nu,
        eigenaarbron: 'kadaster',
        eigenaarstatus: 'gevonden',
        eigenaar_bekend: true,
        updated_by: u.user?.id ?? null,
      };
      if (resultaat.eigenaar_type) patch.eigenaar_type = resultaat.eigenaar_type;
      if (resultaat.eigenaar_bedrijfsnaam) patch.eigenaar_bedrijfsnaam = resultaat.eigenaar_bedrijfsnaam;

      const { error: sigErr } = await supabase
        .from('off_market_signalen')
        .update(patch as never)
        .eq('id', signaal_id);
      if (sigErr) throw sigErr;

      const { error: checkErr } = await supabase
        .from('off_market_kadaster_checks' as never)
        .update({ gekozen_resultaat: resultaat as never, overgenomen_op: nu } as never)
        .eq('id', check_id);
      if (checkErr) throw checkErr;

      return { ok: true };
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['off-market-signaal', vars.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kadaster-check', vars.signaal_id] });
    },
  });
}

export interface HandmatigeOvernameInput {
  signaal_id: string;
  eigenaar_naam: string;
  eigenaar_type?: KadasterResultaat['eigenaar_type'];
  eigenaar_bedrijfsnaam?: string;
  kadastrale_aanduiding: string;
}

/**
 * Handmatig overnemen wanneer de gebruiker zelf in Mijn Kadaster heeft
 * gezocht en het resultaat invult. Logt ook een check-rij met modus='handmatig'
 * voor audit.
 */
export function useHandmatigeOvername() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HandmatigeOvernameInput) => {
      const { data: u } = await supabase.auth.getUser();
      const nu = new Date().toISOString();
      const resultaat: KadasterResultaat = {
        adres: '',
        eigenaar_naam: input.eigenaar_naam,
        eigenaar_type: input.eigenaar_type,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam,
        kadastrale_aanduiding: input.kadastrale_aanduiding,
        confidence: 1,
        bron: 'kadaster',
      };

      const { data: checkRow, error: checkErr } = await supabase
        .from('off_market_kadaster_checks' as never)
        .insert({
          signaal_id: input.signaal_id,
          uitgevoerd_door: u.user?.id ?? null,
          modus: 'handmatig',
          status: 'geslaagd',
          match_confidence: 1,
          resultaten: [resultaat] as never,
          gekozen_resultaat: resultaat as never,
          overgenomen_op: nu,
        } as never)
        .select('id')
        .single();
      if (checkErr) throw checkErr;

      const patch: Record<string, unknown> = {
        eigenaar_naam: input.eigenaar_naam,
        kadastrale_aanduiding: input.kadastrale_aanduiding,
        kadaster_check_op: nu,
        eigenaarbron: 'kadaster',
        eigenaarstatus: 'gevonden',
        eigenaar_bekend: true,
        updated_by: u.user?.id ?? null,
      };
      if (input.eigenaar_type) patch.eigenaar_type = input.eigenaar_type;
      if (input.eigenaar_bedrijfsnaam) patch.eigenaar_bedrijfsnaam = input.eigenaar_bedrijfsnaam;

      const { error: sigErr } = await supabase
        .from('off_market_signalen')
        .update(patch as never)
        .eq('id', input.signaal_id);
      if (sigErr) throw sigErr;

      return { check_id: (checkRow as { id: string }).id };
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['off-market-signaal', vars.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kadaster-check', vars.signaal_id] });
    },
  });
}
