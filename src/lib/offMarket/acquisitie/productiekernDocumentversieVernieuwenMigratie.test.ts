import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260819115001_acquisitie_productiekern_documentversie_vernieuwen.sql',
), 'utf8');

describe('Productiekern documentversie-vernieuwingsmigratie', () => {
  it('staat uitsluitend een opvolgende versie toe vóór fysieke printregistratie', () => {
    expect(sql).toContain('p_nieuwe_documentversie <> p_verwacht_documentversie + 1');
    expect(sql).toContain("v_status <> 'documenten_gegenereerd' or v_printdatum is not null");
    expect(sql).toContain('for update;');
    expect(sql).toContain("raise exception 'optimistic_lock_conflict'");
  });

  it('valideert de vier nieuwe private Storage-objecten onder de nieuwe versie', () => {
    expect(sql).toContain("jsonb_array_length(p_documenten) <> 4");
    expect(sql).toContain("|| p_nieuwe_documentversie::text || '/'");
    expect(sql).toContain("from storage.objects o");
    expect(sql).toContain("o.bucket_id = 'off-market-productie'");
    expect(sql).toContain("raise exception 'batchdocument_storage_object_ontbreekt'");
  });

  it('verhoogt batch en documentset transactioneel zonder oude bestanden te verwijderen', () => {
    const versieUpdate = sql.indexOf('set documentversie = p_nieuwe_documentversie');
    const registratie = sql.indexOf('perform public.off_market_batch_documenten_registreren_intern');
    expect(versieUpdate).toBeGreaterThan(0);
    expect(registratie).toBeGreaterThan(versieUpdate);
    expect(sql).toContain("'vorige_documentversie', p_verwacht_documentversie");
    expect(sql).toContain("'vervangende_documentset', true");
    expect(sql).not.toMatch(/delete\s+from\s+public\.off_market_batchdocumenten/i);
    expect(sql).not.toMatch(/update\s+public\.off_market_brieven/i);
  });

  it('is alleen via de beveiligde authenticated RPC beschikbaar', () => {
    expect(sql).toContain('perform public.off_market_productiekern_assert_interne_actor(p_actor_id)');
    expect(sql).toMatch(/revoke all on function public\.off_market_batch_documentversie_vernieuwen[\s\S]*?from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function public\.off_market_batch_documentversie_vernieuwen[\s\S]*?to authenticated;/i);
  });
});

