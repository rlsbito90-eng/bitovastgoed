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
import { Loader2, MapPinned, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
}

function formatGetal(value: number | null, suffix = ''): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString('nl-NL')}${suffix}`;
}

export default function BagPandenKaart({ scopeCode, filters }: Props) {
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
            Beweeg of zoom de kaart en kies daarna ‘Zoek in dit kaartgebied’. Dezelfde filters als de lijst worden gebruikt.
          </p>
        </div>
        <Button onClick={() => void zoekInKaartgebied()} disabled={laden}>
          {laden ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : kaartVerouderd ? <RefreshCw className="mr-2 h-4 w-4" /> : <MapPinned className="mr-2 h-4 w-4" />}
          Zoek in dit kaartgebied
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
              <div className="min-w-[220px] p-1 text-xs text-foreground">
                <p className="text-sm font-semibold">{geselecteerd.adres}</p>
                <p className="mt-1 text-muted-foreground">{[geselecteerd.postcode, geselecteerd.plaats].filter(Boolean).join(' ')}</p>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {geselecteerd.status && <p>{geselecteerd.status}</p>}
                  {geselecteerd.bouwjaar !== null && <p>Bouwjaar {geselecteerd.bouwjaar}</p>}
                  {geselecteerd.gbo !== null && <p>{formatGetal(geselecteerd.gbo, ' m² GBO')}</p>}
                  {geselecteerd.vboAantal !== null && <p>{formatGetal(geselecteerd.vboAantal, ' VBO')}</p>}
                  {geselecteerd.wijk && <p>Wijk: {geselecteerd.wijk}</p>}
                  {geselecteerd.buurt && <p>Buurt: {geselecteerd.buurt}</p>}
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">BAG-pand {geselecteerd.id}</p>
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
