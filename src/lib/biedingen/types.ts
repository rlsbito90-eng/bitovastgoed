// Centraal type-model voor de biedingenmodule.

export type BiedingStatus =
  | 'concept'
  | 'ontvangen'
  | 'in_behandeling'
  | 'tegenvoorstel_gedaan'
  | 'aangepast_bod_gevraagd'
  | 'geaccepteerd'
  | 'afgewezen'
  | 'ingetrokken'
  | 'verlopen';

export type BiedingType =
  | 'indicatief'
  | 'openingsbod'
  | 'voorwaardelijk'
  | 'onvoorwaardelijk'
  | 'eindbod'
  | 'tegenvoorstel'
  | 'verhoogd_bod'
  | 'schriftelijk'
  | 'mondeling';

export type VoorbehoudStatus = 'geen' | 'ja' | 'onbekend' | 'nader_te_bepalen';

export type BiedingRichting = 'van_koper' | 'van_verkoper' | 'namens_verkoper' | 'intern';

export const BIEDING_RICHTING_LABELS: Record<BiedingRichting, string> = {
  van_koper: 'Van koper',
  van_verkoper: 'Van verkoper',
  namens_verkoper: 'Namens verkoper',
  intern: 'Intern',
};

export const BIEDING_RICHTING_LABELS_LONG: Record<BiedingRichting, string> = {
  van_koper: 'Bod van koper',
  van_verkoper: 'Tegenvoorstel van verkoper',
  namens_verkoper: 'Voorstel namens verkoper',
  intern: 'Intern voorstel',
};

export type KostenType = 'kk' | 'von' | 'nader';

export type BiedingBron =
  | 'kandidaat' | 'makelaar' | 'koper'
  | 'schriftelijk' | 'telefonisch' | 'email' | 'whatsapp' | 'anders';

export interface Bieding {
  id: string;
  objectId: string;
  relatieId: string;
  dealId?: string | null;
  objectPipelineId?: string | null;
  counterOfferToId?: string | null;
  bedrag?: number | null;
  currency: string;
  bieddatum: string;
  geldigTot?: string | null;
  status: BiedingStatus;
  offerType: BiedingType;
  financieringsvoorbehoud: VoorbehoudStatus;
  ddVoorbehoud: VoorbehoudStatus;
  gewensteLevering?: string | null;
  gewensteLeveringTekst?: string | null;
  waarborgsomBedrag?: number | null;
  waarborgsomPct?: number | null;
  kostenType?: KostenType | null;
  voorwaarden?: string | null;
  notities?: string | null;
  interneNotities?: string | null;
  bron?: BiedingBron | null;
  isBestOffer: boolean;
  isFinalOffer: boolean;
  rejectedReason?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  withdrawnAt?: string | null;
  expiredAt?: string | null;
  aangemaaktDoor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const BIEDING_STATUS_LABELS: Record<BiedingStatus, string> = {
  concept: 'Concept',
  ontvangen: 'Ontvangen',
  in_behandeling: 'In behandeling',
  tegenvoorstel_gedaan: 'Tegenvoorstel gedaan',
  aangepast_bod_gevraagd: 'Aangepast bod gevraagd',
  geaccepteerd: 'Geaccepteerd',
  afgewezen: 'Afgewezen',
  ingetrokken: 'Ingetrokken',
  verlopen: 'Verlopen',
};

export const BIEDING_TYPE_LABELS: Record<BiedingType, string> = {
  indicatief: 'Indicatief bod',
  openingsbod: 'Openingsbod',
  voorwaardelijk: 'Voorwaardelijk bod',
  onvoorwaardelijk: 'Onvoorwaardelijk bod',
  eindbod: 'Eindbod',
  tegenvoorstel: 'Tegenvoorstel',
  verhoogd_bod: 'Verhoogd bod',
  schriftelijk: 'Schriftelijk bod',
  mondeling: 'Mondeling bod',
};

export const VOORBEHOUD_LABELS: Record<VoorbehoudStatus, string> = {
  geen: 'Geen',
  ja: 'Ja',
  onbekend: 'Onbekend',
  nader_te_bepalen: 'Nader te bepalen',
};

export const KOSTEN_LABELS: Record<KostenType, string> = {
  kk: 'Kosten koper (k.k.)',
  von: 'Vrij op naam (VON)',
  nader: 'Nader overeen te komen',
};

export const BRON_LABELS: Record<BiedingBron, string> = {
  kandidaat: 'Kandidaat',
  makelaar: 'Makelaar',
  koper: 'Koper',
  schriftelijk: 'Schriftelijk',
  telefonisch: 'Telefonisch',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  anders: 'Anders',
};

export const OPEN_STATUSES: BiedingStatus[] = [
  'concept', 'ontvangen', 'in_behandeling',
  'tegenvoorstel_gedaan', 'aangepast_bod_gevraagd',
];

export const CLOSED_STATUSES: BiedingStatus[] = [
  'geaccepteerd', 'afgewezen', 'ingetrokken', 'verlopen',
];

export function isOpenStatus(s: BiedingStatus) {
  return OPEN_STATUSES.includes(s);
}
