import {
  toetsSamenstelling,
  type Meetbasis,
  type SamenstellingsUitkomst,
  type CriteriumSterkte,
  type GebruikOnderdeel,
} from './samenstellingscriterium';

/** Tijdelijk voorbeeldregister. Canonieke codes komen later uit één gedeelde taxonomie. */
export const DEMO_GEBRUIKSFUNCTIES = [
  { value: 'bedrijfsruimte', label: 'Bedrijfsruimte' },
  { value: 'kantoor', label: 'Kantoorruimte' },
  { value: 'wonen', label: 'Woonruimte' },
  { value: 'winkel', label: 'Winkelruimte' },
  { value: 'horeca', label: 'Horeca' },
  { value: 'maatschappelijk', label: 'Maatschappelijk' },
  { value: 'overig', label: 'Overig' },
] as const;

export interface OnderdeelConcept {
  id: string;
  omschrijving: string;
  gebruiksfunctieCode: string;
  oppervlakte: string;
  meetbasis: Meetbasis;
  adres: string;
}

export interface SamenstellingsProefResultaat {
  uitkomst: SamenstellingsUitkomst;
  totaalM2: number | null;
  bedrijfsruimteM2: number | null;
  overigeM2: number | null;
  bedrijfsruimteAandeel: number | null;
  overigeAandeel: number | null;
  uitleg: string;
}

const REVIEW = (uitleg: string): SamenstellingsProefResultaat => ({
  uitkomst: { status: 'controle_nodig', diskwalificatie: false, gemetenPercentage: null, verklaring: uitleg },
  totaalM2: null, bedrijfsruimteM2: null, overigeM2: null,
  bedrijfsruimteAandeel: null, overigeAandeel: null, uitleg,
});

/** Geen impliciete conversie van blanco of ongeldige oppervlaktes naar nul. */
export function parseOppervlakte(waarde: string): number | null {
  const clean = waarde.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Demo van een gedeelde vaste taxonomiecode plus generieke min-eis.
 * De aanduiding 'overig' is hier 100% minus bedrijfsruimte, dus inclusief
 * kantoor, winkel, wonen, horeca en alle andere functionele onderdelen.
 *
 * Dit wijzigt het bestaande matchpercentage niet, maakt geen profielrecord
 * aan en wordt nergens vanuit de live matching aangeroepen.
 */
export function berekenSamenstellingsProef(
  regels: readonly OnderdeelConcept[],
  minimumbedrijfsruimte: number,
  sterkte: CriteriumSterkte,
  volledig: boolean,
  zonderOverlap: boolean,
  meetbasisEis: Meetbasis = 'vvo',
): SamenstellingsProefResultaat {
  if (!Number.isFinite(minimumbedrijfsruimte) || minimumbedrijfsruimte < 0 || minimumbedrijfsruimte > 100) {
    return REVIEW('Het percentage moet tussen 0 en 100 liggen.');
  }
  if (regels.length === 0) return REVIEW('Voeg minimaal één objectonderdeel toe.');
  if (!volledig || !zonderOverlap) {
    return REVIEW('Bevestig eerst dat alle ruimten bekend zijn en geen oppervlakten dubbel meetellen.');
  }
  const ids = new Set<string>();
  const onderdelen: GebruikOnderdeel[] = [];
  for (const regel of regels) {
    if (!regel.id || ids.has(regel.id)) return REVIEW('Dubbele objectonderdelen gevonden.');
    ids.add(regel.id);
    const m2 = parseOppervlakte(regel.oppervlakte);
    if (m2 === null || !regel.gebruiksfunctieCode.trim()) {
      return REVIEW('Minstens één gebruiksfunctie of oppervlakte ontbreekt of is ongeldig.');
    }
    onderdelen.push({
      id: regel.id,
      gebruiksfunctieCode: regel.gebruiksfunctieCode,
      oppervlakteM2: m2,
      meetbasis: regel.meetbasis,
    });
  }

  if (onderdelen.some(o => o.meetbasis !== meetbasisEis)) {
    return REVIEW('De objectonderdelen zijn niet allemaal gemeten volgens de vereiste meetbasis ' +
      meetbasisEis.toUpperCase() + '. VVO, GBO en BVO mogen niet ongemerkt worden gemengd.');
  }
  const uitkomst = toetsSamenstelling(
    { onderdelen, volledigheidBevestigd: true, zonderOverlapBevestigd: true },
    { gebruiksfunctieCode: 'bedrijfsruimte', operator: 'min',
      percentage: minimumbedrijfsruimte, sterkte, meetbasis: meetbasisEis },
  );
  if (uitkomst.status === 'controle_nodig') return REVIEW(uitkomst.verklaring);
  const totaalM2 = onderdelen.reduce((sum, o) => sum + o.oppervlakteM2, 0);
  const bedrijfsruimteM2 = onderdelen
    .filter(o => o.gebruiksfunctieCode === 'bedrijfsruimte')
    .reduce((sum, o) => sum + o.oppervlakteM2, 0);
  const overigeM2 = totaalM2 - bedrijfsruimteM2;
  const bedrijfsruimteAandeel = bedrijfsruimteM2 / totaalM2 * 100;
  const overigeAandeel = 100 - bedrijfsruimteAandeel;
  return {
    uitkomst, totaalM2, bedrijfsruimteM2, overigeM2,
    bedrijfsruimteAandeel, overigeAandeel,
    uitleg: 'Vergelijking op basis van ' + meetbasisEis.toUpperCase()
      + '; alle overige gebruiksfuncties worden samen meegeteld.',
  };
}
