import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260831153000_guard_fee_reporting_legacy_ambiguity.sql'),
  'utf8',
);

describe('object_fee_reporting SQL guard', () => {
  it('gebruikt accepted bid als sterkste concrete Deal-identificatie', () => {
    expect(migration).toContain('accepted_active_deal');
    expect(migration).toContain("b.status = 'geaccepteerd'");
  });

  it('staat legacy fallback alleen toe bij exact één actieve Deal', () => {
    expect(migration).toContain('active_count = 1');
    expect(migration).toContain('single_active_deal');
  });

  it('valt bij ambiguïteit terug op Objectforecast in plaats van willekeurige Dealfee', () => {
    expect(migration).toContain('else null');
    expect(migration).toContain('coalesce(c.verwachte_fee_bedrag, 0)');
    expect(migration).not.toContain('row_number() over');
  });
});
