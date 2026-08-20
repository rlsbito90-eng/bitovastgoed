// Edge function: offmarket-kadaster-pdf-eigenaar-extractie
//
// Leest uitsluitend een reeds intern opgeslagen officieel Kadasterbericht/PDF
// voor een Off-Market signaal. Geen nieuwe Kadaster-aanvraag, geen OCR en dus
// geen betaalde actie. De bestaande rechten uit raw_limited blijven leidend;
// de PDF wordt alleen gebruikt om naam/adresvelden veilig te herstellen en
// aan de juiste rechthebbende te koppelen.

// @ts-nocheck — Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import { z } from 'npm:zod@3.23.8';
import { extractKadasterAdresVoorstellenUitTekst } from '../_shared/kadasterPdfAdresParser.ts';
import { normaliseerKadasterPdfTekst } from '../_shared/kadasterPdfTekstNormalisatie.ts';

const MAX_BYTES = 10 * 1024 * 1024;
const NL_POSTCODE_RE = /\b(\d{4})\s*([A-Z]{2})\b/i;

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
  straatHuisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  verzendadres: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function schoon(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }
function schoneNaam(v: unknown): string {
  return schoon(v).replace(/\s+Geboren\s+\d{1,2}-\d{1,2}-\d{4}\s+te\s+.+$/i, '').trim();
}
function norm(v: unknown): string {
  return schoneNaam(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL')
    .replace(/\b(b\.?v\.?|n\.?v\.?)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function rechtssituatieVoor(label: unknown): Rechtssituatie {
  const s = schoon(label).toLowerCase();
  if (s.startsWith('erfpacht')) return 'erfpacht';
  if (s.startsWith('opstal')) return 'opstal';
  if (s.startsWith('appartementsrecht')) return 'appartementsrecht';
  if (s.startsWith('eigendom')) return 'volle_eigendom';
  return 'overig';
}
function rang(k: Kandidaat): number {
  return k.rechtssituatie === 'erfpacht' ? 50 : k.rechtssituatie === 'opstal' ? 45 : k.rechtssituatie === 'appartementsrecht' ? 40 : k.rechtssituatie === 'volle_eigendom' ? 30 : 20;
}
function kandidaatLabel(k: Kandidaat): string { return k.bedrijfsnaam || k.naam || ''; }
function isRechtspersoonNaam(naam: string, kvk: string | null): boolean {
  if (kvk) return true;
  return /\b(b\.?\s*v\.?|n\.?\s*v\.?|v\.?\s*o\.?\s*f\.?|stichting|vereniging|co[oö]peratie|holding|beheer|gmbh|limited|ltd|s\.?\s*[àa]\.?\s*r\.?\s*l\.?)\b/i.test(naam);
}
function eigenaarType(naam: string, kvk: string | null): string {
  if (/\b(gemeente|provincie|rijksoverheid|staat der nederlanden|ministerie|waterschap)\b/i.test(naam)) return 'overheid';
  if (/\bb\.?\s*v\.?\b/i.test(naam)) return 'bv';
  if (/\bstichting\b/i.test(naam)) return 'stichting';
  if (/\b(v\.?\s*v\.?\s*e\.?|vereniging van (eigenaars|eigenaren))\b/i.test(naam)) return 'vve';
  return kvk ? 'onbekend' : isRechtspersoonNaam(naam, kvk) ? 'onbekend' : 'particulier';
}

function adresUitObject(adres: any): Pick<Kandidaat, 'straatHuisnummer' | 'postcode' | 'plaats' | 'verzendadres'> {
  const straat = schoon(adres?.straat);
  const huisnummer = schoon(adres?.huisnummer);
  const postcode = schoon(adres?.postcode).replace(/^(\d{4})\s*([A-Z]{2})$/i, '$1 $2').toUpperCase();
  const plaats = schoon(adres?.plaats);
  const straatHuisnummer = [straat, huisnummer].filter(Boolean).join(' ').trim() || null;
  const verzendadres = straatHuisnummer && postcode && plaats ? `${straatHuisnummer}\n${postcode} ${plaats}` : null;
  return { straatHuisnummer, postcode: postcode || null, plaats: plaats || null, verzendadres };
}
function parseVerzendadres(value: string | null | undefined): Pick<Kandidaat, 'straatHuisnummer' | 'postcode' | 'plaats' | 'verzendadres'> {
  const regels = String(value ?? '').split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  const verzendadres = regels.join('\n') || null;
  const samen = regels.join(' ');
  const m = samen.match(NL_POSTCODE_RE);
  if (!m) return { straatHuisnummer: regels[0] ?? null, postcode: null, plaats: null, verzendadres };
  const idx = samen.search(NL_POSTCODE_RE);
  const straatHuisnummer = samen.slice(0, idx).trim().replace(/[,\s]+$/, '') || null;
  const postcode = `${m[1]} ${m[2].toUpperCase()}`;
  const plaats = samen.slice(idx + m[0].length).trim().replace(/^[,\s]+/, '') || null;
  return { straatHuisnummer, postcode, plaats, verzendadres: straatHuisnummer && plaats ? `${straatHuisnummer}\n${postcode} ${plaats}` : verzendadres };
}
function adresCompleet(k: Kandidaat): boolean {
  if (!k.verzendadres) return false;
  if (k.postcode && k.plaats && k.straatHuisnummer) return true;
  return k.verzendadres.split(/\r?\n/).map((v) => v.trim()).filter(Boolean).length >= 3;
}

function kandidaatUitPartij(partij: any, blok: any, isBedrijf: boolean): Kandidaat | null {
  const rawNaam = schoneNaam(partij?.naam);
  if (!rawNaam) return null;
  const kvk = schoon(partij?.kvk) || null;
  const adres = adresUitObject(partij?.adres);
  const bedrijf = isBedrijf || isRechtspersoonNaam(rawNaam, kvk);
  return {
    rolLabel: schoon(blok?.omschrijving) || 'Overig recht',
    rechtssituatie: rechtssituatieVoor(blok?.omschrijving),
    aandeel: schoon(blok?.aandeelInRecht) || schoon(partij?.aandeel) || null,
    naam: bedrijf ? null : rawNaam,
    bedrijfsnaam: bedrijf ? rawNaam : null,
    kvk,
    ...adres,
  };
}
function kandidatenUitBestaandeRechten(rawLimited: any): Kandidaat[] {
  const blokken = Array.isArray(rawLimited?.rechten?.blokken) ? rawLimited.rechten.blokken : [];
  const out: Kandidaat[] = [];
  for (const blok of blokken) {
    for (const p of Array.isArray(blok?.persons) ? blok.persons : []) {
      const k = kandidaatUitPartij(p, blok, false); if (k) out.push(k);
    }
    for (const e of Array.isArray(blok?.entities) ? blok.entities : []) {
      const k = kandidaatUitPartij(e, blok, true); if (k) out.push(k);
    }
  }
  return out;
}
function kandidaatUitVoorstel(v: any): Kandidaat | null {
  const label = schoon(v?.bedrijfsnaam) || schoon(v?.naam);
  if (!label || !v?.verzendadres) return null;
  const adres = parseVerzendadres(v.verzendadres);
  const isBedrijf = !!schoon(v?.bedrijfsnaam) || isRechtspersoonNaam(label, null);
  return {
    rolLabel: schoon(v?.rolLabel) || (v?.rechtType === 'erfpacht' ? 'Erfpacht (recht van)' : v?.rechtType === 'eigendom' ? 'Eigendom (recht van)' : 'Overig recht'),
    rechtssituatie: v?.rechtType === 'erfpacht' ? 'erfpacht' : v?.rechtType === 'eigendom' ? 'volle_eigendom' : rechtssituatieVoor(v?.rolLabel),
    aandeel: schoon(v?.aandeel) || null,
    naam: isBedrijf ? null : label,
    bedrijfsnaam: isBedrijf ? label : null,
    kvk: null,
    ...adres,
  };
}
function combineerKandidaten(basis: Kandidaat[], voorstellen: any[]): Kandidaat[] {
  const out = [...basis];
  for (const voorstelRaw of voorstellen) {
    const voorstel = kandidaatUitVoorstel(voorstelRaw);
    if (!voorstel) continue;
    const idx = out.findIndex((k) => norm(kandidaatLabel(k)) === norm(kandidaatLabel(voorstel)) && k.rechtssituatie === voorstel.rechtssituatie);
    if (idx >= 0) {
      const bestaand = out[idx];
      out[idx] = {
        ...bestaand,
        naam: voorstel.naam,
        bedrijfsnaam: voorstel.bedrijfsnaam,
        straatHuisnummer: voorstel.straatHuisnummer ?? bestaand.straatHuisnummer,
        postcode: voorstel.postcode ?? bestaand.postcode,
        plaats: voorstel.plaats ?? bestaand.plaats,
        verzendadres: voorstel.verzendadres ?? bestaand.verzendadres,
      };
    } else {
      out.push(voorstel);
    }
  }
  const uniek = new Map<string, Kandidaat>();
  for (const k of out) {
    const key = `${k.rechtssituatie}|${norm(kandidaatLabel(k))}|${k.aandeel ?? ''}`;
    const prev = uniek.get(key);
    if (!prev || (!prev.verzendadres && k.verzendadres)) uniek.set(key, k);
  }
  return [...uniek.values()];
}
function pseudoBlok(k: Kandidaat): Record<string, unknown> {
  const partij: Record<string, unknown> = { naam: kandidaatLabel(k), ...(k.kvk ? { kvk: k.kvk } : {}) };
  if (k.straatHuisnummer && k.postcode && k.plaats) {
    const m = k.straatHuisnummer.match(/^(.*\D)\s+(\d.*)$/);
    partij.adres = { straat: m?.[1]?.trim() || k.straatHuisnummer, huisnummer: m?.[2]?.trim() || '', postcode: k.postcode, plaats: k.plaats };
  }
  return { omschrijving: k.rolLabel, aandeelInRecht: k.aandeel, persons: k.naam ? [partij] : [], entities: k.bedrijfsnaam ? [partij] : [] };
}
function veiligVervangbaar(huidig: Record<string, unknown>, primair: Kandidaat): boolean {
  const bestaand = schoon(huidig.eigenaar_bedrijfsnaam) || schoon(huidig.eigenaar_naam);
  if (!bestaand) return true;
  if (norm(bestaand) === norm(kandidaatLabel(primair))) return true;
  return schoon(huidig.eigenaarbron).toLowerCase() === 'kadaster' && huidig.eigenaar_controle_nodig === true;
}
function veiligMeervoudigVervangbaar(huidig: Record<string, unknown>): boolean {
  const bestaand = schoon(huidig.eigenaar_bedrijfsnaam) || schoon(huidig.eigenaar_naam);
  if (!bestaand) return true;
  const bron = schoon(huidig.eigenaarbron).toLowerCase();
  return !bron || bron === 'kadaster';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Alleen POST is toegestaan.' }, 405);
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server niet correct geconfigureerd.' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return json({ error: 'Niet ingelogd.' }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Niet ingelogd.' }, 401);
    const userId = userData.user.id;
    const { data: isIntern, error: rolError } = await userClient.rpc('is_intern_gebruiker', { _user_id: userId });
    if (rolError || !isIntern) return json({ error: 'Geen toegang.' }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Ongeldige invoer.' }, 400);
    const body = parsed.data;
    const { data: toegankelijk } = await userClient.from('off_market_signalen').select('id').eq('id', body.signaal_id).maybeSingle();
    if (!toegankelijk) return json({ error: 'Signaal bestaat niet of is niet toegankelijk.' }, 404);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: records, error: recordError } = await admin.from('kadaster_data_records').select('id,raw_limited,fetched_at,status').eq('signaal_id', body.signaal_id).eq('product_code', 'rechten').in('status', ['geleverd', 'gedeeltelijk']).order('fetched_at', { ascending: false }).limit(10);
    if (recordError) return json({ error: 'Kon Kadasterrecord niet lezen.' }, 500);
    const record = (records ?? []).find((r) => !body.record_id || r.id === body.record_id) ?? null;
    if (!record) return json({ ok: true, status: 'geen_rechten_record', updated: false });

    const { data: documenten, error: documentenError } = await admin.from('kadaster_documenten').select('id,kadaster_data_record_id,storage_bucket,storage_path,product_codes,fetched_at,bestandsgrootte_bytes,mime_type').eq('signaal_id', body.signaal_id).order('fetched_at', { ascending: false }).limit(30);
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
    if (document.bestandsgrootte_bytes && document.bestandsgrootte_bytes > MAX_BYTES) return json({ error: 'Kadasterbericht is te groot voor tekstextractie.' }, 413);

    const { data: pdfBlob, error: downloadError } = await admin.storage.from(document.storage_bucket || 'bito-objecten').download(document.storage_path);
    if (downloadError || !pdfBlob) return json({ error: 'Kon het opgeslagen Kadasterbericht niet lezen.' }, 500);
    const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return json({ error: 'Kadasterbericht is te groot voor tekstextractie.' }, 413);

    let normalised = '';
    try {
      const proxy = await getDocumentProxy(bytes);
      const out = await extractText(proxy, { mergePages: true });
      const rawText = typeof out?.text === 'string' ? out.text : Array.isArray(out?.text) ? out.text.join('\n') : '';
      normalised = normaliseerKadasterPdfTekst(rawText);
    } catch {
      return json({ ok: true, status: 'geen_uitleesbare_tekstlaag', document_id: document.id, record_id: record.id, updated: false });
    }
    const voorstellen = extractKadasterAdresVoorstellenUitTekst(normalised);
    const rawLimited = record.raw_limited && typeof record.raw_limited === 'object' ? { ...(record.raw_limited as Record<string, unknown>) } : {};
    const basis = kandidatenUitBestaandeRechten(rawLimited);
    const kandidaten = combineerKandidaten(basis, voorstellen);
    if (!kandidaten.length) return json({ ok: true, status: 'geen_rechthebbenden_uit_pdf', document_id: document.id, record_id: record.id, updated: false });

    const rechten = rawLimited.rechten && typeof rawLimited.rechten === 'object' ? { ...(rawLimited.rechten as Record<string, unknown>) } : {};
    rechten.blokken = kandidaten.map(pseudoBlok);
    rechten.pdf_verrijkt = { document_id: document.id, extracted_at: new Date().toISOString(), aantal_blokken: kandidaten.length, adresvoorstellen: voorstellen.length, parser: 'shared_kadaster_adres_v2' };
    rawLimited.rechten = rechten;
    const { error: rawUpdateError } = await admin.from('kadaster_data_records').update({ raw_limited: rawLimited }).eq('id', record.id);
    if (rawUpdateError) return json({ error: 'Kon PDF-rechten niet aan Kadasterrecord toevoegen.' }, 500);

    const hoogste = Math.max(...kandidaten.map(rang));
    const primairen = kandidaten.filter((k) => rang(k) === hoogste);
    const uniek = new Map(primairen.map((k) => [norm(kandidaatLabel(k)), k]));
    const primairePartijen = [...uniek.values()];

    const { data: huidig, error: huidigError } = await admin.from('off_market_signalen').select('id,eigenaar_naam,eigenaar_bedrijfsnaam,eigenaar_type,eigenaar_kvk,eigenaar_straat_huisnummer,eigenaar_postcode,eigenaar_plaats,eigenaar_verzendadres,eigenaarbron,eigenaarstatus,eigenaar_bekend,eigenaar_controle_nodig,eigenaar_rechtstype,eigenaar_rechtssituatie,eigenaar_aandeel,bloot_eigenaar,status').eq('id', body.signaal_id).single();
    if (huidigError || !huidig) return json({ error: 'Kon huidige eigenaarstatus niet lezen.' }, 500);

    const eigendom = kandidaten.filter((k) => k.rechtssituatie === 'volle_eigendom');
    const primaireSituatie = primairePartijen[0]?.rechtssituatie ?? null;
    const bloot = (primaireSituatie === 'erfpacht' || primaireSituatie === 'opstal') && eigendom.length === 1 ? { naam: eigendom[0].naam, bedrijfsnaam: eigendom[0].bedrijfsnaam, kvk: eigendom[0].kvk, aandeel: eigendom[0].aandeel, rechtssituatie: 'volle_eigendom' } : null;

    if (primairePartijen.length > 1) {
      if (!veiligMeervoudigVervangbaar(huidig as Record<string, unknown>)) {
        await admin.from('off_market_signalen').update({ eigenaar_controle_nodig: true, eigenaar_controle_reden: 'Kadasterrechten wijken af van bestaande handmatige eigenaargegevens.', updated_by: userId }).eq('id', body.signaal_id);
        return json({ ok: true, status: 'conflict', document_id: document.id, record_id: record.id, updated: true });
      }
      const alleAdressenCompleet = primairePartijen.every(adresCompleet);
      const rechthebbenden = primairePartijen.map((k) => ({ naam: k.naam, bedrijfsnaam: k.bedrijfsnaam, kvk: k.kvk, aandeel: k.aandeel, rechtstype: k.rolLabel, rechtssituatie: k.rechtssituatie, straat_huisnummer: k.straatHuisnummer, postcode: k.postcode, plaats: k.plaats, verzendadres: k.verzendadres, bron: 'kadaster' }));
      const patch: Record<string, unknown> = { eigenaarstatus: 'gevonden', eigenaar_bekend: true, eigenaarbron: 'kadaster', eigenaar_type: null, eigenaar_naam: null, eigenaar_bedrijfsnaam: null, eigenaar_kvk: null, eigenaar_straat_huisnummer: null, eigenaar_postcode: null, eigenaar_plaats: null, eigenaar_verzendadres: null, eigenaar_rechthebbenden: rechthebbenden, eigenaar_rechtstype: primairePartijen[0]?.rolLabel ?? null, eigenaar_rechtssituatie: primaireSituatie, eigenaar_aandeel: null, bloot_eigenaar: bloot, eigenaar_controle_nodig: !alleAdressenCompleet, eigenaar_controle_reden: alleAdressenCompleet ? null : 'Van één of meer primaire rechthebbenden ontbreken volledige adresgegevens.', updated_by: userId };
      if (['nieuw_signaal', 'te_onderzoeken', 'twijfel', 'eigenaar_achterhalen'].includes(String(huidig.status ?? ''))) patch.status = alleAdressenCompleet ? 'eigenaar_gevonden' : 'eigenaar_achterhalen';
      const { error: updateError } = await admin.from('off_market_signalen').update(patch).eq('id', body.signaal_id);
      if (updateError) return json({ error: 'Kon meerdere rechthebbenden niet automatisch opslaan.' }, 500);
      return json({ ok: true, status: alleAdressenCompleet ? 'verwerkt_meerdere' : 'verwerkt_meerdere_controle_nodig', document_id: document.id, record_id: record.id, updated: true, aantal_primaire_rechthebbenden: primairePartijen.length, adressen_compleet: alleAdressenCompleet, adresvoorstellen: voorstellen.length, source: 'kadasterbericht_pdf' });
    }

    const primair = primairePartijen[0];
    if (!primair) return json({ ok: true, status: 'geen_primaire_rechthebbende', document_id: document.id, record_id: record.id, updated: false });
    if (!veiligVervangbaar(huidig as Record<string, unknown>, primair)) {
      await admin.from('off_market_signalen').update({ eigenaar_controle_nodig: true, eigenaar_controle_reden: 'Kadasterbericht wijkt af van bestaande handmatige eigenaargegevens.', updated_by: userId }).eq('id', body.signaal_id);
      return json({ ok: true, status: 'conflict', document_id: document.id, record_id: record.id, updated: true });
    }

    const compleet = adresCompleet(primair);
    const patch: Record<string, unknown> = { eigenaarstatus: 'gevonden', eigenaar_bekend: true, eigenaarbron: 'kadaster', eigenaar_type: eigenaarType(kandidaatLabel(primair), primair.kvk), eigenaar_naam: primair.naam, eigenaar_bedrijfsnaam: primair.bedrijfsnaam, eigenaar_kvk: primair.kvk, eigenaar_rechtstype: primair.rolLabel, eigenaar_rechtssituatie: primair.rechtssituatie, eigenaar_aandeel: primair.aandeel, bloot_eigenaar: bloot, eigenaar_controle_nodig: !compleet, eigenaar_controle_reden: compleet ? null : 'Adresgegevens van de primaire rechthebbende zijn onvolledig.', updated_by: userId };
    if (compleet) {
      patch.eigenaar_straat_huisnummer = primair.straatHuisnummer;
      patch.eigenaar_postcode = primair.postcode;
      patch.eigenaar_plaats = primair.plaats;
      patch.eigenaar_verzendadres = primair.verzendadres;
    }
    if (['nieuw_signaal', 'te_onderzoeken', 'twijfel', 'eigenaar_achterhalen'].includes(String(huidig.status ?? ''))) patch.status = compleet ? 'eigenaar_gevonden' : 'eigenaar_achterhalen';
    const { error: updateError } = await admin.from('off_market_signalen').update(patch).eq('id', body.signaal_id);
    if (updateError) return json({ error: 'Kon eigenaargegevens niet automatisch opslaan.' }, 500);
    return json({ ok: true, status: compleet ? 'verwerkt' : 'verwerkt_controle_nodig', document_id: document.id, record_id: record.id, updated: true, rechtssituatie: primair.rechtssituatie, primaire_rechthebbende: kandidaatLabel(primair), adres_compleet: compleet, adresvoorstellen: voorstellen.length, source: 'kadasterbericht_pdf' });
  } catch (error) {
    console.error('[offmarket-kadaster-pdf-eigenaar-extractie] onverwachte fout', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Onverwachte fout bij verwerking van het Kadasterbericht.' }, 500);
  }
});
