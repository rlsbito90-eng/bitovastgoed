import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260816232500_acquisitie_productiekern_batchdocument_storage_guard.sql',
), 'utf8');

describe('Productiekern batchdocument Storage guard', () => {
  it('assert de actor en accepteert alleen het actor/batch/version productiepad', () => {
    expect(sql).toContain('off_market_productiekern_assert_interne_actor(p_actor_id)');
    expect(sql).toContain("'off-market-productie/'");
    expect(sql).toContain('p_actor_id::text');
    expect(sql).toContain('p_batch_id::text');
    expect(sql).toContain('p_verwacht_documentversie::text');
    expect(sql).toContain('bestand_referentie_buiten_productiepad');
  });

  it('verifieert ieder object werkelijk in de private bucket vóór de interne transactie', () => {
    const storageCheck = sql.indexOf('from storage.objects o');
    const interneCall = sql.indexOf('perform public.off_market_batch_documenten_registreren_intern');
    expect(storageCheck).toBeGreaterThan(-1);
    expect(interneCall).toBeGreaterThan(storageCheck);
    expect(sql).toContain("o.bucket_id = 'off-market-productie'");
    expect(sql).toContain('batchdocument_storage_object_ontbreekt');
  });

  it('weigert dubbele refs en geeft execute uitsluitend aan authenticated', () => {
    expect(sql).toContain('dubbele_bestand_referentie');
    expect(sql).toMatch(/revoke all on function public\.off_market_batch_documenten_registreren[\s\S]*?from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function public\.off_market_batch_documenten_registreren[\s\S]*?to authenticated;/i);
  });
});
