// Automatische AI-worker voor Off-Market Radar.
// Selectie gebeurt server-side via off_market_ai_auto_candidates().
// De enrich-v2 functie blijft per call de centrale request- en budgetguard afdwingen.
// Geen BAG- of Kadaster-cascade.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function runtimeSecret(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const env = Deno.env.get('OFF_MARKET_CRON_SECRET')?.trim();
  if (env) return env;
  const { data } = await admin
    .from('off_market_runtime_secrets')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle();
  return typeof data?.value === 'string' && data.value.trim() ? data.value.trim() : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const secret = await runtimeSecret(admin);
  const provided = req.headers.get('x-cron-secret')?.trim() ?? '';
  if (!secret || !provided || provided !== secret) {
    return json({ error: 'Niet geautoriseerd' }, 401);
  }

  const { data: candidates, error: candidateError } = await admin.rpc('off_market_ai_auto_candidates');
  if (candidateError) return json({ error: `Kandidaten ophalen mislukt: ${candidateError.message}` }, 500);

  const rows = Array.isArray(candidates) ? candidates : [];
  if (rows.length === 0) return json({ ok: true, selected: 0, processed: 0, succeeded: 0, failed: 0 });

  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ id: string; status: number; error: string }> = [];
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/off-market-enrich-signaal-v2`;

  // Bewust sequentieel: budget/status wordt vóór iedere individuele provider-call opnieuw gelezen.
  for (const row of rows as Array<{ id?: string }>) {
    if (!row?.id) continue;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': secret,
      },
      body: JSON.stringify({ signaal_id: row.id, force: false }),
    });

    if (response.ok) {
      succeeded++;
      continue;
    }

    failed++;
    const payload = await response.json().catch(() => ({}));
    failures.push({
      id: row.id,
      status: response.status,
      error: typeof payload?.error === 'string' ? payload.error.slice(0, 300) : 'Onbekende fout',
    });

    // Budget-, rate-limit- of authblokkade: niet doorrammen met de rest van de batch.
    if (response.status === 401 || response.status === 402 || response.status === 429) break;
  }

  return json({
    ok: failed === 0,
    selected: rows.length,
    processed: succeeded + failed,
    succeeded,
    failed,
    failures,
  }, failed === 0 ? 200 : 207);
});
