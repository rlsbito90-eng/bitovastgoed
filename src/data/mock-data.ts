// Mock data for Bito Vastgoed Dealflow Manager

export type LeadStatus = 'koud' | 'lauw' | 'warm' | 'actief';
export type PartijType = 'belegger' | 'ontwikkelaar' | 'eigenaar' | 'makelaar' | 'partner';
export type AssetClass = 'wonen' | 'winkels' | 'bedrijfshallen' | 'logistiek' | 'industrieel' | 'kantoren' | 'hotels';
export type VerhuurStatus = 'verhuurd' | 'leeg' | 'gedeeltelijk';
export type DealFase = 'lead' | 'introductie' | 'interesse' | 'bezichtiging' | 'bieding' | 'onderhandeling' | 'closing' | 'afgerond' | 'afgevallen';
export type ObjectStatus = 'off-market' | 'in_onderzoek' | 'onder_optie' | 'verkocht' | 'ingetrokken';
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

// === RELATIES ===
export const relaties: Relatie[] = [
  {
    id: 'rel-1',
    bedrijfsnaam: 'Van Dijk Capital',
    contactpersoon: 'Peter van Dijk',
    type: 'belegger',
    telefoon: '+31 6 1234 5678',
    email: 'p.vandijk@vandijkcapital.nl',
    regio: ['Randstad', 'Noord-Holland'],
    assetClasses: ['wonen', 'logistiek'],
    budgetMin: 2000000,
    budgetMax: 15000000,
    aankoopcriteria: 'Core/core-plus woningportefeuilles, minimaal 10 eenheden',
    leadStatus: 'warm',
    laatsteContact: '2026-03-15',
    volgendeActie: 'Bellen over nieuw object Haarlem',
    notities: 'Zeer actieve partij, zoekt uitbreiding portefeuille Randstad'
  },
  {
    id: 'rel-2',
    bedrijfsnaam: 'Brabant Ontwikkeling BV',
    contactpersoon: 'Lisa de Groot',
    type: 'ontwikkelaar',
    telefoon: '+31 6 9876 5432',
    email: 'l.degroot@brabantontwikkeling.nl',
    regio: ['Brabant', 'Limburg'],
    assetClasses: ['wonen', 'winkels', 'kantoren'],
    budgetMin: 5000000,
    budgetMax: 30000000,
    aankoopcriteria: 'Transformatielocaties en herontwikkeling',
    leadStatus: 'actief',
    laatsteContact: '2026-03-17',
    volgendeActie: 'Factsheet sturen winkelcentrum Eindhoven',
    notities: 'In gesprek over 3 objecten tegelijk. Besluitvorming via directie.'
  },
  {
    id: 'rel-3',
    bedrijfsnaam: 'Stichting Woonborg',
    contactpersoon: 'Henk Jansen',
    type: 'belegger',
    telefoon: '+31 6 5555 1234',
    email: 'h.jansen@woonborg.nl',
    regio: ['Randstad', 'Utrecht'],
    assetClasses: ['wonen'],
    budgetMin: 10000000,
    budgetMax: 50000000,
    aankoopcriteria: 'Nieuwbouw en bestaand verhuurd wonen, middenhuur segment',
    leadStatus: 'warm',
    laatsteContact: '2026-03-12',
    volgendeActie: 'Bezichtiging inplannen Utrecht',
  },
  {
    id: 'rel-4',
    bedrijfsnaam: 'Logistics Park NL',
    contactpersoon: 'Mark Verhoeven',
    type: 'belegger',
    telefoon: '+31 6 4444 5678',
    email: 'm.verhoeven@logisticsparkNL.nl',
    regio: ['Brabant', 'Zuid-Holland', 'Gelderland'],
    assetClasses: ['logistiek', 'bedrijfshallen', 'industrieel'],
    budgetMin: 3000000,
    budgetMax: 20000000,
    aankoopcriteria: 'Modern logistiek vastgoed, liefst langjarig verhuurd',
    leadStatus: 'actief',
    laatsteContact: '2026-03-16',
  },
  {
    id: 'rel-5',
    bedrijfsnaam: 'Familie Mulder Vastgoed',
    contactpersoon: 'Jan Mulder',
    type: 'eigenaar',
    telefoon: '+31 6 3333 9999',
    email: 'j.mulder@muldervastgoed.nl',
    regio: ['Randstad'],
    assetClasses: ['winkels', 'kantoren'],
    verkoopintentie: 'Wil kantoorpand Amsterdam verkopen, waarde ca. €4M',
    leadStatus: 'lauw',
    laatsteContact: '2026-03-01',
    volgendeActie: 'Opvolgen na 2 weken stilte',
  },
  {
    id: 'rel-6',
    bedrijfsnaam: 'Heron Real Estate',
    contactpersoon: 'Sophie van den Berg',
    type: 'makelaar',
    telefoon: '+31 6 2222 8888',
    email: 's.vandenberg@heronre.nl',
    regio: ['Randstad', 'Brabant'],
    assetClasses: ['wonen', 'winkels', 'logistiek'],
    leadStatus: 'actief',
    laatsteContact: '2026-03-14',
    notities: 'Brengt regelmatig off-market objecten aan. Betrouwbare bron.'
  },
  {
    id: 'rel-7',
    bedrijfsnaam: 'Orion Investments',
    contactpersoon: 'Thomas Bakker',
    type: 'belegger',
    telefoon: '+31 6 7777 1111',
    email: 't.bakker@orioninvest.nl',
    regio: ['Randstad', 'Brabant', 'Utrecht'],
    assetClasses: ['wonen', 'kantoren', 'winkels'],
    budgetMin: 1000000,
    budgetMax: 8000000,
    aankoopcriteria: 'Value-add objecten met huurgroei potentie',
    leadStatus: 'koud',
    laatsteContact: '2026-02-10',
    volgendeActie: 'Heractiveren met update dealflow Q1',
  },
];

// === ZOEKPROFIELEN ===
export const zoekprofielen: Zoekprofiel[] = [
  {
    id: 'zp-1',
    naam: 'Woningportefeuille Randstad',
    relatieId: 'rel-1',
    typeVastgoed: ['wonen'],
    regio: ['Randstad', 'Noord-Holland'],
    prijsMin: 3000000,
    prijsMax: 12000000,
    oppervlakteMin: 500,
    verhuurStatus: 'verhuurd',
    rendementseis: 4.5,
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    status: 'actief',
  },
  {
    id: 'zp-2',
    naam: 'Transformatielocaties Brabant',
    relatieId: 'rel-2',
    typeVastgoed: ['kantoren', 'winkels'],
    regio: ['Brabant'],
    prijsMin: 2000000,
    prijsMax: 15000000,
    oppervlakteMin: 1000,
    ontwikkelPotentie: true,
    transformatiePotentie: true,
    status: 'actief',
  },
  {
    id: 'zp-3',
    naam: 'Middenhuur woningen Utrecht',
    relatieId: 'rel-3',
    typeVastgoed: ['wonen'],
    regio: ['Utrecht', 'Randstad'],
    prijsMin: 5000000,
    prijsMax: 25000000,
    oppervlakteMin: 1000,
    verhuurStatus: 'verhuurd',
    rendementseis: 4.0,
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    status: 'actief',
  },
  {
    id: 'zp-4',
    naam: 'Logistiek Zuid-Nederland',
    relatieId: 'rel-4',
    typeVastgoed: ['logistiek', 'bedrijfshallen'],
    regio: ['Brabant', 'Zuid-Holland', 'Gelderland'],
    prijsMin: 3000000,
    prijsMax: 18000000,
    oppervlakteMin: 2000,
    verhuurStatus: 'verhuurd',
    rendementseis: 5.5,
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    status: 'actief',
  },
  {
    id: 'zp-5',
    naam: 'Value-add Kantoren',
    relatieId: 'rel-7',
    typeVastgoed: ['kantoren'],
    regio: ['Randstad', 'Utrecht'],
    prijsMin: 1000000,
    prijsMax: 6000000,
    oppervlakteMin: 500,
    ontwikkelPotentie: true,
    transformatiePotentie: true,
    aanvullendeCriteria: 'Minimaal 30% leegstand voor value-add potentie',
    status: 'actief',
  },
];

// === OBJECTEN ===
export const objecten: ObjectVastgoed[] = [
  {
    id: 'obj-1',
    titel: 'Woningportefeuille Haarlem-Zuid',
    plaats: 'Haarlem',
    provincie: 'Noord-Holland',
    type: 'wonen',
    vraagprijs: 8500000,
    huurinkomsten: 420000,
    aantalHuurders: 24,
    verhuurStatus: 'verhuurd',
    oppervlakte: 1850,
    bouwjaar: 1965,
    onderhoudsstaat: 'Redelijk, deels gerenoveerd',
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    bron: 'Heron Real Estate',
    exclusief: true,
    status: 'off-market',
    samenvatting: '24 eengezinswoningen in gewilde wijk, volledig verhuurd met stabiele huurinkomsten. Recent 8 woningen gerenoveerd.',
    documentenBeschikbaar: true,
    datumToegevoegd: '2026-03-10',
  },
  {
    id: 'obj-2',
    titel: 'Winkelcentrum De Heuvel',
    plaats: 'Eindhoven',
    provincie: 'Brabant',
    type: 'winkels',
    vraagprijs: 12000000,
    huurinkomsten: 680000,
    aantalHuurders: 8,
    verhuurStatus: 'gedeeltelijk',
    oppervlakte: 4200,
    bouwjaar: 1988,
    onderhoudsstaat: 'Matig, renovatie nodig',
    ontwikkelPotentie: true,
    transformatiePotentie: true,
    bron: 'Direct eigenaar',
    exclusief: false,
    status: 'off-market',
    samenvatting: 'Buurtwinkelcentrum met transformatiepotentie naar mixed-use. 2 units leeg, overige huurders stabiel. Bestemmingsplan biedt mogelijkheden voor woningen op verdieping.',
    documentenBeschikbaar: true,
    datumToegevoegd: '2026-03-05',
  },
  {
    id: 'obj-3',
    titel: 'Logistiek Complex Moerdijk',
    plaats: 'Moerdijk',
    provincie: 'Brabant',
    type: 'logistiek',
    vraagprijs: 14500000,
    huurinkomsten: 890000,
    aantalHuurders: 2,
    verhuurStatus: 'verhuurd',
    oppervlakte: 12000,
    bouwjaar: 2015,
    onderhoudsstaat: 'Goed',
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    bron: 'Netwerk',
    exclusief: true,
    status: 'off-market',
    samenvatting: 'Modern logistiek complex aan de A16, twee langjarige huurders (DHL en lokale distributeur). Uitbreidingsmogelijkheid op eigen terrein.',
    documentenBeschikbaar: true,
    datumToegevoegd: '2026-03-12',
  },
  {
    id: 'obj-4',
    titel: 'Kantoorpand Zuidas',
    plaats: 'Amsterdam',
    provincie: 'Noord-Holland',
    type: 'kantoren',
    vraagprijs: 4200000,
    huurinkomsten: 180000,
    aantalHuurders: 3,
    verhuurStatus: 'gedeeltelijk',
    oppervlakte: 1200,
    bouwjaar: 2001,
    onderhoudsstaat: 'Goed',
    ontwikkelPotentie: true,
    transformatiePotentie: true,
    bron: 'Familie Mulder Vastgoed',
    exclusief: false,
    status: 'in_onderzoek',
    samenvatting: 'Kantoorpand in secundaire locatie Zuidas. 40% leegstand biedt kansen voor herontwikkeling of transformatie naar wonen.',
    documentenBeschikbaar: false,
    interneOpmerkingen: 'Eigenaar wil snel verkopen, mogelijk ruimte in prijs',
    datumToegevoegd: '2026-02-28',
  },
  {
    id: 'obj-5',
    titel: 'Appartementencomplex Utrecht Oost',
    plaats: 'Utrecht',
    provincie: 'Utrecht',
    type: 'wonen',
    vraagprijs: 18000000,
    huurinkomsten: 820000,
    aantalHuurders: 36,
    verhuurStatus: 'verhuurd',
    oppervlakte: 3200,
    bouwjaar: 2019,
    onderhoudsstaat: 'Uitstekend',
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    bron: 'Heron Real Estate',
    exclusief: true,
    status: 'off-market',
    samenvatting: 'Nieuwbouw appartementencomplex in populaire wijk. Volledig verhuurd in middenhuur segment. Energielabel A.',
    documentenBeschikbaar: true,
    datumToegevoegd: '2026-03-14',
  },
  {
    id: 'obj-6',
    titel: 'Bedrijfshal Tilburg',
    plaats: 'Tilburg',
    provincie: 'Brabant',
    type: 'bedrijfshallen',
    vraagprijs: 5500000,
    huurinkomsten: 340000,
    aantalHuurders: 1,
    verhuurStatus: 'verhuurd',
    oppervlakte: 6500,
    bouwjaar: 2008,
    onderhoudsstaat: 'Goed',
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    bron: 'Netwerk',
    exclusief: false,
    status: 'off-market',
    samenvatting: 'Moderne bedrijfshal met kantoorruimte, langjarig verhuurd aan logistiek bedrijf. Goed bereikbaar via A58.',
    documentenBeschikbaar: true,
    datumToegevoegd: '2026-03-08',
  },
];

// === DEALS ===
export const deals: Deal[] = [
  {
    id: 'deal-1',
    objectId: 'obj-1',
    relatieId: 'rel-1',
    fase: 'bezichtiging',
    interessegraad: 4,
    datumEersteContact: '2026-03-11',
    datumFollowUp: '2026-03-20',
    bezichtigingGepland: '2026-03-22',
    notities: 'Zeer geïnteresseerd, past goed in portefeuille. Wil taxatie laten doen na bezichtiging.',
  },
  {
    id: 'deal-2',
    objectId: 'obj-2',
    relatieId: 'rel-2',
    fase: 'interesse',
    interessegraad: 3,
    datumEersteContact: '2026-03-06',
    datumFollowUp: '2026-03-19',
    notities: 'Interesse in transformatiepotentie. Vraagt om uitgebreide due diligence informatie.',
  },
  {
    id: 'deal-3',
    objectId: 'obj-3',
    relatieId: 'rel-4',
    fase: 'bieding',
    interessegraad: 5,
    datumEersteContact: '2026-03-13',
    indicatiefBod: 13800000,
    notities: 'Bod uitgebracht op €13.8M. Wacht op reactie verkoper.',
  },
  {
    id: 'deal-4',
    objectId: 'obj-5',
    relatieId: 'rel-3',
    fase: 'introductie',
    interessegraad: 3,
    datumEersteContact: '2026-03-15',
    datumFollowUp: '2026-03-21',
    notities: 'Factsheet gestuurd, wacht op reactie.',
  },
  {
    id: 'deal-5',
    objectId: 'obj-4',
    relatieId: 'rel-7',
    fase: 'lead',
    interessegraad: 2,
    datumEersteContact: '2026-03-01',
    notities: 'Object past in profiel maar relatie is momenteel niet actief.',
  },
];

// === TAKEN ===
export const taken: Taak[] = [
  {
    id: 'taak-1',
    titel: 'Bel Peter van Dijk over bezichtiging Haarlem',
    relatieId: 'rel-1',
    dealId: 'deal-1',
    type: 'Bellen',
    deadline: '2026-03-19',
    prioriteit: 'hoog',
    status: 'open',
  },
  {
    id: 'taak-2',
    titel: 'Factsheet winkelcentrum Eindhoven versturen',
    relatieId: 'rel-2',
    dealId: 'deal-2',
    type: 'Document',
    deadline: '2026-03-18',
    prioriteit: 'urgent',
    status: 'open',
  },
  {
    id: 'taak-3',
    titel: 'Follow-up bod Logistiek Complex Moerdijk',
    relatieId: 'rel-4',
    dealId: 'deal-3',
    type: 'Opvolging',
    deadline: '2026-03-20',
    prioriteit: 'hoog',
    status: 'open',
  },
  {
    id: 'taak-4',
    titel: 'Heractiveren relatie Orion Investments',
    relatieId: 'rel-7',
    type: 'Relatiebeheer',
    deadline: '2026-03-25',
    prioriteit: 'normaal',
    status: 'open',
  },
  {
    id: 'taak-5',
    titel: 'Bezichtiging inplannen Utrecht Oost',
    relatieId: 'rel-3',
    dealId: 'deal-4',
    type: 'Planning',
    deadline: '2026-03-21',
    prioriteit: 'normaal',
    status: 'open',
  },
  {
    id: 'taak-6',
    titel: 'Opvolgen Familie Mulder na 2 weken stilte',
    relatieId: 'rel-5',
    type: 'Opvolging',
    deadline: '2026-03-15',
    prioriteit: 'laag',
    status: 'in_uitvoering',
  },
];

// === HELPERS ===
export const formatCurrency = (amount?: number): string => {
  if (!amount) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const getRelatieById = (id: string) => relaties.find(r => r.id === id);
export const getObjectById = (id: string) => objecten.find(o => o.id === id);
export const getDealById = (id: string) => deals.find(d => d.id === id);
export const getZoekprofielenByRelatie = (relatieId: string) => zoekprofielen.filter(z => z.relatieId === relatieId);
export const getDealsByRelatie = (relatieId: string) => deals.filter(d => d.relatieId === relatieId);
export const getDealsByObject = (objectId: string) => deals.filter(d => d.objectId === objectId);
export const getTakenByRelatie = (relatieId: string) => taken.filter(t => t.relatieId === relatieId);
export const getTakenByDeal = (dealId: string) => taken.filter(t => t.dealId === dealId);

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
    r.toLowerCase() === 'randstad' && ['Noord-Holland', 'Zuid-Holland', 'Utrecht'].includes(object.provincie)
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

export function getMatchesForObject(objectId: string): MatchResult[] {
  const object = getObjectById(objectId);
  if (!object) return [];
  return zoekprofielen
    .filter(z => z.status === 'actief')
    .map(z => berekenMatchScore(object, z))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.score - a.score);
}

export function getMatchesForRelatie(relatieId: string): MatchResult[] {
  const profielen = getZoekprofielenByRelatie(relatieId);
  const results: MatchResult[] = [];
  for (const profiel of profielen) {
    for (const object of objecten) {
      const match = berekenMatchScore(object, profiel);
      if (match) results.push(match);
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

export function getAllMatches(): MatchResult[] {
  const results: MatchResult[] = [];
  for (const profiel of zoekprofielen.filter(z => z.status === 'actief')) {
    for (const object of objecten) {
      const match = berekenMatchScore(object, profiel);
      if (match) results.push(match);
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
