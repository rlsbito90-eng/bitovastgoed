// supabase/functions/bito-ical-feed/index.ts
//
// Bito Vastgoed — iCal Feed Edge Function
//
// Genereert een iCalendar (.ics) feed van alle relevante agenda-items:
//   - Bezichtigingen      (deals.bezichtiging_gepland)
//   - Taken-deadlines     (taken.deadline + deadline_tijd)
//   - Follow-ups          (deals.datum_follow_up + follow_up_tijd)
//   - Verwachte closings  (deals.verwachte_closingdatum, all-day)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://bitovastgoed.lovable.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ===================================================================
// iCalendar helpers
// ===================================================================

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function icsDateTimeUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsDate(d: string): string {
  return d.replace(/-/g, '');
}

/**
 * Combineer DATE + TIME (Europe/Amsterdam) → UTC Date.
 * Ruwe DST-benadering: april t/m oktober = +02:00, anders +01:00.
 */
function combineDateTimeAmsterdam(date: string, time: string): Date {
  // Time kan "HH:mm" of "HH:mm:ss" zijn
  const t = time.length === 5 ? `${time}:00` : time;
  const tempDate = new Date(`${date}T${t}Z`); // parse als UTC
  const month = parseInt(date.substring(5, 7), 10);
  const isDst = month >= 4 && month <= 10;
  const offsetMinutes = isDst ? 120 : 60;
  return new Date(tempDate.getTime() - offsetMinutes * 60 * 1000);
}

function makeUid(type: string, id: string): string {
  return `${type}-${id}@bitovastgoed.nl`;
}

interface VEventInput {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  startUtc?: Date;
  endUtc?: Date;
  startDate?: string;
  endDate?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
}

function buildVEvent(e: VEventInput, dtstamp: string): string {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.uid}`);
  lines.push(`DTSTAMP:${dtstamp}`);

  if (e.startUtc && e.endUtc) {
    lines.push(`DTSTART:${icsDateTimeUtc(e.startUtc)}`);
    lines.push(`DTEND:${icsDateTimeUtc(e.endUtc)}`);
  } else if (e.startDate && e.endDate) {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(e.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(e.endDate)}`);
  }

  lines.push(`SUMMARY:${icsEscape(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.status) lines.push(`STATUS:${e.status}`);

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function addOneDay(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().substring(0, 10);
}

// ===================================================================
// Hoofdfunctie
// ===================================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token || token.length < 16) {
      return new Response('Token ontbreekt of ongeldig', { status: 401 });
    }

    // 1. Token valideren
    const { data: tokenRow, error: tokenError } = await supabase
      .from('feed_tokens')
      .select('id, gebruiker_id')
      .eq('token', token)
      .is('ingetrokken_op', null)
      .maybeSingle();

    if (tokenError) {
      console.error('Token lookup error:', tokenError);
      return new Response('Server-fout', { status: 500 });
    }
    if (!tokenRow) {
      return new Response('Ongeldig of ingetrokken token', { status: 401 });
    }

    // 2. laatst_gebruikt updaten (best-effort)
    supabase
      .from('feed_tokens')
      .update({ laatst_gebruikt: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .then(() => {});

    // 3. Data ophalen — vanaf 30 dagen geleden
    const vandaag = new Date();
    const dertigDagenGeleden = new Date(vandaag);
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30);
    const vanafDate = dertigDagenGeleden.toISOString().substring(0, 10);

    // Deals — flat select (geen FK joins, die bestaan niet)
    const { data: deals, error: dealsErr } = await supabase
      .from('deals')
      .select('id, object_id, relatie_id, bezichtiging_gepland, bezichtiging_tijd, datum_follow_up, follow_up_tijd, verwachte_closingdatum, notities, fase')
      .is('soft_deleted_at', null);

    if (dealsErr) console.error('Deals query error:', dealsErr);

    // Taken — flat select
    const { data: taken, error: takenErr } = await supabase
      .from('taken')
      .select('id, titel, notities, deadline, deadline_tijd, prioriteit, status, relatie_id, object_id, deal_id')
      .is('soft_deleted_at', null)
      .gte('deadline', vanafDate)
      .neq('status', 'afgerond');

    if (takenErr) console.error('Taken query error:', takenErr);

    // Verzamel alle benodigde object_ids en relatie_ids
    const objectIds = new Set<string>();
    const relatieIds = new Set<string>();
    for (const d of deals ?? []) {
      if (d.object_id) objectIds.add(d.object_id);
      if (d.relatie_id) relatieIds.add(d.relatie_id);
    }
    for (const t of taken ?? []) {
      if (t.object_id) objectIds.add(t.object_id);
      if (t.relatie_id) relatieIds.add(t.relatie_id);
    }

    // Lookups (objectnaam ipv titel!)
    const objectMap = new Map<string, any>();
    if (objectIds.size > 0) {
      const { data: objs, error: objsErr } = await supabase
        .from('objecten')
        .select('id, objectnaam, adres, postcode, plaats, anoniem, publieke_naam')
        .in('id', Array.from(objectIds));
      if (objsErr) console.error('Objecten query error:', objsErr);
      for (const o of objs ?? []) objectMap.set(o.id, o);
    }

    const relatieMap = new Map<string, any>();
    if (relatieIds.size > 0) {
      const { data: rels, error: relsErr } = await supabase
        .from('relaties')
        .select('id, bedrijfsnaam')
        .in('id', Array.from(relatieIds));
      if (relsErr) console.error('Relaties query error:', relsErr);
      for (const r of rels ?? []) relatieMap.set(r.id, r);
    }

    const objNaam = (o: any) => o?.objectnaam ?? o?.publieke_naam ?? 'Object';

    // 4. iCal opbouwen
    const dtstamp = icsDateTimeUtc(new Date());
    const events: string[] = [];

    // === BEZICHTIGINGEN ===
    for (const d of deals ?? []) {
      if (!d.bezichtiging_gepland) continue;
      const obj = d.object_id ? objectMap.get(d.object_id) : null;
      const rel = d.relatie_id ? relatieMap.get(d.relatie_id) : null;

      const titel = objNaam(obj);
      const relatie = rel?.bedrijfsnaam ?? '';
      const locatie = obj
        ? [obj.adres, obj.postcode, obj.plaats].filter(Boolean).join(', ')
        : undefined;
      const dealUrl = `${APP_BASE_URL}/deals/${d.id}`;

      const summary = `🏠 Bezichtiging — ${titel}${relatie ? ` (${relatie})` : ''}`;
      const description = [
        relatie ? `Relatie: ${relatie}` : null,
        d.fase ? `Fase: ${d.fase}` : null,
        d.notities ? `\n${d.notities}` : null,
        `\nDeal: ${dealUrl}`,
      ].filter(Boolean).join('\n');

      const event: VEventInput = {
        uid: makeUid('bezichtiging', d.id),
        summary,
        description,
        location: locatie,
        url: dealUrl,
        status: 'CONFIRMED',
      };

      if (d.bezichtiging_tijd) {
        const start = combineDateTimeAmsterdam(d.bezichtiging_gepland, d.bezichtiging_tijd);
        const end = new Date(start.getTime() + 90 * 60 * 1000);
        event.startUtc = start;
        event.endUtc = end;
      } else {
        event.startDate = d.bezichtiging_gepland;
        event.endDate = addOneDay(d.bezichtiging_gepland);
      }

      events.push(buildVEvent(event, dtstamp));
    }

    // === FOLLOW-UPS ===
    for (const d of deals ?? []) {
      if (!d.datum_follow_up) continue;
      const obj = d.object_id ? objectMap.get(d.object_id) : null;
      const rel = d.relatie_id ? relatieMap.get(d.relatie_id) : null;

      const titel = objNaam(obj);
      const relatie = rel?.bedrijfsnaam ?? '';
      const locatie = obj
        ? [obj.adres, obj.postcode, obj.plaats].filter(Boolean).join(', ')
        : undefined;
      const dealUrl = `${APP_BASE_URL}/deals/${d.id}`;

      const summary = `📞 Follow-up — ${titel}${relatie ? ` (${relatie})` : ''}`;
      const description = [
        relatie ? `Relatie: ${relatie}` : null,
        d.fase ? `Fase: ${d.fase}` : null,
        `\nDeal: ${dealUrl}`,
      ].filter(Boolean).join('\n');

      const event: VEventInput = {
        uid: makeUid('followup', d.id),
        summary,
        description,
        location: locatie,
        url: dealUrl,
      };

      if (d.follow_up_tijd) {
        const start = combineDateTimeAmsterdam(d.datum_follow_up, d.follow_up_tijd);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        event.startUtc = start;
        event.endUtc = end;
      } else {
        event.startDate = d.datum_follow_up;
        event.endDate = addOneDay(d.datum_follow_up);
      }

      events.push(buildVEvent(event, dtstamp));
    }

    // === CLOSINGS ===
    for (const d of deals ?? []) {
      if (!d.verwachte_closingdatum) continue;
      const obj = d.object_id ? objectMap.get(d.object_id) : null;
      const rel = d.relatie_id ? relatieMap.get(d.relatie_id) : null;

      const titel = objNaam(obj);
      const relatie = rel?.bedrijfsnaam ?? '';
      const locatie = obj
        ? [obj.adres, obj.postcode, obj.plaats].filter(Boolean).join(', ')
        : undefined;
      const dealUrl = `${APP_BASE_URL}/deals/${d.id}`;

      const fase = d.fase ?? '';
      const isAfgerond = fase === 'afgerond';

      const summary = `💼 ${isAfgerond ? 'Closing' : 'Verwachte closing'} — ${titel}${relatie ? ` (${relatie})` : ''}`;
      const description = [
        relatie ? `Relatie: ${relatie}` : null,
        `Fase: ${fase}`,
        `\nDeal: ${dealUrl}`,
      ].filter(Boolean).join('\n');

      events.push(buildVEvent({
        uid: makeUid('closing', d.id),
        summary,
        description,
        location: locatie,
        url: dealUrl,
        startDate: d.verwachte_closingdatum,
        endDate: addOneDay(d.verwachte_closingdatum),
        status: isAfgerond ? 'CONFIRMED' : 'TENTATIVE',
      }, dtstamp));
    }

    // Build deal lookup map (voor taken die aan een deal gekoppeld zijn)
    const dealMap = new Map<string, any>();
    for (const d of deals ?? []) dealMap.set(d.id, d);

    // === TAKEN ===
    for (const t of taken ?? []) {
      if (!t.deadline) continue;
      const rel = t.relatie_id ? relatieMap.get(t.relatie_id) : null;
      let obj = t.object_id ? objectMap.get(t.object_id) : null;
      const deal = t.deal_id ? dealMap.get(t.deal_id) : null;

      // Als taak aan deal gekoppeld is en geen eigen object/relatie heeft, gebruik die van de deal
      if (deal && !obj && deal.object_id) obj = objectMap.get(deal.object_id);
      const dealRel = deal && !rel && deal.relatie_id ? relatieMap.get(deal.relatie_id) : rel;

      const prefix = t.prioriteit === 'urgent' ? '🔴'
        : t.prioriteit === 'hoog' ? '🟠'
        : '⏰';

      const summary = `${prefix} ${t.titel}`;
      const dealUrl = deal ? `${APP_BASE_URL}/deals/${deal.id}` : null;
      const dealTitel = deal ? objNaam(obj) : null;

      const description = [
        dealRel?.bedrijfsnaam ? `Relatie: ${dealRel.bedrijfsnaam}` : null,
        obj ? `Object: ${objNaam(obj)}` : null,
        deal ? `Deal: ${dealTitel}${deal.fase ? ` (${deal.fase})` : ''}` : null,
        t.notities ? `\nNotities:\n${t.notities}` : null,
        dealUrl ? `\n${dealUrl}` : `\n${APP_BASE_URL}/taken`,
      ].filter(Boolean).join('\n');

      const locatie = obj
        ? [obj.adres, obj.plaats].filter(Boolean).join(', ')
        : undefined;

      const event: VEventInput = {
        uid: makeUid('taak', t.id),
        summary,
        description,
        location: locatie,
        url: dealUrl ?? `${APP_BASE_URL}/taken`,
      };

      if (t.deadline_tijd) {
        const start = combineDateTimeAmsterdam(t.deadline, t.deadline_tijd);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        event.startUtc = start;
        event.endUtc = end;
      } else {
        event.startDate = t.deadline;
        event.endDate = addOneDay(t.deadline);
      }

      events.push(buildVEvent(event, dtstamp));
    }

    // 5. Bouw VCALENDAR
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bito Vastgoed//Agenda Feed//NL',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Bito Vastgoed',
      'X-WR-CALDESC:Bezichtigingen, taken, follow-ups en closings',
      'X-WR-TIMEZONE:Europe/Amsterdam',
      'CALSCALE:GREGORIAN',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="bito-vastgoed.ics"',
        'Cache-Control': 'max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Feed error:', err);
    return new Response('Interne fout bij genereren feed', { status: 500 });
  }
});
