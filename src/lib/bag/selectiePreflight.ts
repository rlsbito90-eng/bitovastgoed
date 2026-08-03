import type { BagVerkennerPand } from './pandenverkennerModel';

export type BagSelectieBlokkadeReden =
  | 'bestaand_bag_id'
  | 'bestaand_adres'
  | 'onvolledig_adres'
  | 'selectielimiet';

export interface BagSelectieBlokkade {
  bagPandId: string;
  reden: BagSelectieBlokkadeReden;
}

export interface BagSelectiePreflight {
  toegestaan: boolean;
  geselecteerd: number;
  kandidaten: BagVerkennerPand[];
  blokkades: BagSelectieBlokkade[];
}

export interface BagSelectieContext {
  bestaandeBagIds: Set<string>;
  bestaandeAdresSleutels: Set<string>;
  maximaalAantal?: number;
}

export function bagAdresSleutel(adres: string, postcode: string | null): string {
  return `${adres}|${postcode ?? ''}`.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export function blokkadeVoorPand(
  pand: BagVerkennerPand,
  context: BagSelectieContext,
): BagSelectieBlokkadeReden | null {
  if (context.bestaandeBagIds.has(pand.bagPandId)) return 'bestaand_bag_id';
  if (!pand.adresCompleet) return 'onvolledig_adres';
  if (context.bestaandeAdresSleutels.has(bagAdresSleutel(pand.adres, pand.postcode))) {
    return 'bestaand_adres';
  }
  return null;
}

export function beoordeelBagSelectie(
  panden: BagVerkennerPand[],
  geselecteerdeIds: Set<string>,
  context: BagSelectieContext,
): BagSelectiePreflight {
  const geselecteerd = panden.filter(pand => geselecteerdeIds.has(pand.bagPandId));
  const maximaalAantal = context.maximaalAantal ?? 250;
  if (geselecteerd.length > maximaalAantal) {
    return {
      toegestaan: false,
      geselecteerd: geselecteerd.length,
      kandidaten: [],
      blokkades: geselecteerd.map(pand => ({ bagPandId: pand.bagPandId, reden: 'selectielimiet' })),
    };
  }

  const blokkades: BagSelectieBlokkade[] = [];
  const kandidaten = geselecteerd.filter((pand) => {
    const reden = blokkadeVoorPand(pand, context);
    if (reden) blokkades.push({ bagPandId: pand.bagPandId, reden });
    return reden === null;
  });
  return {
    toegestaan: geselecteerd.length > 0 && blokkades.length === 0,
    geselecteerd: geselecteerd.length,
    kandidaten,
    blokkades,
  };
}
