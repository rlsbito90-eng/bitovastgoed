// Append-only audit-log voor brievenflow. UI leest primair uit
// `off_market_brieven`; events vormen alleen het logboek.
import { supabase } from '@/integrations/supabase/client';

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
 */
export async function logBriefEvent(input: BriefEventInput): Promise<void> {
  try {
    const signaalId = input.signaal_id?.trim() || null;
    const vastgoedkansId = input.vastgoedkans_id?.trim() || null;
    if (Number(Boolean(signaalId)) + Number(Boolean(vastgoedkansId)) !== 1) {
      console.warn('logBriefEvent fout: exact één dossierbron is verplicht');
      return;
    }

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
      metadata: input.metadata ?? {},
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
