import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260816231000_acquisitie_productiekern_private_storage.sql',
), 'utf8');

describe('Productiekern private Storage migratie', () => {
  it('maakt een private bucket met begrensde PDF/CSV-mimetypes', () => {
    expect(sql).toContain("'off-market-productie'");
    expect(sql).toMatch(/public\s*,[\s\S]*?false/i);
    expect(sql).toContain('20971520');
    expect(sql).toContain("'application/pdf'");
    expect(sql).toContain("'text/csv'");
  });

  it('staat insert/select alleen toe voor interne authenticated users in hun eigen pad', () => {
    expect(sql).toMatch(/for insert\s+to authenticated/i);
    expect(sql).toMatch(/for select\s+to authenticated/i);
    expect(sql).toContain('public.is_intern_gebruiker(auth.uid())');
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(sql).toContain("bucket_id = 'off-market-productie'");
  });

  it('maakt geen update/delete-policy en houdt artifacts vanuit de browser append-only', () => {
    expect(sql).not.toMatch(/create policy[\s\S]{0,160}for update/i);
    expect(sql).not.toMatch(/create policy[\s\S]{0,160}for delete/i);
    expect(sql).toContain('drop policy if exists "off_market_productie_update_eigen_pad"');
    expect(sql).toContain('drop policy if exists "off_market_productie_delete_eigen_pad"');
  });
});
