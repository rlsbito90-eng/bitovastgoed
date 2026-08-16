import type { AcquisitieBron } from './eventContract';

export const ACQUISITIE_KOSTENCATEGORIEEN = [
  'postage',
  'printing',
  'envelope',
  'mailhouse',
  'other',
] as const;

export type AcquisitieKostencategorie = typeof ACQUISITIE_KOSTENCATEGORIEEN[number];

export const COMMERCIELE_KWALIFICATIES = [
  'potential_seller',
  'buyer',
  'both',
  'recontact_later',
  'no_commercial_chance',
  'other',
] as const;

export type CommercieleKwalificatie = typeof COMMERCIELE_KWALIFICATIES[number];

export const COMMERCIELE_KWALIFICATIE_LABEL: Record<CommercieleKwalificatie, string> = {
  potential_seller: 'Potentiële verkoper',
  buyer: 'Koper',
  both: 'Verkoper én koper',
  recontact_later: 'Later opnieuw benaderen',
  no_commercial_chance: 'Geen commerciële kans',
  other: 'Overig',
};

export interface AcquisitieDossierReferentie {
  bron: AcquisitieBron;
  vastgoedkansId?: string | null;
  signaalId?: string | null;
}

export function heeftExactEenAcquisitieDossier(
  ref: Pick<AcquisitieDossierReferentie, 'vastgoedkansId' | 'signaalId'>,
): boolean {
  return Number(Boolean(ref.vastgoedkansId)) + Number(Boolean(ref.signaalId)) === 1;
}

export function dossierPastBijBron(ref: AcquisitieDossierReferentie): boolean {
  if (!heeftExactEenAcquisitieDossier(ref)) return false;
  if (ref.bron === 'vastgoedkansen') return Boolean(ref.vastgoedkansId) && !ref.signaalId;
  return Boolean(ref.signaalId) && !ref.vastgoedkansId;
}

export function isAcquisitieKostencategorie(value: string): value is AcquisitieKostencategorie {
  return (ACQUISITIE_KOSTENCATEGORIEEN as readonly string[]).includes(value);
}

export function isCommercieleKwalificatie(value: string): value is CommercieleKwalificatie {
  return (COMMERCIELE_KWALIFICATIES as readonly string[]).includes(value);
}
