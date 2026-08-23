import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823162600_splitsingspotentie_post_brief3_variant_b.sql'),
  'utf8',
).toLowerCase();

describe('splitsingspotentie post brief 3 variant B migration', () => {
  it('activeert de bedoelde challenger met gelijk gewicht en primaire KPI', () => {
    expect(sql).toContain("'splitsingspotentie'");
    expect(sql).toContain("'post'");
    expect(sql).toContain("'brief_3'");
    expect(sql).toContain("'b'");
    expect(sql).toContain("'splitsingspotentie_post_brief_3_b_v1'");
    expect(sql).toContain('kwalitatieve verkopersrespons');
    expect(sql).toContain('100');
  });
});
