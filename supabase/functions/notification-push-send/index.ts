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

function relatieLabel(row: any, primaireContactNaam?: string | null): string | null {
  if (!row) return null;
  const bedrijf = schoon(row.bedrijfsnaam) || schoon(row.organisatie_naam) || schoon(row.naam);
  if (bedrijf) return bedrijf;
  const persoon = [row.voornaam, row.tussenvoegsel, row.achternaam]
    .map(schoon)
    .filter(Boolean)
    .join(' ')
    .trim();
  // CRM-relaties kunnen alleen in relatie_contactpersonen een naam hebben.
  return persoon || schoon(row.contactpersoon) || schoon(primaireContactNaam) || null;
}

function objectLabel(row: any): string | null {
  if (!row) return null;
  // Het CRM bewaart de herkenbare objectnaam in 'objectnaam', ook wanneer
  // de adresvelden leeg zijn (bijvoorbeeld Bedrijfspand Veendam).
  // 'titel' was alleen de legacy-fallback en is geen DB-kolom in objecten.
  return schoon(row.objectnaam)
    || schoon(row.publieke_naam)
    || schoon(row.adres)
    || schoon(row.titel)
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

function compacteTaakCategorie(task: any, event: any): string {
  const titel = (schoon(task?.titel) || schoon(event?.title) || '').toLocaleLowerCase('nl-NL');
  const type = (schoon(task?.type_taak) || '').toLocaleLowerCase('nl-NL');
  const samen = `${type} ${titel}`.trim();

  const isBrief = /\bbrief\b/.test(samen);
  const isOpvolging = /opvolg|follow[- ]?up/.test(samen);
  if (isBrief && isOpvolging) return 'Brief opvolgen';
  if (isBrief) return 'Brief voorbereiden';
  if (/\bbel(?:len|afspraak)?\b|telefoon|telefonisch|\bcall\b/.test(samen)) return 'Bellen';
  if (isOpvolging) return 'Opvolging';
  return 'Taak';
}

/** Gebruik het werkplan bij planningsmeldingen, nooit een eventuele andere deadline. */
function taakTimingLabel(event: any, task: any, timeZone: string): string | null {
  const type = schoon(event?.event_type);
  const today = datumSleutel(new Date(), timeZone);
  // Kalenderdag rekenen voorkomt zomer-/wintertijdverschuivingen rond middernacht.
  const [year, month, day] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const dateLabel = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
  };

  if (type === 'task_plan_reminder') {
    const date = schoon(event?.metadata?.plan_datum);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (date === today) return 'Vandaag gepland';
    if (date === tomorrow) return 'Morgen gepland';
    return `Gepland ${dateLabel(date)}`;
  }

  if (type === 'task_overdue') return 'Deadline verstreken';
  if (type === 'task_reminder' || type === 'task_due_today') {
    const date = schoon(task?.deadline) || schoon(event?.metadata?.deadline);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (date < today) return 'Deadline verstreken';
    if (date === today) return 'Deadline vandaag';
    if (date === tomorrow) return 'Deadline morgen';
    return `Deadline ${dateLabel(date)}`;
  }

  return null;
}

function verkortPushRegel(value: string, max = 76): string {
  const schoonValue = value.replace(/\s+/g, ' ').trim();
  if (schoonValue.length <= max) return schoonValue;
  return `${schoonValue.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function taakPushPresentatie(
  event: any,
  task: any,
  context: { relatie?: any; object?: any; signaal?: any; primaireContactNaam?: string | null },
  timeZone: string,
): { title: string; body: string } {
  const bronTitel = schoon(task?.titel) || schoon(event?.title) || 'Taak';
  const categorie = compacteTaakCategorie(task, event);
  const timing = taakTimingLabel(event, task, timeZone);
  const title = timing ? `${categorie} · ${timing}` : categorie;

  // De concrete taak staat altijd vooraan. Dat blijft nodig wanneer de kop
  // alleen de categorie 'Bellen' of 'Opvolging' bevat.
  const regels = [verkortPushRegel(bronTitel, 96)];
  const contextParts: string[] = [];
  const pand = objectLabel(context.object) || signaalLabel(context.signaal);
  const relatie = relatieLabel(context.relatie, context.primaireContactNaam);
  if (pand) contextParts.push(pand);
  if (relatie && !contextParts.some(deel => deel.toLocaleLowerCase('nl-NL') === relatie.toLocaleLowerCase('nl-NL'))) {
    contextParts.push(relatie);
  }
  if (contextParts.length) {
    regels.push(verkortPushRegel(contextParts.join(' · '), 96));
  }

  return {
    title,
    body: regels.filter(Boolean).join('\n') || schoon(event?.body) || '',
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
          .select('id, titel, type_taak, deadline, deadline_tijd, relatie_id, object_id, off_market_signaal_id')
          .in('id', taakIds)
      : { data: [], error: null } as any;
    if (taskError) throw taskError;

    const relatieIds = Array.from(new Set((tasks ?? []).map((t: any) => t.relatie_id).filter(Boolean)));
    const objectIds = Array.from(new Set((tasks ?? []).map((t: any) => t.object_id).filter(Boolean)));
    const signaalIds = Array.from(new Set((tasks ?? []).map((t: any) => t.off_market_signaal_id).filter(Boolean)));

    const [
      { data: relaties, error: relatiesError },
      { data: objecten, error: objectenError },
      { data: signalen, error: signalenError },
      { data: contactpersonen, error: contactpersonenError },
    ] = await Promise.all([
      relatieIds.length ? supabase.from('relaties').select('*').in('id', relatieIds) : Promise.resolve({ data: [], error: null } as any),
      objectIds.length ? supabase.from('objecten').select('*').in('id', objectIds) : Promise.resolve({ data: [], error: null } as any),
      signaalIds.length ? supabase.from('off_market_signalen').select('id, adres, plaats, titel').in('id', signaalIds) : Promise.resolve({ data: [], error: null } as any),
      relatieIds.length
        ? supabase.from('relatie_contactpersonen')
          .select('relatie_id, naam, is_primair')
          .in('relatie_id', relatieIds)
          .order('is_primair', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (relatiesError) throw relatiesError;
    if (objectenError) throw objectenError;
    if (signalenError) throw signalenError;
    if (contactpersonenError) throw contactpersonenError;

    const eventMap = new Map((events ?? []).map((e: any) => [e.id, e]));
    const subMap = new Map((subscriptions ?? []).map((s: any) => [s.id, s]));
    const prefMap = new Map((preferences ?? []).map((p: any) => [p.user_id, p]));
    const taskMap = new Map((tasks ?? []).map((t: any) => [t.id, t]));
    const relatieMap = new Map((relaties ?? []).map((r: any) => [r.id, r]));
    // Primair eerst; bij oude data zonder primaire markering het eerste bruikbare contact.
    const primaireContactMap = new Map<string, string>();
    for (const contact of contactpersonen ?? []) {
      const naam = schoon(contact.naam);
      if (naam && !primaireContactMap.has(contact.relatie_id)) {
        primaireContactMap.set(contact.relatie_id, naam);
      }
    }
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
              primaireContactNaam: task.relatie_id ? primaireContactMap.get(task.relatie_id) : null,
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
