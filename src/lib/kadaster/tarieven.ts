import type { KadasterProductCode } from './types';

/**
 * Officiële gepubliceerde Objectinformatie-tarieven, gecontroleerd op 13-08-2026.
 * De live /products-catalogus heeft voorrang zodra die een prijs teruggeeft.
 */
export const KADASTER_OFFICIELE_TARIEVEN_EUR: Partial<Record<KadasterProductCode, number>> = {
  object: 1.92,
  waarde: 0.45,
  rechten: 2.96,
};

export function kadasterProductPrijs(
  code: KadasterProductCode,
  livePrijs: number | null | undefined,
): number | null {
  if (typeof livePrijs === 'number' && Number.isFinite(livePrijs)) return livePrijs;
  return KADASTER_OFFICIELE_TARIEVEN_EUR[code] ?? null;
}

export function formatKadasterPrijs(value: number | null | undefined): string {
  if (value == null) return 'prijs volgens Kadaster';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
