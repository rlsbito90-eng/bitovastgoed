// V2.3 — Kadasteradvies o.b.v. AI-score, strategie en BAG-uitkomst.
// Pure helper, geen IO. Wordt na elke AI/BAG-update opnieuw berekend.

import { strategieMatchVoorBag } from './autoTrigger';
import type { Kadasteradvies, SignaalBagInput } from './types';

export interface KadasteradviesResultaat {
  niveau: Kadasteradvies | null;
  reden: string;
}

function strategieSterk(s: SignaalBagInput): boolean {
  const blob = [
    s.ai_strategie_suggestie ?? '',
    s.potentiele_strategie ?? '',
    s.vergunningtype ?? '',
  ].join(' ').toLowerCase();
  return /splits|transformatie|herontwikkel|ontwikkellocatie|ontwikkeling/.test(blob);
}

export function berekenKadasteradvies(s: SignaalBagInput): KadasteradviesResultaat {
  const bag = (s.bag_status ?? 'niet_verrijkt') as string;

  if (bag === 'niet_verrijkt' || bag === 'bezig') {
    return { niveau: null, reden: 'BAG nog niet verrijkt' };
  }
  if (bag === 'fout') {
    return { niveau: null, reden: 'BAG-verrijking mislukt — handmatig opnieuw proberen' };
  }
  if (bag === 'geen_match') {
    return {
      niveau: null,
      reden: 'Geen BAG-match — controleer adres voordat Kadaster wordt opgehaald',
    };
  }

  const aiScore = typeof s.ai_score === 'number' ? s.ai_score : 0;
  const vbo = s.bag_aantal_vbo ?? 0;
  const opp = s.bag_totaal_oppervlakte_m2 ?? 0;
  const matchOnzeker = s.bag_match_kwaliteit === 'onzeker' || bag === 'meerdere_matches';
  const strategieAlgemeen = strategieMatchVoorBag(s);

  // Lage AI-score: blijft altijd 'laag', ongeacht BAG.
  if (aiScore < 50) {
    return {
      niveau: 'laag',
      reden: 'Lage AI-score — betaald Kadasteronderzoek heeft lage prioriteit',
    };
  }

  // Match-onzekerheid begrenst tot maximaal 'voorzichtig'.
  if (matchOnzeker) {
    return {
      niveau: 'voorzichtig',
      reden: 'Meerdere of onzekere BAG-matches — controleer eerst het juiste adres',
    };
  }

  // Sterk aanbevolen
  if (aiScore >= 80 && vbo >= 2 && opp >= 150) {
    return {
      niveau: 'sterk_aanbevolen',
      reden: `Hoge AI-score (${aiScore}), ${vbo} VBO's en ${opp} m² — Kadasteronderzoek sterk aanbevolen`,
    };
  }

  // Aanbevolen
  if (aiScore >= 70 && (vbo >= 2 || strategieSterk(s))) {
    return {
      niveau: 'aanbevolen',
      reden: vbo >= 2
        ? `AI-score ${aiScore} en ${vbo} VBO's — Kadasteronderzoek aanbevolen`
        : `AI-score ${aiScore} en strategie-fit (splitsing/transformatie/ontwikkeling) — Kadasteronderzoek aanbevolen`,
    };
  }

  // Klein/enkelvoudig object — voorzichtig bij strategie-kans, anders laag.
  const isKlein = (opp > 0 && opp < 120) || vbo <= 1;
  if (isKlein) {
    if (strategieAlgemeen) {
      return {
        niveau: 'voorzichtig',
        reden: 'Beperkte schaal, maar strategie biedt mogelijk kans — overweeg eerst bron/vergunning te controleren',
      };
    }
    return {
      niveau: 'laag',
      reden: 'Kleinschalig of enkelvoudig object zonder duidelijke strategie-fit',
    };
  }

  // Default — voldoende AI, geen sterke trigger.
  return {
    niveau: 'voorzichtig',
    reden: 'Object lijkt redelijk maar mist duidelijke schaal- of strategie-fit',
  };
}
