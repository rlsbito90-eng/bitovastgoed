// Edge function: kadaster-objectinformatie
// Fase 4K.1 — scaffold voor de Kadaster/Kadata Objectinformatie API.
//
// Doel:
//   - Frontend roept alleen deze functie aan; nooit Kadaster direct.
//   - API-key staat uitsluitend in Supabase Secret KADASTER_OBJECTINFORMATIE_API_KEY.
//   - Twee modi:
//       'gebiedsdata' (gratis)   → producten: lasten + buurt
//       'kadaster'   (€ 0,20)    → producten: object + waarde
//                                  (deliver = withoutProduct, zodat een
//                                   ontbrekend product de overige niet blokkeert)
//   - Geen automatische calls; geen retry-loops; geen logging van key.
//   - V1.1: response wordt genormaliseerd en als preview teruggegeven.
//           Overname naar CRM gebeurt in de frontend, handmatig per veld.
//
// @ts-nocheck — Deno runtime

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

import type {
  KadasterModus, KadasterProductCode, KadasterPreview,
} from './_types.ts';
import { normaliseerKadasterResponse, logRegel, responseShape } from './_normalize.ts';

// Officiële Kadata Objectinformatie API host (zie Swagger:
//   https://kadatawebservice.kadaster.nl/objectinformatieApi/swagger/v1/swagger.json).
// `api.kadaster.nl/objectinformatieapi/...` bestaat NIET en geeft Kadaster's
// generieke 404-pagina terug, wat eerder als "object niet gevonden" werd
// geïnterpreteerd.
const KADASTER_BASE_URL =
  Deno.env.get('KADASTER_OBJECTINFORMATIE_BASE_URL')
  ?? 'https://kadatawebservice.kadaster.nl/objectinformatieapi/api/v1';

const DEFAULT_PRODUCTEN_PER_MODUS: Record<KadasterModus, KadasterProductCode[]> = {
  // Standalone gebiedsdata-aanvragen worden door Kadaster geweigerd
  // ("minimaal één product met kosten"); de UI biedt dit niet meer aan,
  // maar we houden de mapping als documentatie.
  gebiedsdata: ['lasten', 'buurt'],
  kadaster:    ['object', 'waarde', 'lasten', 'buurt'],
};

const BETAALDE_PRODUCTEN: KadasterProductCode[] = ['object', 'waarde', 'rechten'];

/**
 * Veilige allowlist zolang Kadaster's /products endpoint nog niet bevestigd
 * is voor deze API-key. `lasten` en `buurt` zijn in de praktijk geweigerd
 * met HTTP 409 "Een of meer onbekende producten opgegeven", dus we sturen
 * ze standaard niet mee. Wordt overschreven door de live /products lijst
 * zodra die succesvol is opgehaald.
 */
const FALLBACK_ALLOWED: KadasterProductCode[] = ['object', 'waarde'];

// Process-cache voor /products. TTL klein houden zodat sleutelwijzigingen
// snel zichtbaar worden, maar voorkomt dat we elke /report een extra GET doen.
let productsCache: { codes: KadasterProductCode[]; fetched_at: number } | null = null;
const PRODUCTS_TTL_MS = 5 * 60 * 1000;

async function fetchAvailableProducts(apiKey: string): Promise<KadasterProductCode[] | null> {
  const now = Date.now();
  if (productsCache && (now - productsCache.fetched_at) < PRODUCTS_TTL_MS) {
    return productsCache.codes;
  }
  try {
    const resp = await fetch(`${KADASTER_BASE_URL}/products`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-API-KEY': apiKey },
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    const arr = Array.isArray(data)
      ? data
      : (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).products))
        ? (data as { products: unknown[] }).products
        : null;
    if (!arr) return null;
    const codes: KadasterProductCode[] = [];
    for (const item of arr) {
      const code = typeof item === 'string'
        ? item
        : (item && typeof item === 'object' ? String((item as Record<string, unknown>).code ?? '') : '');
      const lower = code.toLowerCase();
      if (['object', 'waarde', 'rechten', 'lasten', 'buurt'].includes(lower)) {
        codes.push(lower as KadasterProductCode);
      }
    }
    productsCache = { codes, fetched_at: now };
    return codes;
  } catch {
    return null;
  }
}

const AdresSchema = z.object({
  postalcode: z.string().trim().min(6).max(7),
  houseNumber: z.string().trim().regex(/^\d{1,6}$/, 'huisnummer numeriek'),
  houseLetter: z.string().trim().max(1).nullish(),
  houseNumberAddition: z.string().trim().max(8).nullish(),
});

const BodySchema = z.object({
  modus: z.enum(['gebiedsdata', 'kadaster']),
  bagId: z.string().trim().min(8).max(32).nullish(),
  adres: AdresSchema.nullish(),
  producten: z.array(z.enum(['object', 'waarde', 'rechten', 'lasten', 'buurt']))
    .min(1).max(5).nullish(),
  context: z.object({
    object_id: z.string().uuid().nullish(),
    signaal_id: z.string().uuid().nullish(),
  }).nullish(),
}).refine((v) => !!v.bagId || !!v.adres, {
  message: 'Geef bagId of adres mee',
  path: ['adres'],
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Niet ingelogd', 401, 'unauthorized');
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return jsonError('Niet ingelogd', 401, 'unauthorized');
    }
    const userId = claims.claims.sub as string;

    const { data: rollen } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const isIntern = (rollen ?? []).some(r =>
      r.role === 'admin' || r.role === 'medewerker'
    );
    if (!isIntern) return jsonError('Geen toegang', 403, 'forbidden');

    // --- Input ---
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(
        'Ongeldige invoer: ' + JSON.stringify(parsed.error.flatten().fieldErrors),
        400, 'invalid_input',
      );
    }
    const body = parsed.data;
    const modus = body.modus;

    // --- API key ---
    const apiKey = Deno.env.get('KADASTER_OBJECTINFORMATIE_API_KEY');
    if (!apiKey) {
      return jsonError(
        'Kadaster API-key is niet geconfigureerd. Voeg KADASTER_OBJECTINFORMATIE_API_KEY toe als Supabase Secret.',
        503, 'key_invalid',
      );
    }

    // --- Productselectie bepalen ---
    // Default per modus, of expliciete selectie uit de body. Kadaster
    // weigert bestellingen zonder betaald product; we valideren dat
    // hier vooraf om onnodige upstream-calls te voorkomen.
    const gevraagd = body.producten && body.producten.length > 0
      ? Array.from(new Set(body.producten))
      : DEFAULT_PRODUCTEN_PER_MODUS[modus];

    // Allowlist: live /products endpoint indien beschikbaar, anders
    // veilige fallback met alleen ['object', 'waarde']. `lasten`/`buurt`
    // worden in V1 nooit gestuurd zonder bevestiging via /products.
    const live = await fetchAvailableProducts(apiKey);
    const allowed = live && live.length > 0 ? live : FALLBACK_ALLOWED;
    const filteredOut = gevraagd.filter(c => !allowed.includes(c));
    const codes = gevraagd.filter(c => allowed.includes(c)) as KadasterProductCode[];

    const heeftBetaald = codes.some(c => BETAALDE_PRODUCTEN.includes(c));
    if (!heeftBetaald) {
      return jsonError(
        filteredOut.length > 0
          ? `Geen geldige producten over na filtering. Niet beschikbaar voor deze API-key: ${filteredOut.join(', ')}.`
          : 'Selecteer minimaal één betaald Kadaster-product (object of waarde).',
        400, 'product_invalid',
        { allowed_products: allowed, products_source: live ? 'live' : 'fallback', filtered_out: filteredOut },
      );
    }
    // Swagger definieert de enum als PascalCase ("OnlyComplete", "WithoutProduct",
    // "PartialProduct"). Lowercase varianten worden door Kadaster afgewezen.
    const selection = codes.map((code) => ({
      code,
      deliver: 'WithoutProduct' as const,
    }));

    const reportBody: Record<string, unknown> = {
      selection,
      includePdf: false,
    };
    let zoekadresType: 'bagId' | 'pht' = 'pht';
    let zoekadresWaarde = '';
    if (body.bagId) {
      reportBody.bagId = body.bagId;
      zoekadresType = 'bagId';
      zoekadresWaarde = body.bagId;
    } else if (body.adres) {
      // Postcode altijd normaliseren naar formaat zonder spatie + uppercase.
      const normPostcode = body.adres.postalcode.replace(/\s+/g, '').toUpperCase();
      if (!/^\d{4}[A-Z]{2}$/.test(normPostcode)) {
        return jsonError(
          'Ongeldige postcode. Verwacht 4 cijfers + 2 letters (bv. 3273AV).',
          400, 'invalid_input',
        );
      }
      const pht: Record<string, string> = {
        postalcode: normPostcode,
        houseNumber: String(body.adres.houseNumber),
      };
      // Lege strings niet meesturen — Swagger geeft nullable, en Kadaster
      // weigert in de praktijk lege toevoegingen bij sommige adressen.
      if (body.adres.houseLetter && body.adres.houseLetter.trim()) {
        pht.houseLetter = body.adres.houseLetter.trim();
      }
      if (body.adres.houseNumberAddition && body.adres.houseNumberAddition.trim()) {
        pht.houseNumberAddition = body.adres.houseNumberAddition.trim();
      }
      reportBody.pht = pht;
      zoekadresWaarde = [
        normPostcode,
        body.adres.houseNumber + (body.adres.houseLetter ?? ''),
        body.adres.houseNumberAddition,
      ].filter(Boolean).join(' ');
    }

    // Veilige debug-info: bevat genormaliseerde input + request body zonder
    // de API-key. Wordt zowel bij succes als fout teruggegeven zodat de UI
    // technische details kan tonen.
    const debug = {
      endpoint: '/report',
      base_url: KADASTER_BASE_URL,
      request_preview: reportBody,
      zoekadres: { type: zoekadresType, waarde: zoekadresWaarde },
      product_codes: codes,
      allowed_products: allowed,
      products_source: live ? 'live' : 'fallback',
      filtered_out: filteredOut,
    };

    // --- Kadaster call ---
    const upstreamUrl = `${KADASTER_BASE_URL}/report`;
    const t0 = Date.now();
    let upstreamResp: Response;
    try {
      upstreamResp = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify(reportBody),
      });
    } catch (e) {
      console.log('[kadaster-objectinformatie] netwerk-fout', logRegel({
        modus, user: userId, dur_ms: Date.now() - t0,
        msg: e instanceof Error ? e.message : 'fetch failed',
      }));
      return jsonError(
        'Kadaster is tijdelijk niet bereikbaar. Probeer later opnieuw.',
        502, 'upstream_unavailable', debug,
      );
    }

    // --- HTTP-status mapping naar NL meldingen ---
    if (!upstreamResp.ok) {
      const status = upstreamResp.status;
      const tekst = await upstreamResp.text().catch(() => '');
      // Probeer Kadaster's ErrorResponse uit te lezen (message + identifier).
      let upstreamMessage: string | null = null;
      let upstreamIdentifier: string | null = null;
      try {
        const parsed = JSON.parse(tekst);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.message === 'string') upstreamMessage = parsed.message;
          if (typeof parsed.identifier === 'string') upstreamIdentifier = parsed.identifier;
        }
      } catch { /* niet-JSON respons (bv. HTML 404 pagina) */ }
      const debugMetUpstream = {
        ...debug,
        upstream_status: status,
        upstream_message: upstreamMessage,
        upstream_identifier: upstreamIdentifier,
        upstream_snippet: upstreamMessage ? null : tekst.slice(0, 240),
      };
      console.log('[kadaster-objectinformatie] upstream-fout', logRegel({
        modus, user: userId, status, dur_ms: Date.now() - t0,
        identifier: upstreamIdentifier,
        snippet: (upstreamMessage ?? tekst).slice(0, 200),
      }));
      if (status === 401 || status === 406) {
        return jsonError(
          'Kadaster API-key is ongeldig of verlopen. Verleng of vervang de API-key in Supabase Secrets.',
          status, 'key_invalid', debugMetUpstream,
        );
      }
      if (status === 412) {
        return jsonError(
          'Kadaster-bestedingsruimte is overschreden. Controleer de instellingen in Kadaster/Kadata.',
          status, 'budget_exceeded', debugMetUpstream,
        );
      }
      if (status === 404) {
        return jsonError(
          `Geen Kadasterobject gevonden voor dit adres. Gecontroleerd zoekadres: ${zoekadresWaarde}`,
          status, 'not_found', debugMetUpstream,
        );
      }
      if (status === 409 || status === 422) {
        // Parse "Een of meer onbekende producten opgegeven: lasten, buurt"
        const m = upstreamMessage?.match(/onbekende producten[^:]*:\s*([a-zA-Z, ]+)/i);
        const onbekend = m?.[1]?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
        const melding = onbekend.length > 0
          ? `Product niet beschikbaar voor deze API-key: ${onbekend.join(', ')}.`
          : (upstreamMessage
              ? `Aanvraag geweigerd door Kadaster: ${upstreamMessage}`
              : 'Aanvraag ongeldig (product of adres niet geaccepteerd).');
        return jsonError(melding, status, 'product_invalid', debugMetUpstream);
      }
      if (status >= 500) {
        return jsonError(
          'Kadaster is tijdelijk niet beschikbaar. Probeer later opnieuw.',
          status, 'upstream_unavailable', debugMetUpstream,
        );
      }
      return jsonError(
        `Onverwachte Kadaster-fout (HTTP ${status}).`,
        status, 'unknown', debugMetUpstream,
      );
    }

    const ruwe = await upstreamResp.json().catch(() => null);
    const producten = normaliseerKadasterResponse(ruwe, codes);
    const shape = responseShape(ruwe);

    const preview: KadasterPreview = {
      modus,
      bron: 'kadaster_objectinformatie_api',
      opgehaald_op: new Date().toISOString(),
      productcodes: codes,
      // Prijs is afhankelijk van de Kadaster-tarieven en wordt niet vooraf
      // hardgecodeerd; UI toont "prijs volgens Kadaster" bij null.
      kosten_indicatie_eur: null,
      zoekadres: { type: zoekadresType, waarde: zoekadresWaarde },
      producten,
      debug: { ...debug, response_shape: shape },
    };

    console.log('[kadaster-objectinformatie] ok', logRegel({
      modus, user: userId,
      object_id: body.context?.object_id ?? null,
      signaal_id: body.context?.signaal_id ?? null,
      producten: codes.join(','),
      beschikbaar: producten.filter(p => p.beschikbaar).length,
      dur_ms: Date.now() - t0,
    }));

    return new Response(JSON.stringify(preview), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[kadaster-objectinformatie] onverwachte fout:',
      e instanceof Error ? e.message : e);
    return jsonError(
      'Onverwachte fout in Kadaster-functie.',
      500, 'unknown',
    );
  }
});

function jsonError(
  error: string,
  status: number,
  code?: string,
  debug?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error, code, http_status: status, debug }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
