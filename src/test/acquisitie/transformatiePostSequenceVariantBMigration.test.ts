import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823210715_transformatie_post_sequence_variant_b.sql'),
  'utf8',
).toLowerCase();

describe('transformatie post Brief 1–3 variant B migration', () => {
  it('activeert voor alle drie de brieven een challenger met gelijk gewicht en primaire KPI', () => {
    expect(sql).toContain("'transformatie_herontwikkeling'");
    expect(sql).toContain("'post'");
    expect(sql).toContain("'brief_1'");
    expect(sql).toContain("'brief_2'");
    expect(sql).toContain("'brief_3'");
    expect(sql).toContain("'transformatie_herontwikkeling_post_brief_1_b_v1'");
    expect(sql).toContain("'transformatie_herontwikkeling_post_brief_2_b_v1'");
    expect(sql).toContain("'transformatie_herontwikkeling_post_brief_3_b_v1'");
    expect(sql).toContain('kwalitatieve verkopersrespons');
    expect(sql).toContain("variant_code = 'a'");
    expect(sql).toContain('gewicht = 100');
  });
});
