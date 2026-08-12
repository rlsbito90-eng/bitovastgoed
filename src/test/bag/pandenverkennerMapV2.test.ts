import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync('experiments/bag/pandenverkenner-map-v2.sql', 'utf8');
const service = fs.readFileSync('src/lib/bag/queryService.ts', 'utf8');
const transport = fs.readFileSync('src/lib/bag/queryTransport.ts', 'utf8');
const edge = fs.readFileSync('supabase/functions/bag-query-service/index.ts', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');
const model = fs.readFileSync('src/lib/bag/kaartModel.ts', 'utf8');

describe('Pandenverkenner Map v2', () => {
  it('gebruikt server-side clusters voor uitgezoomde kaart zonder individuele 1500-cap', () => {
    expect(sql).toContain('IF p_zoom < 15 THEN');
    expect(sql).toContain("'cluster'::text");
    expect(sql).toContain('count(*)::integer AS cnt');
    expect(sql).toContain('GROUP BY 1,2');
    const clusterBlok = sql.slice(sql.indexOf('IF p_zoom < 15 THEN'), sql.indexOf('RETURN;', sql.indexOf('IF p_zoom < 15 THEN')));
    expect(clusterBlok).not.toContain('LIMIT p_limiet + 1');
  });

  it('begrenst individuele panden en levert contouren pas vanaf zoom 17', () => {
    expect(sql).toContain('LIMIT p_limiet + 1');
    expect(sql).toContain('CASE WHEN p_zoom >= 17');
    expect(sql).toContain('g.pand_geometrie');
    expect(sql).toContain('pand_geojson');
  });

  it('houdt dezelfde vastgoedfilters in beide detailniveaus', () => {
    expect((sql.match(/i\.pandstatus_huidig=ANY\(p_statussen\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/i\.gebruiksdoelen && p_gebruiksdoelen/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/i\.wijk_code=ANY\(p_wijk_codes\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/i\.buurt_code=ANY\(p_buurt_codes\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('heeft een expliciete V3 request-, transport- en Edge-route', () => {
    expect(service).toContain('BagKaartAanvraagV3');
    expect(service).toContain('valideerKaartAanvraagV3');
    expect(transport).toContain('haalPandenOpKaartV3');
    expect(transport).toContain("action: 'viewport_v3'");
    expect(edge).toContain("body.action === 'viewport_v3'");
    expect(edge).toContain('bag_service.panden_kaart_v3');
  });

  it('rendert serverclusters en echte pandcontouren zonder client-side GeoJSON clustering', () => {
    expect(kaart).toContain('bag-server-clusters');
    expect(kaart).toContain('bag-pandcontour-fill');
    expect(kaart).toContain('minzoom:17');
    expect(kaart).toContain('haalPandenOpKaartV3');
    expect(kaart).not.toContain('clusterMaxZoom');
    expect(kaart).not.toContain('clusterRadius');
    expect(model).toContain('bouwBagKaartV3Contouren');
  });
});

// 1G.2 UX-contract: serverclusters zijn interactief en kaartbeweging ververst gedebounced.
