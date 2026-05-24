// Geconsolideerde types voor de Vastgoedrekenen module.
// Deze types werken in TS los van de Supabase generated types,
// zodat berekeningen pure functions kunnen blijven.

import type { Database } from '@/integrations/supabase/types';

export type Calculation = Database['public']['Tables']['real_estate_calculations']['Row'];
export type Scenario = Database['public']['Tables']['calculation_scenarios']['Row'];
export type Component = Database['public']['Tables']['calculation_components']['Row'];
export type WwsUnit = Database['public']['Tables']['residential_wws_units']['Row'];
export type ScenarioCost = Database['public']['Tables']['scenario_costs']['Row'];
export type ExitAssumption = Database['public']['Tables']['exit_assumptions']['Row'];
export type SellOffUnit = Database['public']['Tables']['sell_off_units']['Row'];
export type CalcOutput = Database['public']['Tables']['calculation_outputs']['Row'];
export type RiskItem = Database['public']['Tables']['risk_analysis']['Row'];
export type UserCalcPrefs = Database['public']['Tables']['user_calculation_preferences']['Row'];
export type TaxSettings = Database['public']['Tables']['vastgoedrekenen_tax_settings']['Row'];

export type ViewMode = 'begeleid' | 'compact' | 'expert';

export type ScenarioAssessmentType = 'exploitatie' | 'verkoop';
export type ScenarioScoreLabel =
  | 'Kansrijk'
  | 'Acceptabel'
  | 'Onzeker'
  | 'Te duur'
  | 'ROI onvoldoende'
  | 'Marge onvoldoende'
  | 'Exitdoel niet gehaald'
  | 'Onvoldoende data'
  | 'Niet haalbaar';

export type ComputedOutputs = {
  totalTransferTax: number;
  totalAcquisitionCosts: number;
  totalCosts: number;
  totalInvestment: number;
  currentAnnualRent: number;
  marketAnnualRent: number;
  wwsCorrectedAnnualRent: number;
  correctedAnnualRent: number;
  // NOI-opbouw
  noi: number;
  noiMargin: number | null;
  totalCorrectionPct: number;
  vacancyCorrectionEur: number;
  operatingCostsEur: number;
  maintenanceCostsEur: number;
  managementCostsEur: number;
  otherCostsEur: number;
  pricePerM2Gbo: number | null;
  barPurchasePrice: number | null;
  barTotalInvestment: number | null;
  factorPurchasePrice: number | null;
  factorTotalInvestment: number | null;
  /** NAR = NOI / totale investering × 100 */
  narTotalInvestment: number | null;
  maximumAllInValue: number;
  maximumBid: number;
  conservativeBid: number;
  realisticBid: number;
  aggressiveBid: number;
  notInterestingAbove: number;
  /** maximaleBieding - vraagprijs. Positief = ruimte boven vraagprijs. */
  differenceWithAskingPrice: number;
  requiredDiscount: number;
  dealScore: 'A' | 'B' | 'C' | 'reject';
  riskScore: 'laag' | 'middel' | 'hoog';
  complexityScore: 'laag' | 'middel' | 'hoog' | 'zeer_hoog';
  inputReliability: 'laag' | 'middel' | 'hoog';
  assessmentType: ScenarioAssessmentType;
  scoreLabel: ScenarioScoreLabel;
  scoreReason: string;
  scorePositivePoints: string[];
  scoreAttentionPoints: string[];
  conclusion: string;
  recommendedNextStep: string;
  warnings: string[];
  // --- Verkoop / exit ---
  saleHasInput: boolean;
  grossSaleProceeds: number | null;
  saleCostsTotal: number | null;
  netSaleProceeds: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  roi: number | null;
  exitValue: number | null;
  saleVsPurchase: number | null;
  saleVsTotalInvestment: number | null;
  exitBasedMaxBid: number | null;
  exitBidBindingTarget: 'marge_euro' | 'marge_pct' | 'roi' | 'target_exit' | null;
  /** Welke basis is gebruikt voor maximumBid: huur (BAR) of verkoop (exit). */
  bidBasisUsed: 'huur' | 'verkoop';
  // --- €/m² KPI's (null = onvoldoende gegevens) ---
  /** Aankoopprijs per m² GBO. */
  purchasePricePerM2: number | null;
  /** Vraagprijs per m² GBO. */
  askingPricePerM2: number | null;
  /** Totale investering per m² GBO. */
  totalInvestmentPerM2: number | null;
  /** Maximale bieding per m² GBO. */
  maximumBidPerM2: number | null;
  /** Totale bouw-/projectkosten per m² GBO (inclusief onvoorzien). */
  totalCostsPerM2: number | null;
  /** Verkoopprijs per m² op basis van bruto / verkoopbare m². */
  salePricePerM2: number | null;
  /** Netto verkoopopbrengst per m². */
  netSaleProceedsPerM2: number | null;
  /** Nettomarge per m² (sellable m²). */
  netMarginPerM2: number | null;
  /** Jaarhuur per m² (gecorrigeerd / m² GBO). */
  annualRentPerM2: number | null;
  /** NOI per m². */
  noiPerM2: number | null;
  // --- Componentstrategie ---
  /** Of er componentstrategie-units zijn die de scenariowaarde bepalen. */
  strategyEnabled: boolean;
  /** Korte omschrijving van de mix (bv. "6× Verkopen (leeg), 2× Aanhouden"). */
  strategyMix: string;
  /** Totale beleggingswaarde van behouden componenten. */
  holdValue: number;
  /** Totale netto verkoopopbrengst uit verkochte componenten. */
  saleNetProceedsUnits: number;
  /** Totale scenariowaarde uit componentstrategie. */
  scenarioValue: number;
  /** Scenarioresultaat bij vraagprijs (waarde − totale investering op vraagprijs). */
  scenarioResultAtAsking: number | null;
  /** Margepercentage bij vraagprijs. */
  scenarioMarginPct: number | null;
  /** Indicatieve maximale aankoopprijs op basis van componentstrategie. */
  maxPurchasePrice: number | null;
  /** Of het scenario rond te rekenen is bij de vraagprijs. */
  roundsAtAsking: boolean | null;
  /** Per-unit detailregels voor weergave. */
  strategyPerUnit: Array<{
    unitId: string;
    label: string;
    type: string | null;
    strategy: string | null;
    contribution: number;
    warnings: string[];
  }>;
};


