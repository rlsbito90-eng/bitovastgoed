// Standaardwaarden voor de Vastgoedrekenen module.
// Pas centraal aan zodat alle scenario's en formulieren consistent blijven.

export const VR_DEFAULTS = {
  // OVB-tarieven (fallback wanneer geen tax_settings beschikbaar zijn).
  ovbHoofdverblijfPct: 2.0,
  ovbWoningBeleggingPct: 8.0,
  ovbNietWoningPct: 10.4,

  // Aankoopkosten
  buyerFeePct: 2.0,
  buyerFeeVatPct: 21.0,

  // Huuranalyse
  vacancyPct: 3.0,
  operatingCostPct: 5.0,
  maintenanceReservePct: 3.0,
  managementCostPct: 3.0,

  // Investering / bieding
  unforeseenPct: 10.0,
  targetBar: 6.0,
  barStepPct: 0.5,
  alternativeBars: [5.5, 6.0, 6.5, 7.0],

  // WWS (V1, indicatief)
  wwsEuroPerPoint: 6.0,
  wwsSocialMaxPoints: 143,
  wwsMidMaxPoints: 186,

  // Drempels deal score
  dealScoreBarA: 6.5,
  dealScoreBarB: 5.5,
  dealScoreBarC: 4.5,
} as const;

export const VR_STRATEGY_LABELS: Record<string, string> = {
  belegging: 'Belegging / doorexploiteren',
  huur_optimaliseren: 'Huur optimaliseren',
  renoveren_verhuren: 'Renoveren en verhuren',
  transformeren: 'Transformeren',
  splitsen: 'Splitsen',
  uitponden: 'Uitponden',
  verkopen_geheel: 'Verkopen als geheel',
  verkoop_per_unit: 'Verkoop per unit',
  bedrijfsunits_los: 'Bedrijfsunits afzonderlijk verkopen',
  buy_fix_hold: 'Buy-fix-hold',
  buy_fix_sell: 'Buy-fix-sell',
  buy_split_sell: 'Buy-split-sell',
  buy_transform_hold: 'Buy-transform-hold',
  buy_transform_sell: 'Buy-transform-sell',
  sale_leaseback: 'Sale & leaseback',
  herontwikkeling: 'Herontwikkeling',
  overig: 'Overig',
};

export const VR_STATUS_LABELS: Record<string, string> = {
  concept: 'Concept',
  indicatief: 'Indicatief',
  gecontroleerd: 'Gecontroleerd',
  voor_bieding: 'Voor bieding',
  afgewezen: 'Afgewezen',
  afgerond: 'Afgerond',
};

export const VR_COMPONENT_LABELS: Record<string, string> = {
  woning: 'Woning',
  appartement: 'Appartement',
  studio: 'Studio',
  kamer: 'Kamer',
  winkelruimte: 'Winkelruimte',
  kantoorruimte: 'Kantoorruimte',
  bedrijfsruimte: 'Bedrijfsruimte',
  bedrijfsunit: 'Bedrijfsunit',
  opslagruimte: 'Opslagruimte',
  kelder: 'Kelder',
  parkeerplaats: 'Parkeerplaats',
  garagebox: 'Garagebox',
  berging: 'Berging',
  horeca: 'Horeca',
  maatschappelijk: 'Maatschappelijk',
  ontwikkelgrond: 'Ontwikkelgrond',
  overig: 'Overig',
};

export const VR_OVB_CLASSIFICATION_LABELS: Record<string, string> = {
  eigen_woning: 'Eigen woning / hoofdverblijf',
  woning_belegging: 'Woning niet-hoofdverblijf / belegging',
  niet_woning: 'Niet-woning / commercieel',
  mixed_use: 'Gemengd / mixed-use',
  vrijgesteld: 'Vrijgesteld / n.v.t.',
  handmatig: 'Handmatig',
};
