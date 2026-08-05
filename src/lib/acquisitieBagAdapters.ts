import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import {
  bouwAcquisitieBagContext,
  type AcquisitieBagBronInput,
  type AcquisitieBagContext,
} from '@/lib/acquisitieBagContext';

/**
 * Off-Market bewaart de volledige BAG-context reeds op het signaalrecord.
 * Deze adapter houdt de gedeelde BAG-weergave vrij van signaalspecifieke kennis.
 */
export function offMarketSignaalNaarBagContext(
  signaal: OffMarketSignaal,
): AcquisitieBagContext {
  return bouwAcquisitieBagContext(signaal as unknown as AcquisitieBagBronInput);
}

/**
 * Vastgoedkansen heeft in de huidige fase alleen de centrale BAG-identificaties.
 * De adapter maakt daar een veilige, read-only context van zonder volledige
 * verrijking of matchkwaliteit te suggereren.
 */
export function vastgoedkansNaarBagContext(
  kans: Pick<Vastgoedkans, 'adres' | 'postcode' | 'plaats' | 'bagPandId' | 'bagVerblijfsobjectId'>,
): AcquisitieBagContext {
  const doelAdres = [kans.adres, kans.postcode, kans.plaats]
    .map((waarde) => waarde?.trim())
    .filter((waarde): waarde is string => Boolean(waarde))
    .join(', ');
  const heeftKoppeling = Boolean(kans.bagPandId?.trim() || kans.bagVerblijfsobjectId?.trim());

  return bouwAcquisitieBagContext({
    bag_status: heeftKoppeling ? 'verrijkt' : 'niet_verrijkt',
    bag_match_kwaliteit: heeftKoppeling ? 'bestaande_koppeling' : null,
    bag_geselecteerd_adres: doelAdres || null,
    bag_geselecteerd_vbo_id: kans.bagVerblijfsobjectId,
    bag_geselecteerd_pand_id: kans.bagPandId,
  });
}
