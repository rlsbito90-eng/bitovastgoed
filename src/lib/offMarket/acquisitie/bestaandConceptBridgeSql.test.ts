import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sqlPad = resolve(
  process.cwd(),
  'supabase/migration-drafts/20260808_acquisitie_productiekern_bestaand_concept_bridge.sql',
);
const sql = readFileSync(sqlPad, 'utf8');

describe('bestaand-concept bridge SQL-draft', () => {
  it('blijft review-only en activeert geen rechten', () => {
    expect(sql).toMatch(/NIET AUTOMATISCH TOEPASSEN/i);
    expect(sql.trim().toLowerCase().endsWith('rollback;')).toBe(true);
    expect(sql).not.toMatch(/\bgrant\s+/i);
    expect(sql).toMatch(/revoke all on function public\.off_market_bestaand_concept_koppelen/i);
  });

  it('bevat de transactionele integriteitsgrenzen', () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("operation_key_conflict");
    expect(sql).toContain("brief_al_aan_andere_selectie_gekoppeld");
    expect(sql).toContain("brief_reeds_productiekern_gekoppeld");
    expect(sql).toContain("brief_signaal_mismatch");
    expect(sql).toContain("'bestaand_concept_bridge'");
  });

  it('koppelt brief, eerste versie en dossierwerkbak in dezelfde functie', () => {
    expect(sql).toMatch(/insert into public\.off_market_brief_versies/i);
    expect(sql).toMatch(/update public\.off_market_brieven[\s\S]*selectie_id = p_selectie_id/i);
    expect(sql).toMatch(/update public\.off_market_acquisitie_dossiers[\s\S]*primaire_werkbak = 'brief_opstellen'/i);
    expect(sql).toMatch(/event_type[\s\S]*'briefversie_aangemaakt'/i);
  });
});
