// Statuspromotie-helper voor off-market signalen.
// Wanneer een brief écht wordt gepost/verstuurd promoveren we het signaal
// naar `benaderd` — maar alleen vanuit "vroege" fases. Latere statussen
// (in_gesprek, dealtraject, niet_interessant, archief, …) blijven intact.
import type { OffMarketStatus } from './types';

/**
 * Statussen die nog vóór "benaderd" liggen in de funnel en dus mogen
 * promoveren wanneer een brief is gepost. `benaderen` wordt expliciet
 * meegenomen omdat het de "voorbereiding"-fase is.
 */
export const STATUSSEN_DIE_NAAR_BENADERD_MOGEN: ReadonlySet<OffMarketStatus> = new Set<OffMarketStatus>([
  'nieuw_signaal',
  'interessant',
  'twijfel',
  'te_onderzoeken',
  'eigenaar_achterhalen',
  'eigenaar_gevonden',
  'benaderen',
]);

/** True wanneer het signaal automatisch naar `benaderd` mag worden gezet. */
export function moetPromoverenNaarBenaderd(
  huidig: OffMarketStatus | string | null | undefined,
): boolean {
  if (!huidig) return true;
  return STATUSSEN_DIE_NAAR_BENADERD_MOGEN.has(huidig as OffMarketStatus);
}
