import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getRuntimeSecrets(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('notification_runtime_secrets')
    .select('key, value')
    .in('key', keys);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value?.trim() ?? '']));
}

function requestSecret(req: Request): string {
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return req.headers.get('x-cron-secret') ?? bearer;
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

function schoon(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result || null;
}

function relatieLabel(row: any): string | null {
  if (!row) return null;
  const bedrijf = schoon(row.bedrijfsnaam) || schoon(row.organisatie_naam) || schoon(row.naam);
  if (bedrijf) return bedrijf;
  const persoon = [row.voornaam, row.tussenvoegsel, row.achternaam]
    .map(schoon)
    .filter(Boolean)
    .join(' ')
    .trim();
  return persoon || null;
}

function objectLabel(row: any): string | null {
  if (!row) return null;
  return schoon(row.titel)
    || schoon(row.adres)
    || [row.straat, row.huisnummer, row.toevoeging].map(schoon).filter(Boolean).join(' ').trim()
    || null;
}

function signaalLabel(row: any): string | null {
  if (!row) return null;
  const adres = schoon(row.adres) || schoon(row.titel);
  const plaats = schoon(row.plaats);
  if (adres && plaats && !adres.toLocaleLowerCase('nl-NL').includes(plaats.toLocaleLowerCase('nl-NL'))) {
    return `${adres} · ${plaats}`;
  }
  return adres || plaats || null;
}

function datumSleutel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function lokaleDatumTijd(deadline: string, deadlineTijd: string | null, timeZone: string): Date | null {
  if (!deadline) return null;
  const tijd = deadlineTijd ? deadlineTijd.slice(0, 5) : '12:00';
  // CRM is momenteel Europe/Amsterdam-gecentreerd. Voor presentatielabels is de bronwaarde
  // leidend; de datumvergelijking gebruikt Intl in de ingestelde timezone.
  const parsed = new Date(`${deadline}T${tijd}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function taakTijdLabel(task: any, event: any, timeZone: string): string | null {
  const deadline = schoon(task?.deadline) || schoon(event?.metadata?.deadline);
  const deadlineTijd = schoon(task?.deadline_tijd) || schoon(event?.metadata?.deadline_tijd);
  if (!deadline) return null;

  const today = datumSleutel(new Date(), timeZone);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = datumSleutel(tomorrowDate, timeZone);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = datumSleutel(yesterdayDate, timeZone);

  const tijd = deadlineTijd ? deadlineTijd.slice(0, 5) : null;
  const eventType = schoon(event?.event_type);
  const isOverdue = eventType === 'task_overdue' || deadline < today;

  if (deadline === today) {
    if (isOverdue) return tijd ? `Vandaag sinds ${tijd} te laat` : 'Vandaag te laat';
    return tijd ? `Vandaag om ${tijd}` : 'Vandaag';
  }
  if (deadline === tomorrow) return tijd ? `Morgen om ${tijd}` : 'Morgen';
  if (deadline === yesterday) return tijd ? `Gisteren sinds ${tijd} te laat` : 'Sinds gisteren te laat';

  const parsed = lokaleDatumTijd(deadline, deadlineTijd, timeZone);
  if (!parsed) return tijd ? `${deadline} om ${tijd}` : deadline;
  const datumLabel = new Intl.DateTimeFormat('nl-NL', {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(parsed);
  if (isOverdue) return tijd ? `Sinds ${datumLabel} ${tijd} te laat` : `Sinds ${datumLabel} te laat`;
  return tijd ? `${datumLabel} om ${tijd}` : datumLabel;
}

function taakPushPresentatie(
  event: any,
  task: any,
  context: { relatie?: any; object?: any; signaal?: any },
  timeZone: string,
): { title: string; body: string } {
  const title = schoon(task?.titel) || schoon(event?.title) || 'Taak';
  const contextParts: string[] = [];
  const pand = signaalLabel(context.signaal) || objectLabel(context.object);
  const relatie = relatieLabel(context.relatie);
  if (pand) contextParts.push(pand);
  if (relatie && !contextParts.includes(relatie)) contextParts.push(relatie);

  const tijdLabel = taakTijdLabel(task, event, timeZone);
  const regels = [] as string[];
  if (contextParts.length) regels.push(contextParts.join(' · '));
  if (tijdLabel) regels.push(tijdLabel);

  // Geen technische/Engelse fallback als er task-context beschikbaar is.
  // Alleen bij ontbrekende brondata gebruiken we de bestaande eventtekst.
  return {
    title,
    body: regels.join('\n') || schoon(event?.body) || '',
  };
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
    const secrets = await getRuntimeSecrets(['cron_secret', 'vapid_public_key', 'vapid_private_key', 'vapid_subject']);
    if (!secrets.cron_secret || requestSecret(req) !== secrets.cron_secret) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (!secrets.vapid_public_key || !secrets.vapid_private_key) {
      return Response.json({ ok: false, error: 'VAPID keys ontbreken' }, { status: 503 });
    }

    webpush.setVapidDetails(
      secrets.vapid_subject || 'mailto:info@bitovastgoed.nl',
      secrets.vapid_public_key,
      secrets.vapid_private_key,
    );

    const nowIso = new Date().toISOString();
    const { data: pending, error: pendingError } = await supabase
      .from('notification_deliveries')
      .select('id, notification_event_id, subscription_id, retry_count, available_at')
      .is('sent_at', null)
      .is('failed_at', null)
      .lt('retry_count', 3)
      .lte('available_at', nowIso)
      .order('available_at', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(100);
    if (pendingError) throw pendingError;

    const eventIds = Array.from(new Set((pending ?? []).map((d: any) => d.notification_event_id)));
    const subscriptionIds = Array.from(new Set((pending ?? []).map((d: any) => d.subscription_id)));

    const { data: events, error: eventsError } = eventIds.length
      ? await supabase
          .from('notification_events')
          .select('id, user_id, event_type, source_type, source_id, title, body, href, priority, occurrence_key, scheduled_at, resolved_at, dismissed_at, metadata')
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

    const taakIds = Array.from(new Set(
      (events ?? [])
        .filter((e: any) => e.source_type === 'taak' && e.source_id)
        .map((e: any) => e.source_id),
    ));
    const { data: tasks, error: taskError } = taakIds.length
      ? await supabase
          .from('taken')
          .select('id, titel, deadline, deadline_tijd, relatie_id, object_id, off_market_signaal_id')
          .in('id', taakIds)
      : { data: [], error: null } as any;
    if (taskError) throw taskError;

    const relatieIds = Array.from(new Set((tasks ?? []).map((t: any) => t.relatie_id).filter(Boolean)));
    const objectIds = Array.from(new Set((tasks ?? []).map((t: any) => t.object_id).filter(Boolean)));
    const signaalIds = Array.from(new Set((tasks ?? []).map((t: any) => t.off_market_signaal_id).filter(Boolean)));

    const [{ data: relaties, error: relatiesError }, { data: objecten, error: objectenError }, { data: signalen, error: signalenError }] = await Promise.all([
      relatieIds.length ? supabase.from('relaties').select('*').in('id', relatieIds) : Promise.resolve({ data: [], error: null } as any),
      objectIds.length ? supabase.from('objecten').select('*').in('id', objectIds) : Promise.resolve({ data: [], error: null } as any),
      signaalIds.length ? supabase.from('off_market_signalen').select('id, adres, plaats, titel').in('id', signaalIds) : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (relatiesError) throw relatiesError;
    if (objectenError) throw objectenError;
    if (signalenError) throw signalenError;

    const eventMap = new Map((events ?? []).map((e: any) => [e.id, e]));
    const subMap = new Map((subscriptions ?? []).map((s: any) => [s.id, s]));
    const prefMap = new Map((preferences ?? []).map((p: any) => [p.user_id, p]));
    const taskMap = new Map((tasks ?? []).map((t: any) => [t.id, t]));
    const relatieMap = new Map((relaties ?? []).map((r: any) => [r.id, r]));
    const objectMap = new Map((objecten ?? []).map((o: any) => [o.id, o]));
    const signaalMap = new Map((signalen ?? []).map((s: any) => [s.id, s]));

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

      // Defense in depth: available_at is leidend, maar een event met een latere
      // scheduled_at mag nooit door een inconsistente delivery te vroeg worden verzonden.
      if (event.scheduled_at && new Date(event.scheduled_at).getTime() > Date.now()) {
        deferred++;
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

      let pushTitle = event.title;
      let pushBody = event.body || '';
      if (event.source_type === 'taak') {
        const task: any = taskMap.get(event.source_id);
        if (task) {
          const presentatie = taakPushPresentatie(
            event,
            task,
            {
              relatie: task.relatie_id ? relatieMap.get(task.relatie_id) : null,
              object: task.object_id ? objectMap.get(task.object_id) : null,
              signaal: task.off_market_signaal_id ? signaalMap.get(task.off_market_signaal_id) : null,
            },
            pref?.timezone || 'Europe/Amsterdam',
          );
          pushTitle = presentatie.title;
          pushBody = presentatie.body;
        }
      }

      const payload = JSON.stringify({
        title: pushTitle,
        body: pushBody,
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