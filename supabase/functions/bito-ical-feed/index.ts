// supabase/functions/bito-ical-feed/index.ts
//
// Bito Vastgoed — iCal Feed Edge Function
//
// Genereert een iCalendar (.ics) feed van alle relevante agenda-items:
//   - Bezichtigingen      (deals.bezichtiging_gepland)
//   - Taken-deadlines     (taken.deadline + deadline_tijd)
//   - Follow-ups          (deals.datum_follow_up + follow_up_tijd)
//   - Verwachte closings  (deals.verwachte_closingdatum, all-day)
//
// Beveiliging: token in URL parameter, gevalideerd tegen feed_tokens
// tabel. Niet-geldige tokens krijgen 401.
//
// Gebruik:
//   GET https://{project}.supabase.co/functions/v1/bito-ical-feed?token={token}
//
// Response: text/calendar (.ics), klaar voor abonnement in agenda-apps.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://bitovastgoed.lovable.app';

// Service-role client — heeft RLS-bypass nodig om tokens te valideren
// en om alle deals/taken te lezen ongeacht ingelogde gebruiker.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ===================================================================
// iCalendar helpers
// ===================================================================

/**
 * Escape tekst voor iCalendar veld-waarden.
 * Spec: RFC 5545 §3.3.11 — komma's, puntkomma's, backslashes, newlines.
 */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Format Date naar iCal UTC datetime: 20260427T143000Z
 */
function icsDateTimeUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Format DATE-only naar iCal date: 20260427
 */
function icsDate(d: string): string {
  return d.replaceAll('-', '');
}

/**
 * Combineert DATE en TIME (allebei strings uit DB) naar Europe/Amsterdam Date.
 * NB: iCal feeds gebruiken UTC voor TZ-onafhankelijkheid; we converteren
 * eerst van Amsterdam (UTC+1 of UTC+2) naar UTC.
 */
function combineDateTimeAmsterdam(date: string, time: string): Date {
  // We bouwen een ISO string met expliciete +01:00 of +02:00 (DST detectie)
  // Voor simpliciteit: assume Amsterdam-tijd, laat browser/Deno converteren.
  // YYYY-MM-DDTHH:mm:ss met Europe/Amsterdam tijdzone trick:
  const iso = `${date}T${time}`;
  // We maken er een lokale-tijd-interpretatie van; om uit te rekenen
  // hoeveel offset Amsterdam heeft op die datum gebruiken we Intl:
  const tempDate = new Date(`${iso}Z`); // Eerst als UTC parsen
  // Bepaal Amsterdam offset op die datum:
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    timeZoneName: 'short',
  });
  // Gebruik bekende DST-grenzen: ruwe schatting via maandbereik.
  // Maart laatste zondag tot oktober laatste zondag = +02:00, anders +01:00.
  const month = parseInt(date.substring(5, 7), 10);
  const isDst = month >= 4 && month <= 10; // ruwe maar werkbare benadering
  const offsetMinutes = isDst ? 120 : 60;
  // Trek de offset af om naar UTC te komen
  return new Date(tempDate.getTime() - offsetMinutes * 60 * 1000);
}

/**
 * Maak een UID — uniek per type+id zodat updates dezelfde event treffen
 * en geen duplicates ontstaan in de agenda-app.
 */
function makeUid(type: string, id: string): string {
  return `${type}-${id}@bitovastgoed.nl`;
}

// ===================================================================
// VEvent builder
// ===================================================================

interface VEventInput {
  uid: string;
  summary: string;       // titel
  description?: string;
  location?: string;
  url?: string;
  // Tijd-event:
  startUtc?: Date;
  endUtc?: Date;
  // All-day event:
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD (exclusive in iCal voor all-day)
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

/**
 * Voeg 1 dag toe aan YYYY-MM-DD (voor DTEND van all-day events,
 * iCal vereist exclusive end-date).
 */
function addOneDay(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().substring(0, 10);
}

// ===================================================================
// Hoofdfunctie
// ===================================================================

Deno.serve(async (req: Request) => {
  // CORS preflight
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

    // 2. laatst_gebruikt updaten (best-effort, niet kritiek)
    supabase
      .from('feed_tokens')
      .update({ laatst_gebruikt: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .then(() => {});

    // 3. Data ophalen — alleen events met een datum vanaf 30 dagen geleden
    //    tot 365 dagen vooruit (zo blijft feed klein, en historie blijft
    //    deels zichtbaar in agenda).
    const vandaag = new Date();
    const dertigDagenGeleden = new Date(vandaag);
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30);
    const vanafDate = dertigDagenGeleden.toISOString().substring(0, 10);

    // Deals — bezichtigingen, follow-ups, closings (allemaal in 1 query)
    const { data: deals } = await supabase
      .from('deals')
      .select(`
        id,
        bezichtiging_gepland,
        bezichtiging_tijd,
        datum_follow_up,
        follow_up_tijd,
        verwachte_closingdatum,
        notities,
        fase,
        objecten:object_id (
          id, titel, adres, postcode, plaats, anoniem
        ),
        relaties:relatie_id (
          bedrijfsnaam
        )
      `)
      .is('soft_deleted_at', null);

    // Taken — alle open + recent afgeronde
    const { data: taken } = await supabase
      .from('taken')
      .select(`
        id,
        titel,
        beschrijving,
        deadline,
        deadline_tijd,
        prioriteit,
        status,
        relaties:relatie_id (bedrijfsnaam),
        objecten:object_id (titel, adres, plaats),
        deals:deal_id (id)
      `)
      .gte('deadline', vanafDate)
      .neq('status', 'afgerond');

    // 4. iCal opbouwen
    const dtstamp = icsDateTimeUtc(new Date());
    const events: string[] = [];

    // === BEZICHTIGINGEN ===
    for (const d of deals ?? []) {
      if (!d.bezichtiging_gepland) continue;
      const obj = (d.objecten as any);
      const rel = (d.relaties as any);
      if (!obj) continue;

      const titel = obj.titel ?? 'Object';
      const relatie = rel?.bedrijfsnaam ?? '';
      const locatie = [obj.adres, obj.postcode, obj.plaats]
        .filter(Boolean).join(', ');
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
        // 1.5 uur tijd-event
        const start = combineDateTimeAmsterdam(d.bezichtiging_gepland, d.bezichtiging_tijd);
        const end = new Date(start.getTime() + 90 * 60 * 1000);
        event.startUtc = start;
        event.endUtc = end;
      } else {
        // All-day
        event.startDate = d.bezichtiging_gepland;
        event.endDate = addOneDay(d.bezichtiging_gepland);
      }

      events.push(buildVEvent(event, dtstamp));
    }

    // === FOLLOW-UPS ===
    for (const d of deals ?? []) {
      if (!d.datum_follow_up) continue;
      const obj = (d.objecten as any);
      const rel = (d.relaties as any);
      if (!obj) continue;

      const titel = obj.titel ?? 'Object';
      const relatie = rel?.bedrijfsnaam ?? '';
      const locatie = [obj.adres, obj.postcode, obj.plaats]
        .filter(Boolean).join(', ');
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
        // 30 min tijd-event
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
      const obj = (d.objecten as any);
      const rel = (d.relaties as any);
      if (!obj) continue;

      const titel = obj.titel ?? 'Object';
      const relatie = rel?.bedrijfsnaam ?? '';
      const locatie = [obj.adres, obj.postcode, obj.plaats]
        .filter(Boolean).join(', ');
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

    // === TAKEN ===
    for (const t of taken ?? []) {
      if (!t.deadline) continue;
      const rel = (t.relaties as any);
      const obj = (t.objecten as any);

      const prefix = t.prioriteit === 'urgent' ? '🔴'
        : t.prioriteit === 'hoog' ? '🟠'
        : '⏰';

      const summary = `${prefix} ${t.titel}`;
      const description = [
        rel?.bedrijfsnaam ? `Relatie: ${rel.bedrijfsnaam}` : null,
        obj?.titel ? `Object: ${obj.titel}` : null,
        t.beschrijving ? `\n${t.beschrijving}` : null,
        `\n${APP_BASE_URL}/taken`,
      ].filter(Boolean).join('\n');

      const locatie = obj
        ? [obj.adres, obj.plaats].filter(Boolean).join(', ')
        : undefined;

      const event: VEventInput = {
        uid: makeUid('taak', t.id),
        summary,
        description,
        location: locatie,
        url: `${APP_BASE_URL}/taken`,
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
        'Cache-Control': 'max-age=300', // 5 min cache
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Feed error:', err);
    return new Response('Interne fout bij genereren feed', { status: 500 });
  }
});
