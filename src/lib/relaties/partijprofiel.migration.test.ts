import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARTIJPROFIELEN, VASTGOEDSTRATEGIEEN } from './partijprofiel';

const migration = readFileSync(
 resolve(process.cwd(), 'supabase/migrations/20261101013600_add_partijprofiel_en_vastgoed_strategieen_a13.sql'),
 'utf8'
);

describe('A13 migratiecontract (statisch, zonder database-aanroep)',()=>{
 it('bevat alle door de applicatie toegestane profiel- en strategiewaarden',()=>{
  const a13Profielen = PARTIJPROFIELEN.filter(item =>
   !['fonds','family_office','buitenlandse_belegger'].includes(item.value)
  );
  for(const item of a13Profielen) expect(migration).toContain(`'${item.value}'`);
  for(const item of VASTGOEDSTRATEGIEEN) expect(migration).toContain(`'${item.value}'`);
 });
 it('blijft additief, nullable, afbreekbaar en vrij van bestaande rijmutaties',()=>{
  expect(migration).toMatch(/BEGIN;/);
  expect(migration).toMatch(/COMMIT;/);
  expect(migration).toMatch(/lock_timeout/);
  expect(migration).toMatch(/statement_timeout/);
  expect(migration).toMatch(/relrowsecurity/);
  expect(migration).toMatch(/ADD COLUMN partijprofiel text NULL/);
  expect(migration).toMatch(/ADD COLUMN vastgoed_strategieen text\[\] NULL/);
  expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\s+(?:TABLE\s+)?public\.relaties\b/i);
 });
});

const uitbreiding = readFileSync(
 resolve(process.cwd(), 'supabase/migrations/20261101130000_a14_extend_partijprofiel_values.sql'),
 'utf8'
);

describe('A14 uitbreiding profielwaarden (statisch, zonder database-aanroep)',()=>{
 it('maakt alle profielwaarden geldig zonder bestaande classificaties opnieuw te schrijven',()=>{
  for(const item of PARTIJPROFIELEN) expect(uitbreiding).toContain(`'${item.value}'`);
  expect(uitbreiding).toContain('relaties_partijprofiel_a13_allowed');
  expect(uitbreiding).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\s+public\.relaties\b/i);
 });
});
