import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pad = 'experiments/bag/2a4b/synthetic-shadow-probe.sql';
const bron = readFileSync(resolve(process.cwd(), pad), 'utf-8');
const sql = bron.replace(/\s+/g, ' ').trim().toLowerCase();

describe('BAG 2A.4B synthetische shadowproef', () => {
  it('is transactioneel, fail-closed en laat nooit testdata achter', () => {
    expect(sql).toContain('begin;');
    expect(sql).toContain('rollback;');
    expect(sql).not.toContain('commit;');
    expect(sql).toContain('2a.4b vereist exact drie lege bag-schema');
    expect(sql).toContain('2a.4b rollback faalde');
    expect(sql).toContain('2a.4b_synthetic_shadow_probe_ok');
  });

  it('doorloopt loader, publisher en reader zonder blijvend lidmaatschap', () => {
    expect(sql).toContain('set local role bag_loader');
    expect(sql).toContain('set local role bag_publisher');
    expect(sql).toContain('set local role bag_reader');
    expect(sql).toContain(
      'grant bag_loader, bag_publisher, bag_reader to postgres with set true, inherit false',
    );
    expect(sql.indexOf('grant bag_loader')).toBeLessThan(sql.indexOf('rollback;'));
    expect(sql).toContain('m.set_option');
  });

  it('test vijf objecten, relaties en beide toegestane 3D-geometrieën', () => {
    for (const objecttype of [
      'woonplaats',
      'openbareruimte',
      'nummeraanduiding',
      'pand',
      'verblijfsobject',
    ]) {
      expect(sql).toContain(`'${objecttype}'`);
    }
    expect(sql).toContain('polygon z((');
    expect(sql).toContain('point z(');
    expect(sql).toContain('extensions.st_covers');
    expect(sql).toContain('extensions.st_srid(geometrie) = 28992');
    expect(sql).toContain('extensions.st_ndims(geometrie) = 3');
  });

  it('bewijst least privilege voor app- en BAG-rollen', () => {
    expect(sql).toContain("has_schema_privilege('anon', 'bag_published', 'usage')");
    expect(sql).toContain(
      "has_schema_privilege('authenticated', 'bag_published', 'usage')",
    );
    expect(sql).toContain(
      "has_schema_privilege('service_role', 'bag_published', 'usage')",
    );
    expect(sql).toContain(
      "has_table_privilege('bag_publisher', 'bag_published.objecten', 'update')",
    );
    expect(sql).toContain(
      "has_table_privilege('bag_loader', 'bag_published.objecten', 'insert')",
    );
    expect(sql).toContain(
      "has_table_privilege('bag_reader', 'bag_staging.objecten', 'select')",
    );
  });
});
