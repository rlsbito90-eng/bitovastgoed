// Edge function: offmarket-kadaster-pdf-eigenaar-extractie
//
// Leest uitsluitend een reeds intern opgeslagen officieel Kadasterbericht/PDF
// voor een Off-Market signaal. Geen nieuwe Kadaster-aanvraag en dus geen
// betaalde actie. De PDF is leidend voor rechten + correspondentieadres:
// erfpachter/opstalhouder krijgt voorrang boven bloot eigenaar.
//
// De functie is idempotent en vervangt alleen bestaande eigenaarvelden als
// deze leeg zijn, exact overeenkomen, of aantoonbaar uit de eerdere
// automatische Kadasterverwerking komen terwijl het dossier nog op
// eigenaarcontrole staat. Handmatige/andere brondata wordt niet stil
// overschreven.

// @ts-nocheck — Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import { z } from 'npm:zod@3.23.8';

const MAX_BYTES = 10 * 1024 * 1024;

const BodySchema = z.object({
  signaal_id: z.string().uuid(),
  record_id: z.string().uuid().nullish(),
  document_id: z.string().uuid().nullish(),
});

type Rechtssituatie = 'volle_eigendom' | 'erfpacht' | 'opstal' | 'appartementsrecht' | 'overig';

type Kandidaat = {
  rolLabel: string;
  rechtssituatie: Rechtssituatie;
  aandeel: string | null;
  naam: string | null;
  bedrijfsnaam: string | null;
  kvk: string | null;
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
  verzendadres: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function schoon(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/\b(b\.?v\.?|n\.?v\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rechtspersoon(naam: string, kvk: string | null): boolean {
  if (kvk) return true;
  return /\b(b\.?\s*v\.?|n\.?\s*v\.?|v\.?\s*o\.?\s*f\.?|stichting|vereniging|co[oö]peratie|gemeente|provincie|waterschap|staat der nederlanden|holding|beheer)\b/i.test(naam);
}

function eigenaarType(naam: string, kvk: string | null): string {
  const n = naam.toLowerCase();
  if (/\b(gemeente|provincie|rijksoverheid|staat der nederlanden|ministerie|waterschap)\b/i.test(n)) return 'overheid';
  if (/\bb\.?\s*v\.?\b/i.test(n)) return 'bv';
  if (/\bstichting\b/i.test(n)) return 'stichting';
  if (/\b(v\.?\s*v\.?\s*e\.?|vereniging van (eigenaars|eigenaren))\b/i.test(n)) return 'vve';
  return kvk ? 'onbekend' : 'particulier';
}

function normaliseerTekst(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').replace(/\f/g, '\n');
  const grenzen = [
    'Rechten', 'Overige rechten', 'Eigendom (recht van)', 'Erfpacht (recht van)',
    'Opstal (recht van)', 'Vruchtgebruik (recht van)', 'Appartementsrecht',
    'Bijzonderheden', 'Koopsom', 'Gemeentelijke lasten', 'Buurtstatistieken',
  ];
  for (const label of grenzen) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(?<!\\n)(?=${escaped}\\b)`, 'gi'), '\n');
  }
  for (const label of ['Aandeel', 'Naam', 'Adres', 'Postbus', 'Zetel', 'KvK-nummer', 'KvK nummer', 'Gebaseerd op']) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(?<=\\S)\\s+(?=${escaped}\\b)`, 'gi'), '\n');
  }
  return s
    .split('\n')
    .map((r) => r.replace(/\*\*/g, '').replace(/^\s*#+\s*/, '').trim())
    .filter((r) => !/^Pagina\s+\d+/i.test(r) && !/^Blad\s+\d+/i.test(r))
    .join('\n');
}

const HEADER_DEFS: Array<{ re: RegExp; label: string; situatie: Rechtssituatie; rang: number }> = [
  { re: /^erfpacht\s*\(recht van\)\s*$/i, label: 'Erfpacht (recht van)', situatie: 'erfpacht', rang: 50 },
  { re: /^opstal\s*\(recht van\)\s*$/i, label: 'Opstal (recht van)', situatie: 'opstal', rang: 45 },
  { re: /^appartementsrecht\s*$/i, label: 'Appartementsrecht', situatie: 'appartementsrecht', rang: 40 },
  { re: /^eigendom\s*\(recht van\)\s*$/i, label: 'Eigendom (recht van)', situatie: 'volle_eigendom', rang: 30 },
  { re: /^vruchtgebruik\s*\(recht van\)\s*$/i, label: 'Vruchtgebruik (recht van)', situatie: 'overig', rang: 20 },
];

const VELD_RE = /^(Aandeel|Naam|Adres|Postbus|Zetel|KvK[- ]nummer|Gebaseerd op)\b\s*:?\s*(.*)$/i;
const POSTCODE_RE = /\b(\d{4})\s*([A-Z]{2})\b/i;

function leesVelden(regels: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let huidig: string | null = null;
  for (const raw of regels) {
    const r = raw.trim();
    if (!r) continue;
    const m = r.match(VELD_RE);
    if (m) {
      huidig = /^kvk/i.test(m[1]) ? 'KvK-nummer' : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
      const arr = out.get(huidig) ?? [];
      if (m[2]?.trim()) arr.push(m[2].trim());
      out.set(huidig, arr);
    } else if (huidig) {
      const arr = out.get(huidig) ?? [];
      arr.push(r);
      out.set(huidig, arr);
    }
  }
  return out;
}

function parseAdres(values: string[] | undefined, postbusValues: string[] | undefined): {
  straatHuisnummer: string; postcode: string; plaats: string; verzendadres: string;
} | null {
  const bron = values?.length ? values.join(' ') : postbusValues?.length ? `Postbus ${postbusValues.join(' ')}` : '';
  const compact = bron.replace(/\s+/g, ' ').trim();
  const m = compact.match(POSTCODE_RE);
  if (!compact || !m) return null;
  const idx = compact.search(POSTCODE_RE);
  let straat = compact.slice(0, idx).trim().replace(/[,\s]+$/, '');
  if (!straat) return null;
  straat = straat.replace(/([A-Za-zÀ-ÿ.])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim();
  const rest = compact.slice(idx + m[0].length).trim().replace(/^[,\s]+/, '');
  const plaats = rest.split(/\s+/)[0]?.trim() ?? '';
  if (!plaats) return null;
  const postcode = `${m[1]} ${m[2].toUpperCase()}`;
  return {
    straatHuisnummer: straat,
    postcode,
    plaats: plaats.replace(/[^A-Za-zÀ-ÿ' -]/g, '').trim() || plaats,
    verzendadres: `${straat}\n${postcode} ${plaats}`,
  };
}

function parseKandidaten(normalised: string): Kandidaat[] {
  const regels = normalised.split('\n').map((r) => r.trim()).filter(Boolean);
  let start = regels.findIndex((r) => /^rechten\s*$/i.test(r));
  if (start < 0) start = 0;
  let eind = regels.length;
  for (let i = start + 1; i < regels.length; i++) {
    if (/^(bijzonderheden|koopsom|gemeentelijke lasten|buurtstatistieken|omgeving)\s*$/i.test(regels[i])) {
      eind = i;
      break;
    }
  }

  const blokken: Array<{ def: typeof HEADER_DEFS[number]; regels: string[] }> = [];
  let huidig: { def: typeof HEADER_DEFS[number]; regels: string[] } | null = null;
  for (let i = start; i < eind; i++) {
    const r = regels[i];
    if (/^overige rechten\s*$/i.test(r)) continue;
    const def = HEADER_DEFS.find((d) => d.re.test(r));
    if (def) {
      if (huidig) blokken.push(huidig);
      huidig = { def, regels: [] };
      continue;
    }
    if (huidig) huidig.regels.push(r);
  }
  if (huidig) blokken.push(huidig);

  const out: Kandidaat[] = [];
  for (const blok of blokken) {
    const velden = leesVelden(blok.regels);
    const naam = (velden.get('Naam') ?? []).join(' ').replace(/\s+/g, ' ').trim();
    const kvkRaw = (velden.get('KvK-nummer') ?? []).join(' ');
    const kvk = kvkRaw.match(/\b\d{8}\b/)?.[0] ?? null;
    const adres = parseAdres(velden.get('Adres'), velden.get('Postbus'));
    if (!naam || !adres) continue;
    const isBedrijf = rechtspersoon(naam, kvk);
    out.push({
      rolLabel: blok.def.label,
      rechtssituatie: blok.def.situatie,
      aandeel: (velden.get('Aandeel') ?? [])[0]?.trim() || null,
      naam: isBedrijf ? null : naam,
      bedrijfsnaam: isBedrijf ? naam : null,
      kvk,
      ...adres,
    });
  }
  return out;
}

function rang(k: Kandidaat): number {
  if (k.rechtssituatie === 'erfpacht') return 50;
  if (k.rechtssituatie === 'opstal') return 45;
  if (k.rechtssituatie === 'appartementsrecht') return 40;
  if (k.rechtssituatie === 'volle_eigendom') return 30;
  return 20;
}

function kandidaatLabel(k: Kandidaat): string {
  return k.bedrijfsnaam || k.naam || '';
}

function pseudoBlok(k: Kandidaat): Record<string, unknown> {
  const adres = {
    straat: k.straatHuisnummer.replace(/\s+\d.*$/, '').trim(),
    huisnummer: k.straatHuisnummer.match(/\b\d+[A-Za-z0-9\-]*\b/)?.[0] ?? '',
    postcode: k.postcode,
    plaats: k.plaats,
  };
  const partij = {
    naam: kandidaatLabel(k),
    ...(k.kvk ? { kvk: k.kvk } : {}),
    adres,
  };
  return {
    omschrijving: k.rolLabel,
    aandeelInRecht: k.aandeel,
    persons: k.naam ? [partij] : [],
    entities: k.bedrijfsnaam ? [partij] : [],
  };
}

function veiligVervangbaar(huidig: Record<string, unknown>, primair: Kandidaat): boolean {
  const bestaand = schoon(huidig.eigenaar_bedrijfsnaam) || schoon(huidig.eigenaar_naam);
  if (!bestaand) return true;
  if (norm(bestaand) === norm(kandidaatLabel(primair))) return true;
  return schoon(huidig.eigenaarbron).toLowerCase() === 'kadaster'
    && huidig.eigenaar_controle_nodig === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Alleen POST is toegestaan.' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Server niet correct geconfigureerd.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return json({ error: 'Niet ingelogd.' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Niet ingelogd.' }, 401);
    const userId = userData.user.id;

    const { data: isIntern, error: rolError } = await userClient.rpc('is_intern_gebruiker', { _user_id: userId });
    if (rolError || !isIntern) return json({ error: 'Geen toegang.' }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Ongeldige invoer.' }, 400);
    const body = parsed.data;

    const { data: toegankelijk, error: toegangError } = await userClient
      .from('off_market_signalen')
      .select('id')
      .eq('id', body.signaal_id)
      .maybeSingle();
    if (toegangError || !toegankelijk) return json({ error: 'Signaal bestaat niet of is niet toegankelijk.' }, 404);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let recordQuery = admin
      .from('kadaster_data_records')
      .select('id,raw_limited,fetched_at,status')
      .eq('signaal_id', body.signaal_id)
      .eq('product_code', 'rechten')
      .in('status', ['geleverd', 'gedeeltelijk'])
      .order('fetched_at', { ascending: false })
      .limit(10);
    const { data: records, error: recordError } = await recordQuery;
    if (recordError) return json({ error: 'Kon Kadasterrecord niet lezen.' }, 500);
    const record = (records ?? []).find((r) => !body.record_id || r.id === body.record_id) ?? null;
    if (!record) return json({ ok: true, status: 'geen_rechten_record', updated: false });

    const { data: documenten, error: documentenError } = await admin
      .from('kadaster_documenten')
      .select('id,kadaster_data_record_id,storage_bucket,storage_path,product_codes,fetched_at,bestandsgrootte_bytes,mime_type')
      .eq('signaal_id', body.signaal_id)
      .order('fetched_at', { ascending: false })
      .limit(30);
    if (documentenError) return json({ error: 'Kon Kadasterberichten niet lezen.' }, 500);

    const document = (documenten ?? []).find((d) => {
      if (body.document_id && d.id !== body.document_id) return false;
      if (!Array.isArray(d.product_codes) || !d.product_codes.includes('rechten')) return false;
      if (d.kadaster_data_record_id === record.id) return true;
      const dt = Math.abs(new Date(d.fetched_at).getTime() - new Date(record.fetched_at).getTime());
      return !d.kadaster_data_record_id && dt <= 5 * 60 * 1000;
    }) ?? null;
    if (!document) return json({ ok: true, status: 'geen_rechten_pdf', record_id: record.id, updated: false });
    if (document.mime_type && document.mime_type !== 'application/pdf') return json({ error: 'Kadasterbericht is geen PDF.' }, 415);
    if (document.bestandsgrootte_bytes && document.bestandsgrootte_bytes > MAX_BYTES) {
      return json({ error: 'Kadasterbericht is te groot voor tekstextractie.' }, 413);
    }

    const { data: pdfBlob, error: downloadError } = await admin.storage
      .from(document.storage_bucket || 'bito-objecten')
      .download(document.storage_path);
    if (downloadError || !pdfBlob) return json({ error: 'Kon het opgeslagen Kadasterbericht niet lezen.' }, 500);
    const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return json({ error: 'Kadasterbericht is te groot voor tekstextractie.' }, 413);

    let rawText = '';
    try {
      const proxy = await getDocumentProxy(bytes);
      const out = await extractText(proxy, { mergePages: true });
      rawText = typeof out?.text === 'string' ? out.text : Array.isArray(out?.text) ? out.text.join('\n') : '';
    } catch {
      return json({ ok: true, status: 'geen_uitleesbare_tekstlaag', document_id: document.id, record_id: record.id, updated: false });
    }

    const kandidaten = parseKandidaten(normaliseerTekst(rawText));
    if (!kandidaten.length) {
      return json({ ok: true, status: 'geen_adresvoorstellen', document_id: document.id, record_id: record.id, updated: false });
    }

    // Bewaar de uit de officiële PDF afgeleide rechtenblokken in raw_limited,
    // zodat ook bestaande records (waar rechtenOverig destijds niet in de
    // whitelist zat) voortaan Eigendom + Erfpacht/Opstal correct tonen.
    const rawLimited = record.raw_limited && typeof record.raw_limited === 'object'
      ? { ...(record.raw_limited as Record<string, unknown>) }
      : {};
    const rechten = rawLimited.rechten && typeof rawLimited.rechten === 'object'
      ? { ...(rawLimited.rechten as Record<string, unknown>) }
      : {};
    rechten.blokken = kandidaten.map(pseudoBlok);
    rechten.pdf_verrijkt = {
      document_id: document.id,
      extracted_at: new Date().toISOString(),
      aantal_blokken: kandidaten.length,
    };
    rawLimited.rechten = rechten;
    const { error: rawUpdateError } = await admin
      .from('kadaster_data_records')
      .update({ raw_limited: rawLimited })
      .eq('id', record.id);
    if (rawUpdateError) return json({ error: 'Kon PDF-rechten niet aan Kadasterrecord toevoegen.' }, 500);

    const hoogste = Math.max(...kandidaten.map(rang));
    const primairen = kandidaten.filter((k) => rang(k) === hoogste);
    const uniek = new Map(primairen.map((k) => [norm(kandidaatLabel(k)), k]));

    if (uniek.size !== 1) {
      await admin.from('off_market_signalen').update({
        eigenaar_controle_nodig: true,
        eigenaar_controle_reden: 'Meerdere primaire rechthebbenden in het officiële Kadasterbericht.',
        updated_by: userId,
      }).eq('id', body.signaal_id);
      return json({ ok: true, status: 'ambigu', document_id: document.id, record_id: record.id, updated: true });
    }

    const primair = [...uniek.values()][0];
    const { data: huidig, error: huidigError } = await admin
      .from('off_market_signalen')
      .select('id,eigenaar_naam,eigenaar_bedrijfsnaam,eigenaar_type,eigenaar_kvk,eigenaar_straat_huisnummer,eigenaar_postcode,eigenaar_plaats,eigenaar_verzendadres,eigenaarbron,eigenaarstatus,eigenaar_bekend,eigenaar_controle_nodig,eigenaar_rechtstype,eigenaar_rechtssituatie,eigenaar_aandeel,bloot_eigenaar,status')
      .eq('id', body.signaal_id)
      .single();
    if (huidigError || !huidig) return json({ error: 'Kon huidige eigenaarstatus niet lezen.' }, 500);

    if (!veiligVervangbaar(huidig as Record<string, unknown>, primair)) {
      await admin.from('off_market_signalen').update({
        eigenaar_controle_nodig: true,
        eigenaar_controle_reden: 'Kadasterbericht wijkt af van bestaande handmatige eigenaargegevens.',
        updated_by: userId,
      }).eq('id', body.signaal_id);
      return json({ ok: true, status: 'conflict', document_id: document.id, record_id: record.id, updated: true });
    }

    const eigendom = kandidaten.filter((k) => k.rechtssituatie === 'volle_eigendom');
    const bloot = (primair.rechtssituatie === 'erfpacht' || primair.rechtssituatie === 'opstal') && eigendom.length === 1
      ? {
          naam: eigendom[0].naam,
          bedrijfsnaam: eigendom[0].bedrijfsnaam,
          kvk: eigendom[0].kvk,
          aandeel: eigendom[0].aandeel,
          rechtssituatie: 'volle_eigendom',
        }
      : null;

    const patch: Record<string, unknown> = {
      eigenaarstatus: 'gevonden',
      eigenaar_bekend: true,
      eigenaarbron: 'kadaster',
      eigenaar_type: eigenaarType(kandidaatLabel(primair), primair.kvk),
      eigenaar_naam: primair.naam,
      eigenaar_bedrijfsnaam: primair.bedrijfsnaam,
      eigenaar_kvk: primair.kvk,
      eigenaar_straat_huisnummer: primair.straatHuisnummer,
      eigenaar_postcode: primair.postcode,
      eigenaar_plaats: primair.plaats,
      eigenaar_verzendadres: primair.verzendadres,
      eigenaar_rechtstype: primair.rolLabel,
      eigenaar_rechtssituatie: primair.rechtssituatie,
      eigenaar_aandeel: primair.aandeel,
      bloot_eigenaar: bloot,
      eigenaar_controle_nodig: false,
      eigenaar_controle_reden: null,
      updated_by: userId,
    };
    if (['nieuw_signaal', 'te_onderzoeken', 'twijfel', 'eigenaar_achterhalen'].includes(String(huidig.status ?? ''))) {
      patch.status = 'eigenaar_gevonden';
    }

    const { error: updateError } = await admin
      .from('off_market_signalen')
      .update(patch)
      .eq('id', body.signaal_id);
    if (updateError) return json({ error: 'Kon eigenaargegevens niet automatisch opslaan.' }, 500);

    return json({
      ok: true,
      status: 'verwerkt',
      document_id: document.id,
      record_id: record.id,
      updated: true,
      rechtssituatie: primair.rechtssituatie,
      primaire_rechthebbende: kandidaatLabel(primair),
      adres_compleet: true,
      source: 'kadasterbericht_pdf',
    });
  } catch (error) {
    console.error('[offmarket-kadaster-pdf-eigenaar-extractie] onverwachte fout', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Onverwachte fout bij verwerking van het Kadasterbericht.' }, 500);
  }
});
