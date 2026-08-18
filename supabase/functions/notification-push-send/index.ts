import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_CRON_SECRET = Deno.env.get('NOTIFICATION_CRON_SECRET') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@bitovastgoed.nl';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function isAuthorized(req: Request): boolean {
  if (!INTERNAL_CRON_SECRET) return false;
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const explicit = req.headers.get('x-cron-secret') ?? '';
  return bearer === INTERNAL_CRON_SECRET || explicit === INTERNAL_CRON_SECRET;
}

function minutesOfDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function localMinutes(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function inQuietHours(pref: any): boolean {
  if (!pref?.quiet_hours_enabled) return false;
  const start = minutesOfDay(pref.quiet_hours_start);
  const end = minutesOfDay(pref.quiet_hours_end);
  if (start == null || end == null || start === end) return false;
  const now = localMinutes(pref.timezone || 'Europe/Amsterdam');
  return start < end ? now >= start && now < end : now >= start || now < end;
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
  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: false, error: 'VAPID keys ontbreken' }, { status: 503 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const { data: pending, error: pendingError } = await supabase
      .from('notification_deliveries')
      .select('id, notification_event_id, subscription_id, retry_count')
      .is('sent_at', null)
      .is('failed_at', null)
      .lt('retry_count', 3)
      .order('queued_at', { ascending: true })
      .limit(100);
    if (pendingError) throw pendingError;

    const eventIds = Array.from(new Set((pending ?? []).map((d: any) => d.notification_event_id)));
    const subscriptionIds = Array.from(new Set((pending ?? []).map((d: any) => d.subscription_id)));

    const { data: events, error: eventsError } = eventIds.length
      ? await supabase
          .from('notification_events')
          .select('id, user_id, title, body, href, priority, occurrence_key, resolved_at, dismissed_at')
          .in('id', eventIds)
      : { data: [], error: null } as any;
    if (eventsError) throw eventsError;

    const { data: subscriptions, error: subsError } = subscriptionIds.length
      ? await supabase
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth_key, revoked_at, push_enabled')
          .in('id', subscriptionIds)
      : { data: [], error: null } as any;
    if (subsError) throw subsError;

    const userIds = Array.from(new Set((events ?? []).map((e: any) => e.user_id)));
    const { data: preferences, error: prefError } = userIds.length
      ? await supabase
          .from('notification_preferences')
          .select('user_id, push_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone')
          .in('user_id', userIds)
      : { data: [], error: null } as any;
    if (prefError) throw prefError;

    const eventMap = new Map((events ?? []).map((e: any) => [e.id, e]));
    const subMap = new Map((subscriptions ?? []).map((s: any) => [s.id, s]));
    const prefMap = new Map((preferences ?? []).map((p: any) => [p.user_id, p]));

    let sent = 0;
    let deferred = 0;
    let revoked = 0;
    let retried = 0;
    let permanentlyFailed = 0;

    for (const delivery of pending ?? []) {
      const d = delivery as any;
      const event: any = eventMap.get(d.notification_event_id);
      const subscription: any = subMap.get(d.subscription_id);

      if (!event || !subscription || event.resolved_at || event.dismissed_at || subscription.revoked_at || subscription.push_enabled === false) {
        await supabase
          .from('notification_deliveries')
          .update({ failed_at: new Date().toISOString(), failure_code: 'inactive_source_or_subscription', updated_at: new Date().toISOString() })
          .eq('id', d.id);
        permanentlyFailed++;
        continue;
      }

      const pref = prefMap.get(event.user_id);
      if (pref?.push_enabled === false) {
        await supabase
          .from('notification_deliveries')
          .update({ failed_at: new Date().toISOString(), failure_code: 'push_disabled', updated_at: new Date().toISOString() })
          .eq('id', d.id);
        permanentlyFailed++;
        continue;
      }

      if (inQuietHours(pref)) {
        deferred++;
        continue;
      }

      const payload = JSON.stringify({
        title: event.title,
        body: event.body || '',
        href: event.href || '/',
        tag: event.occurrence_key,
        priority: event.priority,
        notificationEventId: event.id,
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          payload,
          {
            TTL: event.priority === 'kritiek' ? 86400 : 21600,
            urgency: event.priority === 'kritiek' ? 'high' : 'normal',
          },
        );

        await supabase
          .from('notification_deliveries')
          .update({ sent_at: new Date().toISOString(), failure_code: null, updated_at: new Date().toISOString() })
          .eq('id', d.id);
        sent++;
      } catch (error: any) {
        const statusCode = Number(error?.statusCode ?? 0);
        const gone = statusCode === 404 || statusCode === 410;
        const nextRetry = Number(d.retry_count ?? 0) + 1;

        if (gone) {
          await supabase
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString(), push_enabled: false, updated_at: new Date().toISOString() })
            .eq('id', subscription.id);
          await supabase
            .from('notification_deliveries')
            .update({ failed_at: new Date().toISOString(), failure_code: `endpoint_${statusCode}`, retry_count: nextRetry, updated_at: new Date().toISOString() })
            .eq('id', d.id);
          revoked++;
          continue;
        }

        if (nextRetry >= 3) {
          await supabase
            .from('notification_deliveries')
            .update({ failed_at: new Date().toISOString(), failure_code: `send_${statusCode || 'error'}`, retry_count: nextRetry, updated_at: new Date().toISOString() })
            .eq('id', d.id);
          permanentlyFailed++;
        } else {
          await supabase
            .from('notification_deliveries')
            .update({ failure_code: `retry_${statusCode || 'error'}`, retry_count: nextRetry, updated_at: new Date().toISOString() })
            .eq('id', d.id);
          retried++;
        }
      }
    }

    return Response.json({
      ok: true,
      considered: pending?.length ?? 0,
      sent,
      deferred,
      revoked,
      retried,
      permanently_failed: permanentlyFailed,
    });
  } catch (error) {
    console.error('notification-push-send failed', error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
