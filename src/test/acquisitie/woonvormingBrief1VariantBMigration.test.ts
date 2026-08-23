import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823162700_woonvorming_post_brief1_variant_b.sql'),
  'utf8',
).toLowerCase();

describe('woonvorming post brief 1 variant B migration', () => {
  it('activeert de bedoelde challenger met gelijk gewicht en primaire KPI', () => {
    expect(sql).toContain("'woonvorming'");
    expect(sql).toContain("'post'");
    expect(sql).toContain("'brief_1'");
    expect(sql).toContain("'b'");
    expect(sql).toContain("'woonvorming_post_brief_1_b_v1'");
    expect(sql).toContain('kwalitatieve verkopersrespons');
    expect(sql).toContain('100');
  });
});
