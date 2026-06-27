// POC — Edge Function `kadaster-pdf-text-extract`
//
// Doel: extraheer tekst uit een reeds opgeslagen Kadasterbericht-PDF
// (rij uit `kadaster_documenten` → bytes uit Storage) en haal die tekst
// door de bestaande pure parser om adresvoorstellen te valideren.
//
// Strikt READ-ONLY:
//   - Geen DB-writes, geen Storage-writes, geen Kadaster-aanroep.
//   - Geen persistente opslag van geëxtraheerde tekst of voorstellen.
//   - PDF-inhoud, namen of adressen NIET loggen — alleen tellingen.
//   - Alleen interne gebruikers (admin/medewerker) mogen aanroepen.

// @ts-nocheck — Deno runtime

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import { z } from 'npm:zod@3.23.8';

import {
  extractKadasterAdresVoorstellenUitTekst,
  type KadasterAdresVoorstel,
} from '../_shared/kadasterPdfAdresParser.ts';
import { normaliseerKadasterPdfTekst } from '../_shared/kadasterPdfTekstNormalisatie.ts';
import { maskeerEersteRegels, maskeerPreview } from '../_shared/kadasterPdfTekstMasker.ts';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB harde POC-bovengrens

const BodySchema = z.object({
  document_id: z.string().uuid(),
});

function jsonResp(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResp({ error: 'Server niet correct geconfigureerd.' }, 500);
  }

  // 1) JWT valideren — alleen interne gebruikers.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!token) {
    return jsonResp({ error: 'Niet geautoriseerd.' }, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResp({ error: 'Niet geautoriseerd.' }, 401);
  }
  const userId = userData.user.id;

  // RPC-check via dezelfde JWT-context (zo geldt RLS automatisch).
  const { data: isIntern, error: rolErr } = await userClient.rpc('is_intern_gebruiker', {
    _user_id: userId,
  });
  if (rolErr || !isIntern) {
    return jsonResp({ error: 'Alleen interne gebruikers mogen deze actie uitvoeren.' }, 403);
  }

  // 2) Body parsen.
  let body: unknown;
  try { body = await req.json(); } catch { return jsonResp({ error: 'Ongeldige JSON-body.' }, 400); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResp({ error: 'Ongeldige input.', details: parsed.error.flatten().fieldErrors }, 400);
  }
  const { document_id } = parsed.data;

  // 3) Document opzoeken (service-role; RLS al door rol-check afgevangen).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: doc, error: docErr } = await admin
    .from('kadaster_documenten')
    .select('id, storage_bucket, storage_path, bestandsgrootte_bytes, mime_type')
    .eq('id', document_id)
    .maybeSingle();
  if (docErr) return jsonResp({ error: 'Document-lookup mislukt.' }, 500);
  if (!doc) return jsonResp({ error: 'Document niet gevonden.' }, 404);
  if (doc.mime_type && doc.mime_type !== 'application/pdf') {
    return jsonResp({ error: 'Document is geen PDF.' }, 415);
  }
  if (doc.bestandsgrootte_bytes && doc.bestandsgrootte_bytes > MAX_BYTES) {
    return jsonResp({
      error: `PDF te groot voor POC (limiet ${MAX_BYTES} bytes).`,
    }, 413);
  }

  // 4) PDF downloaden uit Storage.
  const dl = await admin.storage.from(doc.storage_bucket || 'bito-objecten').download(doc.storage_path);
  if (dl.error || !dl.data) {
    return jsonResp({ error: 'PDF kon niet uit storage worden gehaald.' }, 502);
  }
  const arrayBuf = await dl.data.arrayBuffer();
  if (arrayBuf.byteLength > MAX_BYTES) {
    return jsonResp({ error: 'PDF te groot voor POC.' }, 413);
  }
  const bytes = new Uint8Array(arrayBuf);

  // 5) Tekst extraheren met unpdf.
  let rawText = '';
  let pageCount = 0;
  try {
    const pdf = await getDocumentProxy(bytes);
    pageCount = pdf.numPages ?? 0;
    const out = await extractText(pdf, { mergePages: true });
    rawText = typeof out?.text === 'string'
      ? out.text
      : Array.isArray(out?.text) ? out.text.join('\n') : '';
  } catch (e) {
    return jsonResp({
      error: 'PDF-tekstextractie mislukt.',
      reason: 'pdf_lib_failure',
    }, 502);
  }

  // 6) Normaliseren + parser aanroepen.
  const normalised = normaliseerKadasterPdfTekst(rawText);
  let voorstellen: KadasterAdresVoorstel[] = [];
  try {
    voorstellen = extractKadasterAdresVoorstellenUitTekst(normalised);
  } catch (e) {
    return jsonResp({ error: 'Parser-fout op genormaliseerde tekst.' }, 500);
  }

  // 7) Return — alleen voorstellen + tellingen, geen ruwe tekst.
  return jsonResp({
    document_id,
    voorstellen,
    debug: {
      pages: pageCount,
      raw_chars: rawText.length,
      normalised_chars: normalised.length,
      voorstellen_count: voorstellen.length,
      gemaskeerde_tekst_preview: maskeerPreview(normalised, 1500),
      eerste_40_regels: maskeerEersteRegels(normalised, 40),
    },
  });
});
