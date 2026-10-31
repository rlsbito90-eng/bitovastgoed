// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PARTIJPROFIELEN, VASTGOEDSTRATEGIEEN } from './partijprofiel';

const migration = readFileSync(
 new URL('../../../supabase/migrations/20261101100000_add_partijprofiel_en_vastgoed_strategieen_a13.sql', import.meta.url),
 'utf8'
);

describe('A13 migratiecontract (statisch, zonder database-aanroep)',()=>{
 it('bevat alle door de applicatie toegestane profiel- en strategiewaarden',()=>{
  for(const item of PARTIJPROFIELEN) expect(migration).toContain(`'${item.value}'`);
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
