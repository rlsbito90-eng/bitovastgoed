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

export const GEO_FUNCTION_NAME = 'off-market-geo-verrijk';

/** Probeer een leesbare foutmelding te halen uit een Functions-invoke fout. */
async function leesInvokeError(error: any): Promise<string> {
  const resp: Response | undefined = error?.context?.response ?? error?.context;
  if (resp && typeof (resp as any).text === 'function') {
    try {
      const txt = await (resp as Response).text();
      try {
        const j = JSON.parse(txt);
        if (j?.message) return String(j.message);
        if (j?.error) return String(j.error);
      } catch { /* not json */ }
      const status = (resp as Response).status;
      if (txt) return `Edge Function status ${status}: ${txt.slice(0, 200)}`;
      return `Edge Function gaf status ${status}`;
    } catch { /* ignore */ }
  }
  const msg = String(error?.message ?? error ?? '');
  if (msg.toLowerCase().includes('failed to send')) {
    return `Edge Function ${GEO_FUNCTION_NAME} niet bereikbaar. Probeer opnieuw of controleer de deploy.`;
  }
  return msg || 'Onbekende fout bij aanroep van Edge Function.';
}

export async function verrijkSignaalGeo(
  signaalId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; status?: OffMarketGeoStatus; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(GEO_FUNCTION_NAME, {
      body: { signaal_id: signaalId, force: !!opts.force },
    });
    if (error) return { ok: false, error: await leesInvokeError(error) };
    if (data && (data as any).ok === false) {
      return { ok: false, error: (data as any).message ?? (data as any).error ?? 'Geo-verrijking mislukt.' };
    }
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
  opts: { limit?: number; force?: boolean; retryFailed?: boolean } = {},
): Promise<{ ok: boolean; tellers?: BackfillTellers; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(GEO_FUNCTION_NAME, {
      body: {
        batch: true,
        limit: opts.limit ?? 50,
        force: !!opts.force,
        retry_failed: !!opts.retryFailed,
      },
    });
    if (error) return { ok: false, error: await leesInvokeError(error) };
    if (data && (data as any).ok === false) {
      return { ok: false, error: (data as any).message ?? (data as any).error ?? 'Geo-backfill mislukt.' };
    }
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

/** Parse PDOK Locatieserver reverse-response naar onze geo-velden.
 *  Tolerant voor verschillende veldnamen en wrappers. */
export function buildGeoPatchFromPdok(pdok: any): {
  geo_gemeente_naam: string | null;
  geo_gemeente_code: string | null;
  geo_wijk_naam: string | null;
  geo_wijk_code: string | null;
  geo_buurt_naam: string | null;
  geo_buurt_code: string | null;
  hasAny: boolean;
} {
  const docs: any[] =
    pdok?.response?.docs ??
    pdok?.response?.response?.docs ??
    pdok?.docs ??
    [];
  const byType = (t: string) => docs.find((d) => String(d?.type ?? '').toLowerCase() === t);

  const cleanWeergave = (w: any, kind: 'gemeente' | 'wijk' | 'buurt'): string | null => {
    if (typeof w !== 'string') return null;
    let s = w.trim();
    if (kind === 'gemeente') s = s.replace(/^Gemeente\s+/i, '');
    return s || null;
  };
  const pickName = (d: any, namen: string[], kind: 'gemeente' | 'wijk' | 'buurt'): string | null => {
    for (const n of namen) {
      const v = d?.[n];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return cleanWeergave(d?.weergavenaam, kind);
  };
  const pickCode = (d: any, codes: string[]): string | null => {
    for (const c of codes) {
      const v = d?.[c];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  const g = byType('gemeente');
  const w = byType('wijk');
  const b = byType('buurt');

  let gemeenteNaam = pickName(g, ['gemeentenaam', 'gemeente_naam'], 'gemeente');
  let gemeenteCode = pickCode(g, ['gemeentecode', 'gemeente_code']);
  if (!gemeenteNaam) gemeenteNaam = pickName(w, ['gemeentenaam'], 'gemeente') ?? pickName(b, ['gemeentenaam'], 'gemeente');
  if (!gemeenteCode) gemeenteCode = pickCode(w, ['gemeentecode']) ?? pickCode(b, ['gemeentecode']);

  let wijkNaam = pickName(w, ['wijknaam', 'wijk_naam'], 'wijk');
  let wijkCode = pickCode(w, ['wijkcode', 'wijk_code']);
  if (!wijkNaam) wijkNaam = pickName(b, ['wijknaam'], 'wijk');
  if (!wijkCode) wijkCode = pickCode(b, ['wijkcode']);

  const buurtNaam = pickName(b, ['buurtnaam', 'buurt_naam'], 'buurt');
  const buurtCode = pickCode(b, ['buurtcode', 'buurt_code']);

  return {
    geo_gemeente_naam: gemeenteNaam,
    geo_gemeente_code: gemeenteCode,
    geo_wijk_naam: wijkNaam,
    geo_wijk_code: wijkCode,
    geo_buurt_naam: buurtNaam,
    geo_buurt_code: buurtCode,
    hasAny: Boolean(gemeenteNaam || wijkNaam || buurtNaam),
  };
}
