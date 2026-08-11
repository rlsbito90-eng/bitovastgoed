import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'experiments/bag/pandenverkenner-2-0/1a2-search-index-schema.sql'),
  'utf-8',
).replace(/\s+/g, ' ').toLowerCase();

describe('Pandenverkenner 2.0 BUILD 1A.2 schema', () => {
  it('maakt een rebuildable read-model met dataset, scope en pand als sleutel', () => {
    expect(sql).toContain('create schema if not exists bag_search');
    expect(sql).toContain('create table bag_search.pand_search_index');
    expect(sql).toContain('primary key (datasetversie_id, scope_code, pand_identificatie)');
    expect(sql).toContain('index_versie text not null');
  });

  it('scheidt VBO som, max en aantal en borgt NULL-semantiek zonder VBO', () => {
    expect(sql).toContain('vbo_oppervlakte_som numeric');
    expect(sql).toContain('vbo_oppervlakte_max numeric');
    expect(sql).toContain('vbo_aantal integer not null');
    expect(sql).toContain('not heeft_vbo and vbo_aantal = 0 and vbo_oppervlakte_som is null and vbo_oppervlakte_max is null');
    expect(sql).toContain('vbo_oppervlakte_max <= vbo_oppervlakte_som');
  });

  it('neemt panden zonder VBO als first-class rij op', () => {
    expect(sql).toContain('heeft_vbo boolean not null');
    expect(sql).toContain('cardinality(gebruiksdoelen) = 0');
  });

  it('bevat expliciet adresmodel en deterministische adres-consistentie', () => {
    for (const veld of [
      'primair_adres text',
      'primair_straat text',
      'primair_huisnummer text',
      'primair_postcode text',
      'primair_plaats text',
      'adres_count integer not null',
    ]) expect(sql).toContain(veld);
    expect(sql).toContain('(adres_count = 0 and primair_adres is null) or (adres_count > 0 and primair_adres is not null)');
  });

  it('bewaart originele pandgeometrie naast centroid in RD New', () => {
    expect(sql).toContain('pand_geometrie geometry(geometryz, 28992)');
    expect(sql).toContain('centroid geometry(point, 28992)');
    expect(sql).toContain('using gist (centroid)');
    expect(sql).toContain('using gist (pand_geometrie)');
  });

  it('reserveert versieerbare gebiedsverrijking zonder die tot BAG-feit te verheffen', () => {
    for (const veld of [
      'gemeente_code text not null',
      'cbs_jaarversie integer',
      'wijk_code text',
      'buurt_code text',
      'stadsdeel_code text',
    ]) expect(sql).toContain(veld);
  });

  it('sluit directe app-toegang af en houdt bag_reader achter servicefuncties', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('revoke all on table bag_search.pand_search_index from public, anon, authenticated, service_role');
    expect(sql).not.toContain('grant select on bag_search.pand_search_index to bag_reader');
  });

  it('bevat geen acquisitieclassificatie of Off-Market Radar-kolommen', () => {
    expect(sql).not.toContain('acquisitie_classificatie');
    expect(sql).not.toContain('signaal_type');
    expect(sql).not.toContain('off_market');
  });
});
