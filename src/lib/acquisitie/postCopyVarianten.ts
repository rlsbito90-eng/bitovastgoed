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

export function bouwPostVariantTemplate({
  toewijzing,
  aanhef,
  objectomschrijving,
}: PostVariantTemplateInput): PostVariantTemplate {
  if (toewijzing.variantKey !== SPLITSING_BRIEF_1_B_KEY || toewijzing.variantCode !== 'B') {
    return {
      onderwerp: bepaalOnderwerp(objectomschrijving),
      brieftekst: bouwBriefTekst({ aanhef, objectadres: objectomschrijving }),
    };
  }

  const object = objectomschrijving.trim();
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
