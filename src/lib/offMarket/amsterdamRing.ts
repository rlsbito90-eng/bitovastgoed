import type { OffMarketSignaal } from '@/lib/offMarket/types';

export type AmsterdamRingLigging = 'binnen_ring' | 'buiten_ring' | 'onbekend' | 'niet_amsterdam';

/**
 * Praktische acquisitie-afbakening voor "Amsterdam binnen de ring":
 * het gebied binnen de A10 ten zuiden van het IJ. Amsterdam-Noord telt dus
 * bewust niet als "binnen de ring" voor deze commerciële classificatie.
 *
 * De polygon volgt de A10 op hoofdlijnen. Deze classificatie is bedoeld voor
 * filtering/prioritering in Radar en is geen juridisch of kadastraal gebied.
 */
const BINNEN_RING_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [4.7960, 52.3845], // Coentunnel / IJ-west
  [4.8000, 52.3720],
  [4.7910, 52.3550],
  [4.7900, 52.3390],
  [4.8010, 52.3265],
  [4.8240, 52.3195],
  [4.8500, 52.3180],
  [4.8780, 52.3185],
  [4.9050, 52.3210],
  [4.9300, 52.3270],
  [4.9490, 52.3380],
  [4.9610, 52.3520],
  [4.9670, 52.3680],
  [4.9630, 52.3820],
  [4.9500, 52.3890], // Zeeburg / IJ-oost
  [4.9250, 52.3885],
  [4.9000, 52.3865],
  [4.8750, 52.3850],
  [4.8500, 52.3845],
  [4.8250, 52.3850],
  [4.7960, 52.3845],
];

function pointInPolygon(lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = BINNEN_RING_POLYGON.length - 1; i < BINNEN_RING_POLYGON.length; j = i++) {
    const [xi, yi] = BINNEN_RING_POLYGON[i];
    const [xj, yj] = BINNEN_RING_POLYGON[j];
    const intersects = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function isAmsterdam(signaal: OffMarketSignaal): boolean {
  const s = signaal as any;
  const gemeente = String(s.geo_gemeente_naam ?? '').trim().toLowerCase();
  const plaats = String(signaal.plaats ?? '').trim().toLowerCase();
  return gemeente === 'amsterdam' || plaats === 'amsterdam';
}

export function amsterdamRingLigging(signaal: OffMarketSignaal): AmsterdamRingLigging {
  if (!isAmsterdam(signaal)) return 'niet_amsterdam';

  const s = signaal as any;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'onbekend';

  return pointInPolygon(lng, lat) ? 'binnen_ring' : 'buiten_ring';
}

export function isBinnenAmsterdamRing(signaal: OffMarketSignaal): boolean {
  return amsterdamRingLigging(signaal) === 'binnen_ring';
}

export const AMSTERDAM_RING_LABEL: Record<AmsterdamRingLigging, string> = {
  binnen_ring: 'Binnen ring',
  buiten_ring: 'Buiten ring',
  onbekend: 'Onbekend',
  niet_amsterdam: 'Niet Amsterdam',
};
