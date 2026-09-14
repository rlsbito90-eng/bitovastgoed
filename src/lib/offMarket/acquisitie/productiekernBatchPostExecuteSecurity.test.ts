import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260914080948_restrict_atomic_batch_posting_execute.sql',
), 'utf8').replace(/\s+/g, ' ').toLowerCase();

describe('atomische batch-post execute-rechten', () => {
  it('blokkeert anon expliciet en laat alleen de bedoelde uitvoerrollen toe', () => {
    expect(sql).toContain('from public, anon');
    expect(sql).toContain('to authenticated, service_role');
    expect(sql).not.toContain('to anon');
  });
});
