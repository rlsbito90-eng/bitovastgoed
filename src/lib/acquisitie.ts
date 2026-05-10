// Centrale types + labels voor de Acquisitie-module.

export type AcquisitieStatus =
  | 'target_gevonden'
  | 'eigenaar_achterhalen'
  | 'eerste_benadering'
  | 'follow_up_gepland'
  | 'reactie_ontvangen'
  | 'verkoopbereidheid_peilen'
  | 'potentiele_verkooppositie'
  | 'object_aangemaakt'
  | 'niet_interessant';

export type CampagneKanaal = 'brief' | 'bellen' | 'linkedin' | 'email' | 'netwerk' | 'anders';
export type CampagneStatus = 'concept' | 'actief' | 'gepauzeerd' | 'afgerond';
export type EigenaarBekend = 'ja' | 'nee' | 'onbekend';

export const ACQUISITIE_STATUS_LABEL: Record<AcquisitieStatus, string> = {
  target_gevonden: 'Target gevonden',
  eigenaar_achterhalen: 'Eigenaar achterhalen',
  eerste_benadering: 'Eerste benadering',
  follow_up_gepland: 'Follow-up gepland',
  reactie_ontvangen: 'Reactie ontvangen',
  verkoopbereidheid_peilen: 'Verkoopbereidheid peilen',
  potentiele_verkooppositie: 'Potentiële verkooppositie',
  object_aangemaakt: 'Object aangemaakt',
  niet_interessant: 'Niet interessant',
};

export const ACQUISITIE_STATUS_VOLGORDE: AcquisitieStatus[] = [
  'target_gevonden',
  'eigenaar_achterhalen',
  'eerste_benadering',
  'follow_up_gepland',
  'reactie_ontvangen',
  'verkoopbereidheid_peilen',
  'potentiele_verkooppositie',
  'object_aangemaakt',
  'niet_interessant',
];

export const CAMPAGNE_KANAAL_LABEL: Record<CampagneKanaal, string> = {
  brief: 'Brief',
  bellen: 'Bellen',
  linkedin: 'LinkedIn',
  email: 'E-mail',
  netwerk: 'Netwerk',
  anders: 'Anders',
};

export const CAMPAGNE_STATUS_LABEL: Record<CampagneStatus, string> = {
  concept: 'Concept',
  actief: 'Actief',
  gepauzeerd: 'Gepauzeerd',
  afgerond: 'Afgerond',
};

export interface AcquisitieTarget {
  id: string;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  wijk: string | null;
  typeVastgoed: string | null;
  redenInteressant: string | null;
  bron: string | null;
  campagneId: string | null;
  eigenaarBekend: EigenaarBekend;
  eigenaarWoontOpAdres: EigenaarBekend;
  relatieId: string | null;
  status: AcquisitieStatus;
  prioriteit: number;
  laatsteActieDatum: string | null;
  volgendeActieDatum: string | null;
  volgendeActieOmschrijving: string | null;
  notities: string | null;
  objectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcquisitieCampagne {
  id: string;
  naam: string;
  kanaal: CampagneKanaal;
  gebied: string | null;
  startdatum: string | null;
  status: CampagneStatus;
  notities: string | null;
  createdAt: string;
  updatedAt: string;
}

export function targetIsActief(t: AcquisitieTarget): boolean {
  return t.status !== 'object_aangemaakt' && t.status !== 'niet_interessant';
}

export function targetTitel(t: AcquisitieTarget): string {
  const adres = [t.adres, t.postcode, t.plaats].filter(Boolean).join(', ');
  return adres || '(adres ontbreekt)';
}
