import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
  ),
  'utf8',
);

describe('transactioneel SQL-concept acquisitieproductiekern', () => {
  it('staat buiten de actieve migratiemap en rolt altijd terug', () => {
    expect(sql).toContain('NIET AUTOMATISCH TOEPASSEN');
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true);
  });

  it('bevat alle vier transactionele functies', () => {
    expect(sql).toContain('function public.off_market_brief_definitief_maken');
    expect(sql).toContain('function public.off_market_batch_documenten_registreren');
    expect(sql).toContain('function public.off_market_batch_geprint_markeren');
    expect(sql).toContain('function public.off_market_brief_gepost_markeren');
  });

  it('gebruikt per handeling een operation key en transactionele lock', () => {
    const functies = sql.split('create or replace function').slice(1);
    expect(functies).toHaveLength(4);
    for (const functie of functies) {
      expect(functie).toContain('p_operation_key text');
      expect(functie).toContain('pg_advisory_xact_lock');
      expect(functie).toContain('off_market_productie_events');
    }
  });

  it('houdt clientrollen standaard van alle functies af', () => {
    const revokes = sql.match(/revoke all on function/g) ?? [];
    expect(revokes).toHaveLength(4);
    expect(sql).not.toMatch(/grant\s+execute/i);
  });

  it('registreert printen en posten afzonderlijk', () => {
    expect(sql).toContain("'batch_geprint'");
    expect(sql).toContain("'brief_gepost'");
    expect(sql).toContain("status = 'geprint', printdatum = p_printdatum");
    expect(sql).toContain('verzenddatum = p_verzenddatum');
  });

  it('verplicht expliciete batchkoppeling en geadresseerde voor posten', () => {
    expect(sql).toContain('geadresseerde_key_verplicht');
    expect(sql).toContain('batch_niet_geprint');
    expect(sql).toContain('briefversie_niet_in_batch');
    expect(sql).toContain('brief_versie_id = p_brief_versie_id');
    expect(sql).toContain('verwijderd_op is null');
  });

  it('bevat geen directe wijzigingen aan Kadaster-, BAG- of signaalbronnen', () => {
    expect(sql).not.toMatch(/kadaster/i);
    expect(sql).not.toMatch(/\bbag_/i);
    expect(sql).not.toContain('update public.off_market_signalen');
  });
});
