import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pad = resolve(
  process.cwd(),
  'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
);
const sql = readFileSync(pad, 'utf8');

function bevat(fragment: string): boolean {
  return sql.toLowerCase().includes(fragment.toLowerCase());
}

describe('BUILD A SQL-migratieconcept', () => {
  it('staat bewust buiten de actieve migratiemap en eindigt met rollback', () => {
    expect(pad).toContain('supabase/migration-drafts/');
    expect(sql.trim().toLowerCase()).toContain('rollback;');
  });

  it('maakt alleen nieuwe productiekernobjecten aan en wijzigt geen bestaande brieftabel', () => {
    expect(bevat('create table if not exists public.off_market_productie_nummerreeksen')).toBe(true);
    expect(bevat('create table if not exists public.off_market_brief_versies')).toBe(true);
    expect(bevat('create table if not exists public.off_market_printbatches')).toBe(true);
    expect(bevat('create table if not exists public.off_market_printbatch_brieven')).toBe(true);
    expect(bevat('create table if not exists public.off_market_batchdocumenten')).toBe(true);
    expect(bevat('create table if not exists public.off_market_productie_events')).toBe(true);
    expect(bevat('alter table public.off_market_brieven')).toBe(false);
    expect(bevat('alter table public.off_market_acquisitie_selectie')).toBe(false);
  });

  it('gebruikt atomische upserts en geen max-plus-een-nummering', () => {
    expect(bevat('on conflict (reeks_type, reeks_sleutel)')).toBe(true);
    expect(bevat('returning laatste_nummer into v_volgnummer')).toBe(true);
    expect(sql).not.toMatch(/max\s*\([^)]*\)\s*\+\s*1/i);
  });

  it('borgt canonieke brief- en batchnummerformaten', () => {
    expect(bevat("return 'BR' || p_jaar::text || lpad(v_volgnummer::text, 6, '0')")).toBe(true);
    expect(bevat("return 'BAT' || v_sleutel || lpad(v_volgnummer::text, 2, '0')")).toBe(true);
    expect(bevat("check (batchnummer ~ '^BAT[0-9]{10}$')")).toBe(true);
  });

  it('voorkomt meerdere actieve briefversies en meerdere actieve batches per briefversie', () => {
    expect(bevat('off_market_brief_versies_een_actieve_uq')).toBe(true);
    expect(bevat("where status = 'actief'")).toBe(true);
    expect(bevat('off_market_printbatch_brieven_actieve_versie_uq')).toBe(true);
    expect(bevat('where verwijderd_op is null')).toBe(true);
  });

  it('houdt printen en posten als afzonderlijke, gevalideerde datums', () => {
    expect(bevat("status = 'geprint'\n        and printdatum is not null and verzenddatum is null")).toBe(true);
    expect(bevat("status = 'gepost'\n        and printdatum is not null and verzenddatum is not null")).toBe(true);
  });

  it('is standaard gesloten voor applicatierollen', () => {
    expect(bevat('enable row level security')).toBe(true);
    expect(bevat('revoke all on table public.off_market_productie_nummerreeksen from anon, authenticated')).toBe(true);
    expect(bevat('revoke all on function public.reserveer_off_market_briefnummer(integer) from public, anon, authenticated')).toBe(true);
    expect(bevat('revoke all on function public.reserveer_off_market_batchnummer(date) from public, anon, authenticated')).toBe(true);
  });
});
