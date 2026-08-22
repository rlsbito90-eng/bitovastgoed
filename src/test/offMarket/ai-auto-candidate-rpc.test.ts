import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822165000_fix_off_market_ai_auto_candidates_alias.sql'),
  'utf8',
);

describe('AI auto candidate RPC alias', () => {
  it('kwalificeert config-id zodat outputkolom id niet ambigu is', () => {
    expect(migration).toContain('from public.off_market_ai_config c');
    expect(migration).toContain('where c.id = true');
    expect(migration).not.toContain('where id = true');
  });
});
