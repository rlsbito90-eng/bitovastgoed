// Normaliseert ruwe Kadaster Objectinformatie-respons naar een veilig DTO.
// Kadaster levert per /report-call meestal een object terug met daarin:
//   - selection / products: per product een slot met status + (eventueel) data
//   - document / samenvatting / pdf: gedeelde rapport-onderdelen
//   - identifier, processingTime, ...
// We pakken zoveel mogelijk shapes op zodat de UI per productcard kan
// laten zien WAT er ontbreekt: alleen-data, alleen-status, of allebei.

import type {
  KadasterDeliverStatus, KadasterProductCode, KadasterProductResult,
} from './_types.ts';

interface RuweProductSlot {
  code?: string;
  productCode?: string;
  status?: string;
  deliver?: string;
  beschikbaar?: boolean;
  available?: boolean;
  data?: unknown;
  product?: unknown;
  result?: unknown;
  payload?: unknown;
  error?: string;
  message?: string;
  reason?: string;
  [k: string]: unknown;
}

const PRODUCT_DATA_KEY_HINTS: Record<KadasterProductCode, string[]> = {
  object:  ['object', 'wozObject', 'objectInformatie', 'verblijfsobject'],
  waarde:  ['waarde', 'koopsom', 'transactie', 'value', 'koopprijs'],
  rechten: ['rechten', 'eigendom', 'rights'],
  lasten:  ['lasten', 'gemeentelijkeLasten', 'taxes'],
  buurt:   ['buurt', 'buurtstatistieken', 'neighbourhood'],
};

function pakProductenLijst(resp: unknown): RuweProductSlot[] {
  if (!resp || typeof resp !== 'object') return [];
  const r = resp as Record<string, unknown>;
  const kandidaten = [r.products, r.selection, r.productResults, r.result, r.results];
  for (const k of kandidaten) {
    if (Array.isArray(k)) return k as RuweProductSlot[];
  }
  return [];
}

function mapStatus(raw: string | undefined, beschikbaar: boolean): KadasterDeliverStatus {
  const s = (raw ?? '').toLowerCase();
  if (!s) return beschikbaar ? 'geleverd' : 'niet_geleverd';
  if (s.includes('partial')) return 'gedeeltelijk';
  if (s.includes('unavailable') || s === 'notavailable' || s === 'not_available') return 'niet_beschikbaar';
  if (s.includes('fail') || s.includes('error')) return 'niet_beschikbaar';
  if (s.includes('without') || s.includes('missing') || s === 'notdelivered' || s === 'not_delivered') return 'niet_geleverd';
  if (s.includes('complete') || s === 'ok' || s === 'delivered' || s === 'success') return 'geleverd';
  return beschikbaar ? 'geleverd' : 'onbekend';
}

function payloadVoorSlot(slot: RuweProductSlot): unknown {
  // Volgorde van voorkeur: expliciete data → product → result → payload → het hele slot
  if (slot.data && typeof slot.data === 'object') return slot.data;
  if (slot.product && typeof slot.product === 'object') return slot.product;
  if (slot.result && typeof slot.result === 'object') return slot.result;
  if (slot.payload && typeof slot.payload === 'object') return slot.payload;
  return slot;
}

function zoekFallbackData(
  resp: unknown,
  code: KadasterProductCode,
): unknown | null {
  if (!resp || typeof resp !== 'object') return null;
  const r = resp as Record<string, unknown>;
  for (const key of PRODUCT_DATA_KEY_HINTS[code]) {
    const v = r[key];
    if (v && typeof v === 'object') return v;
  }
  // Soms zit per-product data onder `document` of `samenvatting`.
  for (const containerKey of ['document', 'samenvatting', 'summary']) {
    const c = r[containerKey];
    if (c && typeof c === 'object') {
      for (const key of PRODUCT_DATA_KEY_HINTS[code]) {
        const v = (c as Record<string, unknown>)[key];
        if (v && typeof v === 'object') return v;
      }
    }
  }
  return null;
}

export function normaliseerKadasterResponse(
  resp: unknown,
  gevraagdeCodes: KadasterProductCode[],
): KadasterProductResult[] {
  const ruweLijst = pakProductenLijst(resp);
  const perCode = new Map<string, RuweProductSlot>();
  for (const slot of ruweLijst) {
    const c = (typeof slot?.code === 'string' ? slot.code : slot?.productCode);
    if (typeof c === 'string') perCode.set(c.toLowerCase(), slot);
  }

  return gevraagdeCodes.map<KadasterProductResult>((code) => {
    const slot = perCode.get(code);
    const fallback = zoekFallbackData(resp, code);

    if (!slot) {
      // Geen slot in selection/products, maar misschien wel data elders.
      if (fallback) {
        return {
          code,
          beschikbaar: true,
          status: 'geleverd',
          deliver: null,
          data: fallback as Record<string, unknown>,
        };
      }
      return {
        code,
        beschikbaar: false,
        status: 'niet_geleverd',
        deliver: null,
        foutmelding:
          'Niet geleverd voor dit adres. Kadaster heeft voor dit product geen gegevens teruggegeven.',
      };
    }

    const beschikbaarRaw = slot.beschikbaar ?? slot.available;
    const statusRaw = typeof slot.status === 'string' ? slot.status : undefined;
    const deliver = typeof slot.deliver === 'string' ? slot.deliver : null;
    const beschikbaarHeuristiek = beschikbaarRaw !== false
      && statusRaw !== 'unavailable'
      && statusRaw !== 'failed'
      && statusRaw !== 'notAvailable';
    const status = mapStatus(statusRaw, beschikbaarHeuristiek);

    const data = payloadVoorSlot(slot);
    const heeftEchteData = data
      && typeof data === 'object'
      && Object.keys(data as Record<string, unknown>).some(
        (k) => !['code', 'productCode', 'status', 'deliver', 'beschikbaar', 'available', 'error', 'message', 'reason'].includes(k),
      );

    const effectiefBeschikbaar = (status === 'geleverd' || status === 'gedeeltelijk')
      && !!heeftEchteData;

    if (!effectiefBeschikbaar && fallback) {
      return {
        code,
        beschikbaar: true,
        status: 'geleverd',
        deliver,
        data: fallback as Record<string, unknown>,
      };
    }

    const melding = slot.error ?? slot.message ?? slot.reason;
    return {
      code,
      beschikbaar: effectiefBeschikbaar,
      status,
      deliver,
      data: heeftEchteData ? (data as Record<string, unknown>) : undefined,
      foutmelding: effectiefBeschikbaar
        ? undefined
        : (typeof melding === 'string' && melding.trim())
          ? melding
          : 'Niet geleverd voor dit adres. Kadaster heeft voor dit product geen gegevens teruggegeven.',
    };
  });
}

/** Veilige samenvatting van top-level response-shape (geen gevoelige inhoud). */
export function responseShape(resp: unknown): Record<string, unknown> {
  if (!resp || typeof resp !== 'object') {
    return { type: typeof resp };
  }
  const r = resp as Record<string, unknown>;
  const keys = Object.keys(r);
  const heeft = (k: string) => keys.includes(k) && r[k] != null && r[k] !== '';
  const sectie = (k: string) => {
    const v = r[k];
    if (Array.isArray(v)) return { aanwezig: true, type: 'array', lengte: v.length };
    if (v && typeof v === 'object') {
      return { aanwezig: true, type: 'object', keys: Object.keys(v as Record<string, unknown>).slice(0, 24) };
    }
    if (v == null) return { aanwezig: false };
    return { aanwezig: true, type: typeof v };
  };
  return {
    top_level_keys: keys.slice(0, 32),
    document: sectie('document'),
    samenvatting: sectie('samenvatting'),
    summary: sectie('summary'),
    pdf: heeft('pdf'),
    products: sectie('products'),
    selection: sectie('selection'),
    productResults: sectie('productResults'),
    identifier: heeft('identifier'),
    processingTime: heeft('processingTime'),
  };
}

/** Maakt een veilige one-liner voor logging — bevat nooit de API-key. */
export function logRegel(
  fields: Record<string, string | number | boolean | null | undefined>,
): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v.replace(/\s+/g, '_') : v}`)
    .join(' ');
}
