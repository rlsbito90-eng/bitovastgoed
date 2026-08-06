import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
  ),
  'utf8',
);

describe('acquisitiedossier en briefkern SQL-concept', () => {
  it('staat buiten actieve migraties en rolt altijd terug', () => {
    expect(sql).toContain('NIET AUTOMATISCH TOEPASSEN');
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true);
  });

  it('introduceert exact één dossier per selectie met alle operationele werkbakken', () => {
    expect(sql).toContain('create table if not exists public.off_market_acquisitie_dossiers');
    expect(sql).toContain('unique (selectie_id)');

    for (const werkbak of [
      'nieuwe_selectie',
      'eigenaar_achterhalen',
      'brief_opstellen',
      'printklaar',
      'geprint_posten',
      'opvolgen',
      'wachten',
      'afgehandeld',
    ]) {
      expect(sql).toContain(`'${werkbak}'`);
    }
  });

  it('breidt de bestaande brieventabel uit zonder een concurrerende brieventabel te maken', () => {
    expect(sql).toContain('alter table if exists public.off_market_brieven');
    expect(sql).not.toMatch(/create\s+table[^;]*off_market_(?:productie_)?brieven/i);

    for (const kolom of [
      'briefnummer',
      'selectie_id',
      'object_id',
      'relatie_id',
      'actieve_versie',
      'vervanging_van_brief_id',
      'definitief_op',
      'vergrendeld_op',
      'annuleringsreden',
    ]) {
      expect(sql).toMatch(new RegExp(`add column if not exists ${kolom}\\b`, 'i'));
    }
  });

  it('maakt briefnummering uniek maar voert geen backfill uit', () => {
    expect(sql).toContain('off_market_brieven_briefnummer_uq');
    expect(sql).toContain("briefnummer ~ '^BR[0-9]{10}$'");
    expect(sql).not.toMatch(/update\s+public\.off_market_brieven/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.off_market_brieven/i);
  });

  it('houdt clientrechten gesloten en verruimt bestaande brief-RLS niet', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain(
      'revoke all on table public.off_market_acquisitie_dossiers from anon, authenticated',
    );
    expect(sql).not.toMatch(/grant\s+/i);
    expect(sql).not.toMatch(/create\s+policy/i);
  });

  it('voegt geen onbewezen foreign keys of wijzigingen aan andere domeinen toe', () => {
    expect(sql).not.toMatch(/foreign\s+key/i);
    expect(sql).not.toMatch(/references\s+public\./i);
    expect(sql).not.toMatch(/kadaster/i);
    expect(sql).not.toMatch(/\bbag_/i);
    expect(sql).not.toContain('update public.off_market_signalen');
  });
});
