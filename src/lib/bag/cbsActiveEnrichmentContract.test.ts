import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'experiments/bag/pandenverkenner-2-0/1d3-cbs-amsterdam-active-enrichment.sql',
  'utf8',
);

describe('BUILD 1D.3 CBS actieve-indexverrijking', () => {
  it('blijft hard begrensd op actieve Amsterdam build 3 en CBS 2025 staging', () => {
    expect(sql).toContain("id=3 AND scope_code='0363'");
    expect(sql).toContain("index_build_id=3");
    expect(sql).toContain("scope_code='0363'");
    expect(sql).toContain("bronjaar=2025");
    expect(sql).toContain("gemeentecode='GM0363'");
    expect(sql).toContain('ST_Covers(b.geometrie,i.centroid)');
  });

  it('borgt de bewezen dekking en laat uitzonderingen zonder verzonnen gebied', () => {
    expect(sql).toContain('211082');
    expect(sql).toContain('30');
    expect(sql).toContain('ambigue CBS-buurtmatches');
    expect(sql.toLowerCase()).not.toContain('st_dwithin');
    expect(sql.toLowerCase()).not.toContain('st_distance');
    expect(sql.toLowerCase()).not.toContain('<->');
  });

  it('legt CBS-provenance vast', () => {
    expect(sql).toContain('cbs_gebiedsjaar');
    expect(sql).toContain('cbs_buurten_sha256');
    expect(sql).toContain('cbs_wijken_sha256');
    expect(sql).toContain('bd5cd7fdc1d1f23a7b6ae2bf36e309872c1b7ab8243d127fbc989e3b869c77e0');
    expect(sql).toContain('b76c1ffa4a606994184fcf45462cae4127d0acb43802965f987d37994a82a725');
  });
});
