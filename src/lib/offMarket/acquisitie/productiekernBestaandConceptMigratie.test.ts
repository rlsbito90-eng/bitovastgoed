import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pad = resolve(
  process.cwd(),
  'supabase/migrations/20260816214000_acquisitie_productiekern_bestaand_concept_bridge.sql',
);
const sql = readFileSync(pad, 'utf8');

describe('productiekern bestaand-concept bridge migratie', () => {
  it('activeert uitsluitend de publieke wrapper voor authenticated', () => {
    expect(sql).toMatch(/grant execute on function public\.off_market_bestaand_concept_koppelen\([\s\S]*?\) to authenticated;/i);
    expect(sql).toMatch(/revoke all on function public\.off_market_bestaand_concept_koppelen_intern\([\s\S]*?\) from public, anon, authenticated;/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+(table\s+)?public\./i);
  });

  it('behoudt de transactionele integriteitsgrenzen van de gereviewde bridge', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('operation_key_conflict');
    expect(sql).toContain('dossier_niet_gestart');
    expect(sql).toContain('brief_al_aan_andere_selectie_gekoppeld');
    expect(sql).toContain('brief_reeds_productiekern_gekoppeld');
    expect(sql).toContain('brief_signaal_mismatch');
    expect(sql).toContain("'bestaand_concept_bridge'");
  });

  it('koppelt eerste immutable versie en dossierwerkbak in dezelfde functie', () => {
    expect(sql).toMatch(/insert into public\.off_market_brief_versies/i);
    expect(sql).toMatch(/update public\.off_market_brieven[\s\S]*selectie_id = p_selectie_id/i);
    expect(sql).toMatch(/update public\.off_market_acquisitie_dossiers[\s\S]*primaire_werkbak = 'brief_opstellen'/i);
    expect(sql).toMatch(/event_type[\s\S]*'briefversie_aangemaakt'/i);
  });

  it('is een echte migratie en bevat geen review-only rollback', () => {
    expect(sql).not.toMatch(/\brollback\s*;/i);
    expect(sql).not.toMatch(/NIET AUTOMATISCH TOEPASSEN/i);
  });
});
