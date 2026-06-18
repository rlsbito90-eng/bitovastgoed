// V2.2 — Strategieprofielen voor e-mail outreach binnen Brieven & opvolging.
//
// Belangrijk:
//   - Dit bestand bouwt UITSLUITEND e-mailtekst (concept, lokaal).
//   - Er wordt nergens een e-mail daadwerkelijk verstuurd.
//   - Geen externe mailservice, geen verzendprotocol, geen tracking.
//   - Geen netwerkverkeer vanuit dit bestand.

import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';

export type EmailProfiel =
  | 'splitsingspotentie'
  | 'kamerverhuur_verhuur_exploitatieoptimalisatie'
  | 'woonvorming'
  | 'transformatie_herontwikkeling'
  | 'ontwikkellocatie'
  | 'woon_winkelpand'
  | 'commercieel_vastgoed'
  | 'portefeuille'
  | 'algemene_acquisitie';

export const EMAIL_PROFIEL_LABEL: Record<EmailProfiel, string> = {
  splitsingspotentie: 'Splitsingspotentie',
  kamerverhuur_verhuur_exploitatieoptimalisatie:
    'Kamerverhuur / verhuur- & exploitatieoptimalisatie',
  woonvorming: 'Woonvorming',
  transformatie_herontwikkeling: 'Transformatie / herontwikkeling',
  ontwikkellocatie: 'Ontwikkellocatie',
  woon_winkelpand: 'Woon-/winkelpand',
  commercieel_vastgoed: 'Commercieel vastgoed',
  portefeuille: 'Portefeuille / meerdere objecten',
  algemene_acquisitie: 'Algemene acquisitie',
};

export const EMAIL_PROFIEL_VOLGORDE: EmailProfiel[] = [
  'splitsingspotentie',
  'kamerverhuur_verhuur_exploitatieoptimalisatie',
  'woonvorming',
  'transformatie_herontwikkeling',
  'ontwikkellocatie',
  'woon_winkelpand',
  'commercieel_vastgoed',
  'portefeuille',
  'algemene_acquisitie',
];

export type EmailStap = 'email_1' | 'email_2' | 'email_3';

export const EMAIL_STAP_VOLGORDE: EmailStap[] = ['email_1', 'email_2', 'email_3'];

export const EMAIL_STAP_LABEL: Record<EmailStap, string> = {
  email_1: 'E-mail 1',
  email_2: 'E-mail 2',
  email_3: 'E-mail 3',
};

/** Kanaal dat hoort bij een campagne-stap-string. */
export function kanaalVoorStap(stap: string | null | undefined): Kanaal {
  if (typeof stap === 'string' && stap.startsWith('email_')) return 'email';
  return 'post';
}

/** Default opvolgingstermijn in dagen per kanaal (post 21, e-mail 7). */
export function defaultFollowupDagen(kanaal: Kanaal | string | null | undefined): number {
  return kanaal === 'email' ? 7 : 21;
}

interface BriefAchtig {
  kanaal?: string | null;
  campagne_stap?: string | null;
  archived_at?: string | null;
  status?: string | null;
}

/**
 * Bepaal volgende e-mailstap voor één geadresseerde, **onafhankelijk** van
 * postbrieven. Telt actieve e-mailrecords (niet-gearchiveerd) op
 * `campagne_stap` met prefix `email_`.
 */
export function volgendeEmailStap(brieven: BriefAchtig[]): EmailStap {
  const gebruikt = new Set<string>();
  for (const b of brieven) {
    if (b.archived_at) continue;
    if ((b.kanaal ?? 'post') !== 'email') continue;
    if (typeof b.campagne_stap === 'string' && b.campagne_stap.startsWith('email_')) {
      gebruikt.add(b.campagne_stap);
    }
  }
  for (const s of EMAIL_STAP_VOLGORDE) {
    if (!gebruikt.has(s)) return s;
  }
  return 'email_3';
}

// ---------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------

export interface EmailTemplateContext {
  profiel: EmailProfiel;
  adres?: string | null;
  plaats?: string | null;
  geadresseerdeNaam?: string | null;
  bedrijfsnaam?: string | null;
}

export interface EmailTemplate {
  onderwerp: string;
  brieftekst: string;
}

const HANDTEKENING =
  'Met vriendelijke groet,\n' +
  '\n' +
  'Ramysh Bito\n' +
  'Eigenaar & Vastgoedadviseur\n' +
  'Bito Vastgoed\n' +
  'T: +31 6 16 98 76 06\n' +
  'E: info@bitovastgoed.nl\n' +
  'W: www.bitovastgoed.nl';

const BITO_PARAGRAAF =
  'Mijn naam is Ramysh Bito, vastgoedadviseur bij Bito Vastgoed. ' +
  'Wij begeleiden professionele vastgoedpartijen bij discrete aan- en verkooptrajecten ' +
  'van residentieel en commercieel vastgoed, vaak buiten de reguliere markt om.';

const CTA_PARAGRAAF =
  'Graag kom ik vrijblijvend met u in contact om te bespreken of verkoop, samenwerking ' +
  'of een bredere marktverkenning voor u interessant kan zijn. Ook wanneer verkoop op ' +
  'dit moment niet aan de orde is, denk ik graag mee over eventuele toekomstige ' +
  'mogelijkheden of andere objecten in portefeuille.\n' +
  '\n' +
  'Mocht u openstaan voor een korte kennismaking, dan hoor ik graag van u.';

function adresFragment(ctx: EmailTemplateContext): string {
  const a = (ctx.adres ?? '').trim();
  return a || '[adres]';
}

function plaatsFragment(ctx: EmailTemplateContext): string {
  const p = (ctx.plaats ?? '').trim();
  return p || '[plaats/wijk]';
}

function aanhef(ctx: EmailTemplateContext): string {
  // Bewust neutraal — gebruikers passen handmatig aan.
  const naam = (ctx.geadresseerdeNaam ?? '').trim();
  if (naam) return `Geachte heer/mevrouw ${naam.split(/\s+/).slice(-1)[0]},`;
  return 'Geachte heer/mevrouw,';
}

interface ProfielBody {
  onderwerp: (ctx: EmailTemplateContext) => string;
  intro: (ctx: EmailTemplateContext) => string;
  profielAlinea: (ctx: EmailTemplateContext) => string;
}

const PROFIELEN: Record<EmailProfiel, ProfielBody> = {
  splitsingspotentie: {
    onderwerp: (c) => `Vrijblijvende interesse in splitsingsproject ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar vastgoedkansen in ${plaatsFragment(c)} kwam ik het project aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type object — met splitsings- of uitpondingspotentie — sluit goed aan bij de zoekprofielen van professionele investeerders en ontwikkelaars binnen mijn netwerk.',
  },

  kamerverhuur_verhuur_exploitatieoptimalisatie: {
    onderwerp: (c) => `Vrijblijvende interesse in vastgoedobject ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar vastgoedkansen in ${plaatsFragment(c)} kwam ik het object aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type object kan interessant zijn voor professionele partijen die zoeken naar woonobjecten met ' +
      'verhuur-, herindelings-, verkamerings- of exploitatieoptimalisatiepotentie. Daarbij kan het gaan om ' +
      'leegstaande, deels verhuurde of reeds geëxploiteerde panden — verhuurpotentie en huuroptimalisatie ' +
      'spelen hierbij vaak een rol.',
  },

  woonvorming: {
    onderwerp: (c) => `Vrijblijvende interesse in woonvormingsproject ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar woonvormingsmogelijkheden in ${plaatsFragment(c)} kwam ik het object aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type object kan interessant zijn voor partijen die zoeken naar mogelijkheden voor het toevoegen ' +
      'van extra woningen, herindeling of vergunningstrajecten gericht op woningvorming.',
  },

  transformatie_herontwikkeling: {
    onderwerp: (c) => `Vrijblijvende interesse in ontwikkel-/transformatieobject ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar ontwikkel- en transformatiekansen in ${plaatsFragment(c)} kwam ik het object aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type vastgoed kan interessant zijn voor professionele partijen die zoeken naar herontwikkelings-, ' +
      'transformatie- of value-add kansen binnen residentieel of commercieel vastgoed.',
  },

  ontwikkellocatie: {
    onderwerp: (c) => `Vrijblijvende interesse in ontwikkellocatie ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar ontwikkellocaties in ${plaatsFragment(c)} kwam ik de positie aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type grond- of ontwikkelpositie kan interessant zijn voor partijen die actief zijn op het gebied ' +
      'van planvorming, sloop-nieuwbouw of grondposities binnen mijn netwerk.',
  },

  woon_winkelpand: {
    onderwerp: (c) => `Vrijblijvende interesse in woon-/winkelpand ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar mixed-use vastgoed in ${plaatsFragment(c)} kwam ik het pand aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type woon-/winkelpand met commerciële plint en wonen erboven sluit aan bij de zoekprofielen ' +
      'van partijen binnen mijn netwerk die actief zijn op centrum- en mixed-use locaties.',
  },

  commercieel_vastgoed: {
    onderwerp: (c) => `Vrijblijvende interesse in commercieel vastgoedobject ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar commercieel vastgoed in ${plaatsFragment(c)} kwam ik het object aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit type commercieel vastgoed — winkel, kantoor, bedrijfsruimte of light industrial — sluit aan ' +
      'bij de zoekprofielen van professionele partijen binnen mijn netwerk.',
  },

  portefeuille: {
    onderwerp: () => 'Vrijblijvende interesse in uw vastgoedportefeuille',
    intro: (c) =>
      `Tijdens mijn onderzoek naar vastgoedkansen in ${plaatsFragment(c)} kwam ik uw positie tegen, waaronder onder meer ${adresFragment(c)}.`,
    profielAlinea: () =>
      'Voor partijen met meerdere objecten of een bredere vastgoedportefeuille onderzoek ik regelmatig of ' +
      'er professionele koperinteresse kan zijn voor één of meerdere objecten, of voor de portefeuille als geheel.',
  },

  algemene_acquisitie: {
    onderwerp: (c) => `Vrijblijvende interesse in vastgoedobject ${adresFragment(c)}`,
    intro: (c) =>
      `Tijdens mijn onderzoek naar vastgoedkansen in ${plaatsFragment(c)} kwam ik het object aan ${adresFragment(c)} tegen.`,
    profielAlinea: () =>
      'Dit object sluit aan bij zoekprofielen van professionele partijen binnen mijn netwerk. Ik onderzoek ' +
      'discreet of er professionele koperinteresse kan zijn, buiten de reguliere markt om.',
  },
};

/**
 * Bouw onderwerp + brieftekst voor één e-mailprofiel.
 *
 * Geen externe calls, geen fetch, geen verzending — puur tekstcompositie.
 */
export function buildEmailTemplate(ctx: EmailTemplateContext): EmailTemplate {
  const p = PROFIELEN[ctx.profiel] ?? PROFIELEN.algemene_acquisitie;
  const lichaam = [
    aanhef(ctx),
    '',
    p.intro(ctx),
    '',
    p.profielAlinea(ctx),
    '',
    BITO_PARAGRAAF,
    '',
    CTA_PARAGRAAF,
    '',
    HANDTEKENING,
  ].join('\n');
  return { onderwerp: p.onderwerp(ctx), brieftekst: lichaam };
}
