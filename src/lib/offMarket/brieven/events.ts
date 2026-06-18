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
  | 'response_received'
  | 'returned_mail'
  | 'follow_up_created'
  | 'follow_up_completed'
  | 'archived';

export interface BriefEventInput {
  signaal_id: string;
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
 */
export async function logBriefEvent(input: BriefEventInput): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      signaal_id: input.signaal_id,
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
