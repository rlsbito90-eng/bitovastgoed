// Productie-entrypoint voor de robuuste Off-Market normalizer.
// Hydrateert uitsluitend de bestaande server-side cron secret wanneer de Edge env
// die niet bevat en laadt daarna de lokale canonieke normalizer.
// Geen AI-, GEO-, BAG- of Kadaster-call in deze bootstrap zelf.

import { createClient } from 'npm:@supabase/supabase-js@2';

if (!Deno.env.get('OFF_MARKET_CRON_SECRET')?.trim()) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin
    .from('off_market_runtime_secrets')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle();

  if (!error && typeof data?.value === 'string' && data.value.trim()) {
    Deno.env.set('OFF_MARKET_CRON_SECRET', data.value.trim());
  }
}

await import('../off-market-normalize-ruw/index.ts');
