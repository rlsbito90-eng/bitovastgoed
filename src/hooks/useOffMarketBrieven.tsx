// React Query hooks voor de "Brief voorbereiden"-flow.
// Slaat conceptbrieven en verzonden brieven op in `off_market_brieven`.
//
// Gearchiveerde brieven (`archived_at IS NOT NULL`) worden standaard
// uitgefilterd. Verstuurde brieven worden nooit gearchiveerd.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';
import { moetPromoverenNaarBenaderd } from '@/lib/offMarket/statusPromotie';
import { defaultFollowupDagen } from '@/lib/offMarket/email/emailProfielen';
import type { Kanaal, Verzendstatus } from '@/lib/offMarket/brieven/verzendstatus';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';

export interface OffMarketBrief {
  id: string;
  signaal_id: string;
  eigenaar_naam: string | null;
  eigenaar_bedrijfsnaam: string | null;
  verzendadres: string | null;
  objectadres: string | null;
  objectomschrijving: string | null;
  aanhef: string | null;
  onderwerp: string | null;
  brieftekst: string;
  status: 'concept' | 'verstuurd';
  verzonden_op: string | null;
  aangemaakt_door: string | null;
  created_at: string;
  updated_at: string;
  /** Soft-archive timestamp; null betekent actief/zichtbaar. */
  archived_at: string | null;
  archived_reason: string | null;
  // Brieven & opvolging V2 — nullable voor backward compatibility.
  kanaal?: Kanaal | null;
  campagne_stap?: CampagneStap | 'email_1' | 'email_2' | 'email_3' | null;
  geadresseerde_key?: string | null;
  printdatum?: string | null;
  postdatum?: string | null;
  verzendstatus?: Verzendstatus | null;
  opvolgdatum?: string | null;
  gekoppelde_taak_id?: string | null;
  responsstatus?: string | null;
  responsdatum?: string | null;
  respons_kanaal?: string | null;
  respons_samenvatting?: string | null;
}

export interface BriefInsert {
  signaal_id: string;
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  objectadres?: string | null;
  objectomschrijving?: string | null;
  aanhef?: string | null;
  onderwerp?: string | null;
  brieftekst: string;
  status?: 'concept' | 'verstuurd';
  kanaal?: Kanaal | null;
  campagne_stap?: CampagneStap | 'email_1' | 'email_2' | 'email_3' | null;
  geadresseerde_key?: string | null;
  verzendstatus?: Verzendstatus | null;
}

const TABLE = 'off_market_brieven';

export function useOffMarketBrievenForSignaal(
  signaalId: string | null | undefined,
  opts: { includeArchived?: boolean } = {},
) {
  const includeArchived = !!opts.includeArchived;
  return useQuery({
    queryKey: ['off_market_brieven', signaalId, includeArchived ? 'all' : 'active'],
    enabled: !!signaalId,
    queryFn: async (): Promise<OffMarketBrief[]> => {
      let q: any = (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('signaal_id', signaalId);
      if (!includeArchived) q = q.is('archived_at', null);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as OffMarketBrief[];
    },
  });
}

export function useUpsertBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: BriefInsert & { id?: string },
    ): Promise<OffMarketBrief> => {
      const { data: u } = await supabase.auth.getUser();
      // Bereken geadresseerde_key wanneer niet meegegeven.
      const key = input.geadresseerde_key ?? geadresseerdeKey({
        id: input.id ?? `_nieuw|${Date.now()}`,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres ?? null,
      });
      const payload: any = {
        signaal_id: input.signaal_id,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres ?? null,
        objectadres: input.objectadres ?? null,
        objectomschrijving: input.objectomschrijving ?? null,
        aanhef: input.aanhef ?? null,
        onderwerp: input.onderwerp ?? null,
        brieftekst: input.brieftekst,
        status: input.status ?? 'concept',
        aangemaakt_door: u.user?.id ?? null,
        kanaal: input.kanaal ?? 'post',
        campagne_stap: input.campagne_stap ?? null,
        geadresseerde_key: key,
        verzendstatus: input.verzendstatus ?? 'concept',
      };
      if (input.id) {
        // Bestaand record — wijzig kanaal/verzendstatus niet zomaar.
        delete payload.kanaal;
        delete payload.verzendstatus;
        const { data, error } = await (supabase as any)
          .from(TABLE).update(payload).eq('id', input.id).select().single();
        if (error) throw new Error(error.message);
        return data as OffMarketBrief;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE).insert(payload).select().single();
      if (error) throw new Error(error.message);
      // Audit-event voor nieuw concept (fail-soft).
      await logBriefEvent({
        signaal_id: input.signaal_id,
        brief_id: (data as any).id,
        geadresseerde_key: key,
        campagne_stap: input.campagne_stap ?? null,
        kanaal: input.kanaal ?? 'post',
        event_type: 'concept_created',
        status: payload.status,
      });
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}

/**
 * Markeer brief als verstuurd. Postdatum is leidend voor `verzonden_op`,
 * `postdatum` en de follow-up (postdatum + 21 dagen → `opvolgdatum`).
 *
 * - postdatum is YYYY-MM-DD (lokale datum); we bewaren als 12:00 UTC van
 *   die dag zodat tijdzone-shifts geen dag opschuiven.
 * - default is vandaag.
 * - Optioneel: `gekoppelde_taak_id` om de opvolgtaak meteen te koppelen.
 * - Schrijft audit-events `posted` en (indien taak gekoppeld) `follow_up_created`.
 */
export function useMarkBriefVerstuurd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | string
        | {
            id: string;
            postdatum?: string;
            gekoppelde_taak_id?: string | null;
            /** V2.2 — kanaal override. Default valt terug op kanaal uit DB-record. */
            kanaal?: Kanaal | null;
            /** V2.2 — strategieprofiel voor e-mail, alleen voor audit-metadata. */
            email_profiel?: string | null;
          },
    ): Promise<OffMarketBrief> => {
      const id = typeof input === 'string' ? input : input.id;
      const postdatum = typeof input === 'string' ? undefined : input.postdatum;
      const taakId = typeof input === 'string' ? null : (input.gekoppelde_taak_id ?? null);
      const overrideKanaal: Kanaal | null =
        typeof input === 'string' ? null : (input.kanaal ?? null);
      const emailProfiel: string | null =
        typeof input === 'string' ? null : (input.email_profiel ?? null);

      // Bepaal kanaal: override > DB-record > 'post'.
      let kanaal: Kanaal = overrideKanaal ?? 'post';
      if (!overrideKanaal) {
        try {
          const { data: huidig } = await (supabase as any)
            .from(TABLE).select('id,kanaal').eq('id', id).maybeSingle();
          const k = (huidig?.kanaal ?? null) as Kanaal | null;
          if (k) kanaal = k;
        } catch { /* fail-soft */ }
      }

      const isEmail = kanaal === 'email';
      const iso = postdatum
        ? new Date(`${postdatum}T12:00:00.000Z`).toISOString()
        : new Date().toISOString();
      const dagY = postdatum ?? new Date().toISOString().slice(0, 10);
      const opvolgdatum = berekenFollowUpDeadline(dagY, defaultFollowupDagen(kanaal));
      const patch: any = {
        status: 'verstuurd',
        verzonden_op: iso,
        verzendstatus: isEmail ? 'verzonden' : 'gepost',
        postdatum: dagY,
        opvolgdatum,
      };
      if (taakId) patch.gekoppelde_taak_id = taakId;
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);

      const brief = data as OffMarketBrief;
      const eventType = isEmail ? 'sent' : 'posted';
      const eventStatus = isEmail ? 'verzonden' : 'gepost';
      const baseMeta: Record<string, unknown> = isEmail
        ? { verzenddatum: dagY, opvolgdatum, kanaal: 'email', email_profiel: emailProfiel }
        : { postdatum: dagY, opvolgdatum };
      await logBriefEvent({
        signaal_id: brief.signaal_id,
        brief_id: brief.id,
        geadresseerde_key: brief.geadresseerde_key ?? null,
        campagne_stap: brief.campagne_stap ?? null,
        kanaal: brief.kanaal ?? kanaal,
        event_type: eventType,
        status: eventStatus,
        metadata: baseMeta,
      });
      if (taakId) {
        await logBriefEvent({
          signaal_id: brief.signaal_id,
          brief_id: brief.id,
          geadresseerde_key: brief.geadresseerde_key ?? null,
          campagne_stap: brief.campagne_stap ?? null,
          kanaal: brief.kanaal ?? kanaal,
          event_type: 'follow_up_created',
          metadata: { taak_id: taakId, deadline: opvolgdatum, kanaal },
        });
      }

      // Statuspromotie signaal → 'benaderd' (fail-soft).
      // Wijzigt niets wanneer het signaal al verder in de funnel staat.
      try {
        const { data: huidig } = await (supabase as any)
          .from('off_market_signalen')
          .select('id,status')
          .eq('id', brief.signaal_id)
          .maybeSingle();
        const huidigeStatus = (huidig?.status ?? null) as string | null;
        if (moetPromoverenNaarBenaderd(huidigeStatus) && huidigeStatus !== 'benaderd') {
          const { error: updFout } = await (supabase as any)
            .from('off_market_signalen')
            .update({ status: 'benaderd' })
            .eq('id', brief.signaal_id);
          if (!updFout) {
            await logBriefEvent({
              signaal_id: brief.signaal_id,
              brief_id: brief.id,
              geadresseerde_key: brief.geadresseerde_key ?? null,
              campagne_stap: brief.campagne_stap ?? null,
              kanaal: brief.kanaal ?? 'post',
              event_type: 'posted',
              status: 'benaderd',
              metadata: {
                statuspromotie: true,
                van: huidigeStatus,
                naar: 'benaderd',
              },
            });
          }
        }
      } catch (e) {
        console.warn('Statuspromotie naar benaderd mislukt:', e);
      }

      return brief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off_market_brief_events', b.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off-market-signaal', b.signaal_id] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
    },
  });
}

/**
 * Koppel een (later aangemaakte) opvolgtaak aan een bestaande brief.
 * Idempotent: schrijft niet wanneer er al een taak gekoppeld is.
 */
export function useKoppelOpvolgtaak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { brief_id: string; taak_id: string }) => {
      const { data: huidig } = await (supabase as any)
        .from(TABLE)
        .select('id,gekoppelde_taak_id,signaal_id')
        .eq('id', input.brief_id)
        .single();
      if (huidig?.gekoppelde_taak_id) return huidig as OffMarketBrief;
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ gekoppelde_taak_id: input.taak_id })
        .eq('id', input.brief_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as OffMarketBrief;
    },
    onSuccess: (b: any) => {
      if (b?.signaal_id) {
        qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
      }
    },
  });
}

/**
 * Archiveer een conceptbrief (soft-delete). Verstuurde brieven worden
 * geweigerd om historische data te beschermen.
 */
export function useArchiveerBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string; reden?: string },
    ): Promise<OffMarketBrief> => {
      // Defensief: haal eerst de brief op om status te valideren.
      const { data: bestaand, error: leesFout } = await (supabase as any)
        .from(TABLE).select('id,status,signaal_id').eq('id', input.id).single();
      if (leesFout) throw new Error(leesFout.message);
      if (bestaand?.status === 'verstuurd') {
        throw new Error('Verstuurde brieven kunnen niet worden gearchiveerd.');
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({
          archived_at: new Date().toISOString(),
          archived_reason: input.reden ?? 'testconcept opgeschoond',
        })
        .eq('id', input.id)
        .neq('status', 'verstuurd')
        .select()
        .single();
      if (error) throw new Error(error.message);
      await logBriefEvent({
        signaal_id: (data as any).signaal_id,
        brief_id: (data as any).id,
        geadresseerde_key: (data as any).geadresseerde_key ?? null,
        campagne_stap: (data as any).campagne_stap ?? null,
        kanaal: (data as any).kanaal ?? null,
        event_type: 'archived',
        metadata: { reden: input.reden ?? 'testconcept opgeschoond' },
      });
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}
