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
import { normaliseerKadasterResponse, logRegel } from './_normalize.ts';

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
    const heeftBetaald = gevraagd.some(c => BETAALDE_PRODUCTEN.includes(c));
    if (!heeftBetaald) {
      return jsonError(
        'Gratis gebiedsdata kan alleen worden meegeleverd bij een betaalde Kadaster-aanvraag.',
        400, 'product_invalid',
      );
    }
    const codes = gevraagd as KadasterProductCode[];
    const selection = codes.map((code) => ({
      code,
      deliver: 'withoutProduct' as const,
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
      reportBody.pht = {
        postalcode: normPostcode,
        houseNumber: body.adres.houseNumber,
        ...(body.adres.houseLetter ? { houseLetter: body.adres.houseLetter } : {}),
        ...(body.adres.houseNumberAddition ? { houseNumberAddition: body.adres.houseNumberAddition } : {}),
      };
      zoekadresWaarde = [
        normPostcode,
        body.adres.houseNumber + (body.adres.houseLetter ?? ''),
        body.adres.houseNumberAddition,
      ].filter(Boolean).join(' ');
    }

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
          'X-Api-Key': apiKey,
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
        502, 'upstream_unavailable',
      );
    }

    // --- HTTP-status mapping naar NL meldingen ---
    if (!upstreamResp.ok) {
      const status = upstreamResp.status;
      const tekst = await upstreamResp.text().catch(() => '');
      console.log('[kadaster-objectinformatie] upstream-fout', logRegel({
        modus, user: userId, status, dur_ms: Date.now() - t0,
        snippet: tekst.slice(0, 200),
      }));
      if (status === 401 || status === 406) {
        return jsonError(
          'Kadaster API-key is ongeldig of verlopen. Verleng of vervang de API-key in Supabase Secrets.',
          status, 'key_invalid',
        );
      }
      if (status === 412) {
        return jsonError(
          'Kadaster-bestedingsruimte is overschreden. Controleer de instellingen in Kadaster/Kadata.',
          status, 'budget_exceeded',
        );
      }
      if (status === 404) {
        return jsonError(
          'Geen Kadasterobject gevonden voor dit adres.',
          status, 'not_found',
        );
      }
      if (status === 409 || status === 422) {
        return jsonError(
          'Aanvraag ongeldig (product of adres niet geaccepteerd).',
          status, 'product_invalid',
        );
      }
      if (status >= 500) {
        return jsonError(
          'Kadaster is tijdelijk niet beschikbaar. Probeer later opnieuw.',
          status, 'upstream_unavailable',
        );
      }
      return jsonError(
        `Onverwachte Kadaster-fout (HTTP ${status}).`,
        status, 'unknown',
      );
    }

    const ruwe = await upstreamResp.json().catch(() => null);
    const producten = normaliseerKadasterResponse(ruwe, codes);

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

function jsonError(error: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ error, code, http_status: status }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
