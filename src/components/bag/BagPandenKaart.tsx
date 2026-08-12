import { useCallback, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Point } from 'geojson';
import { Check, Copy, ExternalLink, Loader2, MapPinned, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { bouwGoogleMapsAdresUrl } from '@/lib/bag/googleMaps';
import type { BagVerkennerPand } from '@/lib/bag/pandenverkennerModel';
import { haalPandenOpKaartV2 } from '@/lib/bag/queryTransport';
import {
  bouwBagKaartGeoJson,
  isBagKaartAfgekapt,
  type BagKaartFeatureProperties,
  type BagKaartFilters,
  type BagKaartPandRij,
} from '@/lib/bag/kaartModel';

const PDOK_TILE = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';
const PDOK_ATTRIBUTION = '&copy; <a href="https://www.pdok.nl">PDOK</a> / <a href="https://www.kadaster.nl">Kadaster</a>';
const KAART_LIMIET = 1500;
const AMSTERDAM_VIEWPORT = { longitude: 4.9041, latitude: 52.3676, zoom: 10.8 };

const STYLE = {
  version: 8 as const,
  sources: {
    'pdok-brt': {
      type: 'raster' as const,
      tiles: [PDOK_TILE],
      tileSize: 256,
      attribution: PDOK_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [{ id: 'pdok-brt', type: 'raster' as const, source: 'pdok-brt' }],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

const CLUSTER_LAYER = {
  id: 'bag-clusters',
  type: 'circle' as const,
  source: 'bag-panden',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#0f526f',
    'circle-radius': ['step', ['get', 'point_count'], 17, 100, 21, 500, 27],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1.5,
  },
};

const CLUSTER_TELLER_LAYER = {
  id: 'bag-cluster-teller',
  type: 'symbol' as const,
  source: 'bag-panden',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': 11,
  },
  paint: { 'text-color': '#ffffff' },
};

const PAND_LAYER = {
  id: 'bag-panden',
  type: 'circle' as const,
  source: 'bag-panden',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#0f526f',
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 6, 17, 9],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
    'circle-opacity': 0.9,
  },
};

interface Props {
  scopeCode: string;
  filters: BagKaartFilters;
  geselecteerdeIds?: Set<string>;
  onKandidaatToggle?: (pand: BagVerkennerPand) => void;
}

function kaartRijNaarVerkennerPand(row: BagKaartPandRij): BagVerkennerPand {
  const adres = row.primair_adres?.trim() || row.identificatie;
  return {
    datasetversieId: String(row.datasetversie_id),
    bagPandId: row.identificatie,
    voorkomenSleutel: '',
    status: row.status,
    adres,
    adresCompleet: Boolean(row.primair_adres?.trim()),
    straat: null,
    postcode: row.primair_postcode?.trim() || null,
    plaats: row.primair_plaats?.trim() || null,
    wijkCode: row.wijk_code?.trim() || null,
    wijkNaam: row.wijk_naam?.trim() || null,
    buurtCode: row.buurt_code?.trim() || null,
    buurtNaam: row.buurt_naam?.trim() || null,
    bouwjaar: Number.isFinite(row.bouwjaar) ? row.bouwjaar : null,
    gebruiksdoelen: row.gebruiksdoelen ?? [],
    oppervlakte: row.vbo_oppervlakte_som == null ? null : Number(row.vbo_oppervlakte_som),
    aantalVerblijfsobjecten: Number.isFinite(row.vbo_aantal) ? Number(row.vbo_aantal) : 0,
    gemengdGebruik: Boolean(row.is_gemengd),
    cursor: '',
  };
}

function formatGetal(value: number | null, suffix = ''): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString('nl-NL')}${suffix}`;
}

export default function BagPandenKaart({ scopeCode, filters, geselecteerdeIds = new Set(), onKandidaatToggle }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [rows, setRows] = useState<BagKaartPandRij[]>([]);
  const [laden, setLaden] = useState(false);
  const [heeftGezocht, setHeeftGezocht] = useState(false);
  const [kaartVerouderd, setKaartVerouderd] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<BagKaartFeatureProperties | null>(null);

  const geojson = useMemo(() => bouwBagKaartGeoJson(rows), [rows]);
  const afgekapt = useMemo(() => isBagKaartAfgekapt(rows), [rows]);

  const zoekInKaartgebied = useCallback(async () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const bounds = map.getBounds();
    setLaden(true);
    try {
      const resultaat = await haalPandenOpKaartV2<BagKaartPandRij>({
        scopeCode,
        viewport: {
          minLon: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLon: bounds.getEast(),
          maxLat: bounds.getNorth(),
        },
        limiet: KAART_LIMIET,
        ...filters,
      });
      setRows(resultaat.rows);
      setHeeftGezocht(true);
      setKaartVerouderd(false);
      setGeselecteerd(null);
      if (!resultaat.rows.length) toast.info('Geen BAG-panden in dit kaartgebied voor de gekozen filters.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'BAG-kaart laden mislukt.');
    } finally {
      setLaden(false);
    }
  }, [filters, scopeCode]);

  const onClickKaart = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      setGeselecteerd(null);
      return;
    }
    if (feature.layer.id === 'bag-clusters') {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      const source = mapRef.current?.getMap().getSource('bag-panden') as maplibregl.GeoJSONSource | undefined;
      if (clusterId === undefined || !source || feature.geometry.type !== 'Point') return;
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        mapRef.current?.easeTo({
          center: (feature.geometry as Point).coordinates as [number, number],
          zoom: zoom + 0.2,
          duration: 450,
        });
      }).catch(() => undefined);
      return;
    }
    if (feature.layer.id === 'bag-panden') {
      const properties = feature.properties as unknown as BagKaartFeatureProperties;
      setGeselecteerd({
        id: String(properties.id),
        adres: String(properties.adres ?? ''),
        postcode: String(properties.postcode ?? ''),
        plaats: String(properties.plaats ?? ''),
        status: String(properties.status ?? ''),
        bouwjaar: properties.bouwjaar == null ? null : Number(properties.bouwjaar),
        gbo: properties.gbo == null ? null : Number(properties.gbo),
        vboAantal: properties.vboAantal == null ? null : Number(properties.vboAantal),
        wijk: String(properties.wijk ?? ''),
        buurt: String(properties.buurt ?? ''),
      });
    }
  }, []);

  const geselecteerdPunt = useMemo(() => {
    if (!geselecteerd) return null;
    const feature = geojson.features.find(item => item.properties.id === geselecteerd.id);
    return feature?.geometry.coordinates as [number, number] | undefined;
  }, [geojson.features, geselecteerd]);

  const geselecteerdRij = useMemo(() => rows.find(row => row.identificatie === geselecteerd?.id) ?? null, [rows, geselecteerd]);
  const kandidaatGeselecteerd = geselecteerd ? geselecteerdeIds.has(geselecteerd.id) : false;

  const kopieerBagId = async () => {
    if (!geselecteerd) return;
    try {
      await navigator.clipboard.writeText(geselecteerd.id);
      toast.success('BAG-ID gekopieerd.');
    } catch {
      toast.error('BAG-ID kopiëren mislukt.');
    }
  };

  return (
    <div className="border-b p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            <h3 className="text-sm font-medium">Kaart</h3>
            {heeftGezocht && <Badge variant="outline">{geojson.features.length.toLocaleString('nl-NL')} panden</Badge>}
            {afgekapt && <Badge variant="secondary">Max. {KAART_LIMIET.toLocaleString('nl-NL')}</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Beweeg of zoom de kaart en kies daarna ‘Toon panden in beeld’. Dezelfde filters als de lijst worden gebruikt.
          </p>
        </div>
        <Button onClick={() => void zoekInKaartgebied()} disabled={laden}>
          {laden ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : kaartVerouderd ? <RefreshCw className="mr-2 h-4 w-4" /> : <MapPinned className="mr-2 h-4 w-4" />}
          Toon panden in beeld
        </Button>
      </div>

      {afgekapt && (
        <div className="mb-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Dit kaartgebied bevat meer dan {KAART_LIMIET.toLocaleString('nl-NL')} treffers. Zoom verder in voor een complete kaartselectie.
        </div>
      )}

      <div className="relative h-[430px] overflow-hidden rounded-lg border bg-muted/10 md:h-[520px]">
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={STYLE as never}
          initialViewState={AMSTERDAM_VIEWPORT}
          onMoveEnd={() => { if (heeftGezocht) setKaartVerouderd(true); }}
          onClick={onClickKaart}
          interactiveLayerIds={['bag-clusters', 'bag-panden']}
          cursor="pointer"
        >
          <NavigationControl position="bottom-right" showCompass={false} />
          <Source
            id="bag-panden"
            type="geojson"
            data={geojson}
            cluster
            clusterMaxZoom={15}
            clusterRadius={42}
          >
            <Layer {...CLUSTER_LAYER} />
            <Layer {...CLUSTER_TELLER_LAYER} />
            <Layer {...PAND_LAYER} />
          </Source>

          {geselecteerd && geselecteerdPunt && (
            <Popup
              longitude={geselecteerdPunt[0]}
              latitude={geselecteerdPunt[1]}
              closeOnClick={false}
              onClose={() => setGeselecteerd(null)}
              maxWidth="320px"
              offset={10}
            >
              <div className="min-w-[240px] p-1 text-sm text-foreground">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold leading-tight">{geselecteerd.adres}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{[geselecteerd.postcode, geselecteerd.plaats].filter(Boolean).join(' ')}</p>
                  </div>
                  {kandidaatGeselecteerd && <Badge variant="secondary" className="shrink-0 text-[10px]">Geselecteerd</Badge>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {geselecteerd.status && <p className="col-span-2">{geselecteerd.status}</p>}
                  {geselecteerd.bouwjaar !== null && <p>Bouwjaar {geselecteerd.bouwjaar}</p>}
                  {geselecteerd.gbo !== null && <p>{formatGetal(geselecteerd.gbo, ' m² GBO')}</p>}
                  {geselecteerd.vboAantal !== null && <p>{formatGetal(geselecteerd.vboAantal, ' VBO')}</p>}
                  {geselecteerd.wijk && <p className="col-span-2">Wijk: {geselecteerd.wijk}</p>}
                  {geselecteerd.buurt && <p className="col-span-2">Buurt: {geselecteerd.buurt}</p>}
                </div>
                <div className="mt-3 grid gap-2">
                  {geselecteerdRij && onKandidaatToggle && (
                    <Button size="sm" variant={kandidaatGeselecteerd ? 'secondary' : 'default'} className="w-full justify-center text-xs" onClick={() => onKandidaatToggle(kaartRijNaarVerkennerPand(geselecteerdRij))}>
                      <Check className="mr-1.5 h-3.5 w-3.5" />{kandidaatGeselecteerd ? 'Deselecteer kandidaat' : 'Selecteer kandidaat'}
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <a href={bouwGoogleMapsAdresUrl({ adres: geselecteerd.adres, postcode: geselecteerd.postcode || null, plaats: geselecteerd.plaats || null })} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Google Maps</a>
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => void kopieerBagId()}><Copy className="mr-1.5 h-3.5 w-3.5" />BAG-ID</Button>
                  </div>
                </div>
                <p className="mt-3 truncate font-mono-data text-[10px] text-muted-foreground" title={`BAG-pand ${geselecteerd.id}`}>BAG-pand {geselecteerd.id}</p>
              </div>
            </Popup>
          )}
        </Map>

        {!heeftGezocht && (
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
            <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
              Start met ‘Zoek in dit kaartgebied’ om panden op de kaart te laden.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
