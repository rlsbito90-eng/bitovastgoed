import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bouwBagKaartGeoJson, isBagKaartAfgekapt, type BagKaartPandRij } from './kaartModel';

const sql = readFileSync(resolve(process.cwd(), 'experiments/bag/pandenverkenner-viewport-v2.sql'), 'utf8');
const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/bag-query-service/index.ts'), 'utf8');
const transport = readFileSync(resolve(process.cwd(), 'src/lib/bag/queryTransport.ts'), 'utf8');
const queryService = readFileSync(resolve(process.cwd(), 'src/lib/bag/queryService.ts'), 'utf8');
const component = readFileSync(resolve(process.cwd(), 'src/components/bag/BagPandenKaartRuntime.tsx'), 'utf8');
const lijst = readFileSync(resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'), 'utf8');

function rij(overrides: Partial<BagKaartPandRij> = {}): BagKaartPandRij {
  return {
    datasetversie_id: 1,
    index_build_id: 3,
    identificatie: '0363100012345678',
    status: 'Pand in gebruik',
    bouwjaar: 1910,
    vbo_aantal: 4,
    vbo_oppervlakte_som: '420',
    gebruiksdoelen: ['woonfunctie'],
    is_gemengd: false,
    primair_adres: 'Voorbeeldstraat 1',
    primair_postcode: '1011AA',
    primair_plaats: 'Amsterdam',
    wijk_code: 'WK0363A0',
    wijk_naam: 'Centrum',
    buurt_code: 'BU0363A000',
    buurt_naam: 'Burgwallen-Oude Zijde',
    centroid_geojson: { type: 'Point', coordinates: [4.9, 52.37] },
    afgekapt: false,
    ...overrides,
  };
}

describe('Pandenverkenner kaartmodel 1E.1', () => {
  it('bouwt alleen geldige WGS84-punten en normaliseert GBO', () => {
    const geojson = bouwBagKaartGeoJson([
      rij(),
      rij({ identificatie: '2', centroid_geojson: { type: 'Point', coordinates: [999, 999] } }),
    ]);
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry.coordinates).toEqual([4.9, 52.37]);
    expect(geojson.features[0].properties.gbo).toBe(420);
    expect(geojson.features[0].properties.wijk).toBe('Centrum');
  });

  it('markeert een begrensde kaartresponse als afgekapt', () => {
    expect(isBagKaartAfgekapt([rij({ afgekapt: true })])).toBe(true);
    expect(isBagKaartAfgekapt([rij()])).toBe(false);
  });
});

describe('Pandenverkenner kaartquery 1E.1', () => {
  it('houdt WGS84 aan de rand en RD New intern voor de GiST-index', () => {
    expect(sql).toContain('panden_in_viewport_v2');
    expect(sql).toContain('st_makeenvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)');
    expect(sql).toContain('st_transform(');
    expect(sql).toContain('28992');
    expect(sql).toContain('i.centroid && v.geom');
    expect(sql).toContain('st_intersects(i.centroid, v.geom)');
    expect(sql).toContain('st_asgeojson(extensions.st_transform(g.centroid, 4326)');
  });

  it('past dezelfde serverfilters toe vóór de kaartlimiet', () => {
    expect(sql).toContain('i.pandstatus_huidig=ANY(p_statussen)');
    expect(sql).toContain('i.gebruiksdoelen && p_gebruiksdoelen');
    expect(sql).toContain('i.wijk_code=ANY(p_wijk_codes)');
    expect(sql).toContain('i.buurt_code=ANY(p_buurt_codes)');
    expect(sql).toContain('LIMIT p_limiet + 1');
    expect(sql).toContain('count(*) OVER () > p_limiet');
  });

  it('begrenst client en edge transport en laat oude viewport intact', () => {
    expect(queryService).toContain('BagKaartAanvraagV2');
    expect(queryService).toContain('valideerKaartAanvraagV2');
    expect(transport).toContain('haalPandenOpKaartV2');
    expect(transport).toContain("action: 'viewport_v2'");
    expect(edge).toContain("body.action === 'viewport_v2'");
    expect(edge).toContain('panden_in_viewport_v2');
    expect(edge).toContain("body.action === 'viewport'");
  });
});

describe('Pandenverkenner kaart-UX 1E.1', () => {
  it('hergebruikt MapLibre en de bestaande gratis PDOK-achtergrondkaart', () => {
    expect(component).toContain("from 'react-map-gl/maplibre'");
    expect(component).toContain('service.pdok.nl/brt/achtergrondkaart/wmts');
    expect(component).toContain('bag-server-clusters');
    expect(component).toContain('Ververs kaart');
  });

  it('ververst gedebounced en haalt contourdata alsnog op na programmatische focus', () => {
    expect(component).toMatch(/focusVerversNaMoveRef\.current\s*=\s*map\.getZoom\(\)\s*<\s*16\.5/);
    expect(component).toMatch(/if\s*\(focusVerversNaMoveRef\.current\)\s*\{\s*focusVerversNaMoveRef\.current\s*=\s*false;\s*void zoekInKaartgebied\(\);/);
    expect(component).toContain('setTimeout(()=>void zoekInKaartgebied(),700)');
    expect(component).toContain('clusterDrilldownRef.current');
    expect(component).not.toContain('onMove={zoekInKaartgebied}');
    expect(component).toContain('Zoom verder in voor een complete selectie.');
  });

  it('herstelt kaartgebied en resultaten binnen dezelfde browsersessie', () => {
    expect(component).toContain('leesKaartSessie');
    expect(component).toContain('bewaarKaartSessie');
    expect(component).toContain('initialViewState={initiëleSessie?.viewState??AMSTERDAM_VIEWPORT}');
  });

  it('koppelt dezelfde lijstfilters aan de kaartcomponent', () => {
    expect(lijst).toContain('<BagPandenKaart');
    expect(lijst).toContain('kaartFilters');
    expect(lijst).toContain('wijkCodes: serverFilters.wijkCodes');
    expect(lijst).toContain('gebruiksdoelen: filters.gebruiksdoelen');
  });
});
