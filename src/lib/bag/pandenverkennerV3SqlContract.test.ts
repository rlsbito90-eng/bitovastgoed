import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'experiments/bag/pandenverkenner-zoek-panden-v3.sql'),
  'utf8',
);

describe('Pandenverkenner v3 SQL-contract', () => {
  it('maakt v3 naast v2 en behoudt de actieve-indexgrens', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION bag_service.zoek_panden_v3');
    expect(sql).toContain("d.status = 'actief'");
    expect(sql).toContain("b.status = 'actief'");
    expect(sql).toContain('b.validatie_fouten = 0');
    expect(sql).not.toMatch(/DROP\s+FUNCTION\s+bag_service\.zoek_panden_v2/i);
  });

  it('gebruikt OR-semantiek voor status en gebruiksfuncties', () => {
    expect(sql).toContain('i.pandstatus_huidig = ANY(p_statussen)');
    expect(sql).toContain('i.gebruiksdoelen && p_gebruiksdoelen');
  });

  it('begrensd multiselects en behoudt GBO VBO filters', () => {
    expect(sql).toContain('> 16');
    expect(sql).toContain('i.vbo_oppervlakte_som >= p_vbo_som_van');
    expect(sql).toContain('i.vbo_oppervlakte_max >= p_vbo_max_van');
    expect(sql).toContain('i.vbo_aantal >= p_vbo_aantal_van');
  });
});
