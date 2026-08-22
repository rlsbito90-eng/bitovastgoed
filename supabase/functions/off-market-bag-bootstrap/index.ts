// Productie-bootstrap voor de Off-Market BAG-resolver.
//
// Waarom deze laag bestaat:
// - de BAG-businesslogica blijft exact de geverifieerde GitHub-bron op de gepinde commit;
// - productie heeft OFF_MARKET_CRON_SECRET momenteel niet als Edge environment secret;
// - dezelfde secret staat wel server-side in off_market_runtime_secrets (service-role only).
//
// De bootstrap vult uitsluitend de lokale Edge-runtime-env en importeert daarna de
// gepinde BAG-resolver. Hij doet zelf geen BAG-, AI- of Kadaster-call.

import { createClient } from 'npm:@supabase/supabase-js@2';

const PINNED_BAG_COMMIT = 'e144b9da60e2b62c2291c01b3a4ffe53f0126e4f';

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

await import(
  `https://raw.githubusercontent.com/rlsbito90-eng/bitovastgoed/${PINNED_BAG_COMMIT}/supabase/functions/off-market-bag-verrijk/index.ts`
);
