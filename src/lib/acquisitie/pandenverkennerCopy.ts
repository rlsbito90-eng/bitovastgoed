import { BITO_CONTACT } from '@/lib/offMarket/brief';
import { kiesCopyVariant, type CopyVariantDefinitie, type CopyVariantToewijzing } from '@/lib/acquisitie/copyExperimenten';

export type PandenverkennerCopyProfiel =
  | 'pandenverkenner_woon_winkelpand'
  | 'pandenverkenner_gemengd_vastgoed'
  | 'pandenverkenner_woonvastgoed'
  | 'pandenverkenner_commercieel_vastgoed'
  | 'pandenverkenner_algemene_acquisitie';

export interface PandenverkennerCopyInput {
  vastgoedkansId: string;
  typeVastgoed?: string | null;
  objectomschrijving: string;
  plaats?: string | null;
  geadresseerdeKey?: string | null;
  eigenaarBevestigd: boolean;
}

const VARIANTEN: CopyVariantDefinitie[] = [
  {
    code: 'A',
    naam: 'Netwerk/context',
    hypothese: 'Een iets meer onderbouwde eerste brief die de selectie uitlegt vanuit concrete marktvraag in het netwerk verhoogt de kwalitatieve verkopersrespons.',
    actief: true,
  },
  {
    code: 'B',
    naam: 'Kort/direct',
    hypothese: 'Een kortere eerste brief die sneller van objectinteresse naar de verkoopvraag gaat verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.',
    actief: true,
  },
];

const schoon = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function bepaalPandenverkennerCopyProfiel(typeVastgoed?: string | null): PandenverkennerCopyProfiel {
  const type = schoon(typeVastgoed);
  const wonen = type.includes('woonfunctie');
  const winkel = type.includes('winkelfunctie');
  const commercieel = /kantoorfunctie|industriefunctie|winkelfunctie|bijeenkomstfunctie|logiesfunctie|onderwijsfunctie|sportfunctie|gezondheidszorgfunctie|overige gebruiksfunctie/.test(type);

  if (wonen && winkel) return 'pandenverkenner_woon_winkelpand';
  if (wonen && commercieel) return 'pandenverkenner_gemengd_vastgoed';
  if (wonen) return 'pandenverkenner_woonvastgoed';
  if (commercieel) return 'pandenverkenner_commercieel_vastgoed';
  return 'pandenverkenner_algemene_acquisitie';
}

export function kiesPandenverkennerVariant(input: PandenverkennerCopyInput): CopyVariantToewijzing {
  const profiel = bepaalPandenverkennerCopyProfiel(input.typeVastgoed);
  return kiesCopyVariant({
    profiel,
    kanaal: 'post',
    campagneStap: 'brief_1',
    signaalId: input.vastgoedkansId,
    geadresseerdeKey: input.geadresseerdeKey,
    varianten: VARIANTEN,
  });
}

function marktzin(profiel: PandenverkennerCopyProfiel): string {
  switch (profiel) {
    case 'pandenverkenner_woon_winkelpand': return 'woon-/winkelpanden en ander gemengd beleggingsvastgoed';
    case 'pandenverkenner_gemengd_vastgoed': return 'gemengd vastgoed met een combinatie van wonen en commerciële functies';
    case 'pandenverkenner_woonvastgoed': return 'woon- en beleggingsvastgoed';
    case 'pandenverkenner_commercieel_vastgoed': return 'commercieel vastgoed';
    default: return 'vastgoed van dit type';
  }
}

function gebied(plaats?: string | null): string {
  const p = String(plaats ?? '').trim();
  return p ? ` in ${p}` : '';
}

export function bouwPandenverkennerBrief1(input: PandenverkennerCopyInput, toewijzing: CopyVariantToewijzing): { onderwerp: string; brieftekst: string } {
  const profiel = toewijzing.profiel as PandenverkennerCopyProfiel;
  const object = input.objectomschrijving.trim();
  const onderwerp = object ? `Interesse in het pand aan ${object}` : 'Interesse in het pand';
  const pandRef = input.eigenaarBevestigd ? `uw pand aan ${object}` : `het pand aan ${object}`;
  const verkoopRef = input.eigenaarBevestigd ? 'dit pand' : 'het pand';
  const markt = marktzin(profiel);
  const regio = gebied(input.plaats);
  const aanhef = 'Geachte heer/mevrouw,';

  if (toewijzing.variantCode === 'B') {
    return {
      onderwerp,
      brieftekst: [
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam} van ${BITO_CONTACT.bedrijf}.`,
        '',
        `Voor relaties ben ik actief op zoek naar ${markt}${regio}. In dat kader neem ik contact op over ${pandRef}.`,
        '',
        `Speelt verkoop van ${verkoopRef}, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.`,
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
        '',
        'Met vriendelijke groet,',
        '',
        BITO_CONTACT.naam,
        BITO_CONTACT.functie,
        BITO_CONTACT.bedrijf,
        '',
        `T: ${BITO_CONTACT.telefoon}`,
        `E: ${BITO_CONTACT.email}`,
        `W: ${BITO_CONTACT.website}`,
      ].join('\n'),
    };
  }

  return {
    onderwerp,
    brieftekst: [
      aanhef,
      '',
      `Mijn naam is ${BITO_CONTACT.naam}, eigenaar van ${BITO_CONTACT.bedrijf}. Vanuit mijn kantoor begeleid ik professionele beleggers, ontwikkelaars en vastgoedondernemers bij de aan- en verkoop van vastgoed, vaak in discrete trajecten buiten het openbare aanbod.`,
      '',
      `Ik neem contact op naar aanleiding van ${pandRef}. Binnen mijn netwerk is regelmatig vraag naar ${markt}${regio}. Het object viel mij daarom op in mijn zoektocht.`,
      '',
      `Mocht verkoop van ${verkoopRef}, ander vastgoed of een bredere vastgoedportefeuille nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Een eerste gesprek kan uiteraard uitsluitend oriënterend zijn.`,
      '',
      'Speelt verkoop op dit moment niet, dan is dat uiteraard geen probleem. Ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
      '',
      'Ik hoor graag of er vragen zijn of interesse is.',
      '',
      'Met vriendelijke groet,',
      '',
      BITO_CONTACT.naam,
      BITO_CONTACT.functie,
      BITO_CONTACT.bedrijf,
      '',
      `T: ${BITO_CONTACT.telefoon}`,
      `E: ${BITO_CONTACT.email}`,
      `W: ${BITO_CONTACT.website}`,
    ].join('\n'),
  };
}
