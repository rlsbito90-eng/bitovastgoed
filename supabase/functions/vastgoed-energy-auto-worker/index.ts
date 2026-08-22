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

  const { data: config, error: configError } = await admin
    .from('vastgoed_intelligence_config')
    .select('energy_enabled,auto_energy_after_bag')
    .eq('id', true)
    .maybeSingle();
  if (configError || !config) return json({ error: 'Energieconfiguratie ontbreekt' }, 503);
  if (config.energy_enabled !== true || config.auto_energy_after_bag !== true) {
    return json({ ok: true, skipped: true, reason: 'auto_energy_disabled' });
  }

  const batchLimit = 20;
  const { data: candidates, error: candidateError } = await admin.rpc(
    'vastgoed_energy_auto_candidates',
    { _limit: batchLimit },
  );
  if (candidateError) return json({ error: candidateError.message }, 500);

  const cronSecret = req.headers.get('x-cron-secret')!;
  const results: Array<Record<string, unknown>> = [];
  for (const s of candidates ?? []) {
    const response = await fetch(`${supabaseUrl}/functions/v1/vastgoed-energy-verrijk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify({
        bag_vbo_id: s.bag_vbo_id,
        bag_nummeraanduiding_id: s.bag_nummeraanduiding_id,
        adres: s.adres,
        postcode: s.postcode,
        plaats: s.plaats,
        force: false,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    results.push({
      signaal_id: s.signaal_id,
      bag_vbo_id: s.bag_vbo_id,
      ok: response.ok && payload?.ok === true,
      found: payload?.found ?? null,
      cached: payload?.cached ?? false,
      status: response.status,
      error: response.ok ? null : String(payload?.error ?? `HTTP ${response.status}`).slice(0, 300),
    });
  }

  return json({
    ok: results.every((r) => r.ok === true),
    candidates: (candidates ?? []).length,
    processed: results.length,
    succeeded: results.filter((r) => r.ok === true).length,
    failed: results.filter((r) => r.ok !== true).length,
    results,
  });
});
