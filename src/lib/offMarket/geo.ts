// Helpers + client-wrapper voor Off-Market geo-verrijking (PDOK).
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export type OffMarketGeoStatus =
  | 'niet_verrijkt' | 'verrijkt' | 'geen_coordinaten' | 'geen_match' | 'fout';

export const GEO_STATUS_LABEL: Record<OffMarketGeoStatus, string> = {
  niet_verrijkt: 'Niet verrijkt',
  verrijkt: 'Verrijkt',
  geen_coordinaten: 'Geen coördinaten',
  geen_match: 'Geen match',
  fout: 'Fout',
};

export const GEO_BRON_LABEL: Record<string, string> = {
  pdok_locatieserver: 'PDOK Locatieserver',
};

export interface GeoVelden {
  geo_gemeente_naam?: string | null;
  geo_gemeente_code?: string | null;
  geo_wijk_naam?: string | null;
  geo_wijk_code?: string | null;
  geo_buurt_naam?: string | null;
  geo_buurt_code?: string | null;
  geo_status?: OffMarketGeoStatus | null;
  geo_bron?: string | null;
  geo_verrijkt_op?: string | null;
  geo_foutmelding?: string | null;
}

/** Compacte regel `Amsterdam · Centrum · Grachtengordel-West` of fallback. */
export function formatGebiedsindeling(s: GeoVelden): string {
  const status = (s.geo_status ?? 'niet_verrijkt') as OffMarketGeoStatus;
  if (status === 'geen_coordinaten') return 'Wijk/buurt: geen coördinaten';
  if (status !== 'verrijkt') return 'Wijk/buurt: nog niet verrijkt';
  const parts = [s.geo_gemeente_naam, s.geo_wijk_naam, s.geo_buurt_naam].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : 'Wijk/buurt: geen match';
}

/** Korte regel voor lijst/popup: `Amsterdam · Grachtengordel-West`. */
export function formatGemeenteBuurt(s: GeoVelden): string | null {
  if ((s.geo_status ?? 'niet_verrijkt') !== 'verrijkt') return null;
  const buurt = s.geo_buurt_naam ?? s.geo_wijk_naam ?? null;
  const parts = [s.geo_gemeente_naam, buurt].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : null;
}

export function formatGeoStatus(status?: OffMarketGeoStatus | null): string {
  return GEO_STATUS_LABEL[(status ?? 'niet_verrijkt') as OffMarketGeoStatus];
}

export function formatGeoBron(bron?: string | null): string {
  if (!bron) return '—';
  return GEO_BRON_LABEL[bron] ?? bron;
}

export async function verrijkSignaalGeo(
  signaalId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; status?: OffMarketGeoStatus; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('off-market-geo-verrijk', {
      body: { signaal_id: signaalId, force: !!opts.force },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, status: (data as any)?.status as OffMarketGeoStatus };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export interface BackfillTellers {
  totaal: number;
  verrijkt: number;
  skipped: number;
  geen_coordinaten: number;
  geen_match: number;
  fout: number;
}

export async function startGeoBackfill(
  opts: { limit?: number; force?: boolean } = {},
): Promise<{ ok: boolean; tellers?: BackfillTellers; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('off-market-geo-verrijk', {
      body: { batch: true, limit: opts.limit ?? 50, force: !!opts.force },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, tellers: data as BackfillTellers };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Subtiele datum-format voor weergave. */
export function formatGeoDatum(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}
