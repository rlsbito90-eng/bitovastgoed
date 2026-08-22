// Server-side port van src/lib/offMarket/bag/autoTrigger.ts (pure functies, geen netwerkcalls).
// Gebruikt door off-market-normalize-ruw en legacy BAG-cascade guards.
//
// Belangrijk productieprincipe sinds de dedicated workers:
// - normalizer start AI/GEO niet meer rechtstreeks;
// - AI loopt via off-market-ai-auto-worker;
// - GEO loopt via de dedicated GEO-cron/function;
// - BAG loopt via off-market-bag-auto-worker;
// - Kadaster wordt nooit automatisch geraakt.

export interface SignaalAutoInput {
  id?: string;
  titel?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  bron_url?: string | null;
  status?: string | null;
  gearchiveerd_op?: string | null;
  ai_status?: string | null;
  ai_score?: number | null;
  ai_skip_reden?: string | null;
  ai_strategie_suggestie?: string | null;
  potentiele_strategie?: string | null;
  vergunningtype?: string | null;
  assettype?: string | null;
  bag_status?: string | null;
}

export interface TriggerBeslissing {
  toegestaan: boolean;
  reden: string;
}

/** Drempels — 1-op-1 met src/lib/offMarket/bag/autoTrigger.ts. */
export const BAG_DREMPEL_HOOG = 70;
export const BAG_DREMPEL_MIDDEN = 50;

const STRATEGIE_KEYWORDS = [
  'splits',
  'kamerverhuur',
  'verhuur',
  'exploitatie',
  'woonvorm',
  'transformatie',
  'herontwikkel',
  'ontwikkellocatie',
  'ontwikkeling',
  'woon-winkel',
  'woon/winkel',
  'woon_winkel',
];

export function strategieMatchVoorBag(s: SignaalAutoInput): boolean {
  const blob = [
    s.ai_strategie_suggestie ?? '',
    s.potentiele_strategie ?? '',
    s.vergunningtype ?? '',
    s.assettype ?? '',
  ].join(' ').toLowerCase();
  return STRATEGIE_KEYWORDS.some((k) => blob.includes(k));
}

function isArchief(s: SignaalAutoInput): boolean {
  if (s.gearchiveerd_op) return true;
  return s.status === 'archief' || s.status === 'afgevallen' || s.status === 'niet_interessant';
}

function heeftMinimaleData(s: SignaalAutoInput): boolean {
  const titel = (s.titel ?? '').trim();
  const heeftLocatie = !!(
    (s.plaats ?? '').trim() ||
    (s.adres ?? '').trim() ||
    (s.bron_url ?? '').trim()
  );
  return titel.length > 0 && heeftLocatie;
}

/** Postcode+huisnummer OF straat+huisnummer+plaats. */
export function adresKwaliteitVoldoende(s: SignaalAutoInput): boolean {
  const pc = (s.postcode ?? '').replace(/\s+/g, '').toUpperCase();
  const pcOk = /^\d{4}[A-Z]{2}$/.test(pc);
  const adres = (s.adres ?? '').trim();
  const heeftHuisnr = /\b\d+[a-zA-Z]?\b/.test(adres);
  if (pcOk && heeftHuisnr) return true;
  if (adres && heeftHuisnr && (s.plaats ?? '').trim()) return true;
  return false;
}

export function magAiAutoVerrijken(s: SignaalAutoInput): TriggerBeslissing {
  if (isArchief(s)) return { toegestaan: false, reden: 'gearchiveerd of afgevallen' };
  if (s.ai_skip_reden && s.ai_skip_reden.trim()) {
    return { toegestaan: false, reden: 'AI heeft signaal eerder geskipt' };
  }
  const status = s.ai_status ?? 'niet_verrijkt';
  if (status !== 'niet_verrijkt') {
    return { toegestaan: false, reden: `ai_status=${status}` };
  }
  if (!heeftMinimaleData(s)) {
    return { toegestaan: false, reden: 'onvoldoende data (titel/locatie)' };
  }
  return { toegestaan: true, reden: 'voldoet aan criteria' };
}

/**
 * Legacy/server-side BAG-cascade guard. Nieuwe automatische BAG-verrijking
 * loopt via off-market-bag-auto-worker en hoeft niet vanuit normalisatie/AI
 * direct gestart te worden.
 */
export function magBagAutoVerrijken(s: SignaalAutoInput): TriggerBeslissing {
  if (isArchief(s)) return { toegestaan: false, reden: 'gearchiveerd of afgevallen' };
  if (s.ai_skip_reden && s.ai_skip_reden.trim()) {
    return { toegestaan: false, reden: 'AI heeft signaal geskipt' };
  }
  if ((s.ai_status ?? 'niet_verrijkt') !== 'klaar') {
    return { toegestaan: false, reden: 'AI nog niet klaar' };
  }
  if (!adresKwaliteitVoldoende(s)) {
    return { toegestaan: false, reden: 'adreskwaliteit onvoldoende' };
  }
  const bag = (s.bag_status ?? 'niet_verrijkt') as string;
  if (bag === 'bezig') return { toegestaan: false, reden: 'BAG al bezig' };
  if (bag === 'verrijkt') return { toegestaan: false, reden: 'BAG al verrijkt' };
  if (bag === 'fout') return { toegestaan: false, reden: 'BAG-fout — geen auto-retry' };
  if (bag === 'geen_match') return { toegestaan: false, reden: 'geen BAG-match — geen auto-retry' };
  if (bag === 'meerdere_matches') {
    return { toegestaan: false, reden: 'meerdere BAG-matches — handmatige resolver' };
  }

  const score = typeof s.ai_score === 'number' ? s.ai_score : 0;
  if (score >= BAG_DREMPEL_HOOG) {
    return { toegestaan: true, reden: `ai_score >= ${BAG_DREMPEL_HOOG}` };
  }
  if (score >= BAG_DREMPEL_MIDDEN && strategieMatchVoorBag(s)) {
    return { toegestaan: true, reden: `ai_score ${score} + strategie-match` };
  }
  return { toegestaan: false, reden: `ai_score ${score} onvoldoende` };
}

/**
 * Directe normalizer→AI-invocations zijn uitgeschakeld.
 * Automatische AI-selectie loopt uitsluitend via off-market-ai-auto-worker.
 */
export const AI_TRIGGER_CAP_PER_RUN = 0;

/**
 * Legacy export; directe normalizer→GEO-invocations zijn uitgeschakeld.
 * GEO loopt uitsluitend via de dedicated GEO-cron/function.
 */
export const GEO_TRIGGER_CAP_PER_RUN = 0;
