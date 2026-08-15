import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260803233000_bag_2a13_enriched_panden_search.sql',
), 'utf8').replace(/\s+/g, ' ').toLowerCase();

describe('BAG 2A.13 relationeel verrijkte Pandenverkennerquery', () => {
  it('verrijkt uitsluitend de begrensde keysetpagina', () => {
    expect(sql).toContain('pagina as materialized');
    expect(sql).toContain('order by o.identificatie limit p_limiet');
    expect(sql).toContain("p_limiet < 1 or p_limiet > 250");
  });

  it('volgt de officiële VBO-, hoofdadres- en openbare-ruimterelaties', () => {
    expect(sql).toContain("pand_rel.relatietype = 'pandids'");
    expect(sql).toContain("adres_rel.relatietype in ('hoofdadresids', 'nummeraanduidingids')");
    expect(sql).toContain("ruimte_rel.relatietype = 'openbareruimteids'");
    expect(sql).toContain("woonplaats_rel.relatietype = 'woonplaatsids'");
  });

  it('aggregeert functies, oppervlakte en VBO-aantal zonder apprechten te openen', () => {
    expect(sql).toContain("'gebruiksdoelen'");
    expect(sql).toContain("'aantalverblijfsobjecten'");
    expect(sql).toContain('sum(case');
    expect(sql).toContain('security definer');
    expect(sql).toContain('revoke all on function bag_service.zoek_panden');
    expect(sql).toContain('grant execute on function bag_service.zoek_panden');
  });
});
