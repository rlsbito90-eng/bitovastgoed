// Tweede filterlaag binnen het subfilter "Printen & posten".
//   - te_printen : concept met volledig postadres, nog niet geprint/gepost
//   - te_posten  : geprint of in envelop, nog niet gepost/verzonden
// Afgeleid uit de bestaande ActieCategorie; geen nieuwe statuslogica.
import type { ActieCategorie } from '@/lib/offMarket/acquisitie/werkbak';

export type PrintPostFilter = 'alles' | 'te_printen' | 'te_posten';
export type PrintPostGroep = 'te_printen' | 'te_posten';

export const PRINT_POST_LABEL: Record<PrintPostFilter, string> = {
  alles: 'Alles',
  te_printen: 'Te printen',
  te_posten: 'Te posten',
};

export const PRINT_POST_VOLGORDE: PrintPostFilter[] = ['te_printen', 'te_posten', 'alles'];

/** Groep binnen Printen & posten; null wanneer het signaal daar niet thuishoort. */
export function bepaalPrintPostGroep(categorie: ActieCategorie | null): PrintPostGroep | null {
  if (categorie === 'gereed_voor_print') return 'te_printen';
  if (categorie === 'geprint_nog_posten') return 'te_posten';
  return null;
}

/** Past het print/post-filter toe op één signaal. */
export function matchtPrintPostFilter(
  categorie: ActieCategorie | null,
  filter: PrintPostFilter,
): boolean {
  const groep = bepaalPrintPostGroep(categorie);
  if (groep === null) return false;
  if (filter === 'alles') return true;
  return groep === filter;
}

const GELDIG: PrintPostFilter[] = ['alles', 'te_printen', 'te_posten'];

export function isPrintPostFilter(v: unknown): v is PrintPostFilter {
  return typeof v === 'string' && (GELDIG as string[]).includes(v);
}
