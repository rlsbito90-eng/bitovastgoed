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

// Pragmatische bovengrenzen — voorkomen NaN/overflow in AI-scoring (LOG10) en UI.
export const MAX_INDICATIEVE_WAARDE = 10_000_000_000; // €10 mld
export const MAX_MOGELIJKE_FEE = 100_000_000; // €100 mln

/** Valideer een YYYY-MM-DD datum. Lege string is toegestaan (=null). */
export function isValidIsoDate(s: string): boolean {
  if (!s || !s.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const [y, m, d] = s.trim().split('-').map(Number);
  if (y < 1900 || y > 2999) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
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

  // Numerieke validatie — coerce eerst zodat een eventuele string-leak ook gevalideerd wordt.
  const iw = coerceNumericOrNull(f.indicatieve_waarde);
  if (f.indicatieve_waarde != null && iw == null && String(f.indicatieve_waarde).trim() !== '') {
    errors.indicatieve_waarde = 'Ongeldige waarde';
  } else if (iw != null) {
    if (iw < 0) errors.indicatieve_waarde = 'Mag niet negatief zijn';
    else if (iw > MAX_INDICATIEVE_WAARDE) {
      errors.indicatieve_waarde = `Max € ${MAX_INDICATIEVE_WAARDE.toLocaleString('nl-NL')}`;
    }
  }
  const mf = coerceNumericOrNull(f.mogelijke_fee);
  if (f.mogelijke_fee != null && mf == null && String(f.mogelijke_fee).trim() !== '') {
    errors.mogelijke_fee = 'Ongeldige waarde';
  } else if (mf != null) {
    if (mf < 0) errors.mogelijke_fee = 'Mag niet negatief zijn';
    else if (mf > MAX_MOGELIJKE_FEE) {
      errors.mogelijke_fee = `Max € ${MAX_MOGELIJKE_FEE.toLocaleString('nl-NL')}`;
    }
  }

  // Datumvalidatie
  if (!isValidIsoDate(f.bron_datum)) {
    errors.bron_datum = 'Ongeldige datum (verwacht JJJJ-MM-DD)';
  }
  if (!isValidIsoDate(f.volgende_actie_datum)) {
    errors.volgende_actie_datum = 'Ongeldige datum (verwacht JJJJ-MM-DD)';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

type Insert = Database['public']['Tables']['off_market_signalen']['Insert'];
const blank = (s: string) => (s.trim() ? s.trim() : null);

/**
 * Coerce numerieke veldwaarde voor DB:
 * - null / undefined / leeg → null
 * - string of number → Number()
 * - NaN of Infinity → null (nooit naar Supabase sturen)
 */
export function coerceNumericOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

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
    indicatieve_waarde: coerceNumericOrNull(f.indicatieve_waarde),
    mogelijke_fee: coerceNumericOrNull(f.mogelijke_fee),
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
