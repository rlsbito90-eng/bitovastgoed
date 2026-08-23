import type { EmailProfiel } from '@/lib/offMarket/email/emailProfielen';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';

export type CopyVariantCode = 'A' | 'B' | 'C' | 'D';

export interface CopyVariantDefinitie {
  code: CopyVariantCode;
  naam: string;
  hypothese: string;
  actief: boolean;
}

export interface CopyVariantToewijzing {
  profiel: string;
  variantKey: string;
  variantCode: CopyVariantCode;
  variantNaam: string;
  hypothese: string;
}

const CONTROLE_VARIANT: CopyVariantDefinitie = {
  code: 'A',
  naam: 'Controle',
  hypothese: 'Huidige standaardtekst als controlevariant.',
  actief: true,
};

const SPLITSING_BRIEF_1_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Kort/direct', actief: true,
  hypothese: 'Een kortere, object- en splitsingsgerichte eerste brief met één laagdrempelige CTA verhoogt de kwalitatieve respons ten opzichte van de algemene controlebrief.',
};
const SPLITSING_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compact/direct', actief: true,
  hypothese: 'Een compactere en directere follow-up met korte verwijzing naar Brief 1, één commerciële kernzin en één CTA verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons ten opzichte van de langere controle-follow-up.',
};
const SPLITSING_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compacte afsluiting', actief: true,
  hypothese: 'Een compactere, strakker afrondende Brief 3 verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-A.',
};

const WOONVORMING_BRIEF_1_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Kort/direct', actief: true,
  hypothese: 'Een kortere, objectgerichte eerste brief die de woonvormingscontext slechts als aanleiding benoemt en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de meer uitleggevende controlevariant.',
};
const WOONVORMING_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compact/direct', actief: true,
  hypothese: 'Een compactere follow-up die het eerdere contact kort benoemt, de woonvormingscontext niet opnieuw uitlegt en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-follow-up.',
};
const WOONVORMING_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compacte afsluiting', actief: true,
  hypothese: 'Een compactere Brief 3 die minder terugblikt op de eerdere sequence en sneller naar de commerciële opening en rustige afronding gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-afsluiter.',
};

const KAMERVERHUUR_BRIEF_1_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Kort/direct', actief: true,
  hypothese: 'Een kortere eerste brief die het omzettings- of kamerverhuursignaal feitelijk benoemt en sneller naar de verkoopvraag gaat, verhoogt de kwalitatieve verkopersrespons.',
};
const KAMERVERHUUR_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compact/direct', actief: true,
  hypothese: 'Een korte follow-up die alleen naar het eerdere contact verwijst en de vergunning niet opnieuw uitlegt, verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.',
};
const KAMERVERHUUR_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compacte afsluiting', actief: true,
  hypothese: 'Een korte, rustige laatste follow-up verhoogt de kans op reactie zonder de eigenaar onnodig onder druk te zetten.',
};

const TRANSFORMATIE_BRIEF_1_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Kort/direct', actief: true,
  hypothese: 'Een brief die het transformatie- of herontwikkelingssignaal kort als aanleiding benoemt zonder het te duiden en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de meer uitleggevende controlevariant.',
};
const TRANSFORMATIE_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compact/direct', actief: true,
  hypothese: 'Een follow-up die het oorspronkelijke signaal niet herhaalt en direct doorgaat naar de vraag of verkoop speelt, verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons ten opzichte van de langere controle-follow-up.',
};
const TRANSFORMATIE_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B', naam: 'Compacte afsluiting', actief: true,
  hypothese: 'Een compactere Brief 3 die minder terugblikt op het oorspronkelijke signaal en sneller naar de commerciële opening en een rustige afronding gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-afsluiter.',
};

export const COPY_VARIANTEN: CopyVariantDefinitie[] = [CONTROLE_VARIANT];

function standaardVariantenVoorExperiment(args: { profiel: string; kanaal: Kanaal; campagneStap: string }): CopyVariantDefinitie[] {
  if (args.kanaal !== 'post') return COPY_VARIANTEN;

  const perProfiel: Record<string, Record<string, CopyVariantDefinitie>> = {
    splitsingspotentie: {
      brief_1: SPLITSING_BRIEF_1_VARIANT_B,
      brief_2: SPLITSING_BRIEF_2_VARIANT_B,
      brief_3: SPLITSING_BRIEF_3_VARIANT_B,
    },
    woonvorming: {
      brief_1: WOONVORMING_BRIEF_1_VARIANT_B,
      brief_2: WOONVORMING_BRIEF_2_VARIANT_B,
      brief_3: WOONVORMING_BRIEF_3_VARIANT_B,
    },
    kamerverhuur_verhuur_exploitatieoptimalisatie: {
      brief_1: KAMERVERHUUR_BRIEF_1_VARIANT_B,
      brief_2: KAMERVERHUUR_BRIEF_2_VARIANT_B,
      brief_3: KAMERVERHUUR_BRIEF_3_VARIANT_B,
    },
    transformatie_herontwikkeling: {
      brief_1: TRANSFORMATIE_BRIEF_1_VARIANT_B,
      brief_2: TRANSFORMATIE_BRIEF_2_VARIANT_B,
      brief_3: TRANSFORMATIE_BRIEF_3_VARIANT_B,
    },
  };

  const challenger = perProfiel[args.profiel]?.[args.campagneStap];
  return challenger ? [CONTROLE_VARIANT, challenger] : COPY_VARIANTEN;
}

const schoon = (v: unknown) => String(v ?? '').trim().toLowerCase();

type PostCopySignaal = Pick<
  OffMarketSignaal,
  'vergunningtype' | 'potentiele_strategie' | 'assettype' | 'titel' | 'omschrijving'
>;

const SPLITSING_TEKST = /\b(?:splitsingsvergunning|appartementensplitsing|kadastrale\s+splitsing|juridische\s+splitsing|(?:bouwkundig\s+)?splitsen)\b/i;
const WOONVORMING_TEKST = /\b(?:woonvormingsvergunning|woonvorming|woningvorming)\b/i;
const KAMERVERHUUR_TEKST = /\b(?:omzettingsvergunning|kamerverhuur(?:vergunning)?|kamergewijze(?:\s+verhuur)?|woningdelen|onzelfstandige\s+woonruimte)\b/i;
const TRANSFORMATIE_TEKST = /\b(?:transformatie|transformeren|herontwikkeling|herontwikkelen|functiewijziging|gebruikswijziging|wijzigen\s+(?:van\s+)?(?:het\s+)?gebruik|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen)\b/i;
const VERBOUW_NAAR_WONEN_TEKST = /\b(?:verbouwen|veranderen|vergroten|herverdelen|omvormen)\b.{0,80}\b(?:naar|tot|in)\b.{0,50}\b(?:appartement(?:en)?|woning(?:en)?|woonruimte(?:n)?|studio'?s)\b/i;
const ONTWIKKELING_TEKST = /\b(?:nieuwbouw|woningbouwproject|projectontwikkeling|gebiedsontwikkeling|ontwikkellocatie|bouwen\s+van|oprichten|realiseren\s+van\s+(?:\d+\s+)?(?:woongebouwen?|woningen?|appartementen?|studio'?s|units)|cre[eë]ren\s+van\s+(?:\d+\s+)?appartementen?)\b/i;

export function bepaalPostCopyProfiel(signaal: PostCopySignaal): string {
  const vergunning = schoon(signaal.vergunningtype);
  const strategie = schoon(signaal.potentiele_strategie);
  const asset = schoon(signaal.assettype);
  const tekst = `${schoon(signaal.titel)} ${schoon(signaal.omschrijving)}`.trim();

  if (vergunning === 'splitsing' || strategie.includes('splits') || SPLITSING_TEKST.test(tekst)) return 'splitsingspotentie';
  if (vergunning === 'woonvorming' || WOONVORMING_TEKST.test(tekst)) return 'woonvorming';
  if (vergunning === 'omzetting' || KAMERVERHUUR_TEKST.test(tekst)) return 'kamerverhuur_verhuur_exploitatieoptimalisatie';
  if (
    vergunning === 'transformatie'
    || vergunning === 'functiewijziging'
    || strategie.includes('transform')
    || strategie.includes('herontwikk')
    || asset === 'transformatieobject'
    || TRANSFORMATIE_TEKST.test(tekst)
    || VERBOUW_NAAR_WONEN_TEKST.test(tekst)
  ) return 'transformatie_herontwikkeling';

  if (asset === 'ontwikkellocatie' || ONTWIKKELING_TEKST.test(tekst) || (vergunning === 'ontwikkeling' && !tekst)) {
    return 'ontwikkellocatie';
  }
  if (asset === 'woon_winkelpand' || asset === 'gemengd_vastgoed') return 'woon_winkelpand';
  if (asset === 'vastgoedportefeuille' || strategie.includes('portefeuille')) return 'portefeuille';
  if (['kantoor', 'winkelpand', 'bedrijfscomplex', 'light_industrial', 'logistiek'].includes(asset)) return 'commercieel_vastgoed';
  return 'algemene_acquisitie';
}

export function bepaalCopyProfiel(args: { signaal: PostCopySignaal; kanaal: Kanaal; emailProfiel?: EmailProfiel | null }): string {
  if (args.kanaal === 'email' && args.emailProfiel) return args.emailProfiel;
  return bepaalPostCopyProfiel(args.signaal);
}

function stabieleHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function kiesCopyVariant(args: {
  profiel: string;
  kanaal: Kanaal;
  campagneStap: string;
  signaalId: string;
  geadresseerdeKey?: string | null;
  varianten?: CopyVariantDefinitie[];
}): CopyVariantToewijzing {
  const bron = args.varianten ?? standaardVariantenVoorExperiment(args);
  const actief = bron.filter(v => v.actief);
  const kandidaten = actief.length > 0 ? actief : [CONTROLE_VARIANT];
  const identiteit = [args.signaalId, args.geadresseerdeKey ?? '', args.kanaal, args.campagneStap, args.profiel].join('|');
  const gekozen = kandidaten[stabieleHash(identiteit) % kandidaten.length];
  const variantKey = `${args.profiel}:${args.kanaal}:${args.campagneStap}:${gekozen.code}`;
  return {
    profiel: args.profiel,
    variantKey,
    variantCode: gekozen.code,
    variantNaam: gekozen.naam,
    hypothese: gekozen.hypothese,
  };
}

export const COPY_PROFIEL_LABEL: Record<string, string> = {
  splitsingspotentie: 'Splitsingspotentie',
  kamerverhuur_verhuur_exploitatieoptimalisatie: 'Kamerverhuur / exploitatie',
  woonvorming: 'Woonvorming',
  transformatie_herontwikkeling: 'Transformatie / herontwikkeling',
  ontwikkellocatie: 'Ontwikkellocatie',
  woon_winkelpand: 'Woon-/winkelpand',
  commercieel_vastgoed: 'Commercieel vastgoed',
  portefeuille: 'Portefeuille',
  algemene_acquisitie: 'Algemene acquisitie',
};

export function copyProfielLabel(profiel: string | null | undefined): string {
  if (!profiel) return 'Onbekend profiel';
  return COPY_PROFIEL_LABEL[profiel] ?? profiel;
}
