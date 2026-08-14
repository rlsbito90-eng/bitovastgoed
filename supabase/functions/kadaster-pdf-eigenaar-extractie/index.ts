// Edge function: kadaster-pdf-eigenaar-extractie
//
// Leest uitsluitend een reeds intern opgeslagen officieel Kadasterbericht/PDF
// en vult ontbrekende eigenaar-adresvelden in het centrale Eigenaarsregister aan.
// Geen Kadaster API-call, geen betaalde actie, geen OCR en geen CRM-relatie-mutatie.
// Hergebruikt de bestaande geteste PDF-normalisatie + adresparser.
// Volledige PDF-tekst blijft uitsluitend in memory en wordt nooit gelogd/opgeslagen.

// @ts-nocheck — Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import { z } from 'npm:zod@3.23.8';
import { extractKadasterAdresVoorstellenUitTekst } from '../_shared/kadasterPdfAdresParser.ts';
import { normaliseerKadasterPdfTekst } from '../_shared/kadasterPdfTekstNormalisatie.ts';

const MAX_BYTES = 10 * 1024 * 1024;

const BodySchema = z.object({
  vastgoedkans_id: z.string().uuid(),
  document_id: z.string().uuid().nullish(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function norm(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/\b(b\.?v\.?|n\.?v\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function surname(value: string): string {
  return value.trim().split(/\s+/).at(-1) ?? value.trim();
}

function ownerAliases(eigenaar: Record<string, unknown>): string[] {
  const display = String(eigenaar.bedrijfsnaam || eigenaar.naam || '').trim();
  const aliases = [display, String(eigenaar.naam || '').trim(), String(eigenaar.bedrijfsnaam || '').trim()].filter(Boolean);
  if (eigenaar.voornamen && display && !eigenaar.bedrijfsnaam) {
    aliases.push(`${String(eigenaar.voornamen).trim()} ${surname(display)}`.trim());
  }
  return [...new Set(aliases.map(norm).filter(Boolean))];
}

function parseVerzendadres(value: string | undefined): { adres: string; postcode: string; plaats: string } | null {
  if (!value) return null;
  const regels = value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  if (regels.length < 2) return null;
  const plaatsregel = regels.at(-1) ?? '';
  const match = plaatsregel.match(/^(\d{4})\s*([A-Z]{2})\s+(.+)$/i);
  if (!match) return null;
  const adres = regels.slice(0, -1).join(' ').trim();
  if (!adres) return null;
  return {
    adres,
    postcode: `${match[1]}${match[2].toUpperCase()}`,
    plaats: match[3].trim(),
  };
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

    const { data: kans, error: kansError } = await userClient
      .from('vastgoedkansen')
      .select('id')
      .eq('id', body.vastgoedkans_id)
      .maybeSingle();
    if (kansError || !kans) return json({ error: 'Vastgoedkans bestaat niet of is niet toegankelijk.' }, 404);

    // Service-role wordt pas na JWT + interne rolcontrole gebruikt voor private Storage/DB.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: documenten, error: documentenError } = await admin
      .from('kadaster_documenten')
      .select('id,storage_bucket,storage_path,product_codes,fetched_at,bestandsgrootte_bytes,mime_type')
      .eq('vastgoedkans_id', body.vastgoedkans_id)
      .order('fetched_at', { ascending: false })
      .limit(20);
    if (documentenError) return json({ error: 'Kon Kadasterberichten niet lezen.' }, 500);

    const document = (documenten ?? []).find((d) => {
      if (body.document_id && d.id !== body.document_id) return false;
      return Array.isArray(d.product_codes) && d.product_codes.includes('rechten');
    });
    if (!document) return json({ ok: true, status: 'geen_rechten_pdf', updated: 0 });
    if (document.mime_type && document.mime_type !== 'application/pdf') return json({ error: 'Kadasterbericht is geen PDF.' }, 415);
    if (document.bestandsgrootte_bytes && document.bestandsgrootte_bytes > MAX_BYTES) {
      return json({ error: 'Kadasterbericht is te groot voor tekstextractie.' }, 413);
    }

    const { data: pdfBlob, error: downloadError } = await admin.storage
      .from(document.storage_bucket || 'bito-objecten')
      .download(document.storage_path);
    if (downloadError || !pdfBlob) return json({ error: 'Kon het opgeslagen Kadasterbericht niet lezen.' }, 500);
    const arrayBuffer = await pdfBlob.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) return json({ error: 'Kadasterbericht is te groot voor tekstextractie.' }, 413);

    let normalised = '';
    try {
      const proxy = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const out = await extractText(proxy, { mergePages: true });
      const rawText = typeof out?.text === 'string' ? out.text : Array.isArray(out?.text) ? out.text.join('\n') : '';
      normalised = normaliseerKadasterPdfTekst(rawText);
    } catch {
      return json({ ok: true, status: 'geen_uitleesbare_tekstlaag', document_id: document.id, updated: 0 });
    }
    if (!normalised) return json({ ok: true, status: 'geen_uitleesbare_tekstlaag', document_id: document.id, updated: 0 });

    const voorstellen = extractKadasterAdresVoorstellenUitTekst(normalised);

    const { data: koppelingen, error: koppelingenError } = await admin
      .from('eigenaar_koppelingen')
      .select('id,eigenaar_id,kadaster_record_id,eigenaar:eigenaren(id,naam,bedrijfsnaam,voornamen,voorletters,adres,postcode,plaats,bron_details,archived_at)')
      .eq('vastgoedkans_id', body.vastgoedkans_id);
    if (koppelingenError) return json({ error: 'Kon Eigenaarsregister niet lezen.' }, 500);

    const uniekeEigenaren = new Map<string, Record<string, unknown>>();
    for (const koppeling of koppelingen ?? []) {
      const eigenaar = koppeling.eigenaar;
      if (!eigenaar || eigenaar.archived_at) continue;
      uniekeEigenaren.set(String(eigenaar.id), eigenaar);
    }
    const eigenaren = [...uniekeEigenaren.values()];
    if (!eigenaren.length) return json({ ok: true, status: 'geen_eigenaren', document_id: document.id, updated: 0 });

    const matches = new Map<string, { voorstel: Record<string, unknown>; adres: { adres: string; postcode: string; plaats: string } }>();
    for (const voorstel of voorstellen) {
      if (voorstel.confidence !== 'hoog' && voorstel.confidence !== 'middel') continue;
      const voorstelNaam = norm(voorstel.bedrijfsnaam ?? voorstel.naam ?? '');
      const adres = parseVerzendadres(voorstel.verzendadres);
      if (!voorstelNaam || !adres) continue;
      const kandidaten = eigenaren.filter((e) => ownerAliases(e).includes(voorstelNaam));
      // Ambigue naam = niets automatisch koppelen.
      if (kandidaten.length !== 1) continue;
      const ownerId = String(kandidaten[0].id);
      if (!matches.has(ownerId)) matches.set(ownerId, { voorstel: voorstel as Record<string, unknown>, adres });
    }

    const extractedAt = new Date().toISOString();
    let updated = 0;
    for (const eigenaar of eigenaren) {
      const ownerId = String(eigenaar.id);
      const match = matches.get(ownerId) ?? null;
      const details = eigenaar.bron_details && typeof eigenaar.bron_details === 'object'
        ? { ...(eigenaar.bron_details as Record<string, unknown>) }
        : {};
      details.pdf_adres_extractie = {
        document_id: document.id,
        bron: 'kadasterbericht_pdf',
        extracted_at: extractedAt,
        status: match ? 'matched' : 'no_match',
        confidence: match?.voorstel.confidence ?? null,
      };

      const patch: Record<string, unknown> = { bron_details: details };
      if (match) {
        // Alleen gaten vullen; bestaande sterkere JSON/handmatige gegevens nooit overschrijven.
        if (!eigenaar.adres) patch.adres = match.adres.adres;
        if (!eigenaar.postcode) patch.postcode = match.adres.postcode;
        if (!eigenaar.plaats) patch.plaats = match.adres.plaats;
      }

      const { error: updateError } = await admin.from('eigenaren').update(patch).eq('id', ownerId);
      if (updateError) return json({ error: 'Kon eigenaarverrijking niet opslaan.' }, 500);
      if (match && (!eigenaar.adres || !eigenaar.postcode || !eigenaar.plaats)) updated += 1;
    }

    return json({
      ok: true,
      status: matches.size ? 'verwerkt' : 'geen_adresmatch',
      document_id: document.id,
      owners_checked: eigenaren.length,
      voorstellen: voorstellen.length,
      matched: matches.size,
      updated,
      source: 'kadasterbericht_pdf',
    });
  } catch (error) {
    console.error('[kadaster-pdf-eigenaar-extractie] onverwachte fout', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Onverwachte fout bij Kadasterbericht-extractie.' }, 500);
  }
});
