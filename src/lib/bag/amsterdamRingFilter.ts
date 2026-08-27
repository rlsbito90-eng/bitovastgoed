/**
 * Interne pseudo-wijkcode voor de server-side Pandenverkenner-filter
 * "Amsterdam binnen de ring". Deze code bestaat niet als echte CBS-wijk in
 * de actieve Amsterdam BAG-index en wordt door bag_service geïnterpreteerd
 * als geometrische A10-filter (ten zuiden van het IJ).
 *
 * Waarom via wijkCodes: zo blijft het bestaande zoek-/kaartcontract, de
 * werkcontext en opgeslagen zoekprofielen achterwaarts compatibel zonder een
 * parallel filterkanaal te introduceren.
 */
export const BAG_AMSTERDAM_RING_WIJK_SENTINEL = 'WK0363RG';

export function heeftBinnenRingFilter(wijkCodes: string[]): boolean {
  return wijkCodes.includes(BAG_AMSTERDAM_RING_WIJK_SENTINEL);
}

export function echteWijkCodes(wijkCodes: string[]): string[] {
  return wijkCodes.filter(code => code !== BAG_AMSTERDAM_RING_WIJK_SENTINEL);
}

export function zetBinnenRingFilter(wijkCodes: string[], actief: boolean): string[] {
  const zonder = echteWijkCodes(wijkCodes);
  return actief ? [...zonder, BAG_AMSTERDAM_RING_WIJK_SENTINEL] : zonder;
}
