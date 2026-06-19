// V2.3 + V2.4 — Kadasteradvies o.b.v. AI-score, strategie, BAG-uitkomst,
// gekozen doelobject en BAG-pandcontext. Pure helper, geen IO.

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

function strategieKamerverhuur(s: SignaalBagInput): boolean {
  const blob = [
    s.ai_strategie_suggestie ?? '',
    s.potentiele_strategie ?? '',
  ].join(' ').toLowerCase();
  return /kamerverhuur|verhuur|exploitatie/.test(blob);
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

  // V2.4 — doelobject + pandcontext (alleen actief wanneer doelobject gekozen is).
  const doelOpp = typeof s.bag_geselecteerd_opp_m2 === 'number' ? s.bag_geselecteerd_opp_m2 : null;
  const pandOpp = typeof s.bag_pandcontext_totaal_opp_m2 === 'number'
    ? s.bag_pandcontext_totaal_opp_m2 : opp;
  const pandVbo = typeof s.bag_pandcontext_aantal_vbo === 'number'
    ? s.bag_pandcontext_aantal_vbo : vbo;
  const heeftDoelobject = doelOpp != null;
  const doelKlein = doelOpp != null && doelOpp < 60;
  const pandKlein = pandOpp > 0 && pandOpp < 150 && pandVbo > 0 && pandVbo <= 2;
  const pandGroot = pandVbo >= 3 || pandOpp >= 200;

  // Lage AI-score blokkeert altijd, behalve wanneer kamerverhuur/exploitatie strategie
  // expliciet relevant blijft voor een klein doelobject. Buiten dat: laag.
  if (aiScore < 50) {
    if (heeftDoelobject && doelKlein && strategieKamerverhuur(s)) {
      return {
        niveau: 'voorzichtig',
        reden: `Doelobject circa ${doelOpp} m² en BAG-pandcontext circa ${pandOpp} m². Het object is kleinschalig, maar kan door kamerverhuur-, verhuur- of exploitatieoptimalisatiepotentie relevant blijven. Betaald Kadasteronderzoek verdient een bewuste afweging.`,
      };
    }
    return {
      niveau: 'laag',
      reden: 'Lage AI-score — betaald Kadasteronderzoek heeft lage prioriteit',
    };
  }

  // Match-onzekerheid begrenst tot maximaal 'voorzichtig'.
  if (matchOnzeker) {
    return {
      niveau: 'voorzichtig',
      reden: 'Meerdere of onzekere BAG-matches — kies eerst het juiste BAG-adres voordat Kadaster wordt aangevraagd',
    };
  }

  // V2.4 — Kleinschalige BAG-adrescontext (≤2 VBO én <150 m²) beperkt het advies
  // maximaal tot 'voorzichtig', ongeacht AI-score. Reden noemt de schaal expliciet.
  const kleineContext = pandVbo > 0 && pandVbo <= 2 && pandOpp > 0 && pandOpp < 150;
  if (kleineContext) {
    if (strategieKamerverhuur(s)) {
      return {
        niveau: 'voorzichtig',
        reden: `Kleinschalige BAG-adrescontext van circa ${pandOpp} m² met ${pandVbo} VBO's. Door mogelijke verhuur-, kamerverhuur- of exploitatieoptimalisatie kan het signaal nog relevant zijn, maar betaald Kadasteronderzoek verdient een bewuste afweging.`,
      };
    }
    return {
      niveau: 'voorzichtig',
      reden: `Kleinschalige BAG-adrescontext van circa ${pandOpp} m² met ${pandVbo} VBO's. Betaald Kadasteronderzoek verdient een bewuste afweging.`,
    };
  }

  // V2.4 — Doelobject-aware paden.
  if (heeftDoelobject) {
    // Klein doelobject + grote pandcontext + AI ≥ 70 → aanbevolen.
    if (doelKlein && pandGroot && aiScore >= 70) {
      return {
        niveau: 'aanbevolen',
        reden: `Doelobject is beperkt (${doelOpp} m²), maar de bredere BAG-pandcontext bevat ${pandVbo} VBO's en ${pandOpp} m². AI-score ${aiScore} — Kadasteronderzoek aanbevolen.`,
      };
    }
    // Klein doelobject + kamerverhuur/exploitatie → minimaal voorzichtig (nooit laag).
    if (doelKlein && strategieKamerverhuur(s)) {
      return {
        niveau: 'voorzichtig',
        reden: `Doelobject circa ${doelOpp} m² en BAG-pandcontext circa ${pandOpp} m². Het object is kleinschalig, maar kan door kamerverhuur-, verhuur- of exploitatieoptimalisatiepotentie relevant blijven. Betaald Kadasteronderzoek verdient een bewuste afweging.`,
      };
    }
    // Klein doelobject + kleine pandcontext → voorzichtig.
    if (doelKlein && pandKlein) {
      return {
        niveau: 'voorzichtig',
        reden: `Doelobject circa ${doelOpp} m² en BAG-pandcontext circa ${pandOpp} m². Kleinschalig — Kadasteronderzoek met bewuste afweging.`,
      };
    }
    // Groot doelobject ≥150 m² + AI ≥ 70.
    if (doelOpp != null && doelOpp >= 150 && aiScore >= 70) {
      if (aiScore >= 80) {
        return {
          niveau: 'sterk_aanbevolen',
          reden: `Groot doelobject (${doelOpp} m²) en hoge AI-score (${aiScore}) — Kadasteronderzoek sterk aanbevolen.`,
        };
      }
      return {
        niveau: 'aanbevolen',
        reden: `Groot doelobject (${doelOpp} m²) en AI-score ${aiScore} — Kadasteronderzoek aanbevolen.`,
      };
    }
  }

  // Sterk aanbevolen (zonder doelobject, op pandcontext-totalen).
  if (aiScore >= 80 && pandVbo >= 2 && pandOpp >= 150) {
    return {
      niveau: 'sterk_aanbevolen',
      reden: `Hoge AI-score (${aiScore}), ${pandVbo} VBO's en ${pandOpp} m² — Kadasteronderzoek sterk aanbevolen.`,
    };
  }

  // Strategie splitsing/transformatie + ≥2 VBO → aanbevolen.
  if (strategieSterk(s) && pandVbo >= 2) {
    return {
      niveau: 'aanbevolen',
      reden: `Strategie splitsing/transformatie en ${pandVbo} VBO's in de BAG-pandcontext — Kadasteronderzoek aanbevolen.`,
    };
  }

  // Aanbevolen — AI ≥70 + (≥2 VBO of strategie sterk), ENKEL bij voldoende schaal.
  if (aiScore >= 70 && pandOpp >= 150 && (pandVbo >= 2 || strategieSterk(s))) {
    return {
      niveau: 'aanbevolen',
      reden: pandVbo >= 2
        ? `AI-score ${aiScore} en ${pandVbo} VBO's in de BAG-pandcontext — Kadasteronderzoek aanbevolen.`
        : `AI-score ${aiScore} en strategie-fit (splitsing/transformatie/ontwikkeling) — Kadasteronderzoek aanbevolen.`,
    };
  }

  // Klein/enkelvoudig object — voorzichtig bij strategie-kans, anders laag.
  const isKlein = (pandOpp > 0 && pandOpp < 120) || pandVbo <= 1;
  if (isKlein) {
    if (strategieAlgemeen) {
      return {
        niveau: 'voorzichtig',
        reden: 'Beperkte schaal, maar strategie biedt mogelijk kans — overweeg eerst bron/vergunning te controleren.',
      };
    }
    return {
      niveau: 'laag',
      reden: 'Kleinschalig of enkelvoudig object zonder duidelijke strategie-fit.',
    };
  }

  return {
    niveau: 'voorzichtig',
    reden: 'Object lijkt redelijk maar mist duidelijke schaal- of strategie-fit.',
  };
}
