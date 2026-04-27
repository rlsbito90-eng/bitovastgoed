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

// ---- PIPELINE ----
export type PipelineFase =
  | 'match_gevonden'
  | 'teaser_verstuurd'
  | 'interesse_ontvangen'
  | 'nda_verstuurd'
  | 'nda_getekend'
  | 'informatie_gedeeld'
  | 'bezichtiging_gepland'
  | 'bezichtiging_geweest'
  | 'indicatieve_bieding'
  | 'onderhandeling'
  | 'loi_ontvangen'
  | 'due_diligence'
  | 'koopovereenkomst_concept'
  | 'koopovereenkomst_getekend'
  | 'transport_closing'
  | 'afgerond'
  | 'afgevallen';

export type InteresseNiveau = 'koud' | 'lauw' | 'warm' | 'zeer_warm';

export type VolgendeActieType =
  | 'bellen' | 'mailen' | 'whatsapp' | 'nda_sturen' | 'stukken_delen'
  | 'bezichtiging_plannen' | 'bieding_opvolgen' | 'onderhandelen' | 'overig';

export const PIPELINE_FASES: { key: PipelineFase; label: string }[] = [
  { key: 'match_gevonden',          label: 'Match gevonden' },
  { key: 'teaser_verstuurd',        label: 'Teaser verstuurd' },
  { key: 'interesse_ontvangen',     label: 'Interesse ontvangen' },
  { key: 'nda_verstuurd',           label: 'NDA verstuurd' },
  { key: 'nda_getekend',            label: 'NDA getekend' },
  { key: 'informatie_gedeeld',      label: 'Informatie gedeeld' },
  { key: 'bezichtiging_gepland',    label: 'Bezichtiging gepland' },
  { key: 'bezichtiging_geweest',    label: 'Bezichtiging geweest' },
  { key: 'indicatieve_bieding',     label: 'Indicatieve bieding' },
  { key: 'onderhandeling',          label: 'Onderhandeling' },
  { key: 'loi_ontvangen',           label: 'LOI ontvangen' },
  { key: 'due_diligence',           label: 'Due diligence' },
  { key: 'koopovereenkomst_concept',label: 'KO concept' },
  { key: 'koopovereenkomst_getekend',label: 'KO getekend' },
  { key: 'transport_closing',       label: 'Transport / closing' },
  { key: 'afgerond',                label: 'Afgerond' },
  { key: 'afgevallen',              label: 'Afgevallen' },
];

export const INTERESSE_LABELS: Record<InteresseNiveau, string> = {
  koud: 'Koud', lauw: 'Lauw', warm: 'Warm', zeer_warm: 'Zeer warm',
};

export const VOLGENDE_ACTIE_LABELS: Record<VolgendeActieType, string> = {
  bellen: 'Bellen',
  mailen: 'Mailen',
  whatsapp: 'WhatsApp',
  nda_sturen: 'NDA sturen',
  stukken_delen: 'Stukken delen',
  bezichtiging_plannen: 'Bezichtiging plannen',
  bieding_opvolgen: 'Bieding opvolgen',
  onderhandelen: 'Onderhandelen',
  overig: 'Overig',
};

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
  assetClasses: AssetClass[];        // legacy
  propertyTypeIds?: string[];        // nieuwe taxonomie
  propertySubtypeIds?: string[];     // nieuwe taxonomie
  dealTypeIds?: string[];            // nieuwe taxonomie
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

  // Classificatie (legacy)
  type: AssetClass;
  subcategorie?: string;          // legacy free-text
  subcategorieId?: string;        // FK naar object_subcategorieen (legacy)
  // Nieuwe taxonomie
  propertyTypeId?: string;        // FK property_types
  propertySubtypeIds?: string[];  // FK[] property_subtypes
  dealTypeIds?: string[];         // FK[] deal_types

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

  // IM-content (uitgebreid voor 18-sectie IM)
  propositie?: string;
  objectomschrijving?: string;
  locatieOmschrijving?: string;
  technischeStaatOmschrijving?: string;
  procesVoorwaarden?: string;
  dataroomUrl?: string;

  // Marktwaarde-indicatie (handmatig, los van referentie-mediaan)
  marktwaardeIndicatie?: number;
  marktwaardeBron?: string;

  // Document-contactgegevens (los van verantwoordelijke profiel)
  contactNaam?: string;
  contactFunctie?: string;
  contactTelefoon?: string;
  contactEmail?: string;

  // Gestructureerde IM-velden
  oppervlaktenPerVerdieping?: Array<{
    verdieping: string;
    vvo?: number;
    bvo?: number;
    bestemming?: string;
  }>;
  financieleScenarios?: {
    huidig?: { jaarhuur?: number; bar?: number; noi?: number; opmerking?: string };
    marktconform?: { jaarhuur?: number; bar?: number; noi?: number; opmerking?: string };
    naRenovatie?: { jaarhuur?: number; bar?: number; noi?: number; opmerking?: string };
  };
  /** Status per documenttype: 'beschikbaar' | 'op_aanvraag' | 'na_nda'. Alleen tonen in IM als sectie-toggle aan staat. */
  documentatieStatus?: Record<string, 'beschikbaar' | 'op_aanvraag' | 'na_nda'>;
  /** Per IM-sectie zichtbaar maken in document. Default: undefined = laat code beslissen op basis van content. */
  imSectiesZichtbaar?: Record<string, boolean>;

  // Overig
  documentenBeschikbaar: boolean;
  interneOpmerkingen?: string;
  opmerkingen?: string;
  datumToegevoegd: string;
  updatedAt?: string;
  /**
   * Toggle om de referentieanalyse-sectie op object-detail te tonen.
   * Default true.
   */
  referentieanalyseZichtbaar?: boolean;
  softDeletedAt?: string;

  // Object Pipeline (Pipedrive-stijl) — los van object_pipeline (kandidaat)
  pipelineId?: string;
  pipelineStageId?: string;
  pipelineUpdatedAt?: string;
  pipelineStageLocked?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  entityType: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  slug: string;
  sortOrder: number;
  color?: string;
  probability?: number;
  isWon: boolean;
  isLost: boolean;
  isActive: boolean;
}

/**
 * Mapping van kandidaat-pipelinefase (object_pipeline) naar object-pipeline stage-slug.
 * Wordt gebruikt voor lichte automatische voortgang van het object zelf wanneer
 * een kandidaat verder schuift. Alleen vooruit, nooit terugzetten.
 */
export const KANDIDAAT_NAAR_OBJECT_STAGE: Partial<Record<PipelineFase, string>> = {
  match_gevonden: 'in_verkoop',
  teaser_verstuurd: 'kandidaten_benaderd',
  interesse_ontvangen: 'kandidaten_benaderd',
  nda_verstuurd: 'nda_dataroom',
  nda_getekend: 'nda_dataroom',
  informatie_gedeeld: 'nda_dataroom',
  bezichtiging_gepland: 'bezichtigingen',
  bezichtiging_geweest: 'bezichtigingen',
  indicatieve_bieding: 'biedingen_ontvangen',
  onderhandeling: 'onderhandeling',
  loi_ontvangen: 'loi',
  due_diligence: 'due_diligence',
  koopovereenkomst_concept: 'koopovereenkomst',
  koopovereenkomst_getekend: 'koopovereenkomst',
  transport_closing: 'closing',
  afgerond: 'afgerond',
  afgevallen: 'afgevallen',
};

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
  isPlattegrond?: boolean;
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
  typeVastgoed: AssetClass[];        // legacy
  subcategorieIds?: string[];        // legacy
  // Nieuwe taxonomie
  propertyTypeIds?: string[];
  propertySubtypeIds?: string[];
  dealTypeIds?: string[];
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
  updatedAt?: string;
}

export interface Deal {
  id: string;
  objectId: string;
  relatieId: string;
  fase: DealFase;
  interessegraad: number;
  datumEersteContact: string;
  datumFollowUp?: string;
  followUpTijd?: string;
  bezichtigingGepland?: string;
  bezichtigingTijd?: string;
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
  /**
   * Toggle om de referentieanalyse-sectie op deze deal-detail te tonen.
   * Default true (sectie zichtbaar). Aan/uit te zetten in DealFormDialog
   * tab Basis. Bestaande deals krijgen `true` via DB-default.
   */
  referentieanalyseZichtbaar?: boolean;
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

export interface PipelineKandidaat {
  id: string;
  objectId: string;
  relatieId: string;
  zoekprofielId?: string;

  pipelineFase: PipelineFase;
  interesseNiveau: InteresseNiveau;
  matchscore?: number;

  teaserVerstuurd: boolean;
  teaserVerstuurdOp?: string;
  ndaVerstuurd: boolean;
  ndaVerstuurdOp?: string;
  ndaGetekend: boolean;
  ndaGetekendOp?: string;
  informatieGedeeld: boolean;
  informatieGedeeldOp?: string;

  bezichtigingDatum?: string;
  biedingBedrag?: number;
  biedingVoorwaarden?: string;
  financieringsvoorbehoud?: boolean;
  gewensteLevering?: string;
  feeAkkoord: boolean;

  laatsteContactdatum?: string;
  volgendeActie?: VolgendeActieType;
  volgendeActieOmschrijving?: string;
  volgendeActieDatum?: string;

  notities?: string;
  redenAfgevallen?: string;

  createdAt?: string;
  updatedAt?: string;
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

// ---- REFERENTIE-OBJECTEN ----
export interface ReferentieObject {
  id: string;
  adres: string;
  postcode: string;
  plaats: string;
  assetClass: AssetClass;
  m2: number;
  vraagprijs: number;
  /** Door DB berekend (generated stored). Optioneel, omdat client soms zonder werkt. */
  prijsPerM2?: number;
  bouwjaar: number;
  energielabel?: Energielabel;
  huurstatus?: VerhuurStatus;
  huurprijsPerMaand?: number;
  huurprijsPerJaar?: number;
  bron?: string;
  notities?: string;
  softDeletedAt?: string;
  createdAt?: string;
}

export interface DealReferentie {
  id: string;
  dealId: string;
  referentieObjectId: string;
  notities?: string;
}

export interface ObjectReferentie {
  id: string;
  objectId: string;
  referentieObjectId: string;
  notities?: string;
  createdAt: string;
  updatedAt?: string;
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

// €/m² formatter - voor prijs/m², huur/m², bod/m²
export const formatEurPerM2 = (eur?: number, m2?: number, perJaar = false): string => {
  if (!eur || !m2 || m2 <= 0) return '—';
  const v = eur / m2;
  const rounded = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `€${rounded.toLocaleString('nl-NL')}/m²${perJaar ? '/jr' : ''}`;
};

// Berekent prijs/m² (capital deal); huur/m²/jr; bod/m². Geeft `null` als
// onmogelijk te berekenen (ontbrekende waarde of ongeldige oppervlakte).
export const eurPerM2 = (eur?: number, m2?: number): number | null => {
  if (!eur || !m2 || m2 <= 0) return null;
  return eur / m2;
};


// =====================================================================
// MATCHING ENGINE
// =====================================================================

/**
 * Categorie-key voor een matchcomponent. Wordt gebruikt door de UI om
 * positieve, ontbrekende en mismatch-factoren te groeperen onder
 * "Waarom deze match?".
 */
export type MatchCategorie =
  | 'type'
  | 'subcategorie'
  | 'dealtype'
  | 'regio'
  | 'budget'
  | 'oppervlakte'
  | 'bouwjaar'
  | 'leegstand'
  | 'verhuurstatus'
  | 'rendement'
  | 'walt'
  | 'energielabel'
  | 'potentie'
  | 'overig';

/** Aard van een matchcomponent. */
export type MatchAard = 'positief' | 'ontbrekend' | 'mismatch' | 'fallback';

export interface MatchFactor {
  categorie: MatchCategorie;
  aard: MatchAard;
  /** Korte, voor de gebruiker leesbare beschrijving. */
  label: string;
  /** Optioneel toegekend aantal punten (positief of negatief). */
  punten?: number;
  /** Optioneel maximaal aantal punten voor deze categorie. */
  max?: number;
}

export type MatchBetrouwbaarheid = 'hoog' | 'middel' | 'laag';

export interface MatchResult {
  zoekprofielId: string;
  relatieId: string;
  objectId: string;
  /** 0-100, gecapt. */
  score: number;
  /** Korte one-liners voor compacte weergaven. */
  redenen: string[];
  /** Volledige uitleg per criterium (voor "Waarom deze match?"). */
  factoren: MatchFactor[];
  /** Categorieën die niet beoordeeld konden worden door ontbrekende data. */
  ontbrekendeData: MatchCategorie[];
  /** Categorieën die actief negatief uitvallen. */
  mismatches: MatchCategorie[];
  /** Vlag dat ergens legacy assetClass/asset_classes als fallback is gebruikt. */
  gebruikteFallback: boolean;
  /** Globale kwaliteitsindicatie (los van ruwe score). */
  betrouwbaarheid: MatchBetrouwbaarheid;
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

// Maxima per nieuwe taxonomie-categorie (zie spec van de uitbreiding).
const MAX_TYPE = 25;
const MAX_SUBCAT = 20;
const MAX_DEAL = 20;

function hasOverlap<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  if (!a || !b || a.length === 0 || b.length === 0) return [];
  const set = new Set(b);
  return a.filter(x => set.has(x));
}

export function berekenMatchScore(
  object: ObjectVastgoed,
  profiel: Zoekprofiel,
): MatchResult | null {
  const redenen: string[] = [];
  const factoren: MatchFactor[] = [];
  const ontbrekendeData: MatchCategorie[] = [];
  const mismatches: MatchCategorie[] = [];
  let gebruikteFallback = false;
  let score = 0;

  // ----------------------------------------------------------------
  // 1. TYPE VASTGOED — nieuwe taxonomie met legacy fallback (max 25)
  // ----------------------------------------------------------------
  const objectHeeftNieuwType = !!object.propertyTypeId;
  const profielHeeftNieuwType = !!(profiel.propertyTypeIds && profiel.propertyTypeIds.length > 0);

  if (objectHeeftNieuwType && profielHeeftNieuwType) {
    if (profiel.propertyTypeIds!.includes(object.propertyTypeId!)) {
      score += MAX_TYPE;
      const label = `Type vastgoed matcht (${ASSET_CLASS_LABELS[object.type]})`;
      redenen.push(label);
      factoren.push({ categorie: 'type', aard: 'positief', label, punten: MAX_TYPE, max: MAX_TYPE });
    } else {
      // Geen overlap op nieuwe taxonomie — harde knock-out.
      return null;
    }
  } else {
    // Legacy fallback op assetClass / typeVastgoed[].
    if (!profiel.typeVastgoed || profiel.typeVastgoed.length === 0) {
      // Profiel heeft geen typevoorkeur ingevuld — niet beoordeelbaar.
      ontbrekendeData.push('type');
      factoren.push({
        categorie: 'type', aard: 'ontbrekend',
        label: 'Geen type vastgoed in zoekprofiel opgegeven',
      });
    } else if (!profiel.typeVastgoed.includes(object.type)) {
      return null;
    } else {
      score += MAX_TYPE;
      gebruikteFallback = true;
      const label = `Type vastgoed matcht (${ASSET_CLASS_LABELS[object.type]}) — via legacy classificatie`;
      redenen.push(`Type matcht (${ASSET_CLASS_LABELS[object.type]})`);
      factoren.push({ categorie: 'type', aard: 'fallback', label, punten: MAX_TYPE, max: MAX_TYPE });
    }
  }

  // ----------------------------------------------------------------
  // 2. SUBCATEGORIE — nieuwe taxonomie met legacy fallback (max 20)
  // ----------------------------------------------------------------
  const objectSubs = object.propertySubtypeIds ?? [];
  const profielSubs = profiel.propertySubtypeIds ?? [];

  if (profielSubs.length > 0 && objectSubs.length > 0) {
    const overlap = hasOverlap(objectSubs, profielSubs);
    if (overlap.length > 0) {
      // 12 punten voor minstens 1 overlap, +4 per extra (cap 20)
      const punten = Math.min(MAX_SUBCAT, 12 + (overlap.length - 1) * 4);
      score += punten;
      const label = `Subcategorie matcht (${overlap.length} overlap${overlap.length === 1 ? '' : 'pen'})`;
      redenen.push(label);
      factoren.push({ categorie: 'subcategorie', aard: 'positief', label, punten, max: MAX_SUBCAT });
    } else {
      // Profiel én object hebben subcategorieën, maar geen overlap. Geen knock-out,
      // wel een mismatch en lager vertrouwen.
      mismatches.push('subcategorie');
      factoren.push({
        categorie: 'subcategorie', aard: 'mismatch',
        label: 'Subcategorieën komen niet overeen', punten: 0, max: MAX_SUBCAT,
      });
    }
  } else if (profielSubs.length > 0 && objectSubs.length === 0) {
    // Object niet geclassificeerd op subniveau — beperkte score (8/20)
    score += 8;
    ontbrekendeData.push('subcategorie');
    factoren.push({
      categorie: 'subcategorie', aard: 'ontbrekend',
      label: 'Object heeft geen subcategorie ingevuld', punten: 8, max: MAX_SUBCAT,
    });
  } else if (profielSubs.length === 0 && objectSubs.length > 0) {
    // Koper heeft geen subvoorkeur, dus alle subs passen → halve score
    score += 10;
    factoren.push({
      categorie: 'subcategorie', aard: 'positief',
      label: 'Koper heeft geen subvoorkeur — geen beperking',
      punten: 10, max: MAX_SUBCAT,
    });
  } else if (profiel.subcategorieIds && profiel.subcategorieIds.length > 0) {
    // Legacy fallback op oude subcategorie_id
    if (!object.subcategorieId || !profiel.subcategorieIds.includes(object.subcategorieId)) {
      mismatches.push('subcategorie');
      factoren.push({
        categorie: 'subcategorie', aard: 'mismatch',
        label: 'Legacy subcategorie matcht niet', punten: 0, max: MAX_SUBCAT,
      });
    } else {
      score += 12;
      gebruikteFallback = true;
      factoren.push({
        categorie: 'subcategorie', aard: 'fallback',
        label: 'Subcategorie matcht via legacy veld', punten: 12, max: MAX_SUBCAT,
      });
    }
  } else {
    ontbrekendeData.push('subcategorie');
  }

  // ----------------------------------------------------------------
  // 3. DEALTYPE / PROPOSITIE — alleen nieuwe taxonomie (max 20)
  // ----------------------------------------------------------------
  const objectDeals = object.dealTypeIds ?? [];
  const profielDeals = profiel.dealTypeIds ?? [];

  if (profielDeals.length > 0 && objectDeals.length > 0) {
    const overlap = hasOverlap(objectDeals, profielDeals);
    if (overlap.length > 0) {
      const punten = Math.min(MAX_DEAL, 12 + (overlap.length - 1) * 4);
      score += punten;
      const label = `Dealtype matcht (${overlap.length} overlap${overlap.length === 1 ? '' : 'pen'})`;
      redenen.push(label);
      factoren.push({
        categorie: 'dealtype', aard: 'positief', label, punten, max: MAX_DEAL,
      });
    } else {
      mismatches.push('dealtype');
      factoren.push({
        categorie: 'dealtype', aard: 'mismatch',
        label: 'Dealtypes komen niet overeen', punten: 0, max: MAX_DEAL,
      });
    }
  } else if (profielDeals.length > 0 && objectDeals.length === 0) {
    score += 6;
    ontbrekendeData.push('dealtype');
    factoren.push({
      categorie: 'dealtype', aard: 'ontbrekend',
      label: 'Object heeft geen dealtype ingevuld', punten: 6, max: MAX_DEAL,
    });
  } else if (profielDeals.length === 0) {
    ontbrekendeData.push('dealtype');
    factoren.push({
      categorie: 'dealtype', aard: 'ontbrekend',
      label: 'Geen dealtype geselecteerd in zoekprofiel',
    });
  }

  // ----------------------------------------------------------------
  // 4. REGIO (bestaande logica, max 20)
  // ----------------------------------------------------------------
  if (profiel.regio && profiel.regio.length > 0) {
    if (!regioMatcht(profiel, object)) return null;
    score += 20;
    const label = `Regio matcht (${object.plaats || object.provincie})`;
    redenen.push(label);
    factoren.push({ categorie: 'regio', aard: 'positief', label, punten: 20, max: 20 });
  } else {
    score += 5;
    factoren.push({
      categorie: 'regio', aard: 'ontbrekend',
      label: 'Geen regio-voorkeur opgegeven', punten: 5, max: 20,
    });
  }

  // ----------------------------------------------------------------
  // 5. BUDGET / PRIJSRANGE (bestaand, max 25)
  // ----------------------------------------------------------------
  if (typeof object.vraagprijs === 'number') {
    if (typeof profiel.prijsMin === 'number' && object.vraagprijs < profiel.prijsMin) return null;
    if (typeof profiel.prijsMax === 'number' && object.vraagprijs > profiel.prijsMax) return null;
    if (typeof profiel.prijsMin === 'number' || typeof profiel.prijsMax === 'number') {
      score += 25;
      redenen.push('Prijs binnen budget');
      factoren.push({
        categorie: 'budget', aard: 'positief',
        label: 'Vraagprijs valt binnen budget', punten: 25, max: 25,
      });
    } else {
      score += 5;
      factoren.push({
        categorie: 'budget', aard: 'ontbrekend',
        label: 'Geen budget opgegeven in zoekprofiel', punten: 5, max: 25,
      });
    }
  } else if (typeof profiel.prijsMin === 'number' || typeof profiel.prijsMax === 'number') {
    redenen.push('Vraagprijs onbekend');
    ontbrekendeData.push('budget');
    factoren.push({
      categorie: 'budget', aard: 'ontbrekend',
      label: 'Vraagprijs object onbekend', max: 25,
    });
  }

  // ----------------------------------------------------------------
  // 6. OPPERVLAKTE (bestaand, max 10)
  // ----------------------------------------------------------------
  if (typeof object.oppervlakte === 'number') {
    if (typeof profiel.oppervlakteMin === 'number' && object.oppervlakte < profiel.oppervlakteMin) return null;
    if (typeof profiel.oppervlakteMax === 'number' && object.oppervlakte > profiel.oppervlakteMax) return null;
    if (typeof profiel.oppervlakteMin === 'number' || typeof profiel.oppervlakteMax === 'number') {
      score += 10;
      redenen.push('Oppervlakte binnen range');
      factoren.push({
        categorie: 'oppervlakte', aard: 'positief',
        label: 'Oppervlakte binnen range', punten: 10, max: 10,
      });
    }
  }

  // ----------------------------------------------------------------
  // 7. BOUWJAAR
  // ----------------------------------------------------------------
  if (typeof object.bouwjaar === 'number') {
    if (typeof profiel.bouwjaarMin === 'number' && object.bouwjaar < profiel.bouwjaarMin) return null;
    if (typeof profiel.bouwjaarMax === 'number' && object.bouwjaar > profiel.bouwjaarMax) return null;
  }

  // ----------------------------------------------------------------
  // 8. LEEGSTAND
  // ----------------------------------------------------------------
  if (typeof profiel.leegstandMaxPct === 'number' && typeof object.leegstandPct === 'number') {
    if (object.leegstandPct > profiel.leegstandMaxPct) return null;
    score += 5;
    redenen.push('Leegstand binnen grens');
    factoren.push({
      categorie: 'leegstand', aard: 'positief',
      label: 'Leegstand binnen grens', punten: 5, max: 5,
    });
  }

  // ----------------------------------------------------------------
  // 9. ZACHTE CRITERIA
  // ----------------------------------------------------------------
  if (profiel.verhuurStatus) {
    if (object.verhuurStatus === profiel.verhuurStatus) {
      score += 10;
      redenen.push(`Verhuurstatus matcht (${object.verhuurStatus})`);
      factoren.push({
        categorie: 'verhuurstatus', aard: 'positief',
        label: `Verhuurstatus matcht (${object.verhuurStatus})`, punten: 10, max: 10,
      });
    } else {
      score -= 5;
      mismatches.push('verhuurstatus');
      factoren.push({
        categorie: 'verhuurstatus', aard: 'mismatch',
        label: `Verhuurstatus wijkt af (${object.verhuurStatus ?? 'onbekend'})`,
        punten: -5, max: 10,
      });
    }
  }

  if (profiel.ontwikkelPotentie && object.ontwikkelPotentie) {
    score += 5;
    redenen.push('Ontwikkelpotentie aanwezig');
    factoren.push({
      categorie: 'potentie', aard: 'positief',
      label: 'Ontwikkelpotentie aanwezig', punten: 5, max: 5,
    });
  }
  if (profiel.transformatiePotentie && object.transformatiePotentie) {
    score += 5;
    redenen.push('Transformatiepotentie aanwezig');
    factoren.push({
      categorie: 'potentie', aard: 'positief',
      label: 'Transformatiepotentie aanwezig', punten: 5, max: 5,
    });
  }

  if (profiel.energielabelMin && object.energielabelV2) {
    if (ENERGIELABEL_VOLGORDE.indexOf(object.energielabelV2)
        <= ENERGIELABEL_VOLGORDE.indexOf(profiel.energielabelMin)) {
      score += 5;
      redenen.push('Energielabel voldoet');
      factoren.push({
        categorie: 'energielabel', aard: 'positief',
        label: `Energielabel ${object.energielabelV2} voldoet aan ≥ ${profiel.energielabelMin}`,
        punten: 5, max: 5,
      });
    } else {
      mismatches.push('energielabel');
      factoren.push({
        categorie: 'energielabel', aard: 'mismatch',
        label: `Energielabel ${object.energielabelV2} voldoet niet aan ≥ ${profiel.energielabelMin}`,
        max: 5,
      });
    }
  }

  score = Math.max(0, Math.min(100, score));
  if (score < 25) return null;

  // ----------------------------------------------------------------
  // BETROUWBAARHEID
  // Score + hoeveel kernvelden ingevuld waren bepalen het etiket.
  // Kernvelden: type, subcategorie, dealtype, regio, budget.
  // ----------------------------------------------------------------
  const kernIngevuld = [
    objectHeeftNieuwType && profielHeeftNieuwType,
    objectSubs.length > 0 && profielSubs.length > 0,
    objectDeals.length > 0 && profielDeals.length > 0,
    !!(profiel.regio && profiel.regio.length > 0),
    typeof object.vraagprijs === 'number'
      && (typeof profiel.prijsMin === 'number' || typeof profiel.prijsMax === 'number'),
  ].filter(Boolean).length;

  let betrouwbaarheid: MatchBetrouwbaarheid;
  if (score >= 70 && kernIngevuld >= 3 && mismatches.length === 0) {
    betrouwbaarheid = 'hoog';
  } else if (score >= 45 && kernIngevuld >= 2) {
    betrouwbaarheid = 'middel';
  } else {
    betrouwbaarheid = 'laag';
  }

  return {
    zoekprofielId: profiel.id,
    relatieId: profiel.relatieId,
    objectId: object.id,
    score,
    redenen,
    factoren,
    ontbrekendeData,
    mismatches,
    gebruikteFallback,
    betrouwbaarheid,
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


// =====================================================================
// JAAR-DOELEN
// =====================================================================

export interface JaarDoel {
  id: string;
  jaar: number;
  commissieDoelBedrag?: number;
  dealwaardeDoelBedrag?: number;
  notities?: string;
}


// =====================================================================
// COMMISSIE / SUCCESSEN HELPERS
// =====================================================================
// Gewogen pipeline-waarde: commissie × kans per fase.
// Percentages als uitgangspunt — kunnen later verfijnd worden per dealtype.

export const FASE_KANS: Record<DealFase, number> = {
  lead: 0.05,
  introductie: 0.10,
  interesse: 0.20,
  bezichtiging: 0.35,
  bieding: 0.55,
  onderhandeling: 0.75,
  closing: 0.90,
  afgerond: 1.00,
  afgevallen: 0.00,
};

export interface CommissieStats {
  gerealiseerdBedrag: number;           // sum commissie_bedrag afgeronde deals (huidig jaar)
  gerealiseerdAantalDeals: number;      // aantal afgeronde deals (huidig jaar)
  pipelineBedragGewogen: number;        // sum commissie × fase-kans actieve deals
  pipelineBedragTotaal: number;         // sum commissie_bedrag actieve deals (ongewogen)
  pipelineAantalDeals: number;          // aantal actieve deals
  dealwaardeGerealiseerd: number;       // sum vraagprijs afgeronde deals (huidig jaar)
}

export function berekenCommissieStats(
  deals: Deal[],
  vraagprijsPerObject: (objectId: string) => number | undefined,
  jaar?: number,
): CommissieStats {
  const huidigJaar = jaar ?? new Date().getFullYear();
  let gerealiseerdBedrag = 0;
  let gerealiseerdAantalDeals = 0;
  let pipelineBedragGewogen = 0;
  let pipelineBedragTotaal = 0;
  let pipelineAantalDeals = 0;
  let dealwaardeGerealiseerd = 0;

  for (const deal of deals) {
    const commissie = deal.commissieBedrag ?? 0;
    const jaarVanDeal = deal.verwachteClosingdatum
      ? new Date(deal.verwachteClosingdatum).getFullYear()
      : (deal.datumEersteContact ? new Date(deal.datumEersteContact).getFullYear() : huidigJaar);

    if (deal.fase === 'afgerond' && jaarVanDeal === huidigJaar) {
      gerealiseerdBedrag += commissie;
      gerealiseerdAantalDeals += 1;
      dealwaardeGerealiseerd += vraagprijsPerObject(deal.objectId) ?? 0;
    } else if (deal.fase !== 'afgerond' && deal.fase !== 'afgevallen') {
      pipelineBedragTotaal += commissie;
      pipelineBedragGewogen += commissie * FASE_KANS[deal.fase];
      pipelineAantalDeals += 1;
    }
  }

  return {
    gerealiseerdBedrag,
    gerealiseerdAantalDeals,
    pipelineBedragGewogen,
    pipelineBedragTotaal,
    pipelineAantalDeals,
    dealwaardeGerealiseerd,
  };
}

export function getRecenteSuccessen(deals: Deal[], limit = 5): Deal[] {
  return deals
    .filter(d => d.fase === 'afgerond')
    .sort((a, b) => {
      const dA = a.verwachteClosingdatum ?? a.datumEersteContact ?? '';
      const dB = b.verwachteClosingdatum ?? b.datumEersteContact ?? '';
      return dB.localeCompare(dA);
    })
    .slice(0, limit);
}


// =====================================================================
// REFERENTIE-OBJECT KWALITEIT
// =====================================================================
// Heuristische scoring zodat een gebruiker direct ziet of een object goed
// bruikbaar is als referentie. Berekent ook welke velden ontbreken.

export type ReferentieKwaliteit = 'zeer_sterk' | 'goed' | 'bruikbaar' | 'zwak';

export const REFERENTIE_KWALITEIT_LABELS: Record<ReferentieKwaliteit, string> = {
  zeer_sterk: 'Zeer sterke referentie',
  goed: 'Goede referentie',
  bruikbaar: 'Bruikbare referentie',
  zwak: 'Zwakke referentie',
};

export interface ReferentieKwaliteitResultaat {
  qualityScore: number;        // 0-100
  completenessPct: number;     // 0-100
  kwaliteit: ReferentieKwaliteit;
  ontbrekendeAanbevolen: string[];
  ontbrekendeNuttig: string[];
}

// Bereken eenheidsprijzen — utility, ook gebruikt in form-display.
export function berekenPrijsPerM2(prijs?: number, m2?: number): number | undefined {
  if (!prijs || !m2 || m2 <= 0) return undefined;
  return prijs / m2;
}
export function berekenHuurPerM2PerMaand(huurMaand?: number, m2?: number): number | undefined {
  if (!huurMaand || !m2 || m2 <= 0) return undefined;
  return huurMaand / m2;
}
export function berekenHuurPerM2PerJaar(huurJaar?: number, m2?: number): number | undefined {
  if (!huurJaar || !m2 || m2 <= 0) return undefined;
  return huurJaar / m2;
}

interface ReferentieKwaliteitInput {
  adres?: string;
  postcode?: string;
  plaats?: string;
  assetClass?: AssetClass;
  m2?: number;
  vraagprijs?: number;
  bouwjaar?: number;
  energielabel?: Energielabel;
  huurstatus?: VerhuurStatus;
  bron?: string;
}

// Sterk aanbevolen (heavy) en nuttig (light) velden.
const REF_AANBEVOLEN: { key: keyof ReferentieKwaliteitInput; label: string; weight: number }[] = [
  { key: 'adres',      label: 'adres',       weight: 14 },
  { key: 'postcode',   label: 'postcode',    weight: 14 },
  { key: 'plaats',     label: 'plaats',      weight: 12 },
  { key: 'assetClass', label: 'asset class', weight: 14 },
  { key: 'm2',         label: 'm²',          weight: 14 },
  { key: 'vraagprijs', label: 'vraagprijs',  weight: 14 },
  { key: 'bouwjaar',   label: 'bouwjaar',    weight: 8 },
];
const REF_NUTTIG: { key: keyof ReferentieKwaliteitInput; label: string; weight: number }[] = [
  { key: 'energielabel', label: 'energielabel', weight: 4 },
  { key: 'huurstatus',   label: 'huurstatus',   weight: 3 },
  { key: 'bron',         label: 'bron',         weight: 3 },
];

function isIngevuld(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return !Number.isNaN(v) && v > 0;
  return true;
}

export function berekenReferentieKwaliteit(input: ReferentieKwaliteitInput): ReferentieKwaliteitResultaat {
  let score = 0;
  const ontbrekendeAanbevolen: string[] = [];
  const ontbrekendeNuttig: string[] = [];

  for (const v of REF_AANBEVOLEN) {
    if (isIngevuld(input[v.key])) score += v.weight;
    else ontbrekendeAanbevolen.push(v.label);
  }
  for (const v of REF_NUTTIG) {
    if (isIngevuld(input[v.key])) score += v.weight;
    else ontbrekendeNuttig.push(v.label);
  }

  const totaalGewicht = [...REF_AANBEVOLEN, ...REF_NUTTIG].reduce((a, b) => a + b.weight, 0);
  const qualityScore = Math.round((score / totaalGewicht) * 100);

  const totaalVelden = REF_AANBEVOLEN.length + REF_NUTTIG.length;
  const ingevuld = totaalVelden - ontbrekendeAanbevolen.length - ontbrekendeNuttig.length;
  const completenessPct = Math.round((ingevuld / totaalVelden) * 100);

  const kwaliteit: ReferentieKwaliteit =
    qualityScore >= 90 ? 'zeer_sterk'
    : qualityScore >= 75 ? 'goed'
    : qualityScore >= 60 ? 'bruikbaar'
    : 'zwak';

  return { qualityScore, completenessPct, kwaliteit, ontbrekendeAanbevolen, ontbrekendeNuttig };
}

// Variant op ObjectVastgoed-vorm (gewone objecten / dealobjecten).
export function berekenObjectReferentieKwaliteit(input: {
  adres?: string;
  postcode?: string;
  plaats?: string;
  type?: AssetClass;
  oppervlakte?: number;
  vraagprijs?: number;
  bouwjaar?: number;
  energielabelV2?: Energielabel;
  verhuurStatus?: VerhuurStatus;
  bron?: string;
  perceelOppervlakte?: number;
  onderhoudsstaatNiveau?: OnderhoudsstaatNiveau;
  huurPerM2?: number;
}): ReferentieKwaliteitResultaat {
  return berekenReferentieKwaliteit({
    adres: input.adres,
    postcode: input.postcode,
    plaats: input.plaats,
    assetClass: input.type,
    m2: input.oppervlakte,
    vraagprijs: input.vraagprijs,
    bouwjaar: input.bouwjaar,
    energielabel: input.energielabelV2,
    huurstatus: input.verhuurStatus,
    bron: input.bron,
  });
}


// =====================================================================
// REFERENTIE AUTO-MATCHING
// =====================================================================
// Helper voor het vinden van vergelijkbare referentieobjecten voor een
// gegeven object. Gebruikt voor auto-suggesties in de
// DealReferentieAnalyseSectie (geen automatische koppeling — Ramysh
// blijft in controle).
//
// Scoring:
//   - Asset class match: VERPLICHT (anders score 0)
//   - Plaats match: 50 punten
//   - Bouwjaar binnen 15 jaar: tot 25 punten (lineair afnemend)
//   - Oppervlakte binnen 50%: tot 25 punten (lineair afnemend)
// Maximum: 100, weergegeven als "X% match".

export interface ReferentieMatch {
  referentie: ReferentieObject;
  matchScore: number;          // 0-100
  matchRedenen: string[];      // korte beschrijvingen voor UI
}

export interface ReferentieMatchInput {
  type?: AssetClass;
  plaats?: string;
  bouwjaar?: number;
  oppervlakte?: number;
}

export function vindVergelijkbareReferenties(
  doel: ReferentieMatchInput,
  alleReferenties: ReferentieObject[],
  reedsGekoppelde: Set<string>,
  drempel = 50,
): ReferentieMatch[] {
  if (!doel.type) return [];

  const resultaten: ReferentieMatch[] = [];

  for (const ref of alleReferenties) {
    if (reedsGekoppelde.has(ref.id)) continue;
    if (ref.assetClass !== doel.type) continue;

    let score = 0;
    const redenen: string[] = [`Zelfde type: ${ASSET_CLASS_LABELS[ref.assetClass]}`];

    // Plaats match (50 punten)
    if (doel.plaats && ref.plaats &&
        doel.plaats.toLowerCase().trim() === ref.plaats.toLowerCase().trim()) {
      score += 50;
      redenen.push(`Zelfde plaats: ${ref.plaats}`);
    } else if (doel.plaats && ref.plaats) {
      // Plaats niet gelijk — geef geen punten maar laat de match bestaan
      // (kan nog meetellen voor referentie-doeleinden in regio).
      redenen.push(`Andere plaats: ${ref.plaats}`);
    }

    // Bouwjaar (max 25 punten, lineair afnemend over 15 jaar)
    if (doel.bouwjaar && ref.bouwjaar) {
      const verschil = Math.abs(doel.bouwjaar - ref.bouwjaar);
      if (verschil <= 15) {
        const punten = Math.round(25 * (1 - verschil / 15));
        score += punten;
        if (verschil <= 5) redenen.push(`Vergelijkbaar bouwjaar: ${ref.bouwjaar}`);
        else redenen.push(`Bouwjaar ${ref.bouwjaar} (±${verschil} jr)`);
      }
    }

    // Oppervlakte (max 25 punten, lineair afnemend over ±50%)
    if (doel.oppervlakte && ref.m2 && doel.oppervlakte > 0 && ref.m2 > 0) {
      const verhouding = Math.min(doel.oppervlakte, ref.m2) / Math.max(doel.oppervlakte, ref.m2);
      if (verhouding >= 0.5) {
        // verhouding 1.0 = 25 pt, verhouding 0.5 = 0 pt
        const punten = Math.round(25 * ((verhouding - 0.5) / 0.5));
        score += punten;
        const pctVerschil = Math.round((1 - verhouding) * 100);
        if (pctVerschil <= 10) redenen.push(`Vergelijkbare m² (${ref.m2.toLocaleString('nl-NL')})`);
        else redenen.push(`${ref.m2.toLocaleString('nl-NL')} m² (Δ ${pctVerschil}%)`);
      }
    }

    if (score >= drempel) {
      resultaten.push({ referentie: ref, matchScore: score, matchRedenen: redenen });
    }
  }

  // Sorteer aflopend op score
  resultaten.sort((a, b) => b.matchScore - a.matchScore);
  return resultaten;
}
