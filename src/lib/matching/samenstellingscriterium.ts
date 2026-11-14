/**
 * Pure toets voor de fysieke verdeling van gebruiksfuncties.
 * Geen database, geen matchscore-aanpassing, geen ongevraagde conversie.
 * Alleen in toekomstige matching aansluiten wanneer beide kanten dezelfde taxonomiecode gebruiken.
 */

export type Meetbasis = 'vvo' | 'gbo' | 'bvo';
export type CriteriumSterkte = 'hard' | 'voorkeur';
export type CriteriumOperator = 'min' | 'max';

export interface GebruikOnderdeel {
  id: string;
  gebruiksfunctieCode: string;
  oppervlakteM2: number;
  meetbasis: Meetbasis;
}

export interface SamenstellingsEis {
  gebruiksfunctieCode: string;
  operator: CriteriumOperator;
  percentage: number;
  /** Max/min is een harde uitsluiting of slechts een voorkeur. */
  sterkte: CriteriumSterkte;
  meetbasis: Meetbasis;
}

export interface SamenstellingsInvoer {
  onderdelen: readonly GebruikOnderdeel[];
  /** Compleet betekent: alle relevante fysieke ruimtes zijn in de denominator vertegenwoordigd. */
  volledigheidBevestigd: boolean;
  /** Geen overlappende ruimtes, dubbeltelling of aggregaat naast onderliggende eenheden. */
  zonderOverlapBevestigd: boolean;
}

export interface SamenstellingsUitkomst {
  status: 'voldoet' | 'wijkt_af' | 'controle_nodig';
  diskwalificatie: boolean;
  gemetenPercentage: number | null;
  verklaring: string;
}

const REVIEW = (verklaring: string): SamenstellingsUitkomst => ({
  status: 'controle_nodig',
  diskwalificatie: false,
  gemetenPercentage: null,
  verklaring,
});

/**
 * 'Geen gegevens' is nooit impliciet een fail/pass.
 * Een harde eis wordt niet vervangen door een hogere totale matchscore.
 */
export function toetsSamenstelling(
  invoer: SamenstellingsInvoer,
  eis: SamenstellingsEis,
): SamenstellingsUitkomst {
  if (!eis.gebruiksfunctieCode.trim() || !Number.isFinite(eis.percentage) ||
      eis.percentage < 0 || eis.percentage > 100) {
    return REVIEW('Criterium is niet volledig of ongeldig.');
  }
  if (!invoer.volledigheidBevestigd || !invoer.zonderOverlapBevestigd) {
    return REVIEW('De gemeten onderdelen zijn niet aantoonbaar volledig en zonder overlap.');
  }
  if (invoer.onderdelen.length === 0) {
    return REVIEW('Geen oppervlaktegegevens per gebruiksfunctie.');
  }
  const ids = new Set<string>();
  for (const part of invoer.onderdelen) {
    if (!part.id || ids.has(part.id) || !part.gebruiksfunctieCode.trim() ||
        !Number.isFinite(part.oppervlakteM2) || part.oppervlakteM2 <= 0) {
      return REVIEW('Onvolledige, dubbele of ongeldige onderdelen.');
    }
    ids.add(part.id);
    if (part.meetbasis !== eis.meetbasis) {
      return REVIEW('Oppervlakten hebben verschillende meetbases en kunnen niet worden opgeteld.');
    }
  }
  const totaal = invoer.onderdelen.reduce((sum, part) => sum + part.oppervlakteM2, 0);
  if (!Number.isFinite(totaal) || totaal <= 0) return REVIEW('Ongeldig totaaloppervlak.');

  const soortM2 = invoer.onderdelen
    .filter(p => p.gebruiksfunctieCode === eis.gebruiksfunctieCode)
    .reduce((sum, part) => sum + part.oppervlakteM2, 0);
  const pct = soortM2 / totaal * 100;
  // Vergelijk m²-producten, geen afgeronde weergave; exact 70,00% moet voldoen.
  const voldoet = eis.operator === 'min'
    ? soortM2 * 100 >= eis.percentage * totaal
    : soortM2 * 100 <= eis.percentage * totaal;
  return {
    status: voldoet ? 'voldoet' : 'wijkt_af',
    diskwalificatie: !voldoet && eis.sterkte === 'hard',
    gemetenPercentage: pct,
    verklaring: `${eis.gebruiksfunctieCode}: ${pct.toFixed(2)}% ${eis.meetbasis.toUpperCase()} ${voldoet ? 'voldoet aan' : 'wijkt af van'} ${eis.operator === 'min' ? 'minimum' : 'maximum'} ${eis.percentage}% (${eis.sterkte}).`,
  };
}
