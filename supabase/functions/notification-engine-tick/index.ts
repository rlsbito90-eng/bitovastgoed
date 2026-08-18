import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EVENT_PREF_FIELD: Record<string, string> = {
  task_due_today: 'task_due_enabled',
  task_overdue: 'task_overdue_enabled',
  high_priority_task: 'high_priority_task_enabled',
  bid_expiry: 'bid_expiry_enabled',
  strong_match: 'strong_match_enabled',
  data_quality: 'data_quality_enabled',
};

async function getRuntimeSecret(key: string): Promise<string> {
  const { data, error } = await supabase
    .from('notification_runtime_secrets')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value?.trim() ?? '';
}

async function isAuthorized(req: Request): Promise<boolean> {
  const expected = await getRuntimeSecret('cron_secret');
  if (!expected) return false;
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const explicit = req.headers.get('x-cron-secret') ?? '';
  return bearer === expected || explicit === expected;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    if (!(await isAuthorized(req))) return new Response('Unauthorized', { status: 401 });

    const { data: taskOwners, error: ownersError } = await supabase
      .from('taken')
      .select('owner_user_id')
      .not('owner_user_id', 'is', null)
      .is('soft_deleted_at', null);

    if (ownersError) throw ownersError;

    const userIds = Array.from(new Set((taskOwners ?? []).map((r: any) => r.owner_user_id).filter(Boolean)));
    let createdEvents = 0;
    let resolvedEvents = 0;

    for (const userId of userIds) {
      const { data, error } = await supabase.rpc('refresh_task_notification_events', { p_user_id: userId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      createdEvents += Number(row?.created_count ?? 0);
      resolvedEvents += Number(row?.resolved_count ?? 0);
    }

    const { data: events, error: eventsError } = await supabase
      .from('notification_events')
      .select('id, user_id, event_type, scheduled_at, created_at')
      .is('resolved_at', null)
      .is('dismissed_at', null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`);

    if (eventsError) throw eventsError;

    const eventUserIds = Array.from(new Set((events ?? []).map((e: any) => e.user_id).filter(Boolean)));

    const { data: preferences, error: prefError } = eventUserIds.length
      ? await supabase.from('notification_preferences').select('*').in('user_id', eventUserIds)
      : { data: [], error: null } as any;
    if (prefError) throw prefError;

    const prefMap = new Map<string, any>((preferences ?? []).map((p: any) => [p.user_id, p]));

    const { data: subscriptions, error: subsError } = eventUserIds.length
      ? await supabase
          .from('push_subscriptions')
          .select('id, user_id, created_at')
          .in('user_id', eventUserIds)
          .eq('push_enabled', true)
          .is('revoked_at', null)
      : { data: [], error: null } as any;
    if (subsError) throw subsError;

    const subsByUser = new Map<string, Array<{ id: string; created_at: string }>>();
    for (const s of subscriptions ?? []) {
      const row = s as any;
      const arr = subsByUser.get(row.user_id) ?? [];
      arr.push({ id: row.id, created_at: row.created_at });
      subsByUser.set(row.user_id, arr);
    }

    const deliveries: Array<{ notification_event_id: string; subscription_id: string }> = [];

    for (const event of events ?? []) {
      const e = event as any;
      const pref = prefMap.get(e.user_id);
      if (pref && pref.push_enabled === false) continue;
      const prefField = EVENT_PREF_FIELD[e.event_type];
      if (prefField && pref && pref[prefField] === false) continue;

      for (const subscription of subsByUser.get(e.user_id) ?? []) {
        // Anti-backlog: een device ontvangt uitsluitend events die zijn ontstaan
        // nadat dit specifieke push-endpoint is geregistreerd.
        if (new Date(e.created_at).getTime() < new Date(subscription.created_at).getTime()) continue;
        deliveries.push({
          notification_event_id: e.id,
          subscription_id: subscription.id,
        });
      }
    }

    let queuedDeliveries = 0;
    if (deliveries.length > 0) {
      const { data: inserted, error: deliveryError } = await supabase
        .from('notification_deliveries')
        .upsert(deliveries, {
          onConflict: 'notification_event_id,subscription_id',
          ignoreDuplicates: true,
        })
        .select('id');
      if (deliveryError) throw deliveryError;
      queuedDeliveries = inserted?.length ?? 0;
    }

    return Response.json({
      ok: true,
      users_refreshed: userIds.length,
      created_events: createdEvents,
      resolved_events: resolvedEvents,
      active_events: events?.length ?? 0,
      queued_deliveries: queuedDeliveries,
    });
  } catch (error) {
    console.error('notification-engine-tick failed', error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
