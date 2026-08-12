// BAG BUILD 2A.9 + Pandenverkenner 2.0 — geauthenticeerde, shadow-only transportgrens.
// @ts-nocheck — Deno Edge Runtime; contract wordt statisch en via pure clienttests bewaakt.
import { createClient } from 'npm:@supabase/supabase-js@2';
import postgres from 'npm:postgres@3.4.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const LEGACY_PRODUCTION_REF = 'ljudxyrqoifhfikueric';
const CRM_AUTH_REF = 'vyjocdlwfxrblusfngfq';
const CRM_AUTH_URL = `https://${CRM_AUTH_REF}.supabase.co`;
const MAX_BODY_BYTES = 16_384;
const GEREGISTREERDE_SCOPES = new Set(['0106', '0363', '0599', '0518']);
const STANDAARD_TOEGESTANE_SCOPES = '0363,0106';
const VBO_MODI = new Set(['alle', 'met_vbo', 'zonder_vbo']);
const MAX_MULTISELECT_OPTIES = 16;

let database: ReturnType<typeof postgres> | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Ontbrekende serverconfiguratie: ${name}`);
  return value;
}

function allowedScopes(): Set<string> {
  const raw = Deno.env.get('BAG_ALLOWED_SCOPE_CODES')?.trim() || STANDAARD_TOEGESTANE_SCOPES;
  const scopes = new Set(raw.split(',').map(value => value.trim()).filter(Boolean));
  if (!scopes.size || [...scopes].some(code => !GEREGISTREERDE_SCOPES.has(code))) {
    throw new Error('BAG-scopeallowlist bevat een onbekende of lege scope');
  }
  return scopes;
}

function databaseClient(): ReturnType<typeof postgres> {
  if (database) return database;
  const environment = requiredEnv('BAG_ENVIRONMENT');
  const projectRef = requiredEnv('BAG_PROJECT_REF');
  const expectedRef = requiredEnv('BAG_EXPECTED_PROJECT_REF');
  const databaseUrl = requiredEnv('BAG_READER_DATABASE_URL');
  if (
    environment !== 'shadow'
    || projectRef !== expectedRef
    || projectRef === LEGACY_PRODUCTION_REF
    || projectRef === CRM_AUTH_REF
  ) {
    throw new Error('BAG-transport is niet aan de bevestigde shadow gebonden');
  }
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error('Ongeldige BAG-projectref');

  const parsed = new URL(databaseUrl);
  const username = decodeURIComponent(parsed.username);
  const sslmode = parsed.searchParams.get('sslmode');
  if ((username !== 'bag_gateway' && username !== `bag_gateway.${projectRef}`)
    || (sslmode !== 'require' && sslmode !== 'verify-full')
    || (!parsed.hostname.includes(projectRef) && !username.includes(`.${projectRef}`))) {
    throw new Error('BAG-database-URL voldoet niet aan het gatewaycontract');
  }

  database = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 5,
    connect_timeout: 5,
    prepare: false,
    ssl: 'require',
  });
  return database;
}

function scopeCode(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new TypeError('Ongeldige BAG-scopecode');
  }
  if (!allowedScopes().has(value)) throw new RangeError('Scope niet toegestaan');
  return value;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new TypeError(`${label} moet tussen ${min} en ${max} liggen`);
  }
  return Number(value);
}

function optionalInteger(value: unknown, min: number, max: number, label: string): number | null {
  if (value == null || value === '') return null;
  return integer(value, min, max, label);
}

function optionalNumber(value: unknown, min: number, max: number, label: string): number | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${label} moet tussen ${min} en ${max} liggen`);
  }
  return value;
}

function optionalBoolean(value: unknown, label: string): boolean | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'boolean') throw new TypeError(`${label} moet boolean zijn`);
  return value;
}

function optionalText(value: unknown, maxLength: number, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new TypeError(`${label} moet tekst zijn`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new TypeError(`Ongeldige ${label}`);
  return trimmed;
}

function textArray(value: unknown, label: string, maximaal = MAX_MULTISELECT_OPTIES): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maximaal) {
    throw new TypeError(`${label} mag maximaal ${maximaal} opties bevatten`);
  }
  const items = value.map(item => {
    if (typeof item !== 'string') throw new TypeError(`Ongeldige ${label}`);
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 128) throw new TypeError(`Ongeldige ${label}`);
    return trimmed;
  });
  if (new Set(items).size !== items.length) throw new TypeError(`${label} bevat dubbele opties`);
  return items;
}

function coordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Viewportcoördinaten moeten eindig zijn');
  }
  return value;
}

async function authorize(req: Request): Promise<string> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new TypeError('Unauthorized');
  const authUrl = requiredEnv('BAG_AUTH_SUPABASE_URL');
  const authAnonKey = requiredEnv('BAG_AUTH_SUPABASE_ANON_KEY');
  if (authUrl !== CRM_AUTH_URL) {
    throw new Error('BAG-authenticatie is niet aan de bevestigde CRM-autoriteit gebonden');
  }
  const client = createClient(authUrl, authAnonKey, { global: { headers: { Authorization: authorization } } });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error } = await client.auth.getUser(token);
  const userId = userData.user?.id;
  if (error || typeof userId !== 'string') throw new TypeError('Unauthorized');
  const { data: roles, error: rolesError } = await client.from('user_roles').select('role').eq('user_id', userId);
  const internal = !rolesError && (roles ?? []).some(({ role }) => role === 'admin' || role === 'medewerker');
  if (!internal) throw new RangeError('Forbidden');
  return userId;
}

function validateRanges(
  bouwjaarVan: number | null, bouwjaarTot: number | null,
  vboSomVan: number | null, vboSomTot: number | null,
  vboMaxVan: number | null, vboMaxTot: number | null,
  vboAantalVan: number | null, vboAantalTot: number | null,
): void {
  if (bouwjaarVan !== null && bouwjaarTot !== null && bouwjaarVan > bouwjaarTot) throw new TypeError('Ongeldig bouwjaarbereik');
  if (vboSomVan !== null && vboSomTot !== null && vboSomVan > vboSomTot) throw new TypeError('Ongeldig VBO-sombereik');
  if (vboMaxVan !== null && vboMaxTot !== null && vboMaxVan > vboMaxTot) throw new TypeError('Ongeldig VBO-maxbereik');
  if (vboAantalVan !== null && vboAantalTot !== null && vboAantalVan > vboAantalTot) throw new TypeError('Ongeldig VBO-aantalbereik');
}

async function execute(body: Record<string, unknown>): Promise<unknown> {
  const sql = databaseClient();
  if (body.action === 'viewport') {
    const scope = scopeCode(body.scopeCode);
    const minX = coordinate(body.minX);
    const minY = coordinate(body.minY);
    const maxX = coordinate(body.maxX);
    const maxY = coordinate(body.maxY);
    const limit = integer(body.limit ?? 2500, 1, 2500, 'Viewportlimiet');
    if (minX < -10_000 || maxX > 300_000 || minY < 275_000 || maxY > 630_000 || minX >= maxX || minY >= maxY) {
      throw new TypeError('Viewport valt buiten de begrensde RD New-zone');
    }
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx`SELECT * FROM bag_service.panden_in_viewport(${scope}, ${minX}, ${minY}, ${maxX}, ${maxY}, ${limit})`;
    });
  }
  if (body.action === 'search') {
    const scope = scopeCode(body.scopeCode);
    const limit = integer(body.limit ?? 100, 1, 250, 'Zoeklimiet');
    const cursor = body.cursor == null ? null : String(body.cursor).trim();
    if (cursor !== null && (!cursor || cursor.length > 128)) throw new TypeError('Ongeldige keysetcursor');
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx`SELECT * FROM bag_service.zoek_panden(${scope}, ${cursor}, ${limit})`;
    });
  }
  if (body.action === 'search_v2') {
    const scope = scopeCode(body.scopeCode);
    const limit = integer(body.limit ?? 100, 1, 250, 'Zoeklimiet');
    const cursor = body.cursor == null ? null : String(body.cursor).trim();
    if (cursor !== null && (!cursor || cursor.length > 128)) throw new TypeError('Ongeldige keysetcursor');
    const bouwjaarVan = optionalInteger(body.bouwjaarVan, 1000, 3000, 'Bouwjaar vanaf');
    const bouwjaarTot = optionalInteger(body.bouwjaarTot, 1000, 3000, 'Bouwjaar tot');
    const status = optionalText(body.status, 128, 'pandstatus');
    const vboSomVan = optionalNumber(body.vboOppervlakteSomVan, 0, 100_000_000, 'VBO-oppervlakte som vanaf');
    const vboSomTot = optionalNumber(body.vboOppervlakteSomTot, 0, 100_000_000, 'VBO-oppervlakte som tot');
    const vboMaxVan = optionalNumber(body.vboOppervlakteMaxVan, 0, 10_000_000, 'VBO-oppervlakte max vanaf');
    const vboMaxTot = optionalNumber(body.vboOppervlakteMaxTot, 0, 10_000_000, 'VBO-oppervlakte max tot');
    const vboAantalVan = optionalInteger(body.vboAantalVan, 0, 100_000, 'VBO-aantal vanaf');
    const vboAantalTot = optionalInteger(body.vboAantalTot, 0, 100_000, 'VBO-aantal tot');
    const gebruiksdoel = optionalText(body.gebruiksdoel, 128, 'gebruiksdoel');
    const isGemengd = optionalBoolean(body.isGemengd, 'isGemengd');
    const vboModus = body.vboModus == null ? 'alle' : String(body.vboModus).trim();
    if (!VBO_MODI.has(vboModus)) throw new TypeError('Ongeldige VBO-modus');
    validateRanges(bouwjaarVan, bouwjaarTot, vboSomVan, vboSomTot, vboMaxVan, vboMaxTot, vboAantalVan, vboAantalTot);
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx`SELECT * FROM bag_service.zoek_panden_v2(
        ${scope}, ${cursor}, ${limit}, ${bouwjaarVan}, ${bouwjaarTot}, ${status},
        ${vboSomVan}, ${vboSomTot}, ${vboMaxVan}, ${vboMaxTot},
        ${vboAantalVan}, ${vboAantalTot}, ${gebruiksdoel}, ${isGemengd}, ${vboModus}
      )`;
    });
  }
  if (body.action === 'search_v3') {
    const scope = scopeCode(body.scopeCode);
    const limit = integer(body.limit ?? 100, 1, 250, 'Zoeklimiet');
    const cursor = body.cursor == null ? null : String(body.cursor).trim();
    if (cursor !== null && (!cursor || cursor.length > 128)) throw new TypeError('Ongeldige keysetcursor');
    const bouwjaarVan = optionalInteger(body.bouwjaarVan, 1000, 3000, 'Bouwjaar vanaf');
    const bouwjaarTot = optionalInteger(body.bouwjaarTot, 1000, 3000, 'Bouwjaar tot');
    const statussen = textArray(body.statussen, 'pandstatusselectie');
    const vboSomVan = optionalNumber(body.vboOppervlakteSomVan, 0, 100_000_000, 'VBO-oppervlakte som vanaf');
    const vboSomTot = optionalNumber(body.vboOppervlakteSomTot, 0, 100_000_000, 'VBO-oppervlakte som tot');
    const vboMaxVan = optionalNumber(body.vboOppervlakteMaxVan, 0, 10_000_000, 'VBO-oppervlakte max vanaf');
    const vboMaxTot = optionalNumber(body.vboOppervlakteMaxTot, 0, 10_000_000, 'VBO-oppervlakte max tot');
    const vboAantalVan = optionalInteger(body.vboAantalVan, 0, 100_000, 'VBO-aantal vanaf');
    const vboAantalTot = optionalInteger(body.vboAantalTot, 0, 100_000, 'VBO-aantal tot');
    const gebruiksdoelen = textArray(body.gebruiksdoelen, 'gebruiksfunctieselectie');
    const isGemengd = optionalBoolean(body.isGemengd, 'isGemengd');
    const vboModus = body.vboModus == null ? 'alle' : String(body.vboModus).trim();
    if (!VBO_MODI.has(vboModus)) throw new TypeError('Ongeldige VBO-modus');
    validateRanges(bouwjaarVan, bouwjaarTot, vboSomVan, vboSomTot, vboMaxVan, vboMaxTot, vboAantalVan, vboAantalTot);
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx`SELECT * FROM bag_service.zoek_panden_v3(
        ${scope}, ${cursor}, ${limit}, ${bouwjaarVan}, ${bouwjaarTot}, ${statussen},
        ${vboSomVan}, ${vboSomTot}, ${vboMaxVan}, ${vboMaxTot},
        ${vboAantalVan}, ${vboAantalTot}, ${gebruiksdoelen}, ${isGemengd}, ${vboModus}
      )`;
    });
  }
  if (body.action === 'gebiedsopties') {
    const scope = scopeCode(body.scopeCode);
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx`SELECT * FROM bag_service.cbs_gebiedsopties(${scope})`;
    });
  }
  if (body.action === 'search_v4') {
    const scope = scopeCode(body.scopeCode);
    const limit = integer(body.limit ?? 100, 1, 250, 'Zoeklimiet');
    const cursor = body.cursor == null ? null : String(body.cursor).trim();
    if (cursor !== null && (!cursor || cursor.length > 128)) throw new TypeError('Ongeldige keysetcursor');
    const bouwjaarVan = optionalInteger(body.bouwjaarVan, 1000, 3000, 'Bouwjaar vanaf');
    const bouwjaarTot = optionalInteger(body.bouwjaarTot, 1000, 3000, 'Bouwjaar tot');
    const statussen = textArray(body.statussen, 'pandstatusselectie');
    const wijkCodes = textArray(body.wijkCodes, 'wijkselectie', 64);
    const buurtCodes = textArray(body.buurtCodes, 'buurtselectie', 128);
    if (wijkCodes.some(code => !/^WK[0-9]{4}[A-Z0-9]{2}$/.test(code) || code.slice(2, 6) !== scope)) throw new TypeError('Ongeldige wijkselectie');
    if (buurtCodes.some(code => !/^BU[0-9]{4}[A-Z0-9]{4}$/.test(code) || code.slice(2, 6) !== scope)) throw new TypeError('Ongeldige buurtselectie');
    const vboSomVan = optionalNumber(body.vboOppervlakteSomVan, 0, 100_000_000, 'VBO-oppervlakte som vanaf');
    const vboSomTot = optionalNumber(body.vboOppervlakteSomTot, 0, 100_000_000, 'VBO-oppervlakte som tot');
    const vboMaxVan = optionalNumber(body.vboOppervlakteMaxVan, 0, 10_000_000, 'VBO-oppervlakte max vanaf');
    const vboMaxTot = optionalNumber(body.vboOppervlakteMaxTot, 0, 10_000_000, 'VBO-oppervlakte max tot');
    const vboAantalVan = optionalInteger(body.vboAantalVan, 0, 100_000, 'VBO-aantal vanaf');
    const vboAantalTot = optionalInteger(body.vboAantalTot, 0, 100_000, 'VBO-aantal tot');
    const gebruiksdoelen = textArray(body.gebruiksdoelen, 'gebruiksfunctieselectie');
    const isGemengd = optionalBoolean(body.isGemengd, 'isGemengd');
    const vboModus = body.vboModus == null ? 'alle' : String(body.vboModus).trim();
    if (!VBO_MODI.has(vboModus)) throw new TypeError('Ongeldige VBO-modus');
    validateRanges(bouwjaarVan, bouwjaarTot, vboSomVan, vboSomTot, vboMaxVan, vboMaxTot, vboAantalVan, vboAantalTot);
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx`SELECT * FROM bag_service.zoek_panden_v4(
        ${scope}, ${cursor}, ${limit}, ${bouwjaarVan}, ${bouwjaarTot}, ${statussen},
        ${vboSomVan}, ${vboSomTot}, ${vboMaxVan}, ${vboMaxTot},
        ${vboAantalVan}, ${vboAantalTot}, ${gebruiksdoelen}, ${isGemengd}, ${vboModus},
        ${wijkCodes}, ${buurtCodes}
      )`;
    });
  }
  throw new TypeError('Onbekende BAG-queryactie');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Request te groot' }, 413);
  try {
    await authorize(req);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request te groot' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const rows = await execute(body);
    return json({ rows });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      const unauthorized = error.message === 'Unauthorized';
      return json({ error: unauthorized ? 'Unauthorized' : error.message }, unauthorized ? 401 : 400);
    }
    if (error instanceof RangeError) return json({ error: 'Forbidden' }, 403);
    console.error('[bag-query-service] request failed');
    return json({ error: 'BAG-queryservice tijdelijk niet beschikbaar' }, 503);
  }
});
