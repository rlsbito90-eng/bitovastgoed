import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260804183000_object_kadaster_rls_performance.sql'),
  'utf8',
);

describe('Object- en Kadaster-schema performance-hardening', () => {
  it('indexeert alle door de shadow-advisor gemelde foreign keys', () => {
    expect(migration).toContain('crm_objectregistraties_samengevoegd_in_idx');
    expect(migration).toContain('kadaster_producten_updated_by_idx');
    expect(migration).toContain('kadaster_budgetten_updated_by_idx');
    expect(migration).toContain('kadaster_kosten_events_hergebruik_idx');
  });

  it('initialiseert auth- en adminfuncties één keer per statement', () => {
    expect(migration).toContain('(select auth.uid())');
    expect(migration).toContain('(select public.is_app_admin())');
    expect(migration).not.toMatch(/(?<!select )auth\.uid\(\)/);
  });

  it('voorkomt dubbele permissieve SELECT-policies voor product- en budgetbeheer', () => {
    expect(migration).toContain('drop policy if exists "admin beheert kadasterproducten"');
    expect(migration).toContain('drop policy if exists "admin beheert kadasterbudgetten"');
    expect(migration).toContain('for insert to authenticated');
    expect(migration).toContain('for update to authenticated');
    expect(migration).toContain('for delete to authenticated');
    expect(migration).not.toContain('for all to authenticated');
  });

  it('wijzigt geen gegevens en activeert geen Kadasterproduct', () => {
    expect(migration).not.toMatch(/\b(insert into|update\s+public|delete from|truncate)\b/i);
    expect(migration).not.toContain("actief = true");
  });
});
