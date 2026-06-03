// Validatie + payload-mapping voor off-market signalen
import type { Database } from '@/integrations/supabase/types';
import type {
  OffMarketAssettype, OffMarketBronType, OffMarketSignaaltype,
  OffMarketPrioriteit, OffMarketStatus,
} from './types';

export interface SignaalFormState {
  titel: string;
  assettype: OffMarketAssettype;
  bron_type: OffMarketBronType;
  type_signaal: OffMarketSignaaltype;
  status: OffMarketStatus;
  prioriteit: OffMarketPrioriteit;
  adres: string;
  postcode: string;
  plaats: string;
  provincie: string;
  regio: string;
  omschrijving: string;
  bron_url: string;
  bron_referentie: string;
  bron_datum: string;
  indicatieve_waarde: number | null;
  mogelijke_fee: number | null;
  potentiele_strategie: string;
  volgende_actie_datum: string;
  volgende_actie_omschrijving: string;
  notities: string;
}

export const SIGNAAL_LEEG: SignaalFormState = {
  titel: '',
  assettype: 'overig',
  bron_type: 'handmatig',
  type_signaal: 'handmatige_research',
  status: 'nieuw_signaal',
  prioriteit: 'midden',
  adres: '', postcode: '', plaats: '', provincie: '', regio: '',
  omschrijving: '', bron_url: '', bron_referentie: '', bron_datum: '',
  indicatieve_waarde: null, mogelijke_fee: null, potentiele_strategie: '',
  volgende_actie_datum: '', volgende_actie_omschrijving: '', notities: '',
};

export interface ValidationResult {
  ok: boolean;
  errors: Partial<Record<keyof SignaalFormState, string>>;
}

export function validateSignaal(f: SignaalFormState): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  if (!f.titel.trim()) errors.titel = 'Titel is verplicht';
  if (f.titel.trim().length > 200) errors.titel = 'Titel max 200 tekens';
  if (!f.assettype) errors.assettype = 'Assettype is verplicht';
  if (!f.bron_type) errors.bron_type = 'Bron is verplicht';
  if (!f.type_signaal) errors.type_signaal = 'Type signaal is verplicht';
  if (!f.status) errors.status = 'Status is verplicht';
  if (f.bron_url && !/^https?:\/\//i.test(f.bron_url.trim())) {
    errors.bron_url = 'URL moet beginnen met http(s)://';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

type Insert = Database['public']['Tables']['off_market_signalen']['Insert'];
const blank = (s: string) => (s.trim() ? s.trim() : null);

export function formStateToPayload(f: SignaalFormState): Insert {
  return {
    titel: f.titel.trim(),
    assettype: f.assettype,
    bron_type: f.bron_type,
    type_signaal: f.type_signaal,
    status: f.status,
    prioriteit: f.prioriteit,
    adres: blank(f.adres),
    postcode: blank(f.postcode),
    plaats: blank(f.plaats),
    provincie: blank(f.provincie),
    regio: blank(f.regio),
    omschrijving: blank(f.omschrijving),
    bron_url: blank(f.bron_url),
    bron_referentie: blank(f.bron_referentie),
    bron_datum: blank(f.bron_datum),
    indicatieve_waarde: f.indicatieve_waarde,
    mogelijke_fee: f.mogelijke_fee,
    potentiele_strategie: blank(f.potentiele_strategie),
    volgende_actie_datum: blank(f.volgende_actie_datum),
    volgende_actie_omschrijving: blank(f.volgende_actie_omschrijving),
    notities: blank(f.notities),
  };
}

export function signaalToFormState(
  s: Database['public']['Tables']['off_market_signalen']['Row'],
): SignaalFormState {
  return {
    titel: s.titel,
    assettype: s.assettype,
    bron_type: s.bron_type,
    type_signaal: s.type_signaal,
    status: s.status,
    prioriteit: s.prioriteit,
    adres: s.adres ?? '',
    postcode: s.postcode ?? '',
    plaats: s.plaats ?? '',
    provincie: s.provincie ?? '',
    regio: s.regio ?? '',
    omschrijving: s.omschrijving ?? '',
    bron_url: s.bron_url ?? '',
    bron_referentie: s.bron_referentie ?? '',
    bron_datum: s.bron_datum ?? '',
    indicatieve_waarde: s.indicatieve_waarde != null ? Number(s.indicatieve_waarde) : null,
    mogelijke_fee: s.mogelijke_fee != null ? Number(s.mogelijke_fee) : null,
    potentiele_strategie: s.potentiele_strategie ?? '',
    volgende_actie_datum: s.volgende_actie_datum ?? '',
    volgende_actie_omschrijving: s.volgende_actie_omschrijving ?? '',
    notities: s.notities ?? '',
  };
}
