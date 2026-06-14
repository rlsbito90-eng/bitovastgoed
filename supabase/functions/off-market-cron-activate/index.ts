// off-market-cron-activate
// Eénmalige interne activator: maakt of vervangt de pg_cron job
// 'off-market-sync-hourly'. Leest OFF_MARKET_CRON_SECRET uit env en geeft
// die door aan de SECURITY DEFINER RPC `activate_off_market_cron`.
// De secret komt NOOIT terug in de response.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: isIntern } = await admin.rpc('is_intern_gebruiker',
      { _user_id: claimsData.claims.sub as string });
    if (!isIntern) {
      return new Response(JSON.stringify({ error: 'Geen toegang' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const secret = Deno.env.get('OFF_MARKET_CRON_SECRET');
    if (!secret || secret.length < 10) {
      return new Response(JSON.stringify({ error: 'OFF_MARKET_CRON_SECRET ontbreekt of te kort' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data, error } = await admin.rpc('activate_off_market_cron', { p_secret: secret });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, ...((data ?? {}) as Record<string, unknown>) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('cron-activate error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
