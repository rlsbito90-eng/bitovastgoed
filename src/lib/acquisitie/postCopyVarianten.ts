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

const key = (profiel: string, stap: number, variant: 'A' | 'B') => `${profiel}:post:brief_${stap}:${variant}`;

const SPLITSING = 'splitsingspotentie';
const WOONVORMING = 'woonvorming';
const KAMERVERHUUR = 'kamerverhuur_verhuur_exploitatieoptimalisatie';
const TRANSFORMATIE = 'transformatie_herontwikkeling';

function metHandtekening(regels: string[]): string {
  return [
    ...regels,
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
  ].join('\n');
}

function isVariant(
  toewijzing: PostVariantTemplateInput['toewijzing'],
  profiel: string,
  stap: number,
  variant: 'A' | 'B',
): boolean {
  return toewijzing.variantKey === key(profiel, stap, variant) && toewijzing.variantCode === variant;
}

function woonvormingTemplate(
  toewijzing: PostVariantTemplateInput['toewijzing'],
  aanhef: string,
  object: string,
): PostVariantTemplate | null {
  const objectRef = object || 'uw vastgoed';

  if (isVariant(toewijzing, WOONVORMING, 1, 'A')) {
    return {
      onderwerp: object ? `Interesse in uw pand aan ${object}` : 'Interesse in uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam}, eigenaar van ${BITO_CONTACT.bedrijf}. Ik neem contact met u op naar aanleiding van het vastgoed aan ${objectRef}.`,
        '',
        'Rond het object is een woonvormingsontwikkeling of -vergunning gesignaleerd. Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen, maar dit soort situaties kan samengaan met een bredere vastgoedbeslissing of herpositionering.',
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Dit geldt ook wanneer u ander vastgoed of een bredere portefeuille heeft waarvoor verkoop of een marktverkenning relevant kan zijn.',
        '',
        'Indien verkoop op dit moment niet speelt, is dat uiteraard geen probleem. Ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, WOONVORMING, 1, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam} van ${BITO_CONTACT.bedrijf}. Rond ${objectRef} is een woonvormingsontwikkeling of -vergunning gesignaleerd — dat is voor mij de aanleiding om contact met u op te nemen.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact. Speelt dit niet, dan is dat uiteraard geen probleem; ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, WOONVORMING, 2, 'A')) {
    return {
      onderwerp: object ? `Nogmaals over uw pand aan ${object}` : 'Nogmaals over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}, naar aanleiding van een woonvormingsontwikkeling of -vergunning rond het object. Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.`,
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook wanneer dit specifieke object niet speelt, maar ander vastgoed of een bredere portefeuille mogelijk relevant is, hoor ik dat graag.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, WOONVORMING, 2, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}. Kort nogmaals, voor het geval mijn eerdere brief op een minder geschikt moment kwam.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, WOONVORMING, 3, 'A')) {
    return {
      onderwerp: object ? `Over uw pand aan ${object}` : 'Over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik neem nog één keer kort contact met u op over ${objectRef}. Eerder schreef ik u hierover naar aanleiding van een woonvormingsontwikkeling of -vergunning rond het object.`,
        '',
        'Mocht verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Als dit op dit moment niet speelt, laat ik het voor nu hierbij. Mocht dat in de toekomst veranderen, dan weet u mij uiteraard te vinden.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, WOONVORMING, 3, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik kom nog even terug op ${objectRef}, waarover ik u eerder schreef.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Speelt dit op dit moment niet, dan laat ik het voor nu rusten. Verandert dat op een later moment, dan weet u mij te vinden.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  return null;
}

function kamerverhuurTemplate(
  toewijzing: PostVariantTemplateInput['toewijzing'],
  aanhef: string,
  object: string,
): PostVariantTemplate | null {
  const objectRef = object || 'uw vastgoed';

  if (isVariant(toewijzing, KAMERVERHUUR, 1, 'A')) {
    return {
      onderwerp: object ? `Interesse in uw pand aan ${object}` : 'Interesse in uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam}, eigenaar van ${BITO_CONTACT.bedrijf}. Ik neem contact met u op naar aanleiding van het vastgoed aan ${objectRef}.`,
        '',
        'Rond het object is een vergunning of ontwikkeling gesignaleerd die betrekking heeft op omzetting, kamerverhuur of woningdelen. Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen, maar vormt voor mij wel een concrete aanleiding om vrijblijvend contact met u te zoeken.',
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Dit geldt ook wanneer u ander vastgoed of een bredere portefeuille heeft waarvoor verkoop of een marktverkenning relevant kan zijn.',
        '',
        'Indien verkoop op dit moment niet speelt, is dat uiteraard geen probleem. Ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, KAMERVERHUUR, 1, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam} van ${BITO_CONTACT.bedrijf}. Rond ${objectRef} is een vergunning of ontwikkeling rond omzetting, kamerverhuur of woningdelen gesignaleerd — dat is voor mij de aanleiding om contact met u op te nemen.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact. Speelt dit niet, dan is dat uiteraard geen probleem; ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, KAMERVERHUUR, 2, 'A')) {
    return {
      onderwerp: object ? `Nogmaals over uw pand aan ${object}` : 'Nogmaals over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}, naar aanleiding van een vergunning of ontwikkeling rond omzetting, kamerverhuur of woningdelen. Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.`,
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook wanneer dit specifieke object niet speelt, maar ander vastgoed of een bredere portefeuille mogelijk relevant is, hoor ik dat graag.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, KAMERVERHUUR, 2, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}. Kort nogmaals, voor het geval mijn eerdere brief op een minder geschikt moment kwam.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, KAMERVERHUUR, 3, 'A')) {
    return {
      onderwerp: object ? `Over uw pand aan ${object}` : 'Over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik neem nog één keer kort contact met u op over ${objectRef}. Eerder schreef ik u hierover naar aanleiding van een vergunning of ontwikkeling rond omzetting, kamerverhuur of woningdelen.`,
        '',
        'Mocht verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Als dit op dit moment niet speelt, laat ik het voor nu hierbij. Mocht dat in de toekomst veranderen, dan weet u mij uiteraard te vinden.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, KAMERVERHUUR, 3, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik kom nog even terug op ${objectRef}, waarover ik u eerder schreef.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Speelt dit op dit moment niet, dan laat ik het voor nu rusten. Verandert dat op een later moment, dan weet u mij te vinden.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  return null;
}

function transformatieTemplate(
  toewijzing: PostVariantTemplateInput['toewijzing'],
  aanhef: string,
  object: string,
): PostVariantTemplate | null {
  const objectRef = object || 'uw vastgoed';

  if (isVariant(toewijzing, TRANSFORMATIE, 1, 'A')) {
    const objectZin = object
      ? `Ik neem contact met u op naar aanleiding van het vastgoed aan ${object}.`
      : 'Ik neem contact met u op naar aanleiding van uw vastgoedbezit.';
    return {
      onderwerp: object ? `Interesse in uw pand aan ${object}` : 'Interesse in uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam}, eigenaar van ${BITO_CONTACT.bedrijf}. ${objectZin}`,
        '',
        'Rond het object is een ontwikkeling of vergunning gesignaleerd die betrekking heeft op transformatie, functiewijziging of herontwikkeling. Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen, maar vormt voor mij wel een aanleiding om vrijblijvend contact met u te zoeken.',
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Dit geldt ook wanneer u ander vastgoed of een bredere portefeuille heeft waarvoor verkoop of een marktverkenning relevant kan zijn.',
        '',
        'Indien verkoop op dit moment niet speelt, is dat uiteraard geen probleem. Ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, TRANSFORMATIE, 1, 'B')) {
    return {
      onderwerp: object ? `${object} — vraag over de mogelijkheden` : 'Vraag over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Mijn naam is ${BITO_CONTACT.naam} van ${BITO_CONTACT.bedrijf}. Rond ${objectRef} is een ontwikkeling of vergunning gesignaleerd met betrekking tot transformatie, functiewijziging of herontwikkeling — dat is voor mij de aanleiding om contact met u op te nemen.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact. Speelt dit niet, dan is dat uiteraard geen probleem; ik houd het graag laagdrempelig en kom eventueel op een later moment nog eens bij u terug.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, TRANSFORMATIE, 2, 'A')) {
    return {
      onderwerp: object ? `Nogmaals over uw pand aan ${object}` : 'Nogmaals over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}, naar aanleiding van een ontwikkeling of vergunning rond transformatie, functiewijziging of herontwikkeling. Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.`,
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook wanneer dit specifieke object niet speelt, maar ander vastgoed of een bredere portefeuille mogelijk relevant is, hoor ik dat graag.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, TRANSFORMATIE, 2, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}. Kort nogmaals, voor het geval mijn eerdere brief op een minder geschikt moment kwam.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, TRANSFORMATIE, 3, 'A')) {
    return {
      onderwerp: object ? `Over uw pand aan ${object}` : 'Over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik neem nog één keer kort contact met u op over ${objectRef}. Eerder schreef ik u hierover naar aanleiding van een ontwikkeling of vergunning die betrekking heeft op transformatie, functiewijziging of herontwikkeling.`,
        '',
        'Mocht verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Als dit op dit moment niet speelt, laat ik het voor nu hierbij. Mocht dat in de toekomst veranderen, dan weet u mij uiteraard te vinden.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, TRANSFORMATIE, 3, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik kom nog even terug op ${objectRef}, waarover ik u eerder schreef.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag met u in contact.',
        '',
        'Speelt dit op dit moment niet, dan laat ik het hierbij voor nu rusten. Verandert dat op een later moment, dan weet u mij te vinden.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  return null;
}

function splitsingTemplate(
  toewijzing: PostVariantTemplateInput['toewijzing'],
  aanhef: string,
  object: string,
): PostVariantTemplate | null {
  const objectRef = object || 'uw vastgoed';

  if (isVariant(toewijzing, SPLITSING, 2, 'A')) {
    const vastgoedRef = object ? `het vastgoed aan ${object}` : 'uw vastgoed';
    return {
      onderwerp: object ? `Nogmaals over het vastgoed aan ${object}` : 'Nogmaals over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden stuurde ik u een brief naar aanleiding van ${vastgoedRef}. Mogelijk kwam mijn eerdere bericht op een minder geschikt moment, daarom neem ik kort opnieuw contact met u op.`,
        '',
        'Het object sluit vanwege de mogelijke splitsings- of uitpondingspotentie aan bij vastgoed waar professionele beleggers en ontwikkelaars regelmatig naar zoeken.',
        '',
        'Mocht verkoop van dit pand nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact. Ook wanneer dit specifieke object niet speelt, maar u ander vastgoed of een bredere portefeuille heeft waarvoor verkoop of een marktverkenning relevant kan zijn, hoor ik dat graag.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, SPLITSING, 2, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Enige tijd geleden schreef ik u over ${objectRef}, onder meer vanwege de mogelijke splitsings- of uitpondingspotentie. Kort nogmaals, voor het geval mijn eerdere brief op een minder geschikt moment kwam.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Staat u daarvoor open? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, SPLITSING, 3, 'A')) {
    const vastgoedRef = object ? `het vastgoed aan ${object}` : 'uw vastgoed';
    return {
      onderwerp: object ? `Over uw pand aan ${object}` : 'Over uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Ik neem nog één keer kort contact met u op naar aanleiding van ${vastgoedRef}. Eerder schreef ik u hierover vanwege de mogelijke splitsings- of uitpondingspotentie.`,
        '',
        'Mocht verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn bespreekbaar zijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Als dit op dit moment niet speelt, laat ik het voor nu hierbij. Mocht dat in de toekomst veranderen, dan weet u mij uiteraard te vinden.',
        '',
        'Staat u open voor een korte kennismaking, dan hoor ik graag van u.',
      ]),
    };
  }

  if (isVariant(toewijzing, SPLITSING, 3, 'B')) {
    return {
      onderwerp: object ? `Uw pand aan ${object}` : 'Uw vastgoed',
      brieftekst: metHandtekening([
        aanhef,
        '',
        `Nog één keer kort over ${objectRef}, gezien de mogelijke splitsings- of uitpondingspotentie ervan.`,
        '',
        'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
        '',
        'Speelt dit op dit moment niet, dan laat ik het voor nu rusten. Verandert dat op een later moment, dan weet u mij te vinden.',
        '',
        'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      ]),
    };
  }

  if (isVariant(toewijzing, SPLITSING, 1, 'B')) {
    const objectZin = object
      ? `Ik neem contact met u op naar aanleiding van het vastgoed aan ${object}.`
      : 'Ik neem contact met u op naar aanleiding van uw vastgoedbezit.';
    return {
      onderwerp: object ? `Interesse in het vastgoed aan ${object}` : 'Interesse in uw vastgoed',
      brieftekst: metHandtekening([
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
      ]),
    };
  }

  return null;
}

export function bouwPostVariantTemplate({
  toewijzing,
  aanhef,
  objectomschrijving,
}: PostVariantTemplateInput): PostVariantTemplate {
  const object = objectomschrijving.trim();

  const specifiek =
    splitsingTemplate(toewijzing, aanhef, object)
    ?? woonvormingTemplate(toewijzing, aanhef, object)
    ?? kamerverhuurTemplate(toewijzing, aanhef, object)
    ?? transformatieTemplate(toewijzing, aanhef, object);

  if (specifiek) return specifiek;

  return {
    onderwerp: bepaalOnderwerp(objectomschrijving),
    brieftekst: bouwBriefTekst({ aanhef, objectadres: objectomschrijving }),
  };
}
