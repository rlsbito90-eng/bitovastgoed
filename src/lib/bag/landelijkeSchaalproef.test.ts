import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const lees = (pad: string) =>
  readFileSync(resolve(process.cwd(), pad), 'utf-8')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const runner = lees('scripts/bag/run-2a5-shadow-scale-probe.sh');
const load = lees('experiments/bag/2a5/load-scale-shadow.sql');
const publish = lees('experiments/bag/2a5/publish-measure-scale-shadow.sql');
const cleanup = lees('experiments/bag/2a5/cleanup-scale-shadow.sql');

describe('BAG 2A.5 landelijke schaalproxy', () => {
  it('is hard aan de shadowref gebonden en blokkeert productie', () => {
    expect(runner).toContain('6a89a812-bc24-4545-8da4-dcf44e209fcf');
    expect(runner).toContain('ljudxyrqoifhfikueric');
    expect(runner).toContain('apply_bag_scale_probe_2a5');
    expect(runner).toContain('lovable_project_id');
    expect(runner).toContain('databasehost en opgegeven shadowref sluiten niet aan');
    expect(runner).toContain('sslmode=require');
    expect(runner).toContain('trap cleanup exit');
  });

  it('begrensd de schaal en weigert een niet-lege BAG-shadow', () => {
    expect(runner).toContain('sample_rows < 1000 || sample_rows > 250000');
    expect(load).toContain('2a.5 vereist een lege bag-shadow');
    expect(load).toContain('set local statement_timeout');
    expect(load).toContain('set local lock_timeout');
  });

  it('laadt deterministisch alle vier lagen met 3D RD-geometrie', () => {
    expect(load).toContain('generate_series(1, :sample_rows)');
    expect(load).toContain('insert into bag_staging.objecten');
    expect(load).toContain('insert into bag_staging.voorkomens');
    expect(load).toContain('insert into bag_staging.relaties');
    expect(load).toContain('insert into bag_staging.geometrieen');
    expect(load).toContain('extensions.st_force3dz');
    expect(load).toContain('28992');
  });

  it('publiceert als publisher en meet begrensde indexqueries als reader', () => {
    expect(publish).toContain('set local role bag_publisher');
    expect(publish).toContain('set role bag_reader');
    expect(publish).toContain('explain (analyze, buffers, format json)');
    expect(publish).toContain('limit 100');
    expect(publish).toContain('limit 2500');
    expect(publish).toContain('bag_table_and_index_bytes');
  });

  it('verwijdert testdata en herstelt SET FALSE idempotent', () => {
    expect(cleanup).toContain('delete from bag_published.geometrieen');
    expect(cleanup).toContain('delete from bag_control.datasetversies');
    expect(cleanup).toContain(
      'grant bag_loader, bag_publisher, bag_reader to postgres with set false, inherit false',
    );
    expect(cleanup).toContain('vacuum (analyze, truncate)');
    expect(cleanup).toContain('reindex table bag_published.geometrieen');
    expect(cleanup).toContain('2a.5_scale_cleanup_ok');
  });
});
