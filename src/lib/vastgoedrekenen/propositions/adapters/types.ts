import type {
  PropositionNormalizedInput,
  PropositionType,
  SourceReference,
  ValidationResult,
} from "../types";

export interface PropositionInputAdapter<TInput> {
  propositionType: PropositionType;
  schemaVersion: number;
  validate(input: TInput): ValidationResult;
  normalize(input: TInput): PropositionNormalizedInput;
  describeSources(input: TInput): SourceReference[];
}

export interface RenovateAndSellInput {
  acquisitionBasis: number;
  renovationAreaM2: number;
  renovationCosts: number;
  otherProjectCosts: number;
  targetSaleValue: number;
  saleCosts: number;
  durationMonths: number;
  temporaryIncome?: number;
  sources: SourceReference[];
}

export interface RooftopExtensionExistingBuildingInput {
  propertyValue: number;
  annualRent: number;
  valueEffect: number;
  leaseholdEffect?: number;
  ownersAssociationEffect?: number;
}

export interface RooftopExtensionAddedBuildingInput {
  addedGboM2: number;
  addedBvoM2: number;
  structuralReinforcementCosts: number;
  foundationWorkCosts: number;
  liftStairsAndAccessCosts: number;
  installationCosts: number;
  permitCosts: number;
  constructionLogisticsCosts: number;
  constructionCosts: number;
  saleValue: number;
  annualRentalValue: number;
}

export interface RooftopExtensionInput {
  existingBuilding: RooftopExtensionExistingBuildingInput;
  addedBuilding: RooftopExtensionAddedBuildingInput;
  rentLoss: number;
  nuisanceOrCompensationCosts: number;
  rooftopRightCosts: number;
  sources: SourceReference[];
}

export interface HotelLeaseIndexationRule {
  method: "fixed_percentage" | "consumer_price_index" | "custom";
  annualPercentage?: number;
  reference?: string;
}

export interface HotelOperatorReference {
  name: string;
  registrationNumber?: string;
  groupOrBrand?: string;
}

export interface HotelGuarantee {
  type: string;
  provider?: string;
  amount?: number;
  expiresAt?: string;
}

export interface RevenueRelatedRentInput {
  percentage: number;
  revenueBasis: string;
  threshold?: number;
}

export interface LeasedHotelInput {
  annualBaseRent: number;
  leaseStartDate: string;
  leaseEndDate: string;
  indexationRule: HotelLeaseIndexationRule;
  operator: HotelOperatorReference;
  guarantees: HotelGuarantee[];
  revenueRelatedRent?: RevenueRelatedRentInput;
  ownerCapex: number;
  landlordFfeObligations?: number;
  requiredYield: number;
  sources: SourceReference[];
}

export interface OperatingHotelValueSplit {
  realEstate: number;
  inventoryAndFfe: number;
  operations: number;
  goodwill: number;
}

export interface OperatingHotelInput {
  roomCount: number;
  availableRoomNights: number;
  occupancyRate: number;
  adr: number;
  roomRevenue?: number;
  foodAndBeverageRevenue: number;
  otherRevenue: number;
  personnelCosts: number;
  energyCosts: number;
  otherOperatingCosts: number;
  managementFee: number;
  franchiseFee: number;
  gop: number;
  ffeReserve: number;
  normalizedOperatingCashResult: number;
  stabilizationPeriodMonths: number;
  exitYield?: number;
  exitMultiple?: number;
  renovationAndRepositioningCosts: number;
  valueSplit: OperatingHotelValueSplit;
  sources: SourceReference[];
  /**
   * Exploitatie-input blijft expliciet gescheiden van vastgoedinkomen.
   * Een adapter mag dit contract niet normaliseren naar vastgoed-NOI zonder
   * een afzonderlijke, zichtbare mapping in de centrale rekenkern.
   */
  operatingIncomeClassification: "hotel_operations";
}
