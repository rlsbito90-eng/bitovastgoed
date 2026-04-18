// Bito Vastgoed — Types, helpers en matching engine.
// Data komt uit Supabase via useDataStore. Hier alleen pure utilities.

export type LeadStatus = 'koud' | 'lauw' | 'warm' | 'actief';
export type PartijType = 'belegger' | 'ontwikkelaar' | 'eigenaar' | 'makelaar' | 'partner' | 'overig';
export type AssetClass = 'wonen' | 'winkels' | 'bedrijfshallen' | 'logistiek' | 'industrieel' | 'kantoren' | 'hotels';
export type VerhuurStatus = 'verhuurd' | 'leeg' | 'gedeeltelijk';
export type DealFase = 'lead' | 'introductie' | 'interesse' | 'bezichtiging' | 'bieding' | 'onderhandeling' | 'closing' | 'afgerond' | 'afgevallen';
export type ObjectStatus = 'off-market' | 'in_onderzoek' | 'beschikbaar' | 'onder_optie' | 'verkocht' | 'ingetrokken';
export type TaakPrioriteit = 'laag' | 'normaal' | 'hoog' | 'urgent';
export type TaakStatus = 'open' | 'in_uitvoering' | 'afgerond';
export type ZoekprofielStatus = 'actief' | 'pauze' | 'gearchiveerd';

export interface Relatie {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string;
  type: PartijType;
  telefoon: string;
  email: string;
  regio: string[];
  assetClasses: AssetClass[];
  budgetMin?: number;
  budgetMax?: number;
  aankoopcriteria?: string;
  verkoopintentie?: string;
  leadStatus: LeadStatus;
  laatsteContact: string;
  volgendeActie?: string;
  notities?: string;
}

export interface Zoekprofiel {
  id: string;
  naam: string;
  relatieId: string;
  typeVastgoed: AssetClass[];
  regio: string[];
  stad?: string;
  prijsMin?: number;
  prijsMax?: number;
  oppervlakteMin?: number;
  oppervlakteMax?: number;
  verhuurStatus?: VerhuurStatus;
  rendementseis?: number;
  ontwikkelPotentie: boolean;
  transformatiePotentie: boolean;
  aanvullendeCriteria?: string;
  status: ZoekprofielStatus;
}

export interface ObjectVastgoed {
  id: string;
  titel: string;
  plaats: string;
  provincie: string;
  type: AssetClass;
  vraagprijs?: number;
  huurinkomsten?: number;
  aantalHuurders?: number;
  verhuurStatus: VerhuurStatus;
  oppervlakte?: number;
  bouwjaar?: number;
  onderhoudsstaat?: string;
  ontwikkelPotentie: boolean;
  transformatiePotentie: boolean;
  bron?: string;
  exclusief: boolean;
  status: ObjectStatus;
  samenvatting?: string;
  documentenBeschikbaar: boolean;
  interneOpmerkingen?: string;
  datumToegevoegd: string;
}

export interface Deal {
  id: string;
  objectId: string;
  relatieId: string;
  fase: DealFase;
  interessegraad: number; // 1-5
  datumEersteContact: string;
  datumFollowUp?: string;
  bezichtigingGepland?: string;
  indicatiefBod?: number;
  notities?: string;
}

export interface Taak {
  id: string;
  titel: string;
  relatieId?: string;
  dealId?: string;
  type: string;
  deadline: string;
  prioriteit: TaakPrioriteit;
  status: TaakStatus;
  notities?: string;
}

// === HELPERS ===
export const formatCurrency = (amount?: number): string => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

export const formatDate = (date?: string): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
};

// === MATCHING ENGINE ===
export interface MatchResult {
  zoekprofielId: string;
  relatieId: string;
  objectId: string;
  score: number;
  redenen: string[];
}

export function berekenMatchScore(object: ObjectVastgoed, profiel: Zoekprofiel): MatchResult | null {
  let score = 0;
  const redenen: string[] = [];

  // Hard filter: type moet matchen
  if (!profiel.typeVastgoed.includes(object.type)) return null;

  // Type match +25
  score += 25;
  redenen.push(`Type vastgoed matcht: ${object.type}`);

  // Regio match +25
  const regioMatch = profiel.regio.some(r =>
    object.provincie.toLowerCase().includes(r.toLowerCase()) ||
    (r.toLowerCase() === 'randstad' && ['Noord-Holland', 'Zuid-Holland', 'Utrecht'].includes(object.provincie))
  );
  if (regioMatch) {
    score += 25;
    redenen.push(`Regio matcht: ${object.plaats}, ${object.provincie}`);
  }

  // Budget match +20
  if (object.vraagprijs) {
    const inBudget = (!profiel.prijsMin || object.vraagprijs >= profiel.prijsMin * 0.9) &&
                     (!profiel.prijsMax || object.vraagprijs <= profiel.prijsMax * 1.1);
    if (inBudget) {
      score += 20;
      redenen.push(`Prijs binnen budget`);
    } else if (profiel.prijsMax && object.vraagprijs <= profiel.prijsMax * 1.2) {
      score += 10;
      redenen.push(`Prijs net boven budget (< 20%)`);
    }
  }

  // Oppervlakte match +10
  if (object.oppervlakte && profiel.oppervlakteMin) {
    if (object.oppervlakte >= profiel.oppervlakteMin) {
      score += 10;
      redenen.push(`Oppervlakte voldoet aan minimumeis`);
    }
  } else {
    score += 5;
  }

  // Verhuurstatus match +10
  if (profiel.verhuurStatus && object.verhuurStatus === profiel.verhuurStatus) {
    score += 10;
    redenen.push(`Verhuurstatus matcht: ${object.verhuurStatus}`);
  } else if (!profiel.verhuurStatus) {
    score += 5;
  }

  // Potentie match +10
  if (profiel.ontwikkelPotentie && object.ontwikkelPotentie) {
    score += 5;
    redenen.push(`Ontwikkelpotentie aanwezig`);
  }
  if (profiel.transformatiePotentie && object.transformatiePotentie) {
    score += 5;
    redenen.push(`Transformatiepotentie aanwezig`);
  }

  if (score < 25) return null;

  return {
    zoekprofielId: profiel.id,
    relatieId: profiel.relatieId,
    objectId: object.id,
    score: Math.min(score, 100),
    redenen,
  };
}

export function getMatchesForObjectFromData(
  object: ObjectVastgoed,
  profielen: Zoekprofiel[]
): MatchResult[] {
  return profielen
    .filter(z => z.status === 'actief')
    .map(z => berekenMatchScore(object, z))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.score - a.score);
}

export function getMatchesForRelatieFromData(
  relatieId: string,
  profielen: Zoekprofiel[],
  objecten: ObjectVastgoed[]
): MatchResult[] {
  const eigenProfielen = profielen.filter(z => z.relatieId === relatieId);
  const results: MatchResult[] = [];
  for (const profiel of eigenProfielen) {
    for (const object of objecten) {
      const match = berekenMatchScore(object, profiel);
      if (match) results.push(match);
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

export function getAllMatchesFromData(
  profielen: Zoekprofiel[],
  objecten: ObjectVastgoed[]
): MatchResult[] {
  const results: MatchResult[] = [];
  for (const profiel of profielen.filter(z => z.status === 'actief')) {
    for (const object of objecten) {
      const match = berekenMatchScore(object, profiel);
      if (match) results.push(match);
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
