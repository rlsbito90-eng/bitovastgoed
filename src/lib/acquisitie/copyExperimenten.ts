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
  code: 'B',
  naam: 'Kort/direct',
  hypothese: 'Een kortere, object- en splitsingsgerichte eerste brief met één laagdrempelige CTA verhoogt de kwalitatieve respons ten opzichte van de algemene controlebrief.',
  actief: true,
};

const SPLITSING_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Compact/direct',
  hypothese: 'Een compactere en directere follow-up met korte verwijzing naar Brief 1, één commerciële kernzin en één CTA verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons ten opzichte van de langere controle-follow-up.',
  actief: true,
};

const SPLITSING_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Compacte afsluiting',
  hypothese: 'Een compactere, strakker afrondende Brief 3 verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-A.',
  actief: true,
};

const WOONVORMING_BRIEF_1_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Kort/direct',
  hypothese: 'Een kortere, objectgerichte eerste brief die de woonvormingscontext slechts als aanleiding benoemt en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de meer uitleggevende controlevariant.',
  actief: true,
};

const WOONVORMING_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Compact/direct',
  hypothese: 'Een compactere follow-up die het eerdere contact kort benoemt, de woonvormingscontext niet opnieuw uitlegt en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-follow-up.',
  actief: true,
};

const WOONVORMING_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Compacte afsluiting',
  hypothese: 'Een compactere Brief 3 die minder terugblikt op de eerdere sequence en sneller naar de commerciële opening en rustige afronding gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-afsluiter.',
  actief: true,
};

const TRANSFORMATIE_BRIEF_1_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Kort/direct',
  hypothese: 'Een brief die het transformatie- of herontwikkelingssignaal kort als aanleiding benoemt zonder het te duiden en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de meer uitleggevende controlevariant.',
  actief: true,
};

const TRANSFORMATIE_BRIEF_2_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Compact/direct',
  hypothese: 'Een follow-up die het oorspronkelijke signaal niet herhaalt en direct doorgaat naar de vraag of verkoop speelt, verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons ten opzichte van de langere controle-follow-up.',
  actief: true,
};

const TRANSFORMATIE_BRIEF_3_VARIANT_B: CopyVariantDefinitie = {
  code: 'B',
  naam: 'Compacte afsluiting',
  hypothese: 'Een compactere Brief 3 die minder terugblikt op het oorspronkelijke signaal en sneller naar de commerciële opening en een rustige afronding gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-afsluiter.',
  actief: true,
};

/**
 * Algemene fallback blijft controle A. Alleen experimenten die inhoudelijk
 * gereed en expliciet geactiveerd zijn krijgen hier extra challengers.
 */
export const COPY_VARIANTEN: CopyVariantDefinitie[] = [CONTROLE_VARIANT];

function standaardVariantenVoorExperiment(args: {
  profiel: string;
  kanaal: Kanaal;
  campagneStap: string;
}): CopyVariantDefinitie[] {
  if (args.profiel === 'splitsingspotentie' && args.kanaal === 'post') {
    if (args.campagneStap === 'brief_1') return [CONTROLE_VARIANT, SPLITSING_BRIEF_1_VARIANT_B];
    if (args.campagneStap === 'brief_2') return [CONTROLE_VARIANT, SPLITSING_BRIEF_2_VARIANT_B];
    if (args.campagneStap === 'brief_3') return [CONTROLE_VARIANT, SPLITSING_BRIEF_3_VARIANT_B];
  }
  if (args.profiel === 'woonvorming' && args.kanaal === 'post') {
    if (args.campagneStap === 'brief_1') return [CONTROLE_VARIANT, WOONVORMING_BRIEF_1_VARIANT_B];
    if (args.campagneStap === 'brief_2') return [CONTROLE_VARIANT, WOONVORMING_BRIEF_2_VARIANT_B];
    if (args.campagneStap === 'brief_3') return [CONTROLE_VARIANT, WOONVORMING_BRIEF_3_VARIANT_B];
  }
  if (args.profiel === 'transformatie_herontwikkeling' && args.kanaal === 'post') {
    if (args.campagneStap === 'brief_1') return [CONTROLE_VARIANT, TRANSFORMATIE_BRIEF_1_VARIANT_B];
    if (args.campagneStap === 'brief_2') return [CONTROLE_VARIANT, TRANSFORMATIE_BRIEF_2_VARIANT_B];
    if (args.campagneStap === 'brief_3') return [CONTROLE_VARIANT, TRANSFORMATIE_BRIEF_3_VARIANT_B];
  }
  return COPY_VARIANTEN;
}

const schoon = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function bepaalPostCopyProfiel(signaal: Pick<OffMarketSignaal, 'vergunningtype' | 'potentiele_strategie' | 'assettype'>): string {
  const vergunning = schoon(signaal.vergunningtype);
  const strategie = schoon(signaal.potentiele_strategie);
  const asset = schoon(signaal.assettype);

  if (vergunning === 'splitsing' || strategie.includes('splits')) return 'splitsingspotentie';
  if (vergunning === 'woonvorming') return 'woonvorming';
  if (vergunning === 'omzetting') return 'kamerverhuur_verhuur_exploitatieoptimalisatie';
  if (vergunning === 'transformatie' || vergunning === 'functiewijziging' || strategie.includes('transform') || strategie.includes('herontwikk')) {
    return 'transformatie_herontwikkeling';
  }
  if (vergunning === 'ontwikkeling' || asset === 'ontwikkellocatie') return 'ontwikkellocatie';
  if (asset === 'woon_winkelpand' || asset === 'gemengd_vastgoed') return 'woon_winkelpand';
  if (asset === 'vastgoedportefeuille' || strategie.includes('portefeuille')) return 'portefeuille';
  if (['kantoor', 'winkelpand', 'bedrijfscomplex', 'light_industrial', 'logistiek'].includes(asset)) return 'commercieel_vastgoed';
  return 'algemene_acquisitie';
}

export function bepaalCopyProfiel(args: {
  signaal: Pick<OffMarketSignaal, 'vergunningtype' | 'potentiele_strategie' | 'assettype'>;
  kanaal: Kanaal;
  emailProfiel?: EmailProfiel | null;
}): string {
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
