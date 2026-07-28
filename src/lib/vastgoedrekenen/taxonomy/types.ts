import type { ValuationMethodId } from '../propositions/types';

type TaxonomyMetadata = {
  label: string;
  description: string;
};

export const BUSINESS_CASE_METADATA = {
  legacy_generic: {
    label: 'Generiek / nog niet geclassificeerd',
    description: 'Tijdelijke terugval voor bestaande of nog niet geclassificeerde scenario’s.',
  },
  income_investment: {
    label: 'Inkomensbelegging',
    description: 'Waardecreatie door huurinkomsten, exploitatie en toekomstige verkoopwaarde.',
  },
  value_add: {
    label: 'Waarde toevoegen',
    description: 'Waardecreatie door verbetering van kwaliteit, verhuurbaarheid of opbrengst.',
  },
  redevelopment: {
    label: 'Herontwikkeling',
    description: 'Waardecreatie door een wezenlijke wijziging van gebouw, functie of programma.',
  },
  new_development: {
    label: 'Nieuwe ontwikkeling',
    description: 'Waardecreatie door realisatie van nieuw vastgoedprogramma.',
  },
  land_development: {
    label: 'Grondontwikkeling',
    description: 'Waardecreatie door planvorming en ontwikkeling van grond of locatie.',
  },
  portfolio_optimization: {
    label: 'Portefeuille-optimalisatie',
    description: 'Waardecreatie door herschikking, opsplitsing of gedeeltelijke verkoop.',
  },
  operating_asset: {
    label: 'Exploitatievastgoed',
    description: 'Waardecreatie uit vastgoed in combinatie met een operationele onderneming.',
  },
  capital_restructuring: {
    label: 'Kapitaal-/eigendomstructurering',
    description: 'Waardecreatie of kapitaalvrijval door aanpassing van financiering of eigendom.',
  },
  asset_disposal: {
    label: 'Verkoop / desinvestering',
    description: 'Analyse gericht op verkoop van een bestaand object of onderdeel.',
  },
} as const satisfies Record<string, TaxonomyMetadata>;

export type BusinessCase = keyof typeof BUSINESS_CASE_METADATA;

export const INTERVENTION_METADATA = {
  none: { label: 'Geen fysieke ingreep', description: 'Geen materiële bouwkundige wijziging.' },
  maintain: { label: 'Onderhouden', description: 'Regulier of achterstallig onderhoud uitvoeren.' },
  renovate: { label: 'Renoveren', description: 'Bestaande kwaliteit herstellen of verbeteren.' },
  sustainability_upgrade: { label: 'Verduurzamen', description: 'Energie- en duurzaamheidsmaatregelen uitvoeren.' },
  relet: { label: 'Herverhuren', description: 'Verhuurbaar maken en opnieuw in de markt zetten.' },
  split: { label: 'Splitsen', description: 'Juridisch, functioneel of bouwkundig opdelen.' },
  transform: { label: 'Transformeren', description: 'Functie of gebruik van het vastgoed wijzigen.' },
  expand: { label: 'Uitbreiden', description: 'Extra bouwvolume of bruikbaar oppervlak toevoegen.' },
  demolish_newbuild: { label: 'Sloop/nieuwbouw', description: 'Bestaande bouw slopen en vervangen door nieuwbouw.' },
  site_development: { label: 'Locatie ontwikkelen', description: 'Een terrein of locatie bouwrijp en ontwikkelbaar maken.' },
} as const satisfies Record<string, TaxonomyMetadata>;

export type Intervention = keyof typeof INTERVENTION_METADATA;

export const EXPANSION_SUBTYPE_METADATA = {
  rooftop_addition: { label: 'Optoppen', description: 'Bouwvolume bovenop bestaande bouw toevoegen.' },
  horizontal_extension: { label: 'Aanbouwen / uitbouwen', description: 'Horizontaal volume aan bestaande bouw toevoegen.' },
  new_volume_on_plot: { label: 'Nieuw bouwvolume op perceel', description: 'Een aanvullend zelfstandig volume op het perceel realiseren.' },
  interior_densification: { label: 'Inpandig verdichten / dichtbouwen', description: 'Onbenutte of open ruimte binnen de bestaande contour benutten.' },
  other: { label: 'Overige uitbreiding', description: 'Een andere vorm van fysieke uitbreiding.' },
} as const satisfies Record<string, TaxonomyMetadata>;

export type ExpansionSubtype = keyof typeof EXPANSION_SUBTYPE_METADATA;

export const EXPLOITATION_MODE_METADATA = {
  vacant: { label: 'Leeg / geen exploitatie', description: 'Het onderdeel genereert geen structurele gebruiksopbrengst.' },
  rental: { label: 'Verhuur', description: 'Het onderdeel wordt verhuurd en genereert huurkasstromen.' },
  owner_occupied: { label: 'Eigen gebruik', description: 'Het onderdeel wordt door de eigenaar of koper gebruikt.' },
  operating_business: { label: 'Operationele exploitatie', description: 'Het onderdeel wordt samen met een onderneming geëxploiteerd.' },
  temporary_use: { label: 'Tijdelijk gebruik', description: 'Tijdelijke exploitatie voorafgaand aan een volgende fase.' },
  mixed: { label: 'Gemengd', description: 'Meerdere exploitatievormen binnen hetzelfde onderdeel.' },
  undecided: { label: 'Nog te bepalen', description: 'De exploitatievorm is nog niet vastgesteld.' },
} as const satisfies Record<string, TaxonomyMetadata>;

export type ExploitationMode = keyof typeof EXPLOITATION_MODE_METADATA;

export const DISPOSITION_METADATA = {
  hold: { label: 'Aanhouden', description: 'Het onderdeel blijft in eigendom.' },
  sell_as_whole_vacant: { label: 'Als geheel leeg verkopen', description: 'Verkoop van het gehele onderdeel zonder huurder.' },
  sell_as_whole_tenanted: { label: 'Als geheel verhuurd verkopen', description: 'Verkoop van het gehele onderdeel met huurcontract.' },
  sell_unit: { label: 'Per unit verkopen', description: 'Afzonderlijke eenheden individueel verkopen.' },
  sell_component: { label: 'Per component verkopen', description: 'Een bouwdeel of gebruikscomponent afzonderlijk verkopen.' },
  sale_and_leaseback: { label: 'Sale-and-leaseback', description: 'Verkopen en gelijktijdig terughuren.' },
  refinance_and_hold: { label: 'Herfinancieren en aanhouden', description: 'Kapitaal vrijmaken via herfinanciering en eigendom behouden.' },
  deferred: { label: 'Later beslissen / uitgestelde exit', description: 'De exit wordt naar een later beslismoment verschoven.' },
  undecided: { label: 'Nog te bepalen', description: 'De disposition is nog niet vastgesteld.' },
} as const satisfies Record<string, TaxonomyMetadata>;

export type Disposition = keyof typeof DISPOSITION_METADATA;

export const FUTURE_VALUATION_METHOD_METADATA = {
  dcf_unlevered: {
    label: 'DCF — unlevered',
    description: 'Contante waarde van vastgoedkasstromen vóór financiering.',
  },
} as const satisfies Record<string, TaxonomyMetadata>;

export type FutureValuationMethodId = keyof typeof FUTURE_VALUATION_METHOD_METADATA;
export type CanonicalValuationMethodId = ValuationMethodId | FutureValuationMethodId;

export type TaxonomyConfidence = 'exact' | 'inferred' | 'ambiguous';
export type TaxonomyValidationMode = 'draft' | 'strict';
export type TaxonomyIssueSeverity = 'warning' | 'error';

export interface ComponentTiming {
  startMonth: number;
  durationMonths: number;
  dispositionMonth: number | null;
}

export interface CanonicalScenarioTaxonomy {
  businessCase: BusinessCase;
  intervention: Intervention;
  expansionSubtype: ExpansionSubtype | null;
  exploitation: ExploitationMode;
  disposition: Disposition;
}

export interface LegacyStrategyMapping extends CanonicalScenarioTaxonomy {
  confidence: TaxonomyConfidence;
  warnings: string[];
}

export interface TaxonomyIssue {
  code: string;
  severity: TaxonomyIssueSeverity;
  message: string;
  path?: string;
}

export interface TaxonomyValidationResult {
  valid: boolean;
  issues: TaxonomyIssue[];
}

export interface RuntimeScenarioTaxonomyInput {
  businessCase?: unknown;
  intervention?: unknown;
  expansionSubtype?: unknown;
  exploitation?: unknown;
  disposition?: unknown;
}

export interface ResolvedScenarioTaxonomy {
  value: CanonicalScenarioTaxonomy;
  warnings: string[];
}

export const BUSINESS_CASES = Object.freeze(Object.keys(BUSINESS_CASE_METADATA) as BusinessCase[]);
export const INTERVENTIONS = Object.freeze(Object.keys(INTERVENTION_METADATA) as Intervention[]);
export const EXPANSION_SUBTYPES = Object.freeze(Object.keys(EXPANSION_SUBTYPE_METADATA) as ExpansionSubtype[]);
export const EXPLOITATION_MODES = Object.freeze(Object.keys(EXPLOITATION_MODE_METADATA) as ExploitationMode[]);
export const DISPOSITIONS = Object.freeze(Object.keys(DISPOSITION_METADATA) as Disposition[]);

export const getBusinessCaseLabel = (value: BusinessCase): string => BUSINESS_CASE_METADATA[value].label;
export const getInterventionLabel = (value: Intervention): string => INTERVENTION_METADATA[value].label;
export const getExpansionSubtypeLabel = (value: ExpansionSubtype): string => EXPANSION_SUBTYPE_METADATA[value].label;
export const getExploitationModeLabel = (value: ExploitationMode): string => EXPLOITATION_MODE_METADATA[value].label;
export const getDispositionLabel = (value: Disposition): string => DISPOSITION_METADATA[value].label;
