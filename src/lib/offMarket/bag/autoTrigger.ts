// V2.3 — Triggerregels voor automatische AI- en BAG-verrijking.
// Pure helpers; geen netwerkcalls.

import type { SignaalBagInput } from './types';

/** Drempels — bewust hardcoded in fase 1. Admin-instellingen volgen in fase 2. */
export const BAG_DREMPEL_HOOG = 70;
export const BAG_DREMPEL_MIDDEN = 50;

/** Trefwoorden die wijzen op een strategie waarbij BAG-data eerder relevant is. */
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

export function strategieMatchVoorBag(s: SignaalBagInput): boolean {
  const blob = [
    s.ai_strategie_suggestie ?? '',
    s.potentiele_strategie ?? '',
    s.vergunningtype ?? '',
    s.assettype ?? '',
  ].join(' ').toLowerCase();
  return STRATEGIE_KEYWORDS.some((k) => blob.includes(k));
}

export interface TriggerBeslissing {
  toegestaan: boolean;
  reden: string;
}

function isArchief(s: SignaalBagInput): boolean {
  if (s.gearchiveerd_op) return true;
  return s.status === 'archief' || s.status === 'afgevallen' || s.status === 'niet_interessant';
}

function heeftMinimaleData(s: SignaalBagInput): boolean {
  const titel = (s.titel ?? '').trim();
  const heeftLocatie = !!((s.plaats ?? '').trim()
    || (s.adres ?? '').trim()
    || (s.bron_url ?? '').trim());
  return titel.length > 0 && heeftLocatie;
}

/** Postcode+huisnummer OF straat+huisnummer+plaats. */
export function adresKwaliteitVoldoende(s: SignaalBagInput): boolean {
  const pc = (s.postcode ?? '').replace(/\s+/g, '').toUpperCase();
  const pcOk = /^\d{4}[A-Z]{2}$/.test(pc);
  const adres = (s.adres ?? '').trim();
  const heeftHuisnr = /\b\d+[a-zA-Z]?\b/.test(adres);
  if (pcOk && heeftHuisnr) return true;
  if (adres && heeftHuisnr && (s.plaats ?? '').trim()) return true;
  return false;
}

export function magAiAutoVerrijken(s: SignaalBagInput): TriggerBeslissing {
  if (isArchief(s)) return { toegestaan: false, reden: 'gearchiveerd of afgevallen' };
  const status = s.ai_status ?? 'niet_verrijkt';
  if (status !== 'niet_verrijkt') {
    return { toegestaan: false, reden: `ai_status=${status}` };
  }
  if (!heeftMinimaleData(s)) {
    return { toegestaan: false, reden: 'onvoldoende data (titel/locatie)' };
  }
  return { toegestaan: true, reden: 'voldoet aan criteria' };
}

export function magBagAutoVerrijken(s: SignaalBagInput): TriggerBeslissing {
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

  const score = typeof s.ai_score === 'number' ? s.ai_score : 0;
  if (score >= BAG_DREMPEL_HOOG) {
    return { toegestaan: true, reden: `ai_score >= ${BAG_DREMPEL_HOOG}` };
  }
  if (score >= BAG_DREMPEL_MIDDEN && strategieMatchVoorBag(s)) {
    return { toegestaan: true, reden: `ai_score ${score} + strategie-match` };
  }
  return { toegestaan: false, reden: `ai_score ${score} onvoldoende` };
}
