// supabase/functions/bito-ical-feed/index.ts
// Bito Vastgoed — iCal feed
//
// Semantisch contract:
// - afspraken blijven domeinevents;
// - prognoses blijven TENTATIVE agenda-items;
// - echte gebruikersacties komen primair uit centrale taken;
// - legacy follow-up/volgende-actievelden zijn uitsluitend agenda-fallback zolang
//   nog geen canonieke source-bound taak bestaat.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://bitovastgoed.vercel.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ACTIVE_TASK_STATUSES = ['open', 'in_uitvoering', 'wacht_op_reactie'];
const CLOSED_VASTGOEDKANS_STATUSES = new Set(['afgevallen', 'gepromoveerd']);

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

function addOneDay(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Zet een lokale Europe/Amsterdam datum+tijd exact om naar UTC.
 * Geen hard-coded zomer-/wintertijdmaanden: Intl bepaalt de echte timezone-offset,
 * inclusief overgangsdagen.
 */
function combineDateTimeAmsterdam(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number);
  if (!year || !month || !day) throw new Error(`Ongeldige datum: ${date}`);

  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = desiredAsUtc;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });

  // Twee iteraties zijn voldoende om de timezone-offset rond DST-overgangen
  // correct te convergeren voor bestaande geldige lokale CRM-tijden.
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const renderedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    candidate += desiredAsUtc - renderedAsUtc;
  }
  return new Date(candidate);
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
  const lines: string[] = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`];
  if (e.startUtc && e.endUtc) {
    lines.push(`DTSTART:${icsDateTimeUtc(e.startUtc)}`, `DTEND:${icsDateTimeUtc(e.endUtc)}`);
  } else if (e.startDate && e.endDate) {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(e.startDate)}`, `DTEND;VALUE=DATE:${icsDate(e.endDate)}`);
  }
  lines.push(`SUMMARY:${icsEscape(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.status) lines.push(`STATUS:${e.status}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function timedOrAllDay(
  base: Omit<VEventInput, 'startUtc' | 'endUtc' | 'startDate' | 'endDate'>,
  date: string,
  time: string | null | undefined,
  durationMinutes: number,
): VEventInput {
  if (!time) return { ...base, startDate: date, endDate: addOneDay(date) };
  const start = combineDateTimeAmsterdam(date, time);
  return { ...base, startUtc: start, endUtc: new Date(start.getTime() + durationMinutes * 60_000) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }});
  }

  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token || token.length < 16) return new Response('Token ontbreekt of ongeldig', { status: 401 });

    const { data: tokenRow, error: tokenError } = await supabase
      .from('feed_tokens').select('id, gebruiker_id').eq('token', token)
      .is('ingetrokken_op', null).maybeSingle();
    if (tokenError) return new Response('Server-fout', { status: 500 });
    if (!tokenRow) return new Response('Ongeldig of ingetrokken token', { status: 401 });

    supabase.from('feed_tokens').update({ laatst_gebruikt: new Date().toISOString() })
      .eq('id', tokenRow.id).then(() => {});

    const grens = new Date();
    grens.setDate(grens.getDate() - 30);
    const vanafDate = grens.toISOString().slice(0, 10);

    const [dealRes, taakRes, pipelineRes, ndaRes, kansRes] = await Promise.all([
      supabase.from('deals')
        .select('id, object_id, relatie_id, bezichtiging_gepland, bezichtiging_tijd, datum_follow_up, follow_up_tijd, verwachte_closingdatum, notities, fase')
        .is('soft_deleted_at', null),
      supabase.from('taken')
        .select('id, titel, notities, deadline, deadline_tijd, prioriteit, status, relatie_id, object_id, deal_id, vastgoedkans_id, source_kind, source_id, source_slot')
        .is('soft_deleted_at', null).gte('deadline', vanafDate).in('status', ACTIVE_TASK_STATUSES),
      supabase.from('object_pipeline')
        .select('id, object_id, relatie_id, pipeline_fase, interesse_niveau, bezichtiging_datum, volgende_actie, volgende_actie_datum, volgende_actie_omschrijving, gewenste_levering, notities')
        .is('soft_deleted_at', null),
      supabase.from('relaties')
        .select('id, bedrijfsnaam, nda_datum').is('soft_deleted_at', null)
        .not('nda_datum', 'is', null).gte('nda_datum', vanafDate),
      // Geen archived_at-filter: dat veld bestaat niet in het actuele DB-contract.
      // Afgesloten dossiers worden semantisch op status uitgesloten in de eventloop.
      supabase.from('vastgoedkansen')
        .select('id, kansnummer, adres, postcode, plaats, korte_omschrijving, status, eigenaar_naam, volgende_actie_datum, volgende_actie_omschrijving, opvolgdatum, opvolgactie')
        .or(`volgende_actie_datum.gte.${vanafDate},opvolgdatum.gte.${vanafDate}`),
    ]);

    if (dealRes.error) console.error('Deals query error:', dealRes.error);
    if (taakRes.error) console.error('Taken query error:', taakRes.error);
    if (pipelineRes.error) console.error('Pipeline query error:', pipelineRes.error);
    if (ndaRes.error) console.error('NDA query error:', ndaRes.error);
    if (kansRes.error) console.error('Vastgoedkansen query error:', kansRes.error);

    const deals = dealRes.data ?? [];
    const taken = taakRes.data ?? [];
    const pipeline = pipelineRes.data ?? [];
    const ndaRelaties = ndaRes.data ?? [];
    const vastgoedkansen = kansRes.data ?? [];

    const objectIds = new Set<string>();
    const relatieIds = new Set<string>();
    for (const row of [...deals, ...pipeline]) {
      if ((row as any).object_id) objectIds.add((row as any).object_id);
      if ((row as any).relatie_id) relatieIds.add((row as any).relatie_id);
    }
    for (const t of taken) {
      if (t.object_id) objectIds.add(t.object_id);
      if (t.relatie_id) relatieIds.add(t.relatie_id);
    }
    for (const r of ndaRelaties) relatieIds.add(r.id);

    const [objRes, relRes, cpRes] = await Promise.all([
      objectIds.size ? supabase.from('objecten')
        .select('id, objectnaam, adres, postcode, plaats, anoniem, publieke_naam')
        .in('id', [...objectIds]) : Promise.resolve({ data: [], error: null } as any),
      relatieIds.size ? supabase.from('relaties')
        .select('id, bedrijfsnaam, contactpersoon, email, telefoon, type_partij')
        .in('id', [...relatieIds]) : Promise.resolve({ data: [], error: null } as any),
      relatieIds.size ? supabase.from('relatie_contactpersonen')
        .select('relatie_id, naam, email, telefoon, telefoon_mobiel, is_primair, created_at')
        .in('relatie_id', [...relatieIds]).order('is_primair', { ascending: false })
        .order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null } as any),
    ]);

    const objectMap = new Map((objRes.data ?? []).map((o: any) => [o.id, o]));
    const relatieMap = new Map((relRes.data ?? []).map((r: any) => [r.id, r]));
    const primaryCpMap = new Map<string, any>();
    for (const c of cpRes.data ?? []) if (!primaryCpMap.has(c.relatie_id)) primaryCpMap.set(c.relatie_id, c);

    const PLACEHOLDER = new Set(['onbekend', 'onbekende relatie', 'naamloos', '-', '–']);
    const cleanStr = (v: any): string => {
      const s = (v ?? '').toString().trim();
      return !s || PLACEHOLDER.has(s.toLowerCase()) ? '' : s;
    };
    const relName = (r: any): string => {
      if (!r) return '';
      const cp = primaryCpMap.get(r.id);
      const naam = cleanStr(cp?.naam) || cleanStr(r.contactpersoon);
      const bedrijf = cleanStr(r.bedrijfsnaam);
      if (naam && bedrijf) return `${naam} · ${bedrijf}`;
      return naam || bedrijf || cleanStr(r.email) || cleanStr(cp?.email) || cleanStr(r.telefoon) || cleanStr(cp?.telefoon) || '';
    };
    const objNaam = (o: any) => o?.objectnaam ?? o?.publieke_naam ?? 'Object';
    const humanize = (s?: string | null) => cleanStr(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const buildAgendaTitle = (actie: string, naam: string, object: string): string => {
      const onderwerp = [naam, object].filter(Boolean).join(' · ');
      return actie && onderwerp ? `${actie} — ${onderwerp}` : actie || onderwerp || 'Agenda-item';
    };
    const descLines = (...rows: Array<[string, string | null | undefined]>) =>
      rows.filter(([, v]) => cleanStr(v)).map(([k, v]) => `${k}: ${v}`).join('\n');

    // Canonieke source-bound taak wint van een legacy domeinveld, ongeacht of de
    // legacy datum exact gelijk is. Hierdoor blijft wijzigen van datum/tijd 1 event.
    const canonicalSourceSlots = new Set(
      taken.filter((t: any) => t.source_kind && t.source_id && t.source_slot)
        .map((t: any) => `${t.source_kind}|${t.source_id}|${t.source_slot}`),
    );
    const hasCanonical = (kind: string, id: string, slot: string) =>
      canonicalSourceSlots.has(`${kind}|${id}|${slot}`);

    const dtstamp = icsDateTimeUtc(new Date());
    const events: string[] = [];

    // Deal-afspraken en deal-prognoses.
    for (const d of deals) {
      const obj = d.object_id ? objectMap.get(d.object_id) : null;
      const rel = d.relatie_id ? relatieMap.get(d.relatie_id) : null;
      const titel = objNaam(obj);
      const relatie = relName(rel);
      const locatie = obj ? [obj.adres, obj.postcode, obj.plaats].filter(Boolean).join(', ') : undefined;
      const dealUrl = `${APP_BASE_URL}/deals/${d.id}`;

      if (d.bezichtiging_gepland) {
        events.push(buildVEvent(timedOrAllDay({
          uid: makeUid('bezichtiging', d.id),
          summary: `🏠 ${buildAgendaTitle('Bezichtiging', relatie, titel)}`,
          description: [descLines(['Relatie', relatie], ['Object', titel], ['Fase', humanize(d.fase)]), d.notities, `Deal: ${dealUrl}`].filter(Boolean).join('\n'),
          location: locatie, url: dealUrl, status: 'CONFIRMED',
        }, d.bezichtiging_gepland, d.bezichtiging_tijd, 90), dtstamp));
      }

      // Legacy fallback: zodra de canonieke deal-follow-up-taak bestaat, publiceert
      // alleen TAKEN het agenda-item.
      if (d.datum_follow_up && !hasCanonical('deal', d.id, 'follow_up')) {
        events.push(buildVEvent(timedOrAllDay({
          uid: makeUid('followup', d.id),
          summary: `📞 ${buildAgendaTitle('Follow-up', relatie, titel)}`,
          description: [descLines(['Relatie', relatie], ['Object', titel], ['Fase', humanize(d.fase)]), `Deal: ${dealUrl}`].filter(Boolean).join('\n'),
          location: locatie, url: dealUrl,
        }, d.datum_follow_up, d.follow_up_tijd, 30), dtstamp));
      }

      if (d.verwachte_closingdatum) {
        const bevestigd = d.fase === 'afgerond';
        events.push(buildVEvent({
          uid: makeUid('closing', d.id),
          summary: `💼 ${buildAgendaTitle(bevestigd ? 'Closing' : 'Verwachte closing', relatie, titel)}`,
          description: [descLines(['Relatie', relatie], ['Object', titel], ['Fase', humanize(d.fase)]), `Deal: ${dealUrl}`].filter(Boolean).join('\n'),
          location: locatie, url: dealUrl,
          startDate: d.verwachte_closingdatum, endDate: addOneDay(d.verwachte_closingdatum),
          status: bevestigd ? 'CONFIRMED' : 'TENTATIVE',
        }, dtstamp));
      }
    }

    const dealMap = new Map(deals.map((d: any) => [d.id, d]));

    // Centrale taken: enige primaire agenda-bron voor echte gebruikersacties.
    for (const t of taken) {
      if (!t.deadline) continue;
      const deal: any = t.deal_id ? dealMap.get(t.deal_id) : null;
      let obj: any = t.object_id ? objectMap.get(t.object_id) : null;
      if (!obj && deal?.object_id) obj = objectMap.get(deal.object_id);
      const rel: any = t.relatie_id ? relatieMap.get(t.relatie_id) : (deal?.relatie_id ? relatieMap.get(deal.relatie_id) : null);
      const prefix = t.prioriteit === 'urgent' ? '🔴' : t.prioriteit === 'hoog' ? '🟠' : '⏰';
      const url = deal ? `${APP_BASE_URL}/deals/${deal.id}` : `${APP_BASE_URL}/taken`;
      const location = obj ? [obj.adres, obj.plaats].filter(Boolean).join(', ') : undefined;
      events.push(buildVEvent(timedOrAllDay({
        uid: makeUid('taak', t.id), summary: `${prefix} ${t.titel}`,
        description: [relName(rel) ? `Relatie: ${relName(rel)}` : null, obj ? `Object: ${objNaam(obj)}` : null, t.notities, url].filter(Boolean).join('\n'),
        location, url,
      }, t.deadline, t.deadline_tijd, 30), dtstamp));
    }

    // Vastgoedkans-acties: expliciete actie of legacy opvolgdatum is fallback.
    for (const k of vastgoedkansen) {
      if (CLOSED_VASTGOEDKANS_STATUSES.has(k.status)) continue;
      const explicieteDatum = k.volgende_actie_datum ?? null;
      const legacyDatum = !explicieteDatum ? (k.opvolgdatum ?? null) : null;
      const actieDatum = explicieteDatum ?? legacyDatum;
      if (!actieDatum || actieDatum < vanafDate) continue;
      if (explicieteDatum && hasCanonical('vastgoedkans', k.id, 'volgende_actie')) continue;
      if ((taken as any[]).some((t) => t.vastgoedkans_id === k.id && t.deadline === actieDatum)) continue;

      const actie = (explicieteDatum ? cleanStr(k.volgende_actie_omschrijving) : cleanStr(k.opvolgactie)) || 'Vastgoedkans opvolgen';
      const dossierTitel = cleanStr(k.korte_omschrijving) || [k.adres, k.postcode, k.plaats].filter(Boolean).join(', ') || cleanStr(k.kansnummer) || 'Vastgoedkans';
      const url = `${APP_BASE_URL}/vastgoedkansen/${k.id}`;
      events.push(buildVEvent({
        uid: makeUid('vastgoedkans-actie', k.id),
        summary: `📌 ${buildAgendaTitle(actie, cleanStr(k.eigenaar_naam), dossierTitel)}`,
        description: [descLines(['Vastgoedkans', cleanStr(k.kansnummer) || dossierTitel], ['Eigenaar', cleanStr(k.eigenaar_naam)], ['Status', humanize(k.status)], ['Actie', actie]), url].filter(Boolean).join('\n'),
        location: [k.adres, k.postcode, k.plaats].filter(Boolean).join(', ') || undefined,
        url, startDate: actieDatum, endDate: addOneDay(actieDatum),
      }, dtstamp));
    }

    const ACTIE_LABEL: Record<string, string> = {
      bellen: 'Bellen', mailen: 'Mailen', whatsapp: 'WhatsApp', teaser_sturen: 'Teaser sturen',
      nda_sturen: 'NDA sturen', nda_opvolgen: 'NDA opvolgen', stukken_delen: 'Stukken delen',
      info_delen: 'Info delen', bezichtiging_plannen: 'Bezichtiging plannen',
      bezichtiging_inplannen: 'Bezichtiging inplannen', bezichtiging: 'Bezichtiging',
      bieding_opvolgen: 'Bieding opvolgen', bod_opvolgen: 'Bod opvolgen', onderhandelen: 'Onderhandelen',
      contract_opstellen: 'Contract opstellen', dd_opvolgen: 'DD opvolgen', transport_voorbereiden: 'Transport voorbereiden',
      overig: 'Actie', anders: 'Actie',
    };

    for (const p of pipeline) {
      const obj: any = p.object_id ? objectMap.get(p.object_id) : null;
      const rel: any = p.relatie_id ? relatieMap.get(p.relatie_id) : null;
      const titel = objNaam(obj);
      const relatie = relName(rel);
      const locatie = obj ? [obj.adres, obj.postcode, obj.plaats].filter(Boolean).join(', ') : undefined;
      const url = obj ? `${APP_BASE_URL}/objecten/${obj.id}` : `${APP_BASE_URL}/pipeline`;
      const baseDescription = (extra?: string) => [
        relatie ? `Kandidaat: ${relatie}` : null, obj ? `Object: ${titel}` : null,
        p.pipeline_fase ? `Fase: ${humanize(p.pipeline_fase)}` : null, extra, p.notities, url,
      ].filter(Boolean).join('\n');

      if (p.bezichtiging_datum) {
        events.push(buildVEvent({
          uid: makeUid('pipeline-bezichtiging', p.id), summary: `🤝 ${buildAgendaTitle('Bezichtiging', relatie, titel)}`,
          description: baseDescription(), location: locatie, url,
          startDate: p.bezichtiging_datum, endDate: addOneDay(p.bezichtiging_datum), status: 'CONFIRMED',
        }, dtstamp));
      }

      if (p.volgende_actie_datum && !hasCanonical('object_pipeline', p.id, 'volgende_actie')) {
        const actieLabel = p.volgende_actie ? (ACTIE_LABEL[p.volgende_actie] ?? humanize(p.volgende_actie)) : 'Volgende actie';
        const omschrijving = cleanStr(p.volgende_actie_omschrijving);
        events.push(buildVEvent({
          uid: makeUid('pipeline-actie', p.id),
          summary: `✅ ${buildAgendaTitle(omschrijving ? `${actieLabel}: ${omschrijving}` : actieLabel, relatie, titel)}`,
          description: baseDescription(omschrijving ? `Actie: ${actieLabel} — ${omschrijving}` : `Actie: ${actieLabel}`),
          location: locatie, url, startDate: p.volgende_actie_datum, endDate: addOneDay(p.volgende_actie_datum),
        }, dtstamp));
      }

      if (p.gewenste_levering) {
        events.push(buildVEvent({
          uid: makeUid('pipeline-levering', p.id), summary: `📦 ${buildAgendaTitle('Gewenste levering', relatie, titel)}`,
          description: baseDescription('Gewenste leveringsdatum vanuit kandidaat'), location: locatie, url,
          startDate: p.gewenste_levering, endDate: addOneDay(p.gewenste_levering), status: 'TENTATIVE',
        }, dtstamp));
      }
    }

    // NDA blijft voor compatibiliteit in de feed; de semantische opsplitsing van
    // nda_datum is een aparte migratie en wordt niet stilzwijgend in deze tranche veranderd.
    for (const r of ndaRelaties) {
      const url = `${APP_BASE_URL}/relaties/${r.id}`;
      const naam = relName(relatieMap.get(r.id)) || 'Relatie';
      events.push(buildVEvent({
        uid: makeUid('nda-relatie', r.id), summary: `🖋 NDA — ${naam}`,
        description: [`Relatie: ${naam}`, 'NDA-datum vastgelegd op het relatieprofiel.', url].join('\n'),
        url, startDate: r.nda_datum!, endDate: addOneDay(r.nda_datum!),
      }, dtstamp));
    }

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bito Vastgoed//Agenda Feed//NL',
      'METHOD:PUBLISH', 'X-WR-CALNAME:Bito Vastgoed',
      'X-WR-CALDESC:Afspraken, centrale taken, prognoses en legacy fallbacks zonder dubbele acties',
      'X-WR-TIMEZONE:Europe/Amsterdam', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR',
    ].join('\r\n');

    return new Response(ics, { status: 200, headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="bito-vastgoed.ics"',
      'Cache-Control': 'max-age=300',
      'Access-Control-Allow-Origin': '*',
    }});
  } catch (err) {
    console.error('Feed error:', err);
    return new Response('Interne fout bij genereren feed', { status: 500 });
  }
});
