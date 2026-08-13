import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';
import { defaultFollowupDagen } from '@/lib/offMarket/email/emailProfielen';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

export interface AcquisitieBrief extends Omit<OffMarketBrief, 'signaal_id'> {
  signaal_id: string | null;
  vastgoedkans_id: string | null;
}

export interface VastgoedkansBriefConceptInput {
  id?: string;
  vastgoedkans_id: string;
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  objectadres?: string | null;
  objectomschrijving?: string | null;
  aanhef?: string | null;
  onderwerp?: string | null;
  brieftekst: string;
}

const TABLE = 'off_market_brieven';

export function useVastgoedkansBrieven(vastgoedkansId: string | null | undefined) {
  return useQuery({
    queryKey: ['off_market_brieven', 'vastgoedkans', vastgoedkansId],
    enabled: !!vastgoedkansId,
    queryFn: async (): Promise<AcquisitieBrief[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('vastgoedkans_id', vastgoedkansId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieBrief[];
    },
  });
}

/**
 * BUILD 2.0C.2: uitsluitend conceptpersistentie voor Vastgoedkansen.
 * Geen verzending, statuspromotie, taakcreatie of externe actie.
 */
export function useUpsertVastgoedkansBriefConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VastgoedkansBriefConceptInput): Promise<AcquisitieBrief> => {
      const vastgoedkansId = input.vastgoedkans_id.trim();
      if (!vastgoedkansId) throw new Error('Vastgoedkans-ID ontbreekt.');
      if (!input.brieftekst.trim()) throw new Error('Brieftekst is verplicht.');

      const { data: u } = await supabase.auth.getUser();
      const key = geadresseerdeKey({
        id: input.id ?? `_nieuw|${Date.now()}`,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres ?? null,
      });
      const payload: any = {
        signaal_id: null,
        vastgoedkans_id: vastgoedkansId,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres ?? null,
        objectadres: input.objectadres ?? null,
        objectomschrijving: input.objectomschrijving ?? null,
        aanhef: input.aanhef ?? null,
        onderwerp: input.onderwerp ?? null,
        brieftekst: input.brieftekst,
        status: 'concept',
        aangemaakt_door: u.user?.id ?? null,
        kanaal: 'post',
        campagne_stap: 'brief_1',
        geadresseerde_key: key,
        verzendstatus: 'concept',
      };

      let brief: AcquisitieBrief;
      if (input.id) {
        delete payload.status;
        delete payload.kanaal;
        delete payload.campagne_stap;
        delete payload.verzendstatus;
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
          .insert(payload)
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
        });
      }
      return brief;
    },
    onSuccess: (brief) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', 'vastgoedkans', brief.vastgoedkans_id] });
    },
  });
}

export interface MarkeerVastgoedkansBriefVerstuurdInput {
  id: string;
  vastgoedkans_id: string;
  postdatum: string;
}

/**
 * BUILD 2.0C.3: registreert uitsluitend een door de gebruiker bevestigde
 * postverzending. Deze mutatie verstuurt zelf niets, maakt geen taak aan en
 * wijzigt geen Vastgoedkans- of Off-Market-status.
 */
export function useMarkVastgoedkansBriefVerstuurd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkeerVastgoedkansBriefVerstuurdInput): Promise<AcquisitieBrief> => {
      const vastgoedkansId = input.vastgoedkans_id.trim();
      const id = input.id.trim();
      const postdatum = input.postdatum.trim();
      if (!vastgoedkansId || !id || !/^\d{4}-\d{2}-\d{2}$/.test(postdatum)) {
        throw new Error('Brief, Vastgoedkans en geldige postdatum zijn verplicht.');
      }

      const { data: huidig, error: leesFout } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .eq('vastgoedkans_id', vastgoedkansId)
        .single();
      if (leesFout) throw new Error(leesFout.message);
      if (huidig.status === 'verstuurd') return huidig as AcquisitieBrief;
      if (huidig.status !== 'concept') throw new Error('Alleen een conceptbrief kan als verstuurd worden gemarkeerd.');

      const opvolgdatum = berekenFollowUpDeadline(postdatum, defaultFollowupDagen('post'));
      const verzondenOp = new Date(`${postdatum}T12:00:00.000Z`).toISOString();
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({
          status: 'verstuurd',
          verzonden_op: verzondenOp,
          verzendstatus: 'gepost',
          postdatum,
          opvolgdatum,
        })
        .eq('id', id)
        .eq('vastgoedkans_id', vastgoedkansId)
        .eq('status', 'concept')
        .select()
        .single();
      if (error) throw new Error(error.message);

      const brief = data as AcquisitieBrief;
      await logBriefEvent({
        vastgoedkans_id: vastgoedkansId,
        brief_id: brief.id,
        geadresseerde_key: brief.geadresseerde_key ?? null,
        campagne_stap: brief.campagne_stap ?? 'brief_1',
        kanaal: brief.kanaal ?? 'post',
        event_type: 'posted',
        status: 'gepost',
        metadata: { postdatum, opvolgdatum },
      });
      return brief;
    },
    onSuccess: (brief) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', 'vastgoedkans', brief.vastgoedkans_id] });
    },
  });
}

/** Audit-only registratie na succesvolle lokale PDF-generatie. */
export async function logVastgoedkansBriefPdfGenerated(brief: AcquisitieBrief): Promise<void> {
  if (!brief.vastgoedkans_id) return;
  await logBriefEvent({
    vastgoedkans_id: brief.vastgoedkans_id,
    brief_id: brief.id,
    geadresseerde_key: brief.geadresseerde_key ?? null,
    campagne_stap: brief.campagne_stap ?? 'brief_1',
    kanaal: brief.kanaal ?? 'post',
    event_type: 'pdf_generated',
    status: brief.status,
  });
}
