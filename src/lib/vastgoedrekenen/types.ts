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

export type ComputedOutputs = {
  totalTransferTax: number;
  totalAcquisitionCosts: number;
  totalCosts: number;
  totalInvestment: number;
  currentAnnualRent: number;
  marketAnnualRent: number;
  wwsCorrectedAnnualRent: number;
  correctedAnnualRent: number;
  noi: number;
  pricePerM2Gbo: number | null;
  barPurchasePrice: number | null;
  barTotalInvestment: number | null;
  factorPurchasePrice: number | null;
  factorTotalInvestment: number | null;
  maximumAllInValue: number;
  maximumBid: number;
  conservativeBid: number;
  realisticBid: number;
  aggressiveBid: number;
  notInterestingAbove: number;
  differenceWithAskingPrice: number;
  requiredDiscount: number;
  dealScore: 'A' | 'B' | 'C' | 'reject';
  riskScore: 'laag' | 'middel' | 'hoog';
  complexityScore: 'laag' | 'middel' | 'hoog' | 'zeer_hoog';
  inputReliability: 'laag' | 'middel' | 'hoog';
  conclusion: string;
  recommendedNextStep: string;
  warnings: string[];
};
