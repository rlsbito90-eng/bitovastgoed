import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823093000_splitsingspotentie_post_brief1_variant_b.sql'),
  'utf8',
).toLowerCase();

describe('splitsingspotentie post brief 1 variant B migration', () => {
  it('activeert alleen de bedoelde challenger met gelijk gewicht', () => {
    expect(sql).toContain("'splitsingspotentie'");
    expect(sql).toContain("'post'");
    expect(sql).toContain("'brief_1'");
    expect(sql).toContain("'b'");
    expect(sql).toContain("'splitsingspotentie_post_brief_1_b_v1'");
    expect(sql).toContain('100');
  });

  it('voegt de ontbrekende fk-index toe', () => {
    expect(sql).toContain('off_market_brieven_copy_variant_id_idx');
    expect(sql).toContain('on public.off_market_brieven(copy_variant_id)');
  });
});
