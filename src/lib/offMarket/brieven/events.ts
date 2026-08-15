// Append-only audit-log voor brievenflow. UI leest primair uit
// `off_market_brieven`; events vormen alleen het logboek.
import { supabase } from '@/integrations/supabase/client';
import { projecteerBriefEventNaarWorkflow } from '@/lib/workflow/acquisitieBriefWorkflowAdapter';

export type BriefEventType =
  | 'concept_created'
  | 'pdf_generated'
  | 'printed'
  | 'enveloped'
  | 'posted'
  | 'sent'
  | 'email_text_copied'
  | 'response_received'
  | 'returned_mail'
  | 'follow_up_created'
  | 'follow_up_completed'
  | 'archived';

export interface BriefEventInput {
  signaal_id?: string | null;
  vastgoedkans_id?: string | null;
  brief_id?: string | null;
  geadresseerde_key?: string | null;
  campagne_stap?: string | null;
  kanaal?: string | null;
  event_type: BriefEventType;
  event_date?: string;
  status?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Schrijf een briefgebeurtenis. Faalt zacht (console.warn) zodat UI-acties
 * nooit afgebroken worden door event-logging.
 *
 * Sinds BUILD 2.0C.1 is het eventlog dossierbreed. Bestaande callers die
 * alleen `signaal_id` meegeven blijven exact hetzelfde werken; het verplichte
 * `dossier_type` wordt hier afgeleid. Nieuwe Vastgoedkans-callers geven alleen
 * `vastgoedkans_id` mee. Exact één dossierbron is verplicht.
 *
 * BUILD 2.0E projecteert hetzelfde feit deterministisch naar een workflow-advies.
 * Dat advies wordt in hetzelfde append-only event opgeslagen; er wordt geen
 * dossierstatus, taak of externe actie automatisch uitgevoerd.
 */
export async function logBriefEvent(input: BriefEventInput): Promise<void> {
  try {
    const signaalId = input.signaal_id?.trim() || null;
    const vastgoedkansId = input.vastgoedkans_id?.trim() || null;
    if (Number(Boolean(signaalId)) + Number(Boolean(vastgoedkansId)) !== 1) {
      console.warn('logBriefEvent fout: exact één dossierbron is verplicht');
      return;
    }

    const workflow = projecteerBriefEventNaarWorkflow(input);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      signaal_id: signaalId,
      vastgoedkans_id: vastgoedkansId,
      dossier_type: vastgoedkansId ? 'vastgoedkans' : 'off_market_signaal',
      brief_id: input.brief_id ?? null,
      geadresseerde_key: input.geadresseerde_key ?? null,
      campagne_stap: input.campagne_stap ?? null,
      kanaal: input.kanaal ?? null,
      event_type: input.event_type,
      status: input.status ?? null,
      volgende_actie: workflow.volgendeActie,
      volgende_actie_op: workflow.volgendeActieOp,
      metadata: {
        ...(input.metadata ?? {}),
        ...(workflow.workflowCode
          ? { workflow: { code: workflow.workflowCode, mode: workflow.workflowMode } }
          : {}),
      },
      created_by: u.user?.id ?? null,
    };
    if (input.event_date) payload.event_date = input.event_date;
    const { error } = await (supabase as any)
      .from('off_market_brief_events').insert(payload);
    if (error) console.warn('logBriefEvent fout:', error.message);
  } catch (e) {
    console.warn('logBriefEvent exception:', e);
  }
}

/**
 * TRACK-7A — projecteer het afronden van een centrale CRM-taak naar het
 * acquisitie-eventlog wanneer die taak expliciet aan één acquisitiebrief is
 * gekoppeld.
 *
 * Veiligheidscontract:
 * - fail-soft: taakafronding mag nooit stuklopen op meetlogging;
 * - exact één gekoppelde brief is vereist; ambiguïteit wordt niet gegokt;
 * - idempotent: maximaal één `follow_up_completed` per gekoppelde brief;
 * - geen status-, taak- of briefmutatie; uitsluitend append-only meetevent.
 */
export async function logFollowUpCompletedVoorTaak(taakId: string): Promise<void> {
  try {
    const normalizedTaakId = taakId.trim();
    if (!normalizedTaakId) return;

    const { data: brieven, error: briefError } = await (supabase as any)
      .from('off_market_brieven')
      .select('id,signaal_id,vastgoedkans_id,geadresseerde_key,campagne_stap,kanaal')
      .eq('gekoppelde_taak_id', normalizedTaakId)
      .limit(2);

    if (briefError) {
      console.warn('logFollowUpCompletedVoorTaak brief lookup fout:', briefError.message);
      return;
    }
    if (!Array.isArray(brieven) || brieven.length === 0) return;
    if (brieven.length !== 1) {
      console.warn('logFollowUpCompletedVoorTaak overgeslagen: taak is niet eenduidig aan één brief gekoppeld');
      return;
    }

    const brief = brieven[0];
    const heeftSignaal = Boolean(brief.signaal_id);
    const heeftVastgoedkans = Boolean(brief.vastgoedkans_id);
    if (Number(heeftSignaal) + Number(heeftVastgoedkans) !== 1) {
      console.warn('logFollowUpCompletedVoorTaak overgeslagen: brief heeft geen eenduidige dossierbron');
      return;
    }

    const { data: bestaand, error: eventError } = await (supabase as any)
      .from('off_market_brief_events')
      .select('id')
      .eq('brief_id', brief.id)
      .eq('event_type', 'follow_up_completed')
      .limit(1);

    if (eventError) {
      console.warn('logFollowUpCompletedVoorTaak event lookup fout:', eventError.message);
      return;
    }
    if (Array.isArray(bestaand) && bestaand.length > 0) return;

    await logBriefEvent({
      signaal_id: brief.signaal_id ?? null,
      vastgoedkans_id: brief.vastgoedkans_id ?? null,
      brief_id: brief.id,
      geadresseerde_key: brief.geadresseerde_key ?? null,
      campagne_stap: brief.campagne_stap ?? null,
      kanaal: brief.kanaal ?? null,
      event_type: 'follow_up_completed',
      status: 'afgerond',
      metadata: {
        taak_id: normalizedTaakId,
        bron: 'centrale_taakstatus',
      },
    });
  } catch (e) {
    console.warn('logFollowUpCompletedVoorTaak exception:', e);
  }
}
