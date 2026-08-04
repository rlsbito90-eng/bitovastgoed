import type { BagVerkennerPand } from './pandenverkennerModel';

export interface StraatSelectieStatus {
  beschikbaar: number;
  geselecteerd: number;
  allesGeselecteerd: boolean;
  gedeeltelijkGeselecteerd: boolean;
}

export function bepaalStraatSelectieStatus(
  panden: BagVerkennerPand[],
  geselecteerdeIds: Set<string>,
  isGeblokkeerd: (pand: BagVerkennerPand) => boolean,
): StraatSelectieStatus {
  const beschikbaar = panden.filter(pand => !isGeblokkeerd(pand));
  const geselecteerd = beschikbaar.filter(pand => geselecteerdeIds.has(pand.bagPandId)).length;

  return {
    beschikbaar: beschikbaar.length,
    geselecteerd,
    allesGeselecteerd: beschikbaar.length > 0 && geselecteerd === beschikbaar.length,
    gedeeltelijkGeselecteerd: geselecteerd > 0 && geselecteerd < beschikbaar.length,
  };
}

export function toggleStraatSelectie(
  panden: BagVerkennerPand[],
  geselecteerdeIds: Set<string>,
  isGeblokkeerd: (pand: BagVerkennerPand) => boolean,
  maximaalAantal = 250,
): Set<string> | null {
  const beschikbaar = panden.filter(pand => !isGeblokkeerd(pand));
  const allesGeselecteerd = beschikbaar.length > 0
    && beschikbaar.every(pand => geselecteerdeIds.has(pand.bagPandId));
  const next = new Set(geselecteerdeIds);

  if (allesGeselecteerd) {
    beschikbaar.forEach(pand => next.delete(pand.bagPandId));
    return next;
  }

  beschikbaar.forEach(pand => next.add(pand.bagPandId));
  return next.size > maximaalAantal ? null : next;
}
