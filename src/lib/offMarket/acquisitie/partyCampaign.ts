import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export type PartyMatchStatus = 'bevestigd' | 'mogelijk_dezelfde_partij' | 'onbekend';
export type CampaignContactStatus = 'cold' | 'not_now' | 'not_interested' | 'do_not_contact' | 'warm';
export type CampaignStatus = 'actief' | 'gepauzeerd' | 'afgerond_geen_reactie' | 'warm' | 'afgesloten';
export type CampaignRoutingOutcome =
  | 'nieuwe_campagne_brief_1'
  | 'bundelen_bij_partij'
  | 'meenemen_in_vervolgbrief'
  | 'gespreksonderwerp'
  | 'alleen_registreren'
  | 'herbenadering_voorstellen'
  | 'benadering_bepalen'
  | 'niet_benaderen';

export interface PartyIdentity {
  eigenaarId: string | null;
  partijType?: 'natuurlijk_persoon' | 'rechtspersoon' | 'onbekend';
  crmRelatieId?: string | null;
  naam?: string | null;
  bedrijfsnaam?: string | null;
  matchStatus: PartyMatchStatus;
  matchReden?: string | null;
}

export interface CampaignSnapshot {
  id: string;
  eigenaarId: string;
  doelstelling: string;
  status: CampaignStatus;
  contactStatus: CampaignContactStatus;
  huidigeStap: 'brief_1' | 'brief_2' | 'brief_3' | 'persoonlijk' | null;
  laatsteKoudeContactOp: string | null;
  herbenaderenVanaf: string | null;
  cooldownMaanden: number;
  primarySignaalId: string | null;
}

export interface ObjectScore {
  score: number;
  redenen: string[];
  betrouwbaarheid: 'hoog' | 'middel' | 'laag';
}

export interface RoutingInput {
  signaal: OffMarketSignaal;
  partij: PartyIdentity;
  campagne: CampaignSnapshot | null;
  partijBrieven: OffMarketBrief[];
  partijSignalen?: OffMarketSignaal[];
  vandaag?: Date;
  defaultCooldownMaanden?: number;
  primarySwitchThreshold?: number;
}

export interface RoutingResult {
  outcome: CampaignRoutingOutcome;
  werkvoorraadStatus: 'actief' | 'gebundeld_bij_partij' | 'eerder_benaderd' | 'benadering_bepalen' | 'niet_benaderen';
  reden: string;
  briefAdvies: 'objectbrief' | 'portefeuillebrief' | 'geen_brief' | 'handmatig_beoordelen';
  geadviseerdeStap: 'brief_1' | 'brief_2' | 'brief_3' | null;
  magAutomatischBriefMaken: boolean;
  magHandmatigBriefMaken: boolean;
  nieuwHoofdobjectVoorstellen: boolean;
  huidigObjectScore: ObjectScore | null;
  nieuwObjectScore: ObjectScore;
}

const WARME_SIGNAALSTATUSSEN = new Set([
  'in_gesprek', 'aanbod_ontvangen', 'object_ontvangen', 'dealtraject',
]);

const POSITIEVE_RESPONS = new Set([
  'interesse', 'wil_meer_informatie', 'gesprek_gepland', 'reactie_ontvangen',
]);

function datum(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}

export function scoreRadarObject(signaal: OffMarketSignaal): ObjectScore {
  const a = signaal as any;
  let score = 0;
  const redenen: string[] = [];

  const ai = Number(a.ai_relevantie_score ?? a.relevantie_score ?? NaN);
  if (Number.isFinite(ai)) {
    const genormaliseerd = ai <= 1 ? ai * 100 : ai;
    score += Math.max(0, Math.min(45, genormaliseerd * 0.45));
    redenen.push(`bestaande relevantiescore ${Math.round(genormaliseerd)}`);
  }

  const prioriteit = String(a.prioriteit ?? '').toLowerCase();
  const prioriteitPunten: Record<string, number> = { urgent: 20, hoog: 15, midden: 8, laag: 3 };
  if (prioriteitPunten[prioriteit] != null) {
    score += prioriteitPunten[prioriteit];
    redenen.push(`prioriteit ${prioriteit}`);
  }

  const vergunning = String(a.vergunningtype ?? a.vergunning_type ?? '').toLowerCase();
  const type = String(a.type_signaal ?? '').toLowerCase();
  const strategie = String(a.potentiele_strategie ?? '').toLowerCase();
  const tekst = `${vergunning} ${type} ${strategie}`;
  if (/transformatie|functiewijzig|ontwikkeling|herontwikkeling/.test(tekst)) {
    score += 18;
    redenen.push('concrete transformatie-/ontwikkelaanleiding');
  } else if (/splits|woonvorming|uitpond/.test(tekst)) {
    score += 15;
    redenen.push('splitsings-/uitpondingsaanleiding');
  } else if (/vergunning|bekendmaking/.test(tekst)) {
    score += 10;
    redenen.push('concrete vergunning/bekendmaking');
  }

  const bronBetrouwbaarheid = Number(a.bron_betrouwbaarheid ?? a.ai_confidence ?? NaN);
  if (Number.isFinite(bronBetrouwbaarheid)) {
    const b = bronBetrouwbaarheid <= 1 ? bronBetrouwbaarheid * 100 : bronBetrouwbaarheid;
    score += Math.max(0, Math.min(10, b * 0.1));
    redenen.push(`bronbetrouwbaarheid ${Math.round(b)}`);
  }

  const eventDatum = datum(a.publicatiedatum ?? a.signaal_datum ?? a.created_at);
  if (eventDatum) {
    const dagen = Math.max(0, (Date.now() - eventDatum) / 86_400_000);
    if (dagen <= 30) { score += 7; redenen.push('zeer actueel'); }
    else if (dagen <= 90) { score += 4; redenen.push('actueel'); }
  }

  const betrouwbaarheid: ObjectScore['betrouwbaarheid'] =
    redenen.length >= 4 ? 'hoog' : redenen.length >= 2 ? 'middel' : 'laag';

  return {
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    redenen,
    betrouwbaarheid,
  };
}

function hoogsteVerstuurdeStap(brieven: OffMarketBrief[]): 'brief_1' | 'brief_2' | 'brief_3' | null {
  const rang: Record<string, number> = { brief_1: 1, brief_2: 2, brief_3: 3 };
  let beste: 'brief_1' | 'brief_2' | 'brief_3' | null = null;
  for (const b of brieven) {
    if (b.status !== 'verstuurd') continue;
    const stap = b.campagne_stap as string | null;
    if (!stap || !(stap in rang)) continue;
    if (!beste || rang[stap] > rang[beste]) beste = stap as any;
  }
  return beste;
}

function volgendeStap(stap: 'brief_1' | 'brief_2' | 'brief_3' | null): 'brief_1' | 'brief_2' | 'brief_3' | null {
  if (!stap) return 'brief_1';
  if (stap === 'brief_1') return 'brief_2';
  if (stap === 'brief_2') return 'brief_3';
  return null;
}

function heeftWarmeHistorie(brieven: OffMarketBrief[], signalen: OffMarketSignaal[]): boolean {
  if (brieven.some((b) => POSITIEVE_RESPONS.has(String(b.responsstatus ?? '')))) return true;
  return signalen.some((s) => WARME_SIGNAALSTATUSSEN.has(String((s as any).status ?? '')));
}

function isCooldownVoorbij(campagne: CampaignSnapshot, vandaag: Date, fallbackMaanden: number): boolean {
  const expliciet = datum(campagne.herbenaderenVanaf);
  if (expliciet != null) return vandaag.getTime() >= expliciet;
  const laatst = datum(campagne.laatsteKoudeContactOp);
  if (laatst == null) return false;
  const d = new Date(laatst);
  d.setMonth(d.getMonth() + (campagne.cooldownMaanden || fallbackMaanden));
  return vandaag >= d;
}

export function routeerPartijCampagne(input: RoutingInput): RoutingResult {
  const vandaag = input.vandaag ?? new Date();
  const switchThreshold = input.primarySwitchThreshold ?? 15;
  const nieuwObjectScore = scoreRadarObject(input.signaal);
  const partijSignalen = input.partijSignalen ?? [];
  const warmeHistorie = heeftWarmeHistorie(input.partijBrieven, partijSignalen);

  if (!input.partij.eigenaarId || input.partij.matchStatus !== 'bevestigd') {
    return {
      outcome: 'benadering_bepalen', werkvoorraadStatus: 'benadering_bepalen',
      reden: input.partij.matchReden || 'Mogelijk dezelfde partij; bevestig eerst de partijmatch.',
      briefAdvies: 'handmatig_beoordelen', geadviseerdeStap: null,
      magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore: null, nieuwObjectScore,
    };
  }

  const campagne = input.campagne;
  if (!campagne) {
    return {
      outcome: 'nieuwe_campagne_brief_1', werkvoorraadStatus: 'actief',
      reden: 'Geen bestaande campagne of contacthistorie voor deze bevestigde partij.',
      briefAdvies: 'objectbrief', geadviseerdeStap: 'brief_1',
      magAutomatischBriefMaken: true, magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore: null, nieuwObjectScore,
    };
  }

  if (campagne.contactStatus === 'do_not_contact') {
    return {
      outcome: 'niet_benaderen', werkvoorraadStatus: 'niet_benaderen',
      reden: 'Partij heeft een do-not-contact blokkade. Een nieuw signaal heft die blokkade niet op.',
      briefAdvies: 'geen_brief', geadviseerdeStap: null,
      magAutomatischBriefMaken: false, magHandmatigBriefMaken: false,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore: null, nieuwObjectScore,
    };
  }

  if (campagne.contactStatus === 'warm' || campagne.status === 'warm' || warmeHistorie) {
    return {
      outcome: 'gespreksonderwerp', werkvoorraadStatus: 'eerder_benaderd',
      reden: 'Er is warm contact of actieve persoonlijke opvolging; voeg het object toe als gespreksonderwerp.',
      briefAdvies: 'geen_brief', geadviseerdeStap: null,
      magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore: null, nieuwObjectScore,
    };
  }

  if (campagne.contactStatus === 'not_now') {
    return {
      outcome: 'alleen_registreren', werkvoorraadStatus: 'eerder_benaderd',
      reden: 'Partij heeft aangegeven nu niet benaderd te willen worden; respecteer de vastgelegde vervolgdatum.',
      briefAdvies: 'geen_brief', geadviseerdeStap: null,
      magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore: null, nieuwObjectScore,
    };
  }

  if (campagne.contactStatus === 'not_interested') {
    return {
      outcome: 'alleen_registreren', werkvoorraadStatus: 'eerder_benaderd',
      reden: 'Eerdere reactie: niet geïnteresseerd. Nieuw normaal signaal wordt alleen geregistreerd.',
      briefAdvies: 'geen_brief', geadviseerdeStap: null,
      magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore: null, nieuwObjectScore,
    };
  }

  const verstuurdeStap = hoogsteVerstuurdeStap(input.partijBrieven);
  const next = volgendeStap(verstuurdeStap ?? campagne.huidigeStap);
  const hoofdSignaal = campagne.primarySignaalId
    ? partijSignalen.find((s) => s.id === campagne.primarySignaalId) ?? null
    : null;
  const huidigObjectScore = hoofdSignaal ? scoreRadarObject(hoofdSignaal) : null;
  const nieuwHoofdobjectVoorstellen = Boolean(
    huidigObjectScore && nieuwObjectScore.score > huidigObjectScore.score + switchThreshold,
  );

  if (campagne.status === 'afgerond_geen_reactie' || campagne.status === 'afgesloten') {
    const cooldownVoorbij = isCooldownVoorbij(campagne, vandaag, input.defaultCooldownMaanden ?? 6);
    const duidelijkSterker = huidigObjectScore
      ? nieuwObjectScore.score > huidigObjectScore.score + switchThreshold
      : nieuwObjectScore.score >= 60;
    if (cooldownVoorbij && duidelijkSterker) {
      return {
        outcome: 'herbenadering_voorstellen', werkvoorraadStatus: 'benadering_bepalen',
        reden: 'Cooldown is voorbij en het nieuwe signaal is sterk genoeg voor een expliciet herbenaderingsvoorstel.',
        briefAdvies: 'handmatig_beoordelen', geadviseerdeStap: 'brief_1',
        magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
        nieuwHoofdobjectVoorstellen, huidigObjectScore, nieuwObjectScore,
      };
    }
    if (duidelijkSterker) {
      return {
        outcome: 'benadering_bepalen', werkvoorraadStatus: 'benadering_bepalen',
        reden: 'Nieuwe aanleiding is duidelijk sterker, maar een nieuwe koude campagne wordt niet automatisch gestart.',
        briefAdvies: 'handmatig_beoordelen', geadviseerdeStap: null,
        magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
        nieuwHoofdobjectVoorstellen, huidigObjectScore, nieuwObjectScore,
      };
    }
    return {
      outcome: 'alleen_registreren', werkvoorraadStatus: 'gebundeld_bij_partij',
      reden: 'Eerdere campagne is afgerond zonder reactie; vergelijkbaar nieuw signaal wordt alleen bij de partij gebundeld.',
      briefAdvies: 'geen_brief', geadviseerdeStap: null,
      magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen: false, huidigObjectScore, nieuwObjectScore,
    };
  }

  if (verstuurdeStap || campagne.laatsteKoudeContactOp) {
    return {
      outcome: next ? 'meenemen_in_vervolgbrief' : 'bundelen_bij_partij',
      werkvoorraadStatus: 'gebundeld_bij_partij',
      reden: next
        ? `Deze partij is al benaderd; voeg het nieuwe object toe aan de bestaande campagne en vervolg met ${next.replace('_', ' ')}.`
        : 'De bestaande koude sequence is al doorlopen; start geen tweede Brief 1.',
      briefAdvies: next ? 'portefeuillebrief' : 'geen_brief',
      geadviseerdeStap: next,
      magAutomatischBriefMaken: Boolean(next),
      magHandmatigBriefMaken: true,
      nieuwHoofdobjectVoorstellen, huidigObjectScore, nieuwObjectScore,
    };
  }

  return {
    outcome: 'bundelen_bij_partij', werkvoorraadStatus: 'gebundeld_bij_partij',
    reden: 'Er bestaat al een actieve campagne voor deze partij; bundel het signaal in die campagne.',
    briefAdvies: 'portefeuillebrief', geadviseerdeStap: 'brief_1',
    magAutomatischBriefMaken: false, magHandmatigBriefMaken: true,
    nieuwHoofdobjectVoorstellen, huidigObjectScore, nieuwObjectScore,
  };
}

export function campagnebewusteVervolgIntro(args: {
  stap: 'brief_1' | 'brief_2' | 'brief_3';
  huidigHoofdobject: string;
  nieuwObject?: string | null;
  portefeuille?: boolean;
}): string | null {
  const hoofd = args.huidigHoofdobject.trim();
  const nieuw = args.nieuwObject?.trim();
  if (args.stap === 'brief_1') return null;
  if (nieuw && nieuw !== hoofd) {
    return `Enige tijd geleden schreef ik u over het vastgoed aan ${hoofd}. Inmiddels kwam ook ${nieuw} onder mijn aandacht. Dat was voor mij aanleiding om nogmaals kort contact met u op te nemen.`;
  }
  if (args.portefeuille) {
    return `Enige tijd geleden schreef ik u over het vastgoed aan ${hoofd}. Omdat er meerdere relevante objecten binnen uw vastgoedportefeuille spelen, kom ik graag nogmaals kort bij u terug.`;
  }
  return `Enige tijd geleden schreef ik u over het vastgoed aan ${hoofd}. Ik kom graag nogmaals kort bij u terug.`;
}
