import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');

describe('officiële Assen-shadowimport', () => {
  it('blijft fail-closed voor project, approval, SSL en lege BAG-tabellen', () => {
    const runner = readFileSync(resolve(root, 'scripts/bag/run-officiele-assen-shadow-import.sh'), 'utf8');
    const sql = readFileSync(resolve(root, 'experiments/bag/shadow/import-officiele-assen.sql'), 'utf8');

    expect(runner).toContain('APPLY_BAG_OFFICIAL_ASSEN_SHADOW');
    expect(runner).toContain('xfygspvpeugxowxbcvnm');
    expect(runner).toContain('ljudxyrqoifhfikueric');
    expect(runner).toContain('sslmode=require');
    expect(runner).toContain("expected_objecten\" == '128745'");
    expect(runner).toContain("expected_voorkomens\" == '168047'");
    expect(runner).toContain("expected_relaties\" == '160351'");
    expect(runner).toContain("expected_geometrieen\" == '122388'");
    expect(sql).toContain('Officiële Assen-import vereist een lege BAG-shadow');
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('bag_control.activeer_datasetversie');
    expect(sql).toContain('WITH SET FALSE, INHERIT FALSE');
  });

  it('houdt de database-URL uit workflowinputs en artifacts', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/bag-shadow-officiele-assen-import.yml'), 'utf8');
    const artifactPaths = workflow.split('          path: |\n')[1] ?? '';

    expect(workflow).toContain('secrets.BAG_SHADOW_DATABASE_URL');
    expect(workflow).not.toMatch(/database[_-]?url:\s*\n\s+description:/i);
    expect(artifactPaths).not.toContain('bag-shadow-bron/records.ndjson');
    expect(artifactPaths).not.toContain('bag-shadow-bron/postgis-export/*.csv');
  });
});
