// Edge function: kadaster-pdf-eigenaar-extractie
//
// Leest uitsluitend een reeds intern opgeslagen officieel Kadasterbericht/PDF
// en vult ontbrekende eigenaar-adresvelden in het centrale Eigenaarsregister aan.
// Geen Kadaster API-call, geen betaalde actie, geen OCR en geen CRM-relatie-mutatie.
// Volledige PDF-tekst blijft uitsluitend in memory en wordt nooit gelogd/opgeslagen.

// @ts-nocheck — Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { extractKadasterPdfText } from '../_shared/kadasterPdfText.ts';
import { parseKadasterPdfOwnerAddresses } from '../_shared/kadasterPdfOwner.ts';

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

function surnameFromDisplayName(value: string): string {
  return value.trim().split(/\s+/).at(-1) ?? value.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Alleen POST is toegestaan.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Niet ingelogd.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.slice('Bearer '.length);
    const { data: claims, error: claimsError } = await client.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) return json({ error: 'Niet ingelogd.' }, 401);

    const userId = claims.claims.sub as string;
    const { data: rollen, error: rollenError } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (rollenError) return json({ error: 'Kon gebruikersrol niet controleren.' }, 403);
    const isIntern = (rollen ?? []).some((r) => r.role === 'admin' || r.role === 'medewerker');
    if (!isIntern) return json({ error: 'Geen toegang.' }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Ongeldige invoer.' }, 400);
    const body = parsed.data;

    const { data: kans, error: kansError } = await client
      .from('vastgoedkansen')
      .select('id')
      .eq('id', body.vastgoedkans_id)
      .maybeSingle();
    if (kansError || !kans) return json({ error: 'Vastgoedkans bestaat niet of is niet toegankelijk.' }, 404);

    const { data: documenten, error: documentenError } = await client
      .from('kadaster_documenten')
      .select('id,storage_bucket,storage_path,product_codes,fetched_at')
      .eq('vastgoedkans_id', body.vastgoedkans_id)
      .order('fetched_at', { ascending: false })
      .limit(20);
    if (documentenError) return json({ error: 'Kon Kadasterberichten niet lezen.' }, 500);

    const document = (documenten ?? []).find((d) => {
      if (body.document_id && d.id !== body.document_id) return false;
      return Array.isArray(d.product_codes) && d.product_codes.includes('rechten');
    });
    if (!document) return json({ ok: true, status: 'geen_rechten_pdf', updated: 0 });

    const { data: pdfBlob, error: downloadError } = await client.storage
      .from(document.storage_bucket || 'bito-objecten')
      .download(document.storage_path);
    if (downloadError || !pdfBlob) return json({ error: 'Kon het opgeslagen Kadasterbericht niet lezen.' }, 500);

    let text: string;
    try {
      text = await extractKadasterPdfText(new Uint8Array(await pdfBlob.arrayBuffer()));
    } catch (error) {
      return json({
        ok: true,
        status: 'geen_uitleesbare_tekstlaag',
        document_id: document.id,
        updated: 0,
        error: error instanceof Error ? error.message : 'PDF-tekstextractie mislukt.',
      });
    }

    const { data: koppelingen, error: koppelingenError } = await client
      .from('eigenaar_koppelingen')
      .select('id,eigenaar_id,kadaster_record_id,eigenaar:eigenaren(id,naam,bedrijfsnaam,voornamen,voorletters,adres,postcode,plaats,bron_details,archived_at)')
      .eq('vastgoedkans_id', body.vastgoedkans_id);
    if (koppelingenError) return json({ error: 'Kon Eigenaarsregister niet lezen.' }, 500);

    const uniekeEigenaren = new Map<string, Record<string, unknown>>();
    for (const koppeling of koppelingen ?? []) {
      const eigenaar = koppeling.eigenaar;
      if (!eigenaar || eigenaar.archived_at) continue;
      uniekeEigenaren.set(eigenaar.id, eigenaar);
    }
    const eigenaren = [...uniekeEigenaren.values()];
    if (!eigenaren.length) return json({ ok: true, status: 'geen_eigenaren', document_id: document.id, updated: 0 });

    const hints = eigenaren.map((e) => {
      const display = String(e.bedrijfsnaam || e.naam || '').trim();
      const aliases = [String(e.naam || '').trim(), String(e.bedrijfsnaam || '').trim()].filter(Boolean);
      if (e.voornamen && display) {
        aliases.push(`${String(e.voornamen).trim()} ${surnameFromDisplayName(display)}`.trim());
      }
      return { id: String(e.id), naam: display, alternatieveNamen: [...new Set(aliases)] };
    }).filter((h) => h.naam);

    const matches = parseKadasterPdfOwnerAddresses(text, hints);
    const matchesPerOwner = new Map(matches.map((m) => [m.ownerId, m]));
    const extractedAt = new Date().toISOString();
    let updated = 0;

    for (const eigenaar of eigenaren) {
      const ownerId = String(eigenaar.id);
      const match = matchesPerOwner.get(ownerId) ?? null;
      const details = (eigenaar.bron_details && typeof eigenaar.bron_details === 'object')
        ? { ...(eigenaar.bron_details as Record<string, unknown>) }
        : {};
      details.pdf_adres_extractie = {
        document_id: document.id,
        bron: 'kadasterbericht_pdf',
        extracted_at: extractedAt,
        status: match ? 'matched' : 'no_match',
        confidence: match?.confidence ?? null,
      };

      const patch: Record<string, unknown> = { bron_details: details };
      // PDF vult alleen ontbrekende velden aan; bestaande sterkere data wordt nooit overschreven.
      if (match) {
        if (!eigenaar.adres) patch.adres = match.adres;
        if (!eigenaar.postcode) patch.postcode = match.postcode;
        if (!eigenaar.plaats) patch.plaats = match.plaats;
      }

      const { error: updateError } = await client.from('eigenaren').update(patch).eq('id', ownerId);
      if (updateError) return json({ error: 'Kon eigenaarverrijking niet opslaan.' }, 500);
      if (match && (!eigenaar.adres || !eigenaar.postcode || !eigenaar.plaats)) updated += 1;
    }

    return json({
      ok: true,
      status: matches.length ? 'verwerkt' : 'geen_adresmatch',
      document_id: document.id,
      owners_checked: eigenaren.length,
      matched: matches.length,
      updated,
      source: 'kadasterbericht_pdf',
    });
  } catch (error) {
    console.error('[kadaster-pdf-eigenaar-extractie] onverwachte fout', error instanceof Error ? error.message : error);
    return json({ error: 'Onverwachte fout bij Kadasterbericht-extractie.' }, 500);
  }
});
