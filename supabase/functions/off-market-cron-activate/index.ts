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
    // Geen user-auth nodig: deze functie accepteert geen input en de cron-secret
    // wordt alleen server-side gelezen. De RPC zelf is alleen toegankelijk voor service_role.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
