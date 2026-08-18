import { supabase } from '@/integrations/supabase/client';
import type { NotificationPriority } from './policy';

export interface ServerNotificationEvent {
  id: string;
  user_id: string;
  event_type: string;
  source_type: string;
  source_id: string;
  occurrence_key: string;
  title: string;
  body: string | null;
  priority: NotificationPriority;
  href: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

export interface NotificationPreferences {
  user_id: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  task_due_enabled: boolean;
  task_overdue_enabled: boolean;
  high_priority_task_enabled: boolean;
  bid_expiry_enabled: boolean;
  strong_match_enabled: boolean;
  data_quality_enabled: boolean;
  task_default_reminder_minutes: number | null;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  device_label: string | null;
  platform: string | null;
  browser: string | null;
  display_mode: string | null;
  push_enabled: boolean;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  authKey: string;
  deviceLabel?: string;
  platform?: string;
  browser?: string;
  displayMode?: string;
}

const db = supabase as any;

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Geen ingelogde gebruiker');
  return data.user.id;
}

export async function listNotificationEvents(options?: {
  includeResolved?: boolean;
  limit?: number;
}): Promise<ServerNotificationEvent[]> {
  const includeResolved = options?.includeResolved ?? false;
  const limit = options?.limit ?? 200;
  const now = new Date().toISOString();

  let query = db
    .from('notification_events')
    .select('*')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!includeResolved) {
    query = query.is('resolved_at', null).is('dismissed_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ServerNotificationEvent[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db
    .from('notification_events')
    .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { error } = await db
    .from('notification_events')
    .update({ read_at: now, updated_at: now })
    .eq('user_id', userId)
    .is('read_at', null)
    .is('resolved_at', null)
    .is('dismissed_at', null);
  if (error) throw error;
}

export async function dismissNotification(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('notification_events')
    .update({ dismissed_at: now, read_at: now, updated_at: now })
    .eq('id', id);
  if (error) throw error;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const userId = await currentUserId();
  const { data, error } = await db
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as NotificationPreferences;

  const { data: created, error: createError } = await db
    .from('notification_preferences')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (createError) throw createError;
  return created as NotificationPreferences;
}

export async function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, 'user_id'>>,
): Promise<NotificationPreferences> {
  const userId = await currentUserId();
  const { data, error } = await db
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as NotificationPreferences;
}

export async function registerPushSubscription(
  input: PushSubscriptionInput,
): Promise<PushSubscriptionRecord> {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth_key: input.authKey,
      device_label: input.deviceLabel ?? null,
      platform: input.platform ?? null,
      browser: input.browser ?? null,
      display_mode: input.displayMode ?? null,
      push_enabled: true,
      revoked_at: null,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,endpoint' })
    .select('id,user_id,endpoint,device_label,platform,browser,display_mode,push_enabled,last_seen_at,revoked_at')
    .single();
  if (error) throw error;
  return data as PushSubscriptionRecord;
}

export async function touchPushSubscription(endpoint: string): Promise<void> {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { error } = await db
    .from('push_subscriptions')
    .update({ last_seen_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .is('revoked_at', null);
  if (error) throw error;
}

export async function revokePushSubscription(endpoint: string): Promise<void> {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { error } = await db
    .from('push_subscriptions')
    .update({ revoked_at: now, push_enabled: false, updated_at: now })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  if (error) throw error;
}

/**
 * Realtime invalidatie voor alle sessies van dezelfde gebruiker.
 * De callback haalt bewust zelf opnieuw server-state op; payloads worden niet
 * als source of truth gebruikt.
 */
export async function subscribeToNotificationChanges(onChange: () => void): Promise<() => void> {
  const userId = await currentUserId();
  const channel = supabase
    .channel(`notification-events:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notification_events',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
