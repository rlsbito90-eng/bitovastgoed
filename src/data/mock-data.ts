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
export type KandidaatStatus = 'geinteresseerd' | 'bezichtiging' | 'bod' | 'afgevallen' | 'gewonnen';

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
  // Uitgebreide pandinformatie
  internReferentienummer?: string;
  adres?: string;
  postcode?: string;
  subcategorie?: string;
  prijsindicatie?: string;
  huurPerM2?: number;
  brutoAanvangsrendement?: number;
  leegstandPct?: number;
  oppervlakteVvo?: number;
  oppervlakteBvo?: number;
  perceelOppervlakte?: number;
  energielabel?: string;
  eigendomssituatie?: string;
  erfpachtinformatie?: string;
  bestemmingsinformatie?: string;
  beschikbaarVanaf?: string;
  opmerkingen?: string;
}

export interface Deal {
  id: string;
  objectId: string; // primair object (legacy + snelle weergave)
  relatieId: string; // primaire relatie (legacy + snelle weergave)
  fase: DealFase;
  interessegraad: number; // 1-5
  datumEersteContact: string;
  datumFollowUp?: string;
  bezichtigingGepland?: string;
  indicatiefBod?: number;
  notities?: string;
}

export interface DealObjectKoppeling {
  id: string;
  dealId: string;
  objectId: string;
  isPrimair: boolean;
  notities?: string;
}

export interface DealKandidaat {
  id: string;
  dealId: string;
  relatieId: string;
  status: KandidaatStatus;
  notities?: string;
}

export interface Taak {
  id: string;
  titel: string;
  relatieId?: string;
  dealId?: string;
  type: string;
  deadline: string;
  deadlineTijd?: string; // 'HH:MM' optioneel
  prioriteit: TaakPrioriteit;
  status: TaakStatus;
  notities?: string;
}

// === HELPERS ===
export const formatCurrency = (amount?: number): string => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

// Compactere variant voor mobiele KPI's. €1.234.567 -> €1,2 mln
export const formatCurrencyCompact = (amount?: number): string => {
  if (!amount && amount !== 0) return '—';
  if (Math.abs(amount) >= 1_000_000) {
    return `€${(amount / 1_000_000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} mln`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `€${Math.round(amount / 1_000).toLocaleString('nl-NL')}k`;
  }
  return formatCurrency(amount);
};

export const formatDate = (date?: string): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (date?: string, tijd?: string): string => {
  if (!date) return '—';
  const datum = formatDate(date);
  return tijd ? `${datum} · ${tijd.slice(0, 5)}` : datum;
};

// === MATCHING ENGINE ===
// Harde criteria: type, regio (indien opgegeven), budget, oppervlakte (min/max).
// Een hard criterium dat faalt -> géén match.
// Zachte criteria: verhuurstatus-voorkeur, ontwikkel-/transformatiepotentie -> geven score-bonus.
export interface MatchResult {
  zoekprofielId: string;
  relatieId: string;
  objectId: string;
  score: number;
  redenen: string[];
  hardeCriteriaOk: boolean;
}

const RANDSTAD_PROVINCIES = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Flevoland'];

function regioMatcht(profiel: Zoekprofiel, object: ObjectVastgoed): boolean {
  if (!profiel.regio || profiel.regio.length === 0) return true; // geen voorkeur = altijd ok
  const provincie = (object.provincie || '').toLowerCase();
  const plaats = (object.plaats || '').toLowerCase();
  return profiel.regio.some(r => {
    const key = r.trim().toLowerCase();
    if (!key) return false;
    if (key === 'randstad') return RANDSTAD_PROVINCIES.map(p => p.toLowerCase()).includes(provincie);
    return provincie.includes(key) || plaats.includes(key);
  });
}

export function berekenMatchScore(object: ObjectVastgoed, profiel: Zoekprofiel): MatchResult | null {
  const redenen: string[] = [];
  let score = 0;

  // === HARDE CRITERIA ===
  // 1. Type vastgoed verplicht
  if (!profiel.typeVastgoed || profiel.typeVastgoed.length === 0) return null;
  if (!profiel.typeVastgoed.includes(object.type)) return null;
  score += 25;
  redenen.push(`Type matcht (${object.type})`);

  // 2. Regio (indien opgegeven)
  if (profiel.regio && profiel.regio.length > 0) {
    if (!regioMatcht(profiel, object)) return null;
    score += 20;
    redenen.push(`Regio matcht (${object.plaats || object.provincie})`);
  } else {
    score += 5; // geen voorkeur = klein bonusje
  }

  // 3. Budget — STRIKT: object moet binnen [prijsMin, prijsMax] vallen.
  //    Onbekende vraagprijs blokkeert niet, maar geeft ook geen score.
  if (typeof object.vraagprijs === 'number') {
    if (typeof profiel.prijsMin === 'number' && object.vraagprijs < profiel.prijsMin) return null;
    if (typeof profiel.prijsMax === 'number' && object.vraagprijs > profiel.prijsMax) return null;
    if (typeof profiel.prijsMin === 'number' || typeof profiel.prijsMax === 'number') {
      score += 25;
      redenen.push('Prijs binnen budget');
    } else {
      score += 5;
    }
  } else if (typeof profiel.prijsMin === 'number' || typeof profiel.prijsMax === 'number') {
    // Profiel heeft budgeteis maar object geen prijs: zachte penalty, niet uitsluiten
    redenen.push('Vraagprijs onbekend');
  }

  // 4. Oppervlakte — STRIKT: object moet binnen [min, max] vallen indien bekend.
  if (typeof object.oppervlakte === 'number') {
    if (typeof profiel.oppervlakteMin === 'number' && object.oppervlakte < profiel.oppervlakteMin) return null;
    if (typeof profiel.oppervlakteMax === 'number' && object.oppervlakte > profiel.oppervlakteMax) return null;
    if (typeof profiel.oppervlakteMin === 'number' || typeof profiel.oppervlakteMax === 'number') {
      score += 10;
      redenen.push('Oppervlakte binnen range');
    }
  }

  // === ZACHTE CRITERIA ===
  if (profiel.verhuurStatus) {
    if (object.verhuurStatus === profiel.verhuurStatus) {
      score += 10;
      redenen.push(`Verhuurstatus matcht (${object.verhuurStatus})`);
    } else {
      score -= 5; // mismatch op zacht criterium = lichte penalty
    }
  }

  if (profiel.ontwikkelPotentie && object.ontwikkelPotentie) {
    score += 5;
    redenen.push('Ontwikkelpotentie aanwezig');
  }
  if (profiel.transformatiePotentie && object.transformatiePotentie) {
    score += 5;
    redenen.push('Transformatiepotentie aanwezig');
  }

  // Score begrenzen
  score = Math.max(0, Math.min(100, score));
  if (score < 25) return null;

  return {
    zoekprofielId: profiel.id,
    relatieId: profiel.relatieId,
    objectId: object.id,
    score,
    redenen,
    hardeCriteriaOk: true,
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
  const eigenProfielen = profielen.filter(z => z.relatieId === relatieId && z.status === 'actief');
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
