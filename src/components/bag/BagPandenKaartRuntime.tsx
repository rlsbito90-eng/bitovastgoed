import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Map, { Layer, NavigationControl, Popup, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Point } from 'geojson';
import { Check, Copy, ExternalLink, Loader2, MapPinned, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BagCrmMatchBadge from './BagCrmMatchBadge';
import { useActieveVastgoedkansSelectieIds } from '@/hooks/useAcquisitieSelectie';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalenAlle } from '@/hooks/useOffMarketSignalen';
import { bouwGoogleMapsAdresUrl } from '@/lib/bag/googleMaps';
import type { BagVerkennerPand } from '@/lib/bag/pandenverkennerModel';
import { haalPandenOpKaartV3 } from '@/lib/bag/queryTransport';
import { bouwBagKaartV3Contouren, bouwBagKaartV3Punten, type BagKaartFilters, type BagKaartV3FeatureProperties, type BagKaartV3Rij } from '@/lib/bag/kaartModel';
import { bewaarKaartSessie, leesKaartSessie } from '@/lib/bag/kaartSession';
import { bouwCrmObjectMatchIndex, vindCrmObjectMatch, type CrmObjectReferentie } from '@/lib/bag/crmObjectMatch';
import { BAG_KAART_WORKFLOW_LABEL, bepaalBagKaartWorkflowStatus, type BagKaartWorkflowStatus } from '@/lib/bag/pandenverkennerKaartStatus';

const PDOK_TILE = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';
const STYLE = { version: 8 as const, sources: { 'pdok-brt': { type: 'raster' as const, tiles: [PDOK_TILE], tileSize: 256, attribution: '&copy; PDOK / Kadaster', maxzoom: 19 } }, layers: [{ id: 'pdok-brt', type: 'raster' as const, source: 'pdok-brt' }], glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf' };
const KAART_LIMIET = 1500;
const AMSTERDAM_VIEWPORT = { longitude: 4.9041, latitude: 52.3676, zoom: 10.8 };
const CLUSTER_LAYER = { id: 'bag-server-clusters', type: 'circle' as const, source: 'bag-kaart-v3', filter: ['==', ['get', 'itemType'], 'cluster'], paint: { 'circle-color': '#0f526f', 'circle-radius': ['step', ['get', 'aantal'], 18, 100, 23, 500, 29, 2000, 34], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } };
const CLUSTER_TELLER = { id: 'bag-server-cluster-teller', type: 'symbol' as const, source: 'bag-kaart-v3', filter: ['==', ['get', 'itemType'], 'cluster'], layout: { 'text-field': ['get', 'aantal'], 'text-size': 11 }, paint: { 'text-color': '#fff' } };
const WORKFLOW_KLEUR_EXPR = ['match', ['get', 'workflowStatus'], 'geselecteerd', '#f59e0b', 'vastgoedkans', '#2563eb', 'acquisitie', '#7c3aed', 'gearchiveerd', '#94a3b8', 'crm_bekend', '#0f766e', '#0f526f'];
const PAND_LAYER = { id: 'bag-v3-panden', type: 'circle' as const, source: 'bag-kaart-v3', filter: ['==', ['get', 'itemType'], 'pand'], paint: { 'circle-color': WORKFLOW_KLEUR_EXPR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 5, 17, 8, 19, 10], 'circle-stroke-color': '#fff', 'circle-stroke-width': ['match', ['get', 'workflowStatus'], 'geselecteerd', 2.5, 'acquisitie', 2.5, 1], 'circle-opacity': ['match', ['get', 'workflowStatus'], 'gearchiveerd', 0.48, 0.92] } };
const CONTOUR_FILL = { id: 'bag-pandcontour-fill', type: 'fill' as const, source: 'bag-pandcontouren', minzoom: 16.5, paint: { 'fill-color': WORKFLOW_KLEUR_EXPR, 'fill-opacity': ['match', ['get', 'workflowStatus'], 'gearchiveerd', 0.07, 0.14] } };
const CONTOUR_LINE = { id: 'bag-pandcontour-line', type: 'line' as const, source: 'bag-pandcontouren', minzoom: 16.5, paint: { 'line-color': WORKFLOW_KLEUR_EXPR, 'line-width': ['match', ['get', 'workflowStatus'], 'geselecteerd', 3, 'acquisitie', 3, 2], 'line-opacity': ['match', ['get', 'workflowStatus'], 'gearchiveerd', 0.55, 1] } };

const LEGENDA_STATUSSEN: Array<{ status: BagKaartWorkflowStatus; kleur: string }> = [
  { status: 'nieuw', kleur: '#0f526f' },
  { status: 'geselecteerd', kleur: '#f59e0b' },
  { status: 'vastgoedkans', kleur: '#2563eb' },
  { status: 'acquisitie', kleur: '#7c3aed' },
  { status: 'gearchiveerd', kleur: '#94a3b8' },
  { status: 'crm_bekend', kleur: '#0f766e' },
];

interface Props {
  scopeCode: string;
  filters: BagKaartFilters;
  geselecteerdeIds?: Set<string>;
  onKandidaatToggle?: (pand: BagVerkennerPand) => void;
}

function kaartRijNaarVerkennerPand(row: BagKaartV3Rij): BagVerkennerPand {
  const adres = row.primair_adres?.trim() || row.identificatie || '';
  return {
    datasetversieId: String(row.datasetversie_id ?? ''),
    bagPandId: row.identificatie || '',
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

function formatGetal(value: number | null, suffix = '') {
  return value === null || !Number.isFinite(value) ? null : `${Math.round(value).toLocaleString('nl-NL')}${suffix}`;
}

export default function BagPandenKaart({ scopeCode, filters, geselecteerdeIds = new Set(), onKandidaatToggle }: Props) {
  const { kansen, archief } = useVastgoedkansen();
  const alleVastgoedkansen = useMemo(() => [...kansen, ...archief], [kansen, archief]);
  const actieveVastgoedkansSelectieIds = useActieveVastgoedkansSelectieIds();
  const { objecten } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalenAlle();

  const crmIndex = useMemo(() => {
    const referenties: CrmObjectReferentie[] = [
      ...alleVastgoedkansen.map(kans => ({ bron: 'vastgoedkans' as const, recordId: kans.id, route: `/vastgoedkansen/${kans.id}`, bagPandId: kans.bagPandId, adres: kans.adres, postcode: kans.postcode })),
      ...objecten.map(object => {
        const bron = object as typeof object & { bagPandId?: string; straatAdres?: string };
        return { bron: 'object' as const, recordId: object.id, route: `/objecten/${object.id}`, bagPandId: bron.bagPandId, adres: object.adres ?? bron.straatAdres ?? '', postcode: object.postcode };
      }),
      ...signalen.map(signaal => {
        const bron = signaal as typeof signaal & { bagPandId?: string; bag_pand_id?: string };
        return { bron: 'signaal' as const, recordId: signaal.id, route: `/off-market/${signaal.id}`, bagPandId: bron.bagPandId ?? bron.bag_pand_id, adres: signaal.adres ?? '', postcode: signaal.postcode };
      }),
    ];
    return bouwCrmObjectMatchIndex(referenties.filter(referentie => referentie.adres || referentie.bagPandId));
  }, [alleVastgoedkansen, objecten, signalen]);

  const mapRef = useRef<MapRef | null>(null);
  const focusBewegingRef = useRef(false);
  const focusVerversNaMoveRef = useRef(false);
  const clusterDrilldownRef = useRef(false);
  const verversTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const initiëleSessie = useRef(leesKaartSessie(scopeCode, filterKey)).current;
  const [rows, setRows] = useState<BagKaartV3Rij[]>(initiëleSessie?.rows ?? []);
  const [laden, setLaden] = useState(false);
  const [heeftGezocht, setHeeftGezocht] = useState(initiëleSessie?.heeftGezocht ?? false);
  const [kaartVerouderd, setKaartVerouderd] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<BagKaartV3FeatureProperties | null>(null);

  useEffect(() => {
    const sessie = leesKaartSessie(scopeCode, filterKey);
    setRows(sessie?.rows ?? []);
    setHeeftGezocht(sessie?.heeftGezocht ?? false);
    setKaartVerouderd(false);
    setGeselecteerd(null);
    if (sessie?.viewState) mapRef.current?.jumpTo(sessie.viewState);
  }, [scopeCode, filterKey]);

  useEffect(() => () => {
    if (verversTimerRef.current) clearTimeout(verversTimerRef.current);
  }, []);

  const basisPunten = useMemo(() => bouwBagKaartV3Punten(rows), [rows]);
  const basisContouren = useMemo(() => bouwBagKaartV3Contouren(rows), [rows]);
  const rijPerPandId = useMemo(() => new Map(rows.filter(row => row.item_type === 'pand' && row.identificatie).map(row => [row.identificatie!, row])), [rows]);

  const workflowStatusVoorPand = useCallback((pand: BagVerkennerPand): BagKaartWorkflowStatus => {
    const match = vindCrmObjectMatch(pand, crmIndex);
    if (match?.bron === 'vastgoedkans') {
      const kans = alleVastgoedkansen.find(item => item.id === match.recordId);
      return bepaalBagKaartWorkflowStatus({
        crmBron: 'vastgoedkans',
        vastgoedkansGearchiveerd: Boolean(kans?.archivedAt),
        vastgoedkansInAcquisitie: actieveVastgoedkansSelectieIds.has(match.recordId),
        lokaalGeselecteerd: geselecteerdeIds.has(pand.bagPandId),
      });
    }
    return bepaalBagKaartWorkflowStatus({
      crmBron: match?.bron ?? null,
      lokaalGeselecteerd: geselecteerdeIds.has(pand.bagPandId),
    });
  }, [actieveVastgoedkansSelectieIds, alleVastgoedkansen, crmIndex, geselecteerdeIds]);

  const workflowStatusPerPandId = useMemo(() => {
    const statuses = new Map<string, BagKaartWorkflowStatus>();
    rijPerPandId.forEach((row, id) => statuses.set(id, workflowStatusVoorPand(kaartRijNaarVerkennerPand(row))));
    return statuses;
  }, [rijPerPandId, workflowStatusVoorPand]);

  const punten = useMemo(() => ({
    ...basisPunten,
    features: basisPunten.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        workflowStatus: feature.properties.itemType === 'pand' ? (workflowStatusPerPandId.get(feature.properties.id) ?? 'nieuw') : 'nieuw',
      },
    })),
  }), [basisPunten, workflowStatusPerPandId]);

  const contouren = useMemo(() => ({
    ...basisContouren,
    features: basisContouren.features.map(feature => ({
      ...feature,
      properties: { ...feature.properties, workflowStatus: workflowStatusPerPandId.get(feature.properties.id) ?? 'nieuw' },
    })),
  }), [basisContouren, workflowStatusPerPandId]);

  const totaalMatches = useMemo(() => rows.reduce((som, row) => som + (Number(row.aantal) || 0), 0), [rows]);
  const serverClusterMode = rows.some(row => row.item_type === 'cluster');
  const afgekapt = !serverClusterMode && rows.some(row => row.afgekapt);

  const zoekInKaartgebied = useCallback(async () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    setLaden(true);
    try {
      const resultaat = await haalPandenOpKaartV3<BagKaartV3Rij>({ scopeCode, viewport: { minLon: b.getWest(), minLat: b.getSouth(), maxLon: b.getEast(), maxLat: b.getNorth() }, zoom: map.getZoom(), limiet: KAART_LIMIET, ...filters });
      setRows(resultaat.rows);
      setHeeftGezocht(true);
      const c = map.getCenter();
      bewaarKaartSessie({ scopeCode, filterKey, rows: resultaat.rows, heeftGezocht: true, viewState: { longitude: c.lng, latitude: c.lat, zoom: map.getZoom() } });
      setKaartVerouderd(false);
      setGeselecteerd(null);
      if (!resultaat.rows.length) toast.info('Geen BAG-panden in dit kaartgebied voor de gekozen filters.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'BAG-kaart laden mislukt.');
    } finally {
      setLaden(false);
    }
  }, [filterKey, filters, scopeCode]);

  const onClickKaart = useCallback((event: MapLayerMouseEvent) => {
    const f = event.features?.[0];
    if (!f) { setGeselecteerd(null); return; }
    if (f.layer.id === 'bag-server-clusters' && f.geometry.type === 'Point') {
      clusterDrilldownRef.current = true;
      mapRef.current?.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: Math.min((mapRef.current?.getZoom() ?? 10) + 1.8, 15.2), duration: 420 });
      return;
    }
    if (f.layer.id === 'bag-v3-panden') {
      const p = f.properties as unknown as BagKaartV3FeatureProperties;
      setGeselecteerd({ ...p, id: String(p.id), adres: String(p.adres ?? ''), postcode: String(p.postcode ?? ''), plaats: String(p.plaats ?? ''), status: String(p.status ?? ''), bouwjaar: p.bouwjaar == null ? null : Number(p.bouwjaar), gbo: p.gbo == null ? null : Number(p.gbo), vboAantal: p.vboAantal == null ? null : Number(p.vboAantal), wijk: String(p.wijk ?? ''), buurt: String(p.buurt ?? ''), itemType: 'pand', aantal: 1, clusterId: '' });
      if (f.geometry.type === 'Point') {
        const map = mapRef.current?.getMap();
        if (map) {
          focusBewegingRef.current = true;
          focusVerversNaMoveRef.current = map.getZoom() < 16.5;
          map.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: Math.max(map.getZoom(), 16.6), offset: [0, 110], duration: 420 });
        }
      }
    }
  }, []);

  const geselecteerdPunt = useMemo(() => {
    if (!geselecteerd) return null;
    const f = punten.features.find(x => x.properties.id === geselecteerd.id);
    return f?.geometry.coordinates as [number, number] | undefined;
  }, [punten.features, geselecteerd]);
  const geselecteerdRij = useMemo(() => rows.find(row => row.identificatie === geselecteerd?.id) ?? null, [rows, geselecteerd]);
  const geselecteerdPand = useMemo(() => geselecteerdRij ? kaartRijNaarVerkennerPand(geselecteerdRij) : null, [geselecteerdRij]);
  const crmMatch = useMemo(() => geselecteerdPand ? vindCrmObjectMatch(geselecteerdPand, crmIndex) : null, [crmIndex, geselecteerdPand]);
  const kandidaatGeselecteerd = geselecteerd ? geselecteerdeIds.has(geselecteerd.id) : false;

  const kopieerBagId = async () => {
    if (!geselecteerd) return;
    try { await navigator.clipboard.writeText(geselecteerd.id); toast.success('BAG-ID gekopieerd.'); }
    catch { toast.error('BAG-ID kopiëren mislukt.'); }
  };

  return <div className="border-b p-4">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><MapPinned className="h-4 w-4"/><h3 className="text-sm font-medium">Kaart</h3>{heeftGezocht&&<Badge variant="outline">{totaalMatches.toLocaleString('nl-NL')} panden</Badge>}{serverClusterMode&&<Badge variant="secondary">Clusters</Badge>}{afgekapt&&<Badge variant="secondary">Max. {KAART_LIMIET.toLocaleString('nl-NL')}</Badge>}</div>
        <p className="mt-1 text-xs text-muted-foreground">Uitgezoomd zie je clusters over alle matches. Tik een cluster aan om automatisch verder in te zoomen. De kaart ververst vanzelf na slepen of zoomen; vanaf zoomniveau 16,5 verschijnen BAG-pandcontouren.</p>
      </div>
      <Button onClick={() => void zoekInKaartgebied()} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:kaartVerouderd?<RefreshCw className="mr-2 h-4 w-4"/>:<MapPinned className="mr-2 h-4 w-4"/>}Ververs kaart</Button>
    </div>
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground" aria-label="Kaartlegenda workflowstatus">
      {LEGENDA_STATUSSEN.map(item => <span key={item.status} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: item.kleur }} />{BAG_KAART_WORKFLOW_LABEL[item.status]}</span>)}
    </div>
    {afgekapt&&<div className="mb-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Dit detailgebied bevat meer dan {KAART_LIMIET.toLocaleString('nl-NL')} individuele panden. Zoom verder in voor een complete selectie.</div>}
    <div className="relative h-[430px] overflow-hidden rounded-lg border bg-muted/10 md:h-[520px]">
      <Map ref={mapRef} mapLib={maplibregl} mapStyle={STYLE as never} initialViewState={initiëleSessie?.viewState??AMSTERDAM_VIEWPORT} onLoad={()=>{if(!heeftGezocht)void zoekInKaartgebied();}} onMoveEnd={()=>{const map=mapRef.current?.getMap();if(map){const c=map.getCenter();bewaarKaartSessie({scopeCode,filterKey,rows,heeftGezocht,viewState:{longitude:c.lng,latitude:c.lat,zoom:map.getZoom()}});}if(clusterDrilldownRef.current){clusterDrilldownRef.current=false;void zoekInKaartgebied();return;}if(focusBewegingRef.current){focusBewegingRef.current=false;if(focusVerversNaMoveRef.current){focusVerversNaMoveRef.current=false;void zoekInKaartgebied();}return;}if(heeftGezocht){setKaartVerouderd(true);if(verversTimerRef.current)clearTimeout(verversTimerRef.current);verversTimerRef.current=setTimeout(()=>void zoekInKaartgebied(),700);}}} onClick={onClickKaart} interactiveLayerIds={['bag-server-clusters','bag-v3-panden']} cursor="pointer">
        <NavigationControl position="bottom-right" showCompass={false}/>
        <Source id="bag-kaart-v3" type="geojson" data={punten}><Layer {...CLUSTER_LAYER}/><Layer {...CLUSTER_TELLER}/><Layer {...PAND_LAYER}/></Source>
        <Source id="bag-pandcontouren" type="geojson" data={contouren}><Layer {...CONTOUR_FILL}/><Layer {...CONTOUR_LINE}/></Source>
        {geselecteerd&&geselecteerdPunt&&<Popup longitude={geselecteerdPunt[0]} latitude={geselecteerdPunt[1]} closeOnClick={false} onClose={()=>setGeselecteerd(null)} maxWidth="320px" anchor="bottom" offset={12}><div className="min-w-[240px] p-1 text-sm text-foreground"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold leading-tight">{geselecteerd.adres}</p><p className="mt-1 text-xs text-muted-foreground">{[geselecteerd.postcode,geselecteerd.plaats].filter(Boolean).join(' ')}</p></div>{kandidaatGeselecteerd&&<Badge variant="secondary" className="shrink-0 text-[10px]">Geselecteerd</Badge>}</div>{geselecteerdPand&&crmMatch&&<div className="mt-2"><BagCrmMatchBadge pand={geselecteerdPand} fallbackLabel="Al bekend" /></div>}<div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">{geselecteerd.status&&<p className="col-span-2">{geselecteerd.status}</p>}{geselecteerd.bouwjaar!==null&&<p>Bouwjaar {geselecteerd.bouwjaar}</p>}{geselecteerd.gbo!==null&&<p>{formatGetal(geselecteerd.gbo,' m² GBO')}</p>}{geselecteerd.vboAantal!==null&&<p>{formatGetal(geselecteerd.vboAantal,' VBO')}</p>}{geselecteerd.wijk&&<p className="col-span-2">Wijk: {geselecteerd.wijk}</p>}{geselecteerd.buurt&&<p className="col-span-2">Buurt: {geselecteerd.buurt}</p>}</div><div className="mt-3 grid gap-2">{geselecteerdRij&&onKandidaatToggle&&!crmMatch&&<Button size="sm" variant={kandidaatGeselecteerd?'secondary':'default'} className="w-full justify-center text-xs" onClick={()=>onKandidaatToggle(kaartRijNaarVerkennerPand(geselecteerdRij))}><Check className="mr-1.5 h-3.5 w-3.5"/>{kandidaatGeselecteerd?'Deselecteer kandidaat':'Selecteer kandidaat'}</Button>}{crmMatch&&<Button asChild size="sm" variant="secondary" className="w-full justify-center text-xs"><Link to={crmMatch.route}>Open bestaand CRM-dossier</Link></Button>}<div className="grid grid-cols-2 gap-2"><Button asChild size="sm" variant="outline" className="text-xs"><a href={bouwGoogleMapsAdresUrl({adres:geselecteerd.adres,postcode:geselecteerd.postcode||null,plaats:geselecteerd.plaats||null})} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>Google Maps</a></Button><Button size="sm" variant="outline" className="text-xs" onClick={()=>void kopieerBagId()}><Copy className="mr-1.5 h-3.5 w-3.5"/>BAG-ID</Button></div></div><p className="mt-3 truncate font-mono-data text-[10px] text-muted-foreground">BAG-pand {geselecteerd.id}</p></div></Popup>}
      </Map>
      {!heeftGezocht&&<div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center"><div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">Panden worden automatisch voor dit kaartgebied geladen.</div></div>}
    </div>
  </div>;
}
