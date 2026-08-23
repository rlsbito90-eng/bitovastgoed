import { BITO_CONTACT, bepaalOnderwerp, bouwBriefTekst } from '@/lib/offMarket/brief';
import type { CopyVariantToewijzing } from '@/lib/acquisitie/copyExperimenten';

export interface PostVariantTemplateInput {
  toewijzing: Pick<CopyVariantToewijzing, 'profiel' | 'variantKey' | 'variantCode'>;
  aanhef: string;
  objectomschrijving: string;
}

export interface PostVariantTemplate {
  onderwerp: string;
  brieftekst: string;
}

const SPLITSING_BRIEF_1_B_KEY = 'splitsingspotentie:post:brief_1:B';
const SPLITSING_BRIEF_2_A_KEY = 'splitsingspotentie:post:brief_2:A';
const SPLITSING_BRIEF_2_B_KEY = 'splitsingspotentie:post:brief_2:B';
const SPLITSING_BRIEF_3_A_KEY = 'splitsingspotentie:post:brief_3:A';

export function bouwPostVariantTemplate({
  toewijzing,
  aanhef,
  objectomschrijving,
}: PostVariantTemplateInput): PostVariantTemplate {
  const object = objectomschrijving.trim();

  if (toewijzing.variantKey === SPLITSING_BRIEF_2_A_KEY && toewijzing.variantCode === 'A') {
    const objectRef = object ? `het vastgoed aan ${object}` : 'uw vastgoed';
    const onderwerp = object
      ? `Nogmaals over het vastgoed aan ${object}`
      : 'Nogmaals over uw vastgoed';

    return {
      onderwerp,
      brieftekst: [
        aanhef,
        '',
        `Enige tijd geleden stuurde ik u een brief naar aanleiding van ${objectRef}. Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.`,
        '',
        'Het object sluit vanwege de mogelijke splitsings- of uitpondingspotentie aan bij vastgoed waar professionele beleggers en ontwikkelaars regelmatig naar zoeken.',
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook wanneer dit specifieke object niet speelt, maar u ander vastgoed of een bredere portefeuille heeft waarvoor verkoop of een marktverkenning relevant kan zijn, hoor ik dat graag.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
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

  if (toewijzing.variantKey === SPLITSING_BRIEF_2_B_KEY && toewijzing.variantCode === 'B') {
    const objectRef = object || 'uw vastgoed';
    const onderwerp = object
      ? `Uw pand aan ${object}`
      : 'Uw vastgoed';

    return {
      onderwerp,
      brieftekst: [
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}, onder meer vanwege de mogelijke splitsings- of uitpondingspotentie. Kort nogmaals, voor het geval mijn eerdere brief op een minder geschikt moment kwam.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Staat u daarvoor open? Een kort telefoongesprek of e-mail is voldoende.',
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

  if (toewijzing.variantKey === SPLITSING_BRIEF_3_A_KEY && toewijzing.variantCode === 'A') {
    const objectRef = object ? `het vastgoed aan ${object}` : 'uw vastgoed';
    const onderwerp = object
      ? `Over uw pand aan ${object}`
      : 'Over uw vastgoed';

    return {
      onderwerp,
      brieftekst: [
        aanhef,
        '',
        `Ik neem nog één keer kort contact met u op naar aanleiding van ${objectRef}. Eerder schreef ik u hierover vanwege de mogelijke splitsings- of uitpondingspotentie.`,
        '',
        'Mocht verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Als dit op dit moment niet speelt, laat ik het voor nu hierbij. Mocht dat in de toekomst veranderen, dan weet u mij uiteraard te vinden.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
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

  if (toewijzing.variantKey !== SPLITSING_BRIEF_1_B_KEY || toewijzing.variantCode !== 'B') {
    return {
      onderwerp: bepaalOnderwerp(objectomschrijving),
      brieftekst: bouwBriefTekst({ aanhef, objectadres: objectomschrijving }),
    };
  }

  const objectZin = object
    ? `Ik neem contact met u op naar aanleiding van het vastgoed aan ${object}.`
    : 'Ik neem contact met u op naar aanleiding van uw vastgoedbezit.';

  const onderwerp = object
    ? `Interesse in het vastgoed aan ${object}`
    : 'Interesse in uw vastgoed';

  return {
    onderwerp,
    brieftekst: [
      aanhef,
      '',
      `Mijn naam is ${BITO_CONTACT.naam}, eigenaar van ${BITO_CONTACT.bedrijf}. ${objectZin}`,
      '',
      'Dit type object, met mogelijke splitsings- of uitpondingspotentie, sluit aan bij vastgoed waar professionele beleggers en ontwikkelaars regelmatig naar zoeken.',
      '',
      'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Dit geldt overigens niet alleen voor dit object: mocht u ander vastgoed of een bredere portefeuille hebben waarvoor verkoop of een marktverkenning relevant kan zijn, dan hoor ik dat eveneens graag.',
      '',
      'Indien verkoop op dit moment niet speelt, is dat uiteraard geen probleem. Ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
      '',
      'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
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
