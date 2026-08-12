import type { FeatureCollection, Point } from 'geojson';
import type { BagVboModus } from './queryService';

export interface BagKaartFilters {
  bouwjaarVan: number | null;
  bouwjaarTot: number | null;
  statussen: string[];
  wijkCodes: string[];
  buurtCodes: string[];
  vboOppervlakteSomVan: number | null;
  vboOppervlakteSomTot: number | null;
  vboOppervlakteMaxVan: number | null;
  vboOppervlakteMaxTot: number | null;
  vboAantalVan: number | null;
  vboAantalTot: number | null;
  gebruiksdoelen: string[];
  isGemengd: boolean | null;
  vboModus: BagVboModus;
}

export interface BagKaartPandRij {
  datasetversie_id: number;
  index_build_id: number;
  identificatie: string;
  status: string | null;
  bouwjaar: number | null;
  vbo_aantal: number | null;
  vbo_oppervlakte_som: number | string | null;
  gebruiksdoelen: string[] | null;
  is_gemengd: boolean | null;
  primair_adres: string | null;
  primair_postcode: string | null;
  primair_plaats: string | null;
  wijk_code: string | null;
  wijk_naam: string | null;
  buurt_code: string | null;
  buurt_naam: string | null;
  centroid_geojson: Point | null;
  afgekapt: boolean;
}

export interface BagKaartFeatureProperties {
  id: string;
  adres: string;
  postcode: string;
  plaats: string;
  status: string;
  bouwjaar: number | null;
  gbo: number | null;
  vboAantal: number | null;
  wijk: string;
  buurt: string;
}

export interface BagKaartV3Rij {
  item_type: 'cluster' | 'pand'; cluster_id: string | null; aantal: number; datasetversie_id: number | null; index_build_id: number | null; identificatie: string | null;
  status: string | null; bouwjaar: number | null; vbo_aantal: number | null; vbo_oppervlakte_som: number | string | null; gebruiksdoelen: string[] | null; is_gemengd: boolean | null;
  primair_adres: string | null; primair_postcode: string | null; primair_plaats: string | null; wijk_code: string | null; wijk_naam: string | null; buurt_code: string | null; buurt_naam: string | null;
  center_geojson: Point | null; pand_geojson: import('geojson').Polygon | import('geojson').MultiPolygon | null; afgekapt: boolean;
}

export interface BagKaartV3FeatureProperties extends BagKaartFeatureProperties { itemType: 'cluster' | 'pand'; aantal: number; clusterId: string; }

function getal(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function geldigPunt(value: Point | null): value is Point {
  if (!value || value.type !== 'Point' || !Array.isArray(value.coordinates) || value.coordinates.length < 2) return false;
  const [longitude, latitude] = value.coordinates;
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    && longitude >= -180 && longitude <= 180
    && latitude >= -90 && latitude <= 90;
}

export function bouwBagKaartGeoJson(rows: BagKaartPandRij[]): FeatureCollection<Point, BagKaartFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: rows.filter(row => geldigPunt(row.centroid_geojson)).map(row => ({
      type: 'Feature',
      geometry: row.centroid_geojson as Point,
      properties: {
        id: row.identificatie,
        adres: row.primair_adres ?? `BAG-pand ${row.identificatie}`,
        postcode: row.primair_postcode ?? '',
        plaats: row.primair_plaats ?? '',
        status: row.status ?? '',
        bouwjaar: Number.isFinite(row.bouwjaar) ? row.bouwjaar : null,
        gbo: getal(row.vbo_oppervlakte_som),
        vboAantal: Number.isFinite(row.vbo_aantal) ? row.vbo_aantal : null,
        wijk: row.wijk_naam ?? '',
        buurt: row.buurt_naam ?? '',
      },
    })),
  };
}

export function bouwBagKaartV3Punten(rows: BagKaartV3Rij[]): FeatureCollection<Point, BagKaartV3FeatureProperties> {
  return { type: 'FeatureCollection', features: rows.filter(row => geldigPunt(row.center_geojson)).map(row => ({
    type: 'Feature', geometry: row.center_geojson as Point, properties: {
      itemType: row.item_type, aantal: Number(row.aantal) || 0, clusterId: row.cluster_id ?? '', id: row.identificatie ?? row.cluster_id ?? '',
      adres: row.primair_adres ?? (row.item_type === 'cluster' ? `${Number(row.aantal) || 0} panden` : `BAG-pand ${row.identificatie ?? ''}`),
      postcode: row.primair_postcode ?? '', plaats: row.primair_plaats ?? '', status: row.status ?? '', bouwjaar: Number.isFinite(row.bouwjaar) ? row.bouwjaar : null,
      gbo: getal(row.vbo_oppervlakte_som), vboAantal: Number.isFinite(row.vbo_aantal) ? row.vbo_aantal : null, wijk: row.wijk_naam ?? '', buurt: row.buurt_naam ?? '',
    }
  })) };
}

export function bouwBagKaartV3Contouren(rows: BagKaartV3Rij[]): import('geojson').FeatureCollection<import('geojson').Polygon | import('geojson').MultiPolygon, { id: string }> {
  return { type: 'FeatureCollection', features: rows.filter(row => row.item_type === 'pand' && row.identificatie && row.pand_geojson).map(row => ({ type: 'Feature', geometry: row.pand_geojson!, properties: { id: row.identificatie! } })) };
}

export function isBagKaartAfgekapt(rows: BagKaartPandRij[]): boolean {
  return rows.some(row => row.afgekapt === true);
}
