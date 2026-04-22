// Bito Vastgoed — Types + helpers + matching engine.
// Centraal typen-bestand. Gebruikt door alle pages, forms, hooks.

// =====================================================================
// ENUMS
// =====================================================================

export type LeadStatus = 'koud' | 'lauw' | 'warm' | 'actief';

export type PartijType =
  | 'belegger' | 'ontwikkelaar' | 'eigenaar'
  | 'makelaar' | 'partner' | 'overig';

export type InvesteerderSubtype =
  | 'private_belegger' | 'hnwi' | 'family_office' | 'institutioneel'
  | 'fonds' | 'bv' | 'nv' | 'cv';

export type AssetClass =
  | 'wonen' | 'winkels' | 'bedrijfshallen' | 'logistiek'
  | 'industrieel' | 'kantoren' | 'hotels'
  | 'zorgvastgoed' | 'mixed_use' | 'ontwikkellocatie';

export type VerhuurStatus = 'verhuurd' | 'leeg' | 'gedeeltelijk';

export type DealFase =
  | 'lead' | 'introductie' | 'interesse' | 'bezichtiging'
  | 'bieding' | 'onderhandeling' | 'closing'
  | 'afgerond' | 'afgevallen';

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
  | 'plattegrond' | 'kadasterbericht' | 'wozbeschikking'
  | 'jaarrekening_huurder' | 'fotorapport' | 'dd_overzicht' | 'anders';

export type Energielabel =
  | 'A++++' | 'A+++' | 'A++' | 'A+' | 'A'
  | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'onbekend';

export type ExclusiviteitVoorkeur =
  'alleen_off_market' | 'beide' | 'geen_voorkeur';

export type DDStatus =
  'niet_gestart' | 'in_uitvoering' | 'afgerond' | 'niet_van_toepassing';

export type IndexatieBasis = 'CPI' | 'vast_pct' | 'geen' | 'custom';

export type Dealstructuur = 'direct' | 'jv' | 'fonds' | 'asset_deal' | 'share_deal';

export type Transactietype =
  'losse_aankoop' | 'portefeuille' | 'jv' | 'asset_deal' | 'share_deal';


// =====================================================================
// INTERFACES
// =====================================================================

export interface ObjectSubcategorie {
  id: string;
  assetClass: AssetClass;
  subcategorieKey: string;
  label: string;
  beschrijving?: string;
  volgorde: number;
  actief: boolean;
}

export interface Relatie {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string;   // legacy; gedetailleerd in RelatieContactpersoon[]
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
  rendementseis?: number;
  kapitaalsituatie?: KapitaalSituatie;
  eigenVermogenPct?: number;
  voorkeurDealstructuur?: Dealstructuur[];
  voorkeurKanaal?: CommunicatieKanaal;
  voorkeurTaal?: string;

  aankoopcriteria?: string;
  verkoopintentie?: string;

  ndaGetekend: boolean;
  ndaDatum?: string;

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
  subcategorie?: string;          // legacy free-text
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

  // Oppervlakten
  oppervlakte?: number;
  oppervlakteVvo?: number;
  oppervlakteBvo?: number;
  oppervlakteGbo?: number;
  perceelOppervlakte?: number;

  // Pand
  bouwjaar?: number;
  energielabel?: string;          // legacy
  energielabelV2?: Energielabel;
  huidigGebruik?: string;
  aantalVerdiepingen?: number;
  aantalUnits?: number;

  // Onderhoud
  onderhoudsstaat?: string;       // legacy
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

  // Thesis
  samenvatting?: string;
  investeringsthese?: string;
  risicos?: string;
  onderscheidendeKenmerken?: string;

  // Verkoper
  verkoperNaam?: string;
  verkoperRol?: string;
  verkoperVia?: VerkoperVia;
  verkoperTelefoon?: string;
  verkoperEmail?: string;
  verkoopmotivatie?: string;

  // Portefeuille
  isPortefeuille: boolean;
  parentObjectId?: string;

  // Overig
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
  storagePath: string;
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

export interface ObjectHuurMetrics {
  objectId: string;
  aantalHuurders: number;
  totaleJaarhuur: number;
  verhuurdeM2: number;
  waltJaren?: number;
  walbJaren?: number;
}

export interface Zoekprofiel {
  id: string;
  naam: string;
  relatieId: string;
  typeVastgoed: AssetClass[];
  subcategorieIds?: string[];
  regio: string[];
  stad?: string;
  steden?: string[];
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
  prioriteit: number;
  aanvullendeCriteria?: string;
  status: ZoekprofielStatus;
}

export interface Deal {
  id: string;
  objectId: string;
  relatieId: string;
  fase: DealFase;
  interessegraad: number;
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
// LABEL-MAPPINGEN (voor UI-weergave)
// =====================================================================

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  wonen: 'Wonen',
  winkels: 'Winkels / Retail',
  kantoren: 'Kantoren',
  logistiek: 'Logistiek',
  bedrijfshallen: 'Bedrijfshallen',
  industrieel: 'Industrieel',
  hotels: 'Hotels',
  zorgvastgoed: 'Zorgvastgoed',
  mixed_use: 'Mixed-use',
  ontwikkellocatie: 'Ontwikkellocatie',
};

export const INVESTEERDER_SUBTYPE_LABELS: Record<InvesteerderSubtype, string> = {
  private_belegger: 'Private belegger',
  hnwi: 'HNWI',
  family_office: 'Family office',
  institutioneel: 'Institutioneel',
  fonds: 'Fonds',
  bv: 'BV',
  nv: 'NV',
  cv: 'CV',
};

export const KAPITAAL_SITUATIE_LABELS: Record<KapitaalSituatie, string> = {
  cash_ready: 'Cash-ready',
  financiering_vereist: 'Financiering vereist',
  hybride: 'Hybride',
  onbekend: 'Onbekend',
};

export const COMMUNICATIE_KANAAL_LABELS: Record<CommunicatieKanaal, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  telefoon: 'Telefoon',
  signal: 'Signal',
  linkedin: 'LinkedIn',
};

export const VERKOPER_VIA_LABELS: Record<VerkoperVia, string> = {
  rechtstreeks_eigenaar: 'Rechtstreeks eigenaar',
  via_makelaar: 'Via makelaar',
  via_beheerder: 'Via beheerder',
  via_adviseur: 'Via adviseur',
  via_netwerk: 'Via netwerk',
  onbekend: 'Onbekend',
};

export const ONDERHOUDSSTAAT_LABELS: Record<OnderhoudsstaatNiveau, string> = {
  uitstekend: 'Uitstekend',
  goed: 'Goed',
  redelijk: 'Redelijk',
  matig: 'Matig',
  slecht: 'Slecht',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  huurovereenkomst: 'Huurovereenkomst',
  taxatierapport: 'Taxatierapport',
  mjop: 'MJOP',
  asbestinventarisatie: 'Asbestinventarisatie',
  bouwkundig_rapport: 'Bouwkundig rapport',
  energielabel_rapport: 'Energielabel rapport',
  informatiememorandum: 'Informatiememorandum',
  plattegrond: 'Plattegrond',
  kadasterbericht: 'Kadasterbericht',
  wozbeschikking: 'WOZ-beschikking',
  jaarrekening_huurder: 'Jaarrekening huurder',
  fotorapport: 'Fotorapport',
  dd_overzicht: 'Due diligence-overzicht',
  anders: 'Anders',
};

export const DEAL_FASE_LABELS: Record<DealFase, string> = {
  lead: 'Lead',
  introductie: 'Introductie',
  interesse: 'Interesse',
  bezichtiging: 'Bezichtiging',
  bieding: 'Bieding',
  onderhandeling: 'Onderhandeling',
  closing: 'Closing',
  afgerond: 'Afgerond',
  afgevallen: 'Afgevallen',
};

export const DD_STATUS_LABELS: Record<DDStatus, string> = {
  niet_gestart: 'Niet gestart',
  in_uitvoering: 'In uitvoering',
  afgerond: 'Afgerond',
  niet_van_toepassing: 'N.v.t.',
};

export const INDEXATIE_BASIS_LABELS: Record<IndexatieBasis, string> = {
  CPI: 'CPI',
  vast_pct: 'Vast %',
  geen: 'Geen indexatie',
  custom: 'Custom',
};

export const EXCLUSIVITEIT_LABELS: Record<ExclusiviteitVoorkeur, string> = {
  alleen_off_market: 'Alleen off-market',
  beide: 'Beide',
  geen_voorkeur: 'Geen voorkeur',
};

export const PROVINCIES = [
  'Groningen', 'Friesland', 'Drenthe',
  'Overijssel', 'Flevoland', 'Gelderland',
  'Utrecht', 'Noord-Holland', 'Zuid-Holland', 'Zeeland',
  'Noord-Brabant', 'Limburg',
];

export const REGIO_OPTIES = ['Randstad', ...PROVINCIES];


// =====================================================================
// HELPERS
// =====================================================================

export const formatCurrency = (amount?: number): string => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCurrencyCompact = (amount?: number): string => {
  if (amount == null) return '—';
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

export const formatPercent = (n?: number, digits = 1): string => {
  if (n == null) return '—';
  return `${n.toLocaleString('nl-NL', { maximumFractionDigits: digits })}%`;
};

export const formatM2 = (n?: number): string => {
  if (n == null) return '—';
  return `${n.toLocaleString('nl-NL')} m²`;
};


// =====================================================================
// MATCHING ENGINE
// =====================================================================

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

const ENERGIELABEL_VOLGORDE: Energielabel[] =
  ['A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'];

export function berekenMatchScore(
  object: ObjectVastgoed,
  profiel: Zoekprofiel,
): MatchResult | null {
  const redenen: string[] = [];
  let score = 0;

  // HARDE CRITERIA
  if (!profiel.typeVastgoed || profiel.typeVastgoed.length === 0) return null;
  if (!profiel.typeVastgoed.includes(object.type)) return null;
  score += 25;
  redenen.push(`Type matcht (${ASSET_CLASS_LABELS[object.type]})`);

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

  // Bouwjaar
  if (typeof object.bouwjaar === 'number') {
    if (typeof profiel.bouwjaarMin === 'number' && object.bouwjaar < profiel.bouwjaarMin) return null;
    if (typeof profiel.bouwjaarMax === 'number' && object.bouwjaar > profiel.bouwjaarMax) return null;
  }

  // Leegstand
  if (typeof profiel.leegstandMaxPct === 'number' && typeof object.leegstandPct === 'number') {
    if (object.leegstandPct > profiel.leegstandMaxPct) return null;
    score += 5;
    redenen.push('Leegstand binnen grens');
  }

  // ZACHTE CRITERIA
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

  if (profiel.energielabelMin && object.energielabelV2) {
    if (ENERGIELABEL_VOLGORDE.indexOf(object.energielabelV2)
        <= ENERGIELABEL_VOLGORDE.indexOf(profiel.energielabelMin)) {
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
