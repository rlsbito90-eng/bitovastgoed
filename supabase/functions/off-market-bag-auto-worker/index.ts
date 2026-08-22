import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function isAuthorized(admin: ReturnType<typeof createClient>, provided: string | null) {
  if (!provided) return false;
  const envSecret = Deno.env.get('OFF_MARKET_CRON_SECRET')?.trim();
  if (envSecret && envSecret === provided) return true;
  const { data } = await admin
    .from('off_market_runtime_secrets')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle();
  return typeof data?.value === 'string' && data.value === provided;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRole);

  if (!(await isAuthorized(admin, req.headers.get('x-cron-secret')))) {
    return json({ error: 'Niet geautoriseerd' }, 401);
  }

  const batchLimit = 15;
  const { data: candidates, error: candidateError } = await admin
    .from('off_market_signalen')
    .select('id,adres,postcode,plaats,bron_datum')
    .eq('bag_status', 'niet_verrijkt')
    .eq('geo_status', 'verrijkt')
    .is('gearchiveerd_op', null)
    .not('adres', 'is', null)
    .order('bron_datum', { ascending: false, nullsFirst: false })
    .limit(batchLimit);

  if (candidateError) return json({ error: candidateError.message }, 500);

  const cronSecret = req.headers.get('x-cron-secret')!;
  const results: Array<Record<string, unknown>> = [];
  for (const s of candidates ?? []) {
    const response = await fetch(`${supabaseUrl}/functions/v1/off-market-bag-verrijk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify({ signaal_id: s.id, force: false }),
    });
    const payload = await response.json().catch(() => ({}));
    results.push({
      signaal_id: s.id,
      ok: response.ok && payload?.ok === true,
      status: payload?.status ?? null,
      selected_vbo_id: payload?.selected_vbo_id ?? null,
      candidates: payload?.kandidaten ?? null,
      http_status: response.status,
      error: response.ok ? null : String(payload?.error ?? `HTTP ${response.status}`).slice(0, 300),
    });
  }

  return json({
    ok: results.every((r) => r.ok === true),
    candidates: (candidates ?? []).length,
    processed: results.length,
    enriched: results.filter((r) => r.status === 'verrijkt').length,
    ambiguous: results.filter((r) => r.status === 'meerdere_matches').length,
    no_match: results.filter((r) => r.status === 'geen_match').length,
    failed: results.filter((r) => r.ok !== true).length,
    results,
  });
});
