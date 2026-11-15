import type { CriteriumSterkte, Meetbasis, SamenstellingsInvoer } from './samenstellingscriterium';
import { toetsSamenstelling } from './samenstellingscriterium';

/**
 * Generieke, pure regels voor een kopersvoorwaarde. Brongegevens blijven op hun
 * bestaande plek in Objecten en Relaties staan. Geen DB, geen nieuwe velden.
 *
 * Harde eisen zijn UITSLUITEND hard als de bron dat expliciet als zodanig bevat.
 * Vrije tekst of labels als "eis" zijn geen betrouwbaar hardheidsbewijs.
 */
export type CriteriumStatus = 'voldoet' | 'wijkt_af' | 'controle_nodig';
type Basis = { id: string; label: string; sterkte: CriteriumSterkte };

export type Koperscriterium =
  | (Basis & { soort: 'getal'; veld: 'bouwjaar' | 'leegstandPct'; min?: number; max?: number })
  | (Basis & { soort: 'keuze'; veld: 'verhuurStatus'; waarde: 'verhuurd' | 'leeg' | 'gedeeltelijk' })
  | (Basis & { soort: 'energielabel'; minimaal: string })
  | (Basis & {
    soort: 'aandeel'; gebruiksfunctieCode: string; operator: 'min' | 'max';
    percentage: number; meetbasis: Meetbasis;
  });

export interface CriteriumObjectBron {
  isPortefeuille?: boolean;
  bouwjaar?: number | null;
  leegstandPct?: number | null;
  verhuurStatus?: string | null;
  energielabel?: string | null;
  /** Wordt alleen gebruikt als een expliciet gestructureerd aandeelcriterium bestaat. */
  samenstelling?: SamenstellingsInvoer | null;
}

export interface CriteriumBeoordeling {
  id: string;
  label: string;
  sterkte: CriteriumSterkte;
  status: CriteriumStatus;
  diskwalificatie: boolean;
  toelichting: string;
}

export interface CriteriumOverzicht {
  beoordelingen: CriteriumBeoordeling[];
  voldoet: number;
  wijktAf: number;
  controleNodig: number;
  hardeAfwijzing: boolean;
  /** Voorlopige visuele status, niet de bestaande matchscore of pipeline. */
  status: 'hard_afgevallen' | 'controle_nodig' | 'voorkeur_wijkt_af' | 'voldoet';
}

const LABEL_RANG = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const geldigGetal = (waarde: unknown): waarde is number =>
  typeof waarde === 'number' && Number.isFinite(waarde);

const resultaat = (
  regel: Koperscriterium,
  status: CriteriumStatus,
  toelichting: string,
): CriteriumBeoordeling => ({
  id: regel.id,
  label: regel.label,
  sterkte: regel.sterkte,
  status,
  diskwalificatie: status === 'wijkt_af' && regel.sterkte === 'hard',
  toelichting,
});

/** Bij incomplete data altijd controle nodig; geen impliciete null -> 0. */
export function toetsKoperscriterium(
  regel: Koperscriterium,
  object: CriteriumObjectBron,
): CriteriumBeoordeling {
  if (regel.soort === 'aandeel') {
    if (!object.samenstelling) {
      return resultaat(regel, 'controle_nodig',
        'Oppervlaktes per gebruiksfunctie met betrouwbare afbakening ontbreken.');
    }
    const v = toetsSamenstelling(object.samenstelling, {
      gebruiksfunctieCode: regel.gebruiksfunctieCode,
      operator: regel.operator,
      percentage: regel.percentage,
      sterkte: regel.sterkte,
      meetbasis: regel.meetbasis,
    });
    return resultaat(regel, v.status, v.verklaring);
  }

  if (object.isPortefeuille) {
    return resultaat(regel, 'controle_nodig',
      'Portefeuille: controleer dit kenmerk per relevant objectonderdeel; een hoofdwaarde is niet representatief.');
  }

  if (regel.soort === 'getal') {
    if ((regel.min === undefined && regel.max === undefined)
      || (regel.min !== undefined && !geldigGetal(regel.min))
      || (regel.max !== undefined && !geldigGetal(regel.max))
      || (regel.min !== undefined && regel.max !== undefined && regel.min > regel.max)
      || (regel.veld === 'leegstandPct' && (
        (regel.min !== undefined && (regel.min < 0 || regel.min > 100))
        || (regel.max !== undefined && (regel.max < 0 || regel.max > 100))
      ))) {
      return resultaat(regel, 'controle_nodig', 'Ongeldig of tegenstrijdig criterium.');
    }
    const waarde = object[regel.veld];
    if (!geldigGetal(waarde)
      || (regel.veld === 'bouwjaar' && (!Number.isInteger(waarde) || waarde <= 0))
      || (regel.veld === 'leegstandPct' && (waarde < 0 || waarde > 100))) {
      return resultaat(regel, 'controle_nodig', 'Geen geldig objectgegeven beschikbaar.');
    }
    const afwijking = (regel.min !== undefined && waarde < regel.min)
      || (regel.max !== undefined && waarde > regel.max);
    return resultaat(regel, afwijking ? 'wijkt_af' : 'voldoet',
      'Geregistreerd ' + waarde
      + (regel.veld === 'leegstandPct' ? '%' : '')
      + (afwijking ? ' valt buiten ' : ' valt binnen ')
      + 'de opgegeven grenswaarden.');
  }

  if (regel.soort === 'keuze') {
    if (!['verhuurd', 'leeg', 'gedeeltelijk'].includes(regel.waarde)) {
      return resultaat(regel, 'controle_nodig', 'Onbekende zoekvoorkeur.');
    }
    if (!object.verhuurStatus || !['verhuurd', 'leeg', 'gedeeltelijk'].includes(object.verhuurStatus)) {
      return resultaat(regel, 'controle_nodig', 'Verhuursituatie object ontbreekt of is onbekend.');
    }
    return resultaat(regel, object.verhuurStatus === regel.waarde ? 'voldoet' : 'wijkt_af',
      'Geregistreerd: ' + object.verhuurStatus + '; gewenst: ' + regel.waarde + '.');
  }

  const minimaal = LABEL_RANG.indexOf(regel.minimaal as typeof LABEL_RANG[number]);
  const bestaand = LABEL_RANG.indexOf((object.energielabel ?? '') as typeof LABEL_RANG[number]);
  if (minimaal < 0 || bestaand < 0) {
    return resultaat(regel, 'controle_nodig', 'Geen vergelijkbaar energielabel in het objectdossier.');
  }
  return resultaat(regel, bestaand <= minimaal ? 'voldoet' : 'wijkt_af',
    'Geregistreerd ' + object.energielabel + '; gewenst minimaal ' + regel.minimaal
    + '. Geldigheid van het label is niet onafhankelijk geverifieerd.');
}

export function beoordeelKoperscriteria(
  regels: readonly Koperscriterium[],
  object: CriteriumObjectBron,
): CriteriumOverzicht {
  const beoordelingen: CriteriumBeoordeling[] = [];
  const seen = new Set<string>();
  for (const regel of regels) {
    // Duplicaten betekenen dat hetzelfde bronveld per ongeluk twee keer beoordeeld
    // kan worden. Niet stilzwijgend een hard/soft conflict laten passeren.
    if (!regel.id || seen.has(regel.id)) {
      beoordelingen.push({
        id: regel.id,
        label: regel.label,
        sterkte: regel.sterkte,
        status: 'controle_nodig',
        diskwalificatie: false,
        toelichting: 'Dubbele of ontbrekende criteriumidentificatie in het profiel.',
      });
      continue;
    }
    seen.add(regel.id);
    beoordelingen.push(toetsKoperscriterium(regel, object));
  }
  const voldoet = beoordelingen.filter(x => x.status === 'voldoet').length;
  const wijktAf = beoordelingen.filter(x => x.status === 'wijkt_af').length;
  const controleNodig = beoordelingen.filter(x => x.status === 'controle_nodig').length;
  const hardeAfwijzing = beoordelingen.some(x => x.diskwalificatie);
  return {
    beoordelingen, voldoet, wijktAf, controleNodig, hardeAfwijzing,
    status: hardeAfwijzing ? 'hard_afgevallen'
      : controleNodig ? 'controle_nodig'
      : wijktAf ? 'voorkeur_wijkt_af' : 'voldoet',
  };
}
