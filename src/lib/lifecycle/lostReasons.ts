export const OBJECT_ARCHIVE_REASONS = [
  'Verkocht via Bito Vastgoed',
  'Verkocht extern / aan derde',
  'Ingetrokken door eigenaar',
  'Prijs / waarderingsverschil',
  'Investment case niet haalbaar',
  'Geen passende koper / kandidaat',
  'Publiek op markt / niet langer off-market',
  'Onvoldoende informatie',
  'Proces / timing',
  'Handmatig gearchiveerd',
  'Anders',
] as const;

export const DEAL_ARCHIVE_REASONS = [
  'Succesvol afgerond',
  'Koper / kandidaat afgehaakt',
  'Prijs / waarderingsverschil',
  'Investment case niet haalbaar',
  'Object verkocht aan andere partij',
  'Object ingetrokken door eigenaar',
  'Onvoldoende informatie',
  'Proces / timing',
  'Handmatig gearchiveerd',
  'Anders',
] as const;

export type LostReasonCode =
  | 'won'
  | 'price_gap'
  | 'sold_external'
  | 'seller_withdrew'
  | 'buyer_withdrew'
  | 'investment_case_failed'
  | 'no_suitable_buyer'
  | 'public_market'
  | 'insufficient_information'
  | 'process_timing'
  | 'manual_archive'
  | 'other';

/**
 * Frontend parity helper for the SQL classifier in
 * 20260831145500_standardize_lost_reasons.sql.
 *
 * This is intentionally conservative. Human-readable text remains preserved;
 * the code exists only for stable funnel/reporting aggregation.
 */
export function classifyLostReason(reason?: string | null): LostReasonCode | undefined {
  const r = reason?.trim().toLowerCase();
  if (!r) return undefined;

  if (r.includes('succesvol') || r.includes('afgerond') || r.includes('via bito')) return 'won';
  if (r.includes('prijs') || r.includes('waard') || r.includes('te duur')) return 'price_gap';
  if (r.includes('extern') || r.includes('andere partij') || r.includes('derde')) return 'sold_external';
  if (r.includes('ingetrokken') || r.includes('eigenaar')) return 'seller_withdrew';
  if (r.includes('koper afgehaakt') || r.includes('kandidaat afgehaakt')) return 'buyer_withdrew';
  if (r.includes('investment') || r.includes('haalbaar') || r.includes('bouwkost') || r.includes('financier')) {
    return 'investment_case_failed';
  }
  if (r.includes('geen passende') || r.includes('geen kandidaat') || r.includes('geen koper')) return 'no_suitable_buyer';
  if (r.includes('funda') || r.includes('publiek') || r.includes('open markt')) return 'public_market';
  if (r.includes('informatie') || r.includes('document')) return 'insufficient_information';
  if (r.includes('timing') || r.includes('proces') || r.includes('te laat')) return 'process_timing';
  if (r.includes('handmatig')) return 'manual_archive';
  return 'other';
}
