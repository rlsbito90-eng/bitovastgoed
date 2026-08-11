import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const probe = readFileSync(
  resolve(process.cwd(), 'experiments/bag/pandenverkenner-2-0/1a3-synthetic-probe.sql'),
  'utf-8',
).replace(/\s+/g, ' ').toLowerCase();

describe('Pandenverkenner 2.0 BUILD 1A.3 synthetische proef', () => {
  it('draait volledig transactioneel en eindigt altijd met rollback', () => {
    expect(probe).toContain('begin;');
    expect(probe.trim().endsWith('rollback;')).toBe(true);
    expect(probe).not.toContain('commit;');
  });

  it('schrijft uitsluitend in bag_search', () => {
    expect(probe).toContain('insert into bag_search.index_builds');
    expect(probe).toContain('insert into bag_search.pand_search_index');
    expect(probe).not.toMatch(/insert into\s+bag_control\./);
    expect(probe).not.toMatch(/update\s+bag_control\./);
    expect(probe).not.toMatch(/delete from\s+bag_control\./);
    expect(probe).not.toMatch(/insert into\s+bag_published\./);
    expect(probe).not.toMatch(/update\s+bag_published\./);
    expect(probe).not.toMatch(/delete from\s+bag_published\./);
    expect(probe).not.toMatch(/\bpublic\./);
  });

  it('beproeft een pand zonder VBO met NULL-oppervlakten', () => {
    expect(probe).toContain('false, 0, null, null, array[]::text[], false');
    expect(probe).toContain('pand zonder vbo ontbreekt uit actieve synthetische build');
    expect(probe).toContain('null-semantiek voor panden zonder vbo is geschonden');
  });

  it('beproeft dat een opbouwbuild niet als actief wordt behandeld', () => {
    expect(probe).toContain("status = 'actief'");
    expect(probe).toContain("status = 'opbouw'");
    expect(probe).toContain('verwacht 1 niet-actieve opbouwrij');
  });

  it('beproeft de één-actieve-build-per-scope invariant', () => {
    expect(probe).toContain('when unique_violation then');
    expect(probe).toContain('tweede actieve build werd ten onrechte toegestaan');
  });
});
