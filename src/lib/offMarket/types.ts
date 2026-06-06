// Off-Market Radar — gedeelde types, labels en helpers
import type { Database } from '@/integrations/supabase/types';

export type OffMarketAssettype = Database['public']['Enums']['off_market_assettype'];
export type OffMarketBronType = Database['public']['Enums']['off_market_bron_type'];
export type OffMarketSignaaltype = Database['public']['Enums']['off_market_signaaltype'];
export type OffMarketPrioriteit = Database['public']['Enums']['off_market_prioriteit'];
export type OffMarketStatus = Database['public']['Enums']['off_market_status'];
export type OffMarketVergunningtype = Database['public']['Enums']['off_market_vergunningtype'];
export type OffMarketAanvraagOfBesluit = Database['public']['Enums']['off_market_aanvraag_besluit'];
export type OffMarketAiStatus = 'niet_verrijkt' | 'in_wachtrij' | 'bezig' | 'klaar' | 'mislukt';


export type OffMarketSignaal = Database['public']['Tables']['off_market_signalen']['Row'];

export const AI_STATUS_LABEL: Record<OffMarketAiStatus, string> = {
  niet_verrijkt: 'Niet verrijkt',
  in_wachtrij: 'In wachtrij',
  bezig: 'Bezig',
  klaar: 'Verrijkt',
  mislukt: 'Mislukt',
};
export const AI_STATUS_VOLGORDE: OffMarketAiStatus[] = ['klaar', 'bezig', 'in_wachtrij', 'niet_verrijkt', 'mislukt'];

export const ASSETTYPE_LABEL: Record<OffMarketAssettype, string> = {
  kantoor: 'Kantoor',
  winkelpand: 'Winkelpand',
  woon_winkelpand: 'Woon-/winkelpand',
  bedrijfscomplex: 'Bedrijfscomplex',
  light_industrial: 'Light industrial',
  logistiek: 'Logistiek',
  zorgvastgoed: 'Zorgvastgoed',
  transformatieobject: 'Transformatieobject',
  ontwikkellocatie: 'Ontwikkellocatie',
  vastgoedportefeuille: 'Portefeuille',
  overig: 'Overig',
};

export const BRON_TYPE_LABEL: Record<OffMarketBronType, string> = {
  handmatig: 'Handmatig',
  bekendmaking: 'Bekendmaking',
  vergunning: 'Vergunning',
  bag: 'BAG',
  kvk: 'KVK',
  nieuws: 'Nieuws',
  rss: 'RSS',
  csv: 'CSV',
  overig: 'Overig',
};

export const SIGNAALTYPE_LABEL: Record<OffMarketSignaaltype, string> = {
  vergunning_bekendmaking: 'Vergunning/bekendmaking',
  functiewijziging: 'Functiewijziging',
  transformatiepotentie: 'Transformatiepotentie',
  leegstand: 'Leegstand',
  bedrijfsbeeindiging: 'Bedrijfsbeëindiging',
  lang_bezit: 'Lang in bezit',
  onderbenutte_locatie: 'Onderbenutte locatie',
  vastgoednieuws: 'Vastgoednieuws',
  netwerk: 'Netwerk',
  handmatige_research: 'Handmatige research',
  overig: 'Overig',
};

export const PRIORITEIT_LABEL: Record<OffMarketPrioriteit, string> = {
  laag: 'Laag',
  midden: 'Midden',
  hoog: 'Hoog',
  urgent: 'Urgent',
};
export const PRIORITEIT_VOLGORDE: OffMarketPrioriteit[] = ['urgent', 'hoog', 'midden', 'laag'];
const PRIORITEIT_RANG: Record<OffMarketPrioriteit, number> = { urgent: 4, hoog: 3, midden: 2, laag: 1 };
export const prioriteitRang = (p: OffMarketPrioriteit) => PRIORITEIT_RANG[p];

export const STATUS_LABEL: Record<OffMarketStatus, string> = {
  nieuw_signaal: 'Nieuw signaal',
  interessant: 'Interessant',
  twijfel: 'Twijfel',
  te_onderzoeken: 'Te onderzoeken',
  eigenaar_achterhalen: 'Eigenaar achterhalen',
  eigenaar_gevonden: 'Eigenaar gevonden',
  benaderen: 'Benaderen',
  benaderd: 'Benaderd',
  in_gesprek: 'In gesprek',
  aanbod_ontvangen: 'Aanbod ontvangen',
  object_ontvangen: 'Object ontvangen',
  dealtraject: 'Dealtraject',
  niet_interessant: 'Niet interessant',
  afgevallen: 'Afgevallen',
  archief: 'Archief',
};
export const STATUS_VOLGORDE: OffMarketStatus[] = [
  'nieuw_signaal', 'interessant', 'twijfel', 'te_onderzoeken',
  'eigenaar_achterhalen', 'eigenaar_gevonden', 'benaderen', 'benaderd',
  'in_gesprek', 'aanbod_ontvangen', 'object_ontvangen', 'dealtraject',
  'niet_interessant', 'afgevallen', 'archief',
];

export const PROVINCIES = [
  'Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg',
  'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland',
];
