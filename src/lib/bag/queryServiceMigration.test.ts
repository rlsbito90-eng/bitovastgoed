import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = readFileSync(
  resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260803203000_bag_2a7_private_query_service.sql'),
  'utf-8',
);
const sql = bron.replace(/\s+/g, ' ').trim().toLowerCase();
const verificatie = readFileSync(
  resolve(process.cwd(), 'experiments/bag/2a7/query-service-scale-verification.sql'),
  'utf-8',
).replace(/\s+/g, ' ').trim().toLowerCase();

describe('BAG 2A.7 private queryservicemigratie', () => {
  it('houdt de servicelaag privé voor app-rollen', () => {
    expect(sql).toContain('revoke all on schema bag_service from public, anon, authenticated, service_role');
    expect(sql).toContain('grant usage on schema bag_service to bag_reader');
    expect(sql).toContain('security definer');
    expect(sql).toContain('owner to postgres');
    expect(sql).toContain('set jit = off');
  });
  it('valideert scope, limiet en begrensde RD New-coördinaten in de database', () => {
    expect(sql).toContain("p_scope_code ~ '^[a-za-z0-9_-]{1,64}$'");
    expect(sql).toContain('p_limiet < 1 or p_limiet > 2500');
    expect(sql).toContain('p_min_x < -10000 or p_max_x > 300000');
    expect(sql).toContain('p_min_y < 275000 or p_max_y > 630000');
  });
  it('gebruikt de actieve dataset, GiST-operator en een harde viewportlimiet', () => {
    expect(sql).toContain("d.status = 'actief' and d.is_actief");
    expect(sql).toContain('g.geometrie && extensions.st_makeenvelope');
    expect(sql).toContain('limit p_limiet + 1');
    expect(sql).toContain('count(*) over () > p_limiet as is_afgekapt');
  });
  it('biedt afzonderlijke keysetpaginering met maximaal 250 resultaten', () => {
    expect(sql).toContain('create or replace function bag_service.zoek_panden');
    expect(sql).toContain('o.identificatie > p_na_identificatie');
    expect(sql).toContain('order by o.identificatie limit p_limiet');
    expect(sql).toContain('p_limiet < 1 or p_limiet > 250');
  });
  it('voegt een objectgerichte geometrie-index toe', () => {
    expect(sql).toContain('create index if not exists bag_published_geometrieen_object_idx');
    expect(sql).toContain('datasetversie_id, objecttype, identificatie, geometrie_volgnummer');
  });
  it('maakt GiST-plan, afkapping en private privileges reproduceerbaar', () => {
    expect(verificatie).toContain('bag_published_geometrieen_gist_idx');
    expect(verificatie).toContain('bool_and(afgekapt)');
    expect(verificatie).toContain("has_schema_privilege('service_role', 'bag_service', 'usage')");
    expect(verificatie).toContain('2a.7_query_service_scale_ok');
  });
});
