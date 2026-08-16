import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pad = resolve(
  process.cwd(),
  'supabase/migrations/20260816224500_acquisitie_productiekern_atomische_printbatch.sql',
);
const sql = readFileSync(pad, 'utf8');

describe('Productiekern atomische printbatch migratie', () => {
  it('valideert de volledige briefset vóór BAT-nummerreservering en inserts', () => {
    const validatie = sql.indexOf('-- Valideer de volledige set vóór nummerreservering');
    const reserveer = sql.indexOf('v_batchnummer := public.reserveer_off_market_batchnummer');
    const batchInsert = sql.indexOf('insert into public.off_market_printbatches');
    expect(validatie).toBeGreaterThan(-1);
    expect(reserveer).toBeGreaterThan(validatie);
    expect(batchInsert).toBeGreaterThan(reserveer);
    expect(sql).toContain('briefversie_reeds_in_actieve_batch');
    expect(sql).toContain('briefversie_drift');
    expect(sql).toContain('brief_dubbel_in_batch');
    expect(sql).toContain('briefversie_dubbel_in_batch');
  });

  it('maakt BAT en alle koppelingen binnen één interne PL/pgSQL-transactie', () => {
    expect(sql).toMatch(/create or replace function public\.off_market_printbatch_met_brieven_aanmaken_intern/i);
    expect(sql).toMatch(/insert into public\.off_market_printbatches/i);
    expect(sql).toMatch(/insert into public\.off_market_printbatch_brieven/i);
    expect(sql).toContain("'batchnummer_uitgegeven'");
    expect(sql).toContain("'brief_aan_batch_toegevoegd'");
    expect(sql).toContain('pg_advisory_xact_lock');
  });

  it('houdt interne functie en directe tabelwrites dicht en grant alleen publieke wrapper', () => {
    expect(sql).toMatch(/revoke all on function public\.off_market_printbatch_met_brieven_aanmaken_intern\([\s\S]*?\)\s+from public, anon, authenticated;/i);
    expect(sql).toMatch(/perform public\.off_market_productiekern_assert_interne_actor\(p_actor_id\)/i);
    expect(sql).toMatch(/grant execute on function public\.off_market_printbatch_met_brieven_aanmaken\([\s\S]*?\)\s+to authenticated;/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+(table\s+)?public\./i);
  });

  it('is idempotent op root operation key en begrenst batches op 1000 brieven', () => {
    expect(sql).toContain('where operation_key = p_operation_key');
    expect(sql).toContain('operation_key_conflict');
    expect(sql).toContain('maximaal_1000_brieven_per_batch');
    expect(sql).toContain("p_operation_key || ':brief:' || v_versie_id::text");
  });
});
