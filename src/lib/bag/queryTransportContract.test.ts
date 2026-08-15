import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260803213000_bag_2a9_gateway_role.sql',
), 'utf8').replace(/\s+/g, ' ').toLowerCase();
const edge = readFileSync(resolve(
  process.cwd(), 'supabase/functions/bag-query-service/index.ts',
), 'utf8');
const browserTransport = readFileSync(resolve(
  process.cwd(), 'src/lib/bag/queryTransport.ts',
), 'utf8');

describe('BAG 2A.9 servertransportcontract', () => {
  it('maakt een minimale login zonder wachtwoord of directe BAG-rechten', () => {
    expect(migration).toContain('create role bag_gateway login nosuperuser');
    expect(migration).toContain('noinherit noreplication nobypassrls connection limit 8');
    expect(migration).not.toContain('password ');
    expect(migration).toContain('revoke all on all tables');
    expect(migration).toContain('grant bag_reader to bag_gateway with admin false, inherit false, set true');
  });

  it('bindt de Edge-functie fail-closed aan shadow en de gatewaylogin', () => {
    expect(edge).toContain("environment !== 'shadow'");
    expect(edge).toContain("projectRef === LEGACY_PRODUCTION_REF");
    expect(edge).toContain("projectRef === CRM_AUTH_REF");
    expect(edge).toContain("username !== 'bag_gateway'");
    expect(edge).toContain("sslmode !== 'require'");
    expect(edge).toContain("requiredEnv('BAG_READER_DATABASE_URL')");
    expect(edge).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('valideert de JWT van het eigen CRM-project server-side en vereist een interne CRM-rol', () => {
    expect(edge).toContain("const CRM_AUTH_REF = 'vyjocdlwfxrblusfngfq'");
    expect(edge).toContain('BAG_AUTH_SUPABASE_URL');
    expect(edge).toContain('BAG_AUTH_SUPABASE_ANON_KEY');
    expect(edge).toContain('authUrl !== CRM_AUTH_URL');
    expect(edge).not.toContain("requiredEnv('SUPABASE_URL')");
    expect(edge).not.toContain("requiredEnv('SUPABASE_ANON_KEY')");
    expect(edge).toContain('client.auth.getUser(token)');
    expect(edge).not.toContain('client.auth.getClaims(token)');
    expect(edge).toContain('const userId = userData.user?.id');
    expect(edge).toContain("if (error || typeof userId !== 'string') throw new TypeError('Unauthorized')");
    expect(edge).toContain("role === 'admin' || role === 'medewerker'");
    expect(edge).toContain("if (!internal) throw new RangeError('Forbidden')");
  });

  it('bereikt de database pas na succesvolle JWT- en rolcontrole', () => {
    const authorizeCall = edge.indexOf('await authorize(req)');
    const executeCall = edge.indexOf('const rows = await execute(body)');
    const databaseCall = edge.indexOf('const sql = databaseClient()');
    expect(authorizeCall).toBeGreaterThan(-1);
    expect(executeCall).toBeGreaterThan(authorizeCall);
    expect(databaseCall).toBeGreaterThan(-1);
    expect(edge).toContain("body.action === 'viewport'");
    expect(edge).toContain("body.action === 'search'");
    expect(edge).toContain('SET LOCAL ROLE bag_reader');
    expect(edge).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/);
  });

  it('logt geen secrets, tokens of persoonsgegevens', () => {
    expect(edge).not.toMatch(/console\.(?:log|error|warn)\([^\n]*(?:token|authorization|authAnonKey|databaseUrl|userId)/i);
    expect(edge).toContain("console.error('[bag-query-service] request failed')");
  });

  it('begrensd requestgrootte, databasepool, viewport en zoekpagina', () => {
    expect(edge).toContain('MAX_BODY_BYTES = 16_384');
    expect(edge).toContain('max: 2');
    expect(edge).toContain("integer(body.limit ?? 2500, 1, 2500");
    expect(edge).toContain("integer(body.limit ?? 100, 1, 250");
    expect(edge).toContain('minX < -10_000');
  });

  it('roept vanuit de browser uitsluitend de vaste shadowfunctie aan met de CRM-sessie', () => {
    expect(browserTransport).toContain("const SHADOW_PROJECT_REF = 'xfygspvpeugxowxbcvnm'");
    expect(browserTransport).toContain('configuredUrl !== SHADOW_FUNCTION_URL');
    expect(browserTransport).toContain('supabase.auth.getSession()');
    expect(browserTransport).toContain('Authorization: `Bearer ${accessToken}`');
    expect(browserTransport).not.toContain('supabase.functions.invoke');
    expect(browserTransport).not.toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
  });
});
