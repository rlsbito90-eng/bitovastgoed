// Off-Market Radar — gedeelde types, labels en helpers
import type { Database } from '@/integrations/supabase/types';

export type OffMarketAssettype = Database['public']['Enums']['off_market_assettype'];
export type OffMarketBronType = Database['public']['Enums']['off_market_bron_type'];
export type OffMarketSignaaltype = Database['public']['Enums']['off_market_signaaltype'];
export type OffMarketPrioriteit = Database['public']['Enums']['off_market_prioriteit'];
export type OffMarketStatus = Database['public']['Enums']['off_market_status'];

export type OffMarketSignaal = Database['public']['Tables']['off_market_signalen']['Row'];

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
  te_onderzoeken: 'Te onderzoeken',
  eigenaar_achterhalen: 'Eigenaar achterhalen',
  benaderen: 'Benaderen',
  in_gesprek: 'In gesprek',
  object_ontvangen: 'Object ontvangen',
  dealtraject: 'Dealtraject',
  niet_interessant: 'Niet interessant',
  archief: 'Archief',
};
export const STATUS_VOLGORDE: OffMarketStatus[] = [
  'nieuw_signaal', 'te_onderzoeken', 'eigenaar_achterhalen', 'benaderen',
  'in_gesprek', 'object_ontvangen', 'dealtraject', 'niet_interessant', 'archief',
];

export const PROVINCIES = [
  'Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg',
  'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland',
];
