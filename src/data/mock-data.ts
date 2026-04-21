// Bito Vastgoed — Types, helpers en matching engine.
// Data komt uit Supabase via useDataStore. Hier alleen pure utilities.
//
// FASE 1: uitgebreide types matching het nieuwe datamodel.
// Bestaande velden blijven bestaan voor backwards compatibility met de UI;
// nieuwe velden zijn optioneel zodat de huidige formulieren niet stuk gaan
// totdat Fase 2 (formulieren) is opgeleverd.

// =====================================================================
// ENUMS
// =====================================================================

export type LeadStatus = 'koud' | 'lauw' | 'warm' | 'actief';

export type PartijType = 'belegger' | 'ontwikkelaar' | 'eigenaar' | 'makelaar' | 'partner' | 'overig';

export type InvesteerderSubtype =
  | 'private_belegger'
  | 'hnwi'
  | 'family_office'
  | 'institutioneel'
  | 'fonds'
  | 'bv'
  | 'nv'
  | 'cv';

export type AssetClass =
  | 'wonen'
  | 'winkels'
  | 'bedrijfshallen'
  | 'logistiek'
  | 'industrieel'
  | 'kantoren'
  | 'hotels'
  | 'zorgvastgoed'
  | 'mixed_use'
  | 'ontwikkellocatie';

export type VerhuurStatus = 'verhuurd' | 'leeg' | 'gedeeltelijk';

export type DealFase =
  | 'lead' | 'introductie' | 'interesse' | 'bezichtiging'
  | 'bieding' | 'onderhandeling' | 'closing' | 'afgerond' | 'afgevallen';

export type ObjectStatus =
  | 'off-market' | 'in_onderzoek' | 'beschikbaar'
  | 'onder_optie' | 'verkocht' | 'ingetrokken';

export type TaakPrioriteit = 'laag' | 'normaal' | 'hoog' | 'urgent';
export type TaakStatus = 'open' | 'in_uitvoering' | 'afgerond';

export type ZoekprofielStatus = 'actief' | 'pauze' | 'gearchiveerd';

export type KandidaatStatus =
  | 'geinteresseerd' | 'bezichtiging' | 'bod' | 'afgevallen' | 'gewonnen';

export type OnderhoudsstaatNiveau =
  'uitstekend' | 'goed' | 'redelijk' | 'matig' | 'slecht';

export type VerkoperVia =
  | 'rechtstreeks_eigenaar' | 'via_makelaar' | 'via_beheerder'
  | 'via_adviseur' | 'via_netwerk' | 'onbekend';

export type CommunicatieKanaal =
  'whatsapp' | 'email' | 'telefoon' | 'signal' | 'linkedin';

export type KapitaalSituatie =
  'cash_ready' | 'financiering_vereist' | 'hybride' | 'onbekend';

export type DocumentType =
  | 'huurovereenkomst' | 'taxatierapport' | 'mjop' | 'asbestinventarisatie'
  | 'bouwkundig_rapport' | 'energielabel_rapport' | 'informatiememorandum'
  | 'plattegrond' | 'kadasterbericht' | 'wozbeschikking' | 'jaarrekening_huurder'
  | 'fotorapport' | 'dd_overzicht' | 'anders';

export type Energielabel =
  'A++++' | 'A+++' | 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'onbekend';

export type ExclusiviteitVoorkeur = 'alleen_off_market' | 'beide' | 'geen_voorkeur';

export type DDStatus = 'niet_gestart' | 'in_uitvoering' | 'afgerond' | 'niet_van_toepassing';

export type IndexatieBasis = 'CPI' | 'vast_pct' | 'geen' | 'custom';

export type Dealstructuur = 'direct' | 'jv' | 'fonds' | 'asset_deal' | 'share_deal';

export type Transactietype =
  'losse_aankoop' | 'portefeuille' | 'jv' | 'asset_deal' | 'share_deal';


// =====================================================================
// LOOKUP / METADATA
// =====================================================================

export interface ObjectSubcategorie {
  id: string;                 // bv 'wonen.studentenhuisvesting'
  assetClass: AssetClass;
  subcategorieKey: string;
  label: string;
  beschrijving?: string;
  volgorde: number;
  actief: boolean;
}


// =====================================================================
// RELATIES
// =====================================================================

export interface Relatie {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string;     // legacy weergave; gedetailleerd in RelatieContactpersoon[]
  type: PartijType;
  investeerderSubtype?: InvesteerderSubtype;
  telefoon: string;
  email: string;
  website?: string;
  linkedinUrl?: string;

  kvkNummer?: string;
  vestigingsadres?: string;
  vestigingspostcode?: string;
  vestigingsplaats?: string;
  vestigingsland?: string;

  regio: string[];
  assetClasses: AssetClass[];
  budgetMin?: number;
  budgetMax?: number;
  rendementseis?: number;     // %
  kapitaalsituatie?: KapitaalSituatie;
  eigenVermogenPct?: number;  // 0-100
  voorkeurDealstructuur?: Dealstructuur[];
  voorkeurKanaal?: CommunicatieKanaal;
  voorkeurTaal?: string;

  aankoopcriteria?: string;
  verkoopintentie?: string;

  ndaGetekend: boolean;
  ndaDatum?: string;          // ISO date

  bronRelatie?: string;
  leadStatus: LeadStatus;
  laatsteContact: string;
  volgendeActie?: string;
  notities?: string;
  softDeletedAt?: string;
}

export interface RelatieContactpersoon {
  id: string;
  relatieId: string;
  naam: string;
  functie?: string;
  email?: string;
  telefoon?: string;
  linkedinUrl?: string;
  isPrimair: boolean;
  decisionMaker: boolean;
  voorkeurKanaal?: CommunicatieKanaal;
  voorkeurTaal?: string;
  notities?: string;
}


// =====================================================================
// OBJECTEN
// =====================================================================

export interface ObjectVastgoed {
  id: string;
  titel: string;
  internReferentienummer?: string;

  // Anonimiteit
  anoniem: boolean;
  publiekeNaam?: string;
  publiekeRegio?: string;

  // Locatie
  adres?: string;
  postcode?: string;
  plaats: string;
  provincie: string;

  // Classificatie
  type: AssetClass;
  subcategorie?: string;          // legacy text-veld
  subcategorieId?: string;        // FK naar object_subcategorieen
  status: ObjectStatus;
  beschikbaarVanaf?: string;
  bron?: string;
  exclusief: boolean;

  // Financieel
  vraagprijs?: number;
  prijsindicatie?: string;
  huurinkomsten?: number;
  huurPerM2?: number;
  brutoAanvangsrendement?: number;
  nettoAanvangsrendement?: number;
  noi?: number;
  servicekostenJaar?: number;
  wozWaarde?: number;
  wozPeildatum?: string;
  taxatiewaarde?: number;
  taxatiedatum?: string;

  // Verhuur
  verhuurStatus: VerhuurStatus;
  aantalHuurders?: number;
  leegstandPct?: number;

  // Oppervlakten (NEN 2580)
  oppervlakte?: number;           // generiek
  oppervlakteVvo?: number;        // verhuurbaar vloeroppervlak
  oppervlakteBvo?: number;        // bruto vloeroppervlak
  oppervlakteGbo?: number;        // gebruiksoppervlak (NIEUW)
  perceelOppervlakte?: number;

  // Pand
  bouwjaar?: number;
  energielabel?: string;          // legacy text
  energielabelV2?: Energielabel;  // gestandaardiseerd
  huidigGebruik?: string;
  aantalVerdiepingen?: number;
  aantalUnits?: number;

  // Onderhoud
  onderhoudsstaat?: string;       // legacy text
  onderhoudsstaatNiveau?: OnderhoudsstaatNiveau;
  recenteInvesteringen?: string;
  achterstalligOnderhoud?: string;
  asbestinventarisatieAanwezig?: boolean;

  // Juridisch
  eigendomssituatie?: string;
  erfpachtinformatie?: string;
  bestemmingsinformatie?: string;
  kadastraleGemeente?: string;
  kadastraleSectie?: string;
  kadastraalNummer?: string;

  // Potentie
  ontwikkelPotentie: boolean;
  transformatiePotentie: boolean;

  // Investeringsthese
  samenvatting?: string;
  investeringsthese?: string;     // markdown bullets
  risicos?: string;               // markdown bullets
  onderscheidendeKenmerken?: string;

  // Verkoper
  verkoperNaam?: string;
  verkoperRol?: string;
  verkoperVia?: VerkoperVia;
  verkoperTelefoon?: string;
  verkoperEmail?: string;
  verkoopmotivatie?: string;

  // Portefeuille-structuur
  isPortefeuille: boolean;
  parentObjectId?: string;

  // Documenten / overig
  documentenBeschikbaar: boolean;
  interneOpmerkingen?: string;
  opmerkingen?: string;
  datumToegevoegd: string;
  softDeletedAt?: string;
}

export interface ObjectHuurder {
  id: string;
  objectId: string;
  huurderNaam: string;
  branche?: string;
  oppervlakteM2?: number;
  jaarhuur?: number;
  servicekostenJaar?: number;
  ingangsdatum?: string;
  einddatum?: string;
  opzegmogelijkheid?: string;
  indexatieBasis?: IndexatieBasis;
  indexatiePct?: number;
  notities?: string;
}

export interface ObjectDocument {
  id: string;
  objectId: string;
  documenttype: DocumentType;
  bestandsnaam: string;
  storagePath: string;            // pad in bucket bito-objecten
  bestandsgrootteBytes?: number;
  mimeType?: string;
  vertrouwelijk: boolean;
  notities?: string;
  geuploadDoor?: string;
  createdAt: string;
}

export interface ObjectFoto {
  id: string;
  objectId: string;
  storagePath: string;
  bijschrift?: string;
  isHoofdfoto: boolean;
  volgorde: number;
  bestandsgrootteBytes?: number;
}

// View: berekende huurmetrics per object
export interface ObjectHuurMetrics {
  objectId: string;
  aantalHuurders: number;
  totaleJaarhuur: number;
  verhuurdeM2: number;
  waltJaren?: number;
  walbJaren?: number;
}


// =====================================================================
// ZOEKPROFIELEN
// =====================================================================

export interface Zoekprofiel {
  id: string;
  naam: string;
  relatieId: string;
  typeVastgoed: AssetClass[];
  subcategorieIds?: string[];
  regio: string[];
  stad?: string;                  // legacy single
  steden?: string[];              // gebruik deze ipv stad
  prijsMin?: number;
  prijsMax?: number;
  oppervlakteMin?: number;
  oppervlakteMax?: number;
  bouwjaarMin?: number;
  bouwjaarMax?: number;
  energielabelMin?: Energielabel;
  verhuurStatus?: VerhuurStatus;
  rendementseis?: number;
  waltMin?: number;
  leegstandMaxPct?: number;
  ontwikkelPotentie: boolean;
  transformatiePotentie: boolean;
  transactietypeVoorkeur?: Transactietype[];
  exclusiviteitVoorkeur?: ExclusiviteitVoorkeur;
  prioriteit: number;             // 1-5
  aanvullendeCriteria?: string;
  status: ZoekprofielStatus;
}


// =====================================================================
// DEALS
// =====================================================================

export interface Deal {
  id: string;
  objectId: string;
  relatieId: string;
  fase: DealFase;
  interessegraad: number;         // 1-5
  datumEersteContact: string;
  datumFollowUp?: string;
  bezichtigingGepland?: string;
  indicatiefBod?: number;
  verwachteClosingdatum?: string;
  commissiePct?: number;
  commissieBedrag?: number;
  feeStructuur?: string;
  ddStatus?: DDStatus;
  notaris?: string;
  bank?: string;
  tegenpartijMakelaar?: string;
  afwijzingsreden?: string;
  notities?: string;
  softDeletedAt?: string;
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


// =====================================================================
// TAKEN
// =====================================================================

export interface Taak {
  id: string;
  titel: string;
  relatieId?: string;
  dealId?: string;
  type: string;
  deadline: string;
  deadlineTijd?: string;
  prioriteit: TaakPrioriteit;
  status: TaakStatus;
  notities?: string;
  softDeletedAt?: string;
}


// =====================================================================
// HELPERS
// =====================================================================

export const formatCurrency = (amount?: number): string => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
};

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
  return new Date(date).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export const formatDateTime = (date?: string, tijd?: string): string => {
  if (!date) return '—';
  const datum = formatDate(date);
  return tijd ? `${datum} · ${tijd.slice(0, 5)}` : datum;
};

// === MATCHING ENGINE ===
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
  if (!profiel.regio || profiel.regio.length === 0) return true;
  const provincie = (object.provincie || '').toLowerCase();
  const plaats = (object.plaats || '').toLowerCase();
  return profiel.regio.some(r => {
    const key = r.trim().toLowerCase();
    if (!key) return false;
    if (key === 'randstad') {
      return RANDSTAD_PROVINCIES.map(p => p.toLowerCase()).includes(provincie);
    }
    return provincie.includes(key) || plaats.includes(key);
  });
}

export function berekenMatchScore(
  object: ObjectVastgoed,
  profiel: Zoekprofiel,
): MatchResult | null {
  const redenen: string[] = [];
  let score = 0;

  // === HARDE CRITERIA ===
  if (!profiel.typeVastgoed || profiel.typeVastgoed.length === 0) return null;
  if (!profiel.typeVastgoed.includes(object.type)) return null;
  score += 25;
  redenen.push(`Type matcht (${object.type})`);

  // Subcategorie filter (nieuw, optioneel)
  if (profiel.subcategorieIds && profiel.subcategorieIds.length > 0) {
    if (!object.subcategorieId || !profiel.subcategorieIds.includes(object.subcategorieId)) {
      return null;
    }
    score += 10;
    redenen.push('Subcategorie matcht');
  }

  if (profiel.regio && profiel.regio.length > 0) {
    if (!regioMatcht(profiel, object)) return null;
    score += 20;
    redenen.push(`Regio matcht (${object.plaats || object.provincie})`);
  } else {
    score += 5;
  }

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
    redenen.push('Vraagprijs onbekend');
  }

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
      score -= 5;
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

  // Energielabel-eis (nieuw, zacht)
  if (profiel.energielabelMin && object.energielabelV2) {
    const order: Energielabel[] = ['A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'];
    if (order.indexOf(object.energielabelV2) <= order.indexOf(profiel.energielabelMin)) {
      score += 5;
      redenen.push('Energielabel voldoet');
    }
  }

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
  profielen: Zoekprofiel[],
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
  objecten: ObjectVastgoed[],
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
  objecten: ObjectVastgoed[],
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
