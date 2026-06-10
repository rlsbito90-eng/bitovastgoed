// Normaliseert ruwe Kadaster Objectinformatie-respons naar een veilig DTO.
// Houdt opzettelijk losjes: Kadaster-respons-shape wordt in V1.1 nog
// niet volledig vastgepind. We bewaren bekende velden en geven de rest
// als raw door, zodat de frontend per veld kan beslissen.

import type { KadasterProductCode, KadasterProductResult } from './_types.ts';

interface RuweProductSlot {
  code?: string;
  status?: string;
  beschikbaar?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  // Onbekende velden mogen voorbij komen
  [k: string]: unknown;
}

/**
 * Pikt het producten-array uit de Kadaster-response. Kadaster levert
 * meestal { products: [...] } of { selection: [...] } — we ondersteunen
 * beide en vallen terug op een lege lijst.
 */
function pakProductenLijst(resp: unknown): RuweProductSlot[] {
  if (!resp || typeof resp !== 'object') return [];
  const r = resp as Record<string, unknown>;
  const kandidaten = [r.products, r.selection, r.result, r.results];
  for (const k of kandidaten) {
    if (Array.isArray(k)) return k as RuweProductSlot[];
  }
  return [];
}

export function normaliseerKadasterResponse(
  resp: unknown,
  gevraagdeCodes: KadasterProductCode[],
): KadasterProductResult[] {
  const ruweLijst = pakProductenLijst(resp);
  const perCode = new Map<string, RuweProductSlot>();
  for (const slot of ruweLijst) {
    if (typeof slot?.code === 'string') perCode.set(slot.code, slot);
  }

  return gevraagdeCodes.map<KadasterProductResult>((code) => {
    const slot = perCode.get(code);
    if (!slot) {
      return { code, beschikbaar: false, foutmelding: 'Niet geleverd' };
    }
    const beschikbaar = slot.beschikbaar !== false
      && slot.status !== 'unavailable'
      && slot.status !== 'failed';
    return {
      code,
      beschikbaar,
      data: (slot.data ?? slot) as Record<string, unknown>,
      foutmelding: beschikbaar
        ? undefined
        : (slot.error ?? slot.message ?? 'Niet beschikbaar') as string,
    };
  });
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
