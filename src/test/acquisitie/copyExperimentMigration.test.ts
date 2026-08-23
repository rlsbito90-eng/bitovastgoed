import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823083000_acquisitie_copy_varianten.sql'),
  'utf8',
).toLowerCase();

describe('copy-experiment databasecontract', () => {
  it('maakt een aparte variantcatalogus en immutable briefattributie', () => {
    expect(sql).toContain('create table if not exists public.acquisitie_copy_varianten');
    expect(sql).toContain('copy_variant_id uuid references public.acquisitie_copy_varianten(id)');
    expect(sql).toContain('copy_variant_key text');
    expect(sql).toContain('copy_hypothese text');
  });

  it('start uitsluitend met controlevariant A', () => {
    expect(sql).toContain("'a', 'controle'");
    expect(sql).not.toContain("'b', 'controle'");
  });

  it('wijst nieuwe communicatie deterministisch toe zonder update-trigger', () => {
    expect(sql).toContain('hashtext(v_seed)');
    expect(sql).toContain('before insert on public.off_market_brieven');
    expect(sql).not.toContain('before update on public.off_market_brieven');
  });

  it('voorziet post en e-mail van drie touchpoints', () => {
    for (const stap of ['brief_1', 'brief_2', 'brief_3', 'email_1', 'email_2', 'email_3']) {
      expect(sql).toContain(`'${stap}'`);
    }
  });
});
