import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(), 'supabase/migrations/20260803213000_bag_2a9_gateway_role.sql',
), 'utf8').replace(/\s+/g, ' ').toLowerCase();
const edge = readFileSync(resolve(
  process.cwd(), 'supabase/functions/bag-query-service/index.ts',
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
    expect(edge).toContain("projectRef === PRODUCTION_REF");
    expect(edge).toContain("username !== 'bag_gateway'");
    expect(edge).toContain("sslmode !== 'require'");
    expect(edge).toContain("requiredEnv('BAG_READER_DATABASE_URL')");
    expect(edge).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('vereist JWT plus interne CRM-rol en voert alleen vaste queryacties uit', () => {
    expect(edge).toContain("client.auth.getClaims(token)");
    expect(edge).toContain("role === 'admin' || role === 'medewerker'");
    expect(edge).toContain("body.action === 'viewport'");
    expect(edge).toContain("body.action === 'search'");
    expect(edge).toContain("SET LOCAL ROLE bag_reader");
    expect(edge).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/);
  });

  it('begrensd requestgrootte, databasepool, viewport en zoekpagina', () => {
    expect(edge).toContain('MAX_BODY_BYTES = 16_384');
    expect(edge).toContain('max: 2');
    expect(edge).toContain("integer(body.limit ?? 2500, 1, 2500");
    expect(edge).toContain("integer(body.limit ?? 100, 1, 250");
    expect(edge).toContain('minX < -10_000');
  });
});
