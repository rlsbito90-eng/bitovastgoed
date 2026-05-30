// Quickscan-defaults voor notariskosten. Geen vervanger van notariële offerte.
// Pure functions; toon altijd waarschuwing in UI/audit.

export type NotaryProfileKey =
  | 'woning_simpel'
  | 'woning_belegging'
  | 'commercieel'
  | 'mixed_use'
  | 'portefeuille';

export type NotaryProfile = {
  key: NotaryProfileKey;
  label: string;
  /** Minimum bedrag in euro's. */
  minimum: number;
  /** Percentage van de basis (koopsom/vraagprijs). */
  pct: number;
  /** True wanneer profiel een handmatige invoer vereist. */
  requiresManual: boolean;
  note: string;
};

export const NOTARY_PROFILES: Record<NotaryProfileKey, NotaryProfile> = {
  woning_simpel: {
    key: 'woning_simpel',
    label: 'Simpel woningobject',
    minimum: 2000,
    pct: 0.10,
    requiresManual: false,
    note: 'max(€ 2.000, basis × 0,10%)',
  },
  woning_belegging: {
    key: 'woning_belegging',
    label: 'Beleggingswoning / klein object',
    minimum: 2500,
    pct: 0.12,
    requiresManual: false,
    note: 'max(€ 2.500, basis × 0,12%)',
  },
  commercieel: {
    key: 'commercieel',
    label: 'Commercieel vastgoed',
    minimum: 3500,
    pct: 0.15,
    requiresManual: false,
    note: 'max(€ 3.500, basis × 0,15%)',
  },
  mixed_use: {
    key: 'mixed_use',
    label: 'Mixed-use / meerdere units / gesplitst',
    minimum: 5000,
    pct: 0.20,
    requiresManual: false,
    note: 'max(€ 5.000, basis × 0,20%)',
  },
  portefeuille: {
    key: 'portefeuille',
    label: 'Complexe portefeuille',
    minimum: 0,
    pct: 0,
    requiresManual: true,
    note: 'Handmatige invoer vereist — vraag notariële offerte op.',
  },
};

export const NOTARY_PROFILE_KEYS = Object.keys(NOTARY_PROFILES) as NotaryProfileKey[];

export type NotaryProfileResult = {
  profile: NotaryProfile;
  basis: number;
  amount: number;
  /** Formule-tekst voor UI/audit. */
  formula: string;
  requiresManual: boolean;
};

export function computeNotaryFromProfile(basis: number, key: NotaryProfileKey | null | undefined): NotaryProfileResult {
  const effectiveKey: NotaryProfileKey = key && key in NOTARY_PROFILES ? key : 'woning_belegging';
  const profile = NOTARY_PROFILES[effectiveKey];
  const b = Math.max(0, Number(basis ?? 0));
  if (profile.requiresManual || b <= 0) {
    return { profile, basis: b, amount: 0, formula: profile.note, requiresManual: true };
  }
  const pctAmount = Math.round((b * profile.pct) / 100);
  const amount = Math.max(profile.minimum, pctAmount);
  const formula = `max(€ ${profile.minimum.toLocaleString('nl-NL')}, ${b.toLocaleString('nl-NL')} × ${profile.pct.toString().replace('.', ',')}%) = € ${amount.toLocaleString('nl-NL')}`;
  return { profile, basis: b, amount, formula, requiresManual: false };
}

/** Default-profiel voor nieuwe scenario's o.b.v. strategie/objecttype. */
export function defaultNotaryProfileFor(strategyType?: string | null, objectType?: string | null): NotaryProfileKey {
  const o = (objectType ?? '').toLowerCase();
  if (o.includes('mixed') || o.includes('portefeuille')) return 'mixed_use';
  const s = (strategyType ?? '').toLowerCase();
  if (s.includes('commercieel') || s.includes('zakelijk')) return 'commercieel';
  return 'woning_belegging';
}
