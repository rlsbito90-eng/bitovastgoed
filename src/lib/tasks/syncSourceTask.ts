import { supabase } from '@/integrations/supabase/client';
import type { TaskSourceIdentity } from './sourceIdentity';

const sb = supabase as any;

export interface SyncSourceTaskInput {
  identity: TaskSourceIdentity;
  active: boolean;
  title: string;
  type: string;
  deadline?: string | null;
  deadlineTime?: string | null;
  priority?: 'laag' | 'normaal' | 'hoog' | 'urgent';
  relationId?: string | null;
  objectId?: string | null;
  dealId?: string | null;
  vastgoedkansId?: string | null;
  offMarketSignaalId?: string | null;
  notes?: string | null;
}

const ACTIVE_STATUSES = ['open', 'in_uitvoering', 'wacht_op_reactie'];

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Geen ingelogde gebruiker voor taak-synchronisatie');
  return data.user.id;
}

async function findActiveSourceTask(userId: string, identity: TaskSourceIdentity) {
  const { data, error } = await sb
    .from('taken')
    .select('id,status')
    .eq('owner_user_id', userId)
    .eq('source_kind', identity.sourceKind)
    .eq('source_id', identity.sourceId)
    .eq('source_slot', identity.sourceSlot)
    .is('soft_deleted_at', null)
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; status: string } | null;
}

function taskPayload(input: SyncSourceTaskInput, userId: string) {
  return {
    owner_user_id: userId,
    source_kind: input.identity.sourceKind,
    source_id: input.identity.sourceId,
    source_slot: input.identity.sourceSlot,
    titel: input.title,
    type_taak: input.type,
    deadline: input.deadline || null,
    deadline_tijd: input.deadline ? (input.deadlineTime || null) : null,
    prioriteit: input.priority ?? 'normaal',
    relatie_id: input.relationId || null,
    object_id: input.objectId || null,
    deal_id: input.dealId || null,
    vastgoedkans_id: input.vastgoedkansId || null,
    off_market_signaal_id: input.offMarketSignaalId || null,
    notities: input.notes || null,
  };
}

/**
 * Synchroniseert één zakelijke bronactie naar exact één actieve centrale taak.
 *
 * - active=true: bestaande actieve taak bijwerken, anders één nieuwe maken;
 * - active=false: bestaande actieve taak annuleren, historie behouden;
 * - deadline is optioneel en wordt nooit uit een registratiedatum afgeleid;
 * - unieke DB-index blijft de laatste guardrail tegen races/dubbele writes.
 */
export async function syncSourceTask(input: SyncSourceTaskInput): Promise<string | null> {
  const userId = await getCurrentUserId();
  const existing = await findActiveSourceTask(userId, input.identity);

  if (!input.active) {
    if (!existing) return null;
    const { error } = await sb
      .from('taken')
      .update({ status: 'geannuleerd' })
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const payload = taskPayload(input, userId);

  if (existing) {
    const { error } = await sb
      .from('taken')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await sb
    .from('taken')
    .insert({ ...payload, status: 'open' })
    .select('id')
    .single();

  if (!error) return data?.id ?? null;

  // Een gelijktijdige write kan de unieke actieve source-slot index winnen.
  // Refetch en update die taak in plaats van een duplicaat te laten ontstaan.
  if (error.code === '23505') {
    const raced = await findActiveSourceTask(userId, input.identity);
    if (!raced) throw error;
    const { error: updateError } = await sb
      .from('taken')
      .update(payload)
      .eq('id', raced.id);
    if (updateError) throw updateError;
    return raced.id;
  }

  throw error;
}
