// WordPress Contact Form 7 -> CRM intake buffer, never direct update to Relaties.
// Supabase Edge Function owns its authentication; verify_jwt=false is intentional.
// No CORS headers: server-to-server only. Credentials are SHA-256 hashes (no plaintext in SQL).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const source = 'cf7_investor_profile';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const client = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const response = (status: number, message: string) =>
  Response.json({ ok: status === 202, status: message }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
const EMAIL_RE = /^[a-z0-9._+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const encoder = new TextEncoder();

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function readBodyBounded(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length') || 0) > 65536) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 65536) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { data.set(c, offset); offset += c.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}
function isFieldRecord(v: unknown): v is Record<string, string | string[]> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const record = v as Record<string, unknown>;
  if (Object.keys(record).length > 100) return false;
  return Object.entries(record).every(([k,x]) =>
    k.length <= 100 && (
      (typeof x === 'string' && x.length <= 6000) ||
      (Array.isArray(x) && x.length <= 50 &&
        x.every(y => typeof y === 'string' && y.length <= 2000))
    )
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return response(405, 'method_not_allowed');
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return response(415, 'json_required');
  if (!client) return response(503, 'not_configured');

  const token = req.headers.get('x-bito-webhook-token') ?? '';
  const timestamp = Number(req.headers.get('x-bito-timestamp') ?? '');
  if (!/^[a-f0-9]{64}$/i.test(token) || !Number.isSafeInteger(timestamp) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300)
    return response(401, 'unauthorized');

  const { data: credential, error: credentialError } = await client
    .from('website_intake_credentials')
    .select('token_sha256,enabled').eq('source', source).maybeSingle();
  if (credentialError) return response(503, 'not_configured');
  if (!credential?.enabled || !sameHex(await sha256(token), credential.token_sha256 ?? ''))
    return response(401, 'unauthorized');

  let payload: Record<string, unknown>;
  try {
    const raw = await readBodyBounded(req);
    if (!raw) return response(413, 'payload_too_large');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return response(400, 'invalid_payload');
    payload = parsed as Record<string, unknown>;
  } catch {
    return response(400, 'invalid_json');
  }

  const applicant = payload.contact as Record<string, unknown> | undefined;
  const naam = typeof applicant?.naam === 'string' ? applicant.naam.trim() : '';
  const email = typeof applicant?.email === 'string' ? applicant.email.trim().toLowerCase() : '';
  const telefoon = typeof applicant?.telefoon === 'string' ? applicant.telefoon.trim() : '';
  const eventId = typeof payload.event_id === 'string' ? payload.event_id : '';
  if (payload.site !== 'bitovastgoed.nl' ||
      payload.form_title !== 'Investeringsprofiel vastgoed' ||
      !UUID_RE.test(eventId) ||
      naam.length < 2 || naam.length > 160 ||
      !EMAIL_RE.test(email) || email.length > 254 ||
      telefoon.length > 50 ||
      !isFieldRecord(payload.fields))
    return response(400, 'invalid_profile');

  // Alleen exacte e-mailmatches zijn betrouwbaar genoeg voor een automatisch
  // voorstel. Alle andere varianten blijven in de beoordelingswachtrij.
  const [relations, contacts] = await Promise.all([
    client.from('relaties').select('id,email')
      .is('soft_deleted_at',null).ilike('email',email).limit(5),
    client.from('relatie_contactpersonen').select('relatie_id,email')
      .ilike('email',email).limit(5),
  ]);
  if (relations.error || contacts.error) return response(503, 'lookup_failed');
  const matchedIds = new Set<string>();
  for (const r of relations.data ?? []) {
    if (r.email?.trim().toLowerCase() === email) matchedIds.add(r.id);
  }
  for (const c of contacts.data ?? []) {
    if (c.email?.trim().toLowerCase() === email) matchedIds.add(c.relatie_id);
  }
  const suggested = matchedIds.size === 1 ? [...matchedIds][0] : null;
  const status = matchedIds.size > 1 ? 'dubbelzinnig'
    : matchedIds.size === 1 ? 'bestaande_relatie'
    : 'nieuw_te_controleren';

  const { error } = await client.from('website_investor_intakes').insert({
    source, source_event_id: eventId,
    form_id: typeof payload.form_id === 'string' ? payload.form_id.slice(0,100) : null,
    form_title: 'Investeringsprofiel vastgoed',
    applicant_name: naam, applicant_email: email,
    applicant_phone: telefoon || null,
    raw_payload: payload,
    status, suggested_relatie_id: suggested,
  });
  if (error?.code === '23505') return response(202, 'already_received');
  if (error) return response(503, 'storage_failed');
  return response(202, 'received');
});
