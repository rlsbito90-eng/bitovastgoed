// Edge function: off-market-kadaster-check
// Voert een Kadaster-lookup uit voor een off-market signaal.
// V1C: alleen mock-modus geïmplementeerd; api-modus is voorbereid maar
// gooit een nette fout zolang KADASTER_API_KEY niet is geconfigureerd.
//
// - JWT-validatie via getClaims
// - Alleen interne gebruikers (admin/medewerker) mogen aanroepen
// - Schrijft één audit-rij in off_market_kadaster_checks per call
// - Slaat geen ruwe response op, alleen genormaliseerde resultaten

// @ts-nocheck — Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

import {
  normaliseerAdres, bouwZoekvarianten, detecteerComplexiteit,
} from './_adres.ts';
import { mockKadasterLookup } from './_mockAdapter.ts';
import type {
  KadasterCheckResponse, KadasterModus, KadasterStatus, KadasterResultaat,
} from './_types.ts';

interface RequestBody {
  signaal_id: string;
  zoekvariant_id?: string;
  handmatige_zoekterm?: string | null;
  modus?: KadasterModus;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claims.claims.sub as string;

    // Rol-check
    const { data: rollen, error: rolErr } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (rolErr) return json({ error: rolErr.message }, 500);
    const isIntern = (rollen ?? []).some(r => r.role === 'admin' || r.role === 'medewerker');
    if (!isIntern) return json({ error: 'Forbidden' }, 403);

    const body = (await req.json()) as RequestBody;
    if (!body?.signaal_id) return json({ error: 'signaal_id ontbreekt' }, 400);
    const modus: KadasterModus = body.modus ?? 'mock';

    // Service client voor de eigenlijke leesoperatie + audit insert
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: signaal, error: sigErr } = await admin
      .from('off_market_signalen')
      .select('id, titel, adres, postcode, plaats')
      .eq('id', body.signaal_id)
      .maybeSingle();
    if (sigErr) return json({ error: sigErr.message }, 500);
    if (!signaal) return json({ error: 'Signaal niet gevonden' }, 404);

    const adres = normaliseerAdres({
      origineel: signaal.adres ?? signaal.titel ?? '',
      postcode: signaal.postcode,
      plaats: signaal.plaats,
    });
    const complexiteit = detecteerComplexiteit(adres);
    const varianten = bouwZoekvarianten(adres);

    // Variant kiezen
    let variant = varianten.find(v => v.id === body.zoekvariant_id) ?? varianten[0];
    if (body.handmatige_zoekterm) {
      variant = {
        id: 'handmatig',
        label: body.handmatige_zoekterm,
        precisie: 0.5,
        metToevoeging: false,
        query: { vrij: body.handmatige_zoekterm },
      };
    }

    let status: KadasterStatus = 'geen_resultaat';
    let resultaten: KadasterResultaat[] = [];
    let match_confidence = 0;
    let foutmelding: string | undefined;

    if (!variant) {
      status = 'mislukt';
      foutmelding = 'Geen bruikbare zoekvariant beschikbaar';
    } else if (modus === 'mock') {
      const mock = mockKadasterLookup({
        variant,
        origineelAdres: signaal.adres ?? signaal.titel ?? '',
      });
      status = mock.status;
      resultaten = mock.resultaten;
      match_confidence = mock.match_confidence;
    } else if (modus === 'api') {
      const apiKey = Deno.env.get('KADASTER_API_KEY');
      if (!apiKey) {
        status = 'mislukt';
        foutmelding = 'Kadaster API nog niet geconfigureerd (KADASTER_API_KEY ontbreekt)';
      } else {
        // TODO V1D: echte Kadaster-call implementeren
        status = 'mislukt';
        foutmelding = 'API-adapter nog niet geïmplementeerd';
      }
    } else {
      status = 'mislukt';
      foutmelding = `Onbekende modus: ${modus}`;
    }

    // Audit insert
    const { data: checkRow, error: insErr } = await admin
      .from('off_market_kadaster_checks')
      .insert({
        signaal_id: body.signaal_id,
        uitgevoerd_door: userId,
        modus,
        zoekvariant: variant?.id ?? null,
        zoekterm: variant?.query ?? null,
        status,
        match_confidence: match_confidence > 0 ? match_confidence : null,
        resultaten,
        foutmelding,
      })
      .select('id')
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    const response: KadasterCheckResponse & { complex?: boolean; complex_redenen?: string[] } = {
      check_id: checkRow.id as string,
      modus,
      status,
      zoekvariant: variant?.id ?? '',
      resultaten,
      foutmelding,
      complex: complexiteit.complex,
      complex_redenen: complexiteit.redenen,
    };
    return json(response, 200);
  } catch (e) {
    console.error('[off-market-kadaster-check] fout:', e);
    return json({ error: e instanceof Error ? e.message : 'Onbekende fout' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
