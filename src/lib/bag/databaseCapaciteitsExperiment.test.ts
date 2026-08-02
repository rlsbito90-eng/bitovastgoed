import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const lees = (pad: string) => readFileSync(resolve(process.cwd(), pad), 'utf-8');

describe('BAG BUILD 2A.2 geïsoleerd capaciteitsexperiment', () => {
  const schema = lees('experiments/bag/2a2/schema.sql');
  const volume = lees('experiments/bag/2a2/load-volumeprofiel.sql');
  const runner = lees('scripts/bag/run-2a2-capaciteitsproef.sh');

  it('gebruikt uitsluitend het geïsoleerde experimentschema', () => {
    expect(schema).toContain('CREATE SCHEMA IF NOT EXISTS bag_experiment');
    expect(schema).not.toContain('supabase');
    expect(schema).not.toContain('crm');
    expect(runner).toContain('uitsluitend tegen een lokale tijdelijke database');
  });

  it('modelleert het bewezen Assen-volume exact', () => {
    expect(volume).toContain('generate_series(1, 128745)');
    expect(volume).toContain('generate_series(1, 212738)');
    expect(volume).toContain('WHERE c.rn <= 122388');
    expect(volume).toContain("128745,\n  'Objecttelling'");
    expect(volume).toContain("168047,\n  'Voorkomentelling'");
    expect(volume).toContain("212738,\n  'Relatietelling'");
    expect(volume).toContain("122388,\n  'Geometrietelling'");
  });

  it('borgt PostGIS, RD New, constraints en ruimtelijke indexen', () => {
    expect(schema).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
    expect(schema).toContain('geometry(GeometryZ, 28992)');
    expect(schema).toContain('ST_SRID(geometrie) = 28992');
    expect(schema).toContain('USING gist (geometrie)');
    expect(schema).toContain('FOREIGN KEY');
  });

  it('test publicatie en rollback zonder productieverbinding', () => {
    expect(volume).toContain('BEGIN;');
    expect(volume).toContain("SET status = 'actief', is_actief = true");
    expect(runner).toContain('ROLLBACK;');
    expect(runner).toContain('productiedatabaseGebruikt');
    expect(runner).toContain('crmSchrijfacties');
  });
});
