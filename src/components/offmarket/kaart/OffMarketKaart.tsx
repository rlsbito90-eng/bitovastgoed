import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, {
  Layer, Source, NavigationControl, Popup, type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Point } from 'geojson';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MapPinOff, ListChecks, RefreshCw, ExternalLink } from 'lucide-react';
import type { OffMarketSignaal, OffMarketPrioriteit } from '@/lib/offMarket/types';
import { OffMarketPriorityBadge, OffMarketStatusBadge } from '@/components/offmarket/OffMarketBadges';
import { SIGNAALTYPE_LABEL, BRON_TYPE_LABEL } from '@/lib/offMarket/types';
import { formatSignaalAdres, formatSignaalTitel, cleanPlaats, cleanAdres } from '@/lib/offMarket/adresNormalisatie';
import { useKaartGeocoding } from '@/hooks/useKaartGeocoding';
import LocatieControlerenDialog from './LocatieControlerenDialog';
import ZonderLocatieDialog from './ZonderLocatieDialog';
import { AiScoreBadge, BagKaartBadge, BagPopupDetailRegel } from './KaartSignaalBadges';

// PDOK BRT-Achtergrondkaart (gratis, geen key, NL).
const PDOK_TILE = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';
const PDOK_ATTRIBUTION = '&copy; <a href="https://www.pdok.nl">PDOK</a> / <a href="https://www.kadaster.nl">Kadaster</a>';

const VIEWPORT_KEY = 'off-market-kaart:viewport';
const SELECTED_KEY = 'off-market-kaart:selectedSignalId';
const FALLBACK_VIEWPORT = { longitude: 5.1, latitude: 52.1, zoom: 6.6 };

const PRIO_COLOR: Record<OffMarketPrioriteit, string> = {
  urgent: '#dc2626',
  hoog: '#ea580c',
  midden: '#ca8a04',
  laag: '#475569',
};

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

export function heeftLocatie(s: OffMarketSignaal): boolean {
  const lat = (s as any).lat as number | null;
  const lng = (s as any).lng as number | null;
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && !(lat === 0 && lng === 0);
}

export function bouwGeoJson(signalen: OffMarketSignaal[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: signalen.filter(heeftLocatie).map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [(s as any).lng as number, (s as any).lat as number] },
      properties: {
        id: s.id,
        titel: s.titel,
        prioriteit: s.prioriteit,
        kleur: PRIO_COLOR[s.prioriteit as OffMarketPrioriteit] ?? '#475569',
      },
    })),
  };
}

interface Props {
  signalen: OffMarketSignaal[];
}

export default function OffMarketKaart({ signalen }: Props) {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoredSelectionRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(SELECTED_KEY); } catch { return null; }
  });
  const [sidepanelOpen, setSidepanelOpen] = useState(true);
  const [controleerOpen, setControleerOpen] = useState(false);
  const [zonderOpen, setZonderOpen] = useState(false);
  const [viewport, setViewport] = useState(() => {
    try {
      const stored = sessionStorage.getItem(VIEWPORT_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return FALLBACK_VIEWPORT;
  });

  const { onzeker, voortgang, opnieuwProberen, kiesKandidaat, handmatigZoeken } =
    useKaartGeocoding(signalen, true);

  const metLocatie = useMemo(() => signalen.filter(heeftLocatie), [signalen]);
  const zonderLocatie = useMemo(
    () => signalen.filter(s => !heeftLocatie(s) && !onzeker.some(o => o.signaal_id === s.id)),
    [signalen, onzeker],
  );
  const geojson = useMemo(() => bouwGeoJson(signalen), [signalen]);

  const geselecteerd = useMemo(
    () => (selectedId ? signalen.find(s => s.id === selectedId) ?? null : null),
    [selectedId, signalen],
  );

  // Bewaar selectie in sessionStorage zodat we na detail-terugkeer dezelfde selectie hebben.
  useEffect(() => {
    try {
      if (selectedId) sessionStorage.setItem(SELECTED_KEY, selectedId);
      else sessionStorage.removeItem(SELECTED_KEY);
    } catch {}
  }, [selectedId]);

  // viewport persisteren
  useEffect(() => {
    const t = setTimeout(() => {
      try { sessionStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [viewport]);

  // Pan/zoom naar opgeslagen selectie zodra signalen geladen zijn (eenmalig).
  useEffect(() => {
    if (restoredSelectionRef.current) return;
    if (signalen.length === 0) return;
    if (!selectedId) { restoredSelectionRef.current = true; return; }
    const s = signalen.find(x => x.id === selectedId);
    if (!s) { restoredSelectionRef.current = true; return; }
    restoredSelectionRef.current = true;
    if (heeftLocatie(s)) {
      requestAnimationFrame(() => {
        mapRef.current?.easeTo({
          center: [(s as any).lng as number, (s as any).lat as number],
          zoom: Math.max(viewport.zoom ?? 0, 14),
          duration: 600,
        });
      });
    }
    // scroll lijstrij in beeld
    requestAnimationFrame(() => {
      rowRefs.current[selectedId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [signalen, selectedId, viewport.zoom]);

  const panNaarSignaal = useCallback((s: OffMarketSignaal) => {
    if (!heeftLocatie(s)) return;
    mapRef.current?.easeTo({
      center: [(s as any).lng as number, (s as any).lat as number],
      zoom: Math.max(viewport.zoom ?? 0, 14),
      duration: 500,
    });
  }, [viewport.zoom]);

  // Smart pan: zorgt dat de popup volledig binnen de kaartcontainer valt na render.
  const panPopupIntoView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const container = map.getContainer();
    const popup = container.querySelector('.maplibregl-popup') as HTMLElement | null;
    if (!popup) return;

    const isMobiel = window.innerWidth < 768;
    const padTop = isMobiel ? 32 : 24;
    const padBottom = isMobiel ? 110 : 64; // ruimte voor legenda/zwevende UI
    const padLeft = isMobiel ? 16 : 24;
    const padRight = isMobiel ? 16 : 24;

    const cRect = container.getBoundingClientRect();
    const pRect = popup.getBoundingClientRect();

    let dx = 0;
    let dy = 0;
    const overTop = (cRect.top + padTop) - pRect.top;
    const overBottom = pRect.bottom - (cRect.bottom - padBottom);
    const overLeft = (cRect.left + padLeft) - pRect.left;
    const overRight = pRect.right - (cRect.right - padRight);

    if (overTop > 0) dy = -overTop;
    else if (overBottom > 0) dy = overBottom;

    if (overLeft > 0) dx = -overLeft;
    else if (overRight > 0) dx = overRight;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    map.panBy([dx, dy], { duration: 350, easing: (t: number) => t * (2 - t) });
  }, []);

  const selecteer = useCallback((s: OffMarketSignaal, opties: { pan?: boolean; scrollList?: boolean } = {}) => {
    setSelectedId(s.id);
    if (opties.pan !== false) {
      if (heeftLocatie(s)) panNaarSignaal(s);
      else toast.info('Geen kaartlocatie beschikbaar voor dit signaal.');
    }
    if (opties.scrollList) {
      requestAnimationFrame(() => {
        rowRefs.current[s.id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }, [panNaarSignaal]);

  // Trigger smart pan zodra de popup is gerenderd na selectiewijziging.
  useEffect(() => {
    if (!selectedId || !geselecteerd || !heeftLocatie(geselecteerd)) return;
    // Wacht tot eventuele easeTo/panNaarSignaal animatie klaar is, daarna meten en bijsturen.
    const t1 = window.setTimeout(() => {
      requestAnimationFrame(() => panPopupIntoView());
    }, 80);
    const t2 = window.setTimeout(panPopupIntoView, 560);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [selectedId, geselecteerd, panPopupIntoView]);


  const onClickKaart = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) { setSelectedId(null); return; }
    if (f.layer.id === 'clusters') {
      const clusterId = f.properties?.cluster_id as number;
      const src = mapRef.current?.getMap().getSource('signalen') as maplibregl.GeoJSONSource | undefined;
      if (clusterId != null && src) {
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          mapRef.current?.easeTo({
            center: ((f.geometry as Point).coordinates) as [number, number],
            zoom: zoom + 0.2,
            duration: 500,
          });
        }).catch(() => {});
      }
      return;
    }
    if (f.layer.id === 'pinnen') {
      const id = f.properties?.id as string;
      const sig = signalen.find(s => s.id === id);
      if (sig) selecteer(sig, { pan: false, scrollList: true });
    }
  };

  const openDetail = (s: OffMarketSignaal) => {
    // bewaar selectie expliciet vóór navigatie zodat terugkeer betrouwbaar werkt
    try { sessionStorage.setItem(SELECTED_KEY, s.id); } catch {}
    try { sessionStorage.setItem('off-market-filter:tab', 'kaart'); } catch {}
    navigate(`/off-market/${s.id}`);
  };

  return (
    <div className="relative w-full h-[calc(100vh-220px)] min-h-[480px] rounded-lg overflow-hidden border border-border bg-card">
      {/* Statuschip-rij linksboven */}
      <div className="absolute z-10 top-3 left-3 flex flex-wrap gap-2 max-w-[calc(100%-1.5rem)]">
        <div className="px-2.5 py-1 text-xs rounded-md bg-background text-foreground border border-border shadow-sm font-medium">
          {metLocatie.length} op kaart · {signalen.length} totaal
        </div>
        {onzeker.length > 0 && (
          <button
            type="button"
            onClick={() => setControleerOpen(true)}
            className="px-3 py-1.5 text-xs rounded-md bg-accent text-accent-foreground border border-accent shadow-sm hover:bg-accent/90 active:bg-accent/80 inline-flex items-center gap-1.5 font-semibold min-h-[32px] cursor-pointer"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Locatie controleren ({onzeker.length})
          </button>
        )}
        {zonderLocatie.length > 0 && (
          <button
            type="button"
            onClick={() => setZonderOpen(true)}
            className="px-3 py-1.5 text-xs rounded-md bg-background text-foreground border border-border shadow-sm hover:bg-muted inline-flex items-center gap-1.5 font-medium min-h-[32px] cursor-pointer"
          >
            <MapPinOff className="h-3.5 w-3.5" />
            Zonder locatie ({zonderLocatie.length})
          </button>
        )}
        {voortgang.bezig && (
          <div className="px-2.5 py-1 text-xs rounded-md bg-background text-foreground border border-border shadow-sm inline-flex items-center gap-1.5 font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            PDOK… {voortgang.klaar}/{voortgang.totaal}
          </div>
        )}
        {!voortgang.bezig && voortgang.totaal > 0 && (
          <button
            type="button"
            onClick={opnieuwProberen}
            className="px-2.5 py-1 text-xs rounded-md bg-background text-foreground border border-border shadow-sm hover:bg-muted inline-flex items-center gap-1.5 font-medium min-h-[32px] cursor-pointer"
            title="Locaties opnieuw controleren via PDOK"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Opnieuw
          </button>
        )}
      </div>

      {/* Legenda rechtsonder */}
      <div className="absolute z-10 bottom-3 right-3 px-3 py-2 rounded-md bg-background/95 border border-border shadow-sm text-[11px] space-y-1">
        <div className="font-medium text-foreground">Prioriteit</div>
        {(['urgent', 'hoog', 'midden', 'laag'] as OffMarketPrioriteit[]).map(p => (
          <div key={p} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIO_COLOR[p] }} />
            <span className="capitalize">{p}</span>
          </div>
        ))}
      </div>

      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={STYLE as never}
        initialViewState={viewport}
        onMoveEnd={(e) => setViewport({ longitude: e.viewState.longitude, latitude: e.viewState.latitude, zoom: e.viewState.zoom })}
        interactiveLayerIds={['clusters', 'pinnen']}
        onClick={onClickKaart}
        style={{ width: '100%', height: '100%' }}
        cursor="grab"
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source
          id="signalen"
          type="geojson"
          data={geojson}
          cluster
          clusterRadius={50}
          clusterMaxZoom={13}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': '#0f766e',
              'circle-opacity': 0.85,
              'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 12,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="pinnen"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['get', 'kleur'],
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], selectedId ?? ''], 11,
                7,
              ],
              'circle-stroke-color': [
                'case',
                ['==', ['get', 'id'], selectedId ?? ''], '#1f2937',
                '#ffffff',
              ],
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'id'], selectedId ?? ''], 3,
                2,
              ],
            }}
          />
        </Source>

        {geselecteerd && heeftLocatie(geselecteerd) && (
          <Popup
            longitude={(geselecteerd as any).lng as number}
            latitude={(geselecteerd as any).lat as number}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            offset={18}
            maxWidth="320px"
            className="off-market-popup"
          >
            <PinPreview signaal={geselecteerd} onOpen={() => openDetail(geselecteerd)} />
          </Popup>
        )}
      </Map>

      {/* Sidepanel desktop */}
      <div className={`hidden lg:block absolute top-0 right-0 h-full transition-all ${sidepanelOpen ? 'w-[340px]' : 'w-0'}`}>
        {sidepanelOpen && (
          <div className="h-full w-full bg-background/95 border-l border-border overflow-hidden flex flex-col">
            <div className="sticky top-0 px-3 py-2 border-b border-border bg-background/95 flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-medium">Signalen op kaart ({metLocatie.length})</div>
              <button
                type="button"
                onClick={() => setSidepanelOpen(false)}
                className="p-1 rounded hover:bg-muted cursor-pointer"
                aria-label="Sidepanel sluiten"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <ul ref={listRef} className="divide-y divide-border overflow-y-auto flex-1">
              {metLocatie.map(s => {
                const isSelected = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button
                      ref={(el) => { rowRefs.current[s.id] = el; }}
                      type="button"
                      onClick={() => selecteer(s, { pan: true })}
                      onDoubleClick={() => openDetail(s)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`group w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors border-l-2 ${
                        isSelected
                          ? 'bg-accent/15 border-accent'
                          : 'border-transparent hover:bg-muted/70 hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium truncate ${isSelected ? 'text-foreground' : ''}`}>{formatSignaalTitel(s)}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {formatSignaalAdres(s) || '—'}
                          </div>
                          {(s as any).geo_status === 'verrijkt' && ((s as any).geo_gemeente_naam || (s as any).geo_buurt_naam) && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {[(s as any).geo_gemeente_naam, (s as any).geo_buurt_naam ?? (s as any).geo_wijk_naam].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            <OffMarketPriorityBadge prioriteit={s.prioriteit} />
                            <OffMarketStatusBadge status={s.status} />
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <AiScoreBadge score={s.ai_score} status={s.ai_status} size="sm" />
                            <BagKaartBadge signaal={s} size="sm" />
                          </div>
                        </div>
                        {isSelected && (
                          <ExternalLink
                            className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5"
                            onClick={(ev) => { ev.stopPropagation(); openDetail(s); }}
                          />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
              {metLocatie.length === 0 && (
                <li className="px-3 py-6 text-sm text-muted-foreground text-center">
                  Geen signalen met locatie in de huidige selectie.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {!sidepanelOpen && (
        <button
          type="button"
          onClick={() => setSidepanelOpen(true)}
          className="hidden lg:flex absolute top-3 right-14 z-10 px-2 py-1 rounded-md bg-background/95 border border-border text-xs items-center gap-1 hover:bg-muted cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Sidepanel
        </button>
      )}

      <LocatieControlerenDialog
        open={controleerOpen}
        onOpenChange={setControleerOpen}
        items={onzeker}
        onKies={kiesKandidaat}
      />
      <ZonderLocatieDialog
        open={zonderOpen}
        onOpenChange={setZonderOpen}
        signalen={zonderLocatie}
        onZoek={async (s) => {
          await handmatigZoeken(s);
          setControleerOpen(true);
        }}
      />
    </div>
  );
}

function PinPreview({ signaal, onOpen }: { signaal: OffMarketSignaal; onOpen: () => void }) {
  const gebied = (() => {
    const s = signaal as any;
    if ((s.geo_status ?? 'niet_verrijkt') !== 'verrijkt') return 'Gebiedsindeling nog niet verrijkt';
    return [s.geo_gemeente_naam, s.geo_wijk_naam, s.geo_buurt_naam].filter(Boolean).join(' · ') || null;
  })();
  return (
    <div className="space-y-2 min-w-[240px] max-w-[300px]">
      <div
        className="text-sm font-semibold leading-snug text-foreground break-words"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {formatSignaalTitel(signaal)}
      </div>
      <div className="text-xs text-muted-foreground leading-snug break-words">
        {[cleanAdres(signaal.adres), [signaal.postcode, cleanPlaats(signaal.plaats)].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—'}
      </div>
      {gebied && (
        <div className="text-[11px] text-muted-foreground leading-snug">{gebied}</div>
      )}
      <div className="flex flex-wrap gap-1">
        <OffMarketPriorityBadge prioriteit={signaal.prioriteit} />
        <OffMarketStatusBadge status={signaal.status} />
      </div>
      <div className="flex flex-wrap gap-1">
        <AiScoreBadge score={signaal.ai_score} status={signaal.ai_status} />
        <BagKaartBadge signaal={signaal} />
      </div>
      <BagPopupDetailRegel signaal={signaal} />
      <div className="text-[11px] text-muted-foreground">
        {SIGNAALTYPE_LABEL[signaal.type_signaal] ?? signaal.type_signaal}
        {signaal.bron_type ? ` · ${BRON_TYPE_LABEL[signaal.bron_type] ?? signaal.bron_type}` : ''}
        {signaal.bron_datum ? ` · ${new Date(signaal.bron_datum).toLocaleDateString('nl-NL')}` : ''}
      </div>
      <Button
        size="sm"
        className="w-full mt-1 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
        onClick={onOpen}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open signaal
      </Button>
    </div>
  );
}
