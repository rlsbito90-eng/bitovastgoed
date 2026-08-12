import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'experiments/bag/pandenverkenner-2-0/1d1-cbs-wijk-buurt-verrijking.sql'),
  'utf8',
);

describe('CBS wijk/buurt spatial-join contract', () => {
  it('begrensd de verrijking op actieve Amsterdam-build en scope', () => {
    expect(sql).toContain("b.scope_code = '0363'");
    expect(sql).toContain("d.status = 'actief'");
    expect(sql).toContain("b.status = 'actief'");
    expect(sql).toContain('b.validatie_fouten = 0');
    expect(sql).toContain("i.scope_code = '0363'");
  });

  it('koppelt in RD New met boundary-safe point-in-polygon en blokkeert ambiguïteit', () => {
    expect(sql).toContain('geometry(MultiPolygon,28992)');
    expect(sql).toContain('ST_Covers(b.geometrie, i.centroid)');
    expect(sql).toContain('k.match_count = 1');
  });

  it('wijzigt alleen wijk- en buurtvelden van de search-index', () => {
    expect(sql).toContain('UPDATE bag_search.pand_search_index i');
    expect(sql).toContain('SET wijk_code = k.wijkcode');
    expect(sql).toContain('wijk_naam = k.wijknaam');
    expect(sql).toContain('buurt_code = k.buurtcode');
    expect(sql).toContain('buurt_naam = k.buurtnaam');
    expect(sql).not.toMatch(/UPDATE\s+bag_published\./i);
    expect(sql).not.toMatch(/UPDATE\s+bag_control\./i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/DROP\s+/i);
  });
});
