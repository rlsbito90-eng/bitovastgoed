import { describe, expect, it } from "vitest";
import type {
  LeasedHotelInput,
  OperatingHotelInput,
  PropositionInputAdapter,
  RenovateAndSellInput,
  RooftopExtensionInput,
} from "./adapters/types";

const sources = [{ sourceType: "manual", reference: "test" }];

const renovateInput: RenovateAndSellInput = {
  acquisitionBasis: 1,
  renovationAreaM2: 1,
  renovationCosts: 1,
  otherProjectCosts: 1,
  targetSaleValue: 1,
  saleCosts: 1,
  durationMonths: 1,
  sources,
};

const rooftopInput: RooftopExtensionInput = {
  existingBuilding: {
    propertyValue: 1,
    annualRent: 1,
    valueEffect: 0,
  },
  addedBuilding: {
    addedGboM2: 1,
    addedBvoM2: 1,
    structuralReinforcementCosts: 1,
    foundationWorkCosts: 1,
    liftStairsAndAccessCosts: 1,
    installationCosts: 1,
    permitCosts: 1,
    constructionLogisticsCosts: 1,
    constructionCosts: 1,
    saleValue: 1,
    annualRentalValue: 1,
  },
  rentLoss: 1,
  nuisanceOrCompensationCosts: 1,
  rooftopRightCosts: 1,
  sources,
};

const leasedHotelInput: LeasedHotelInput = {
  annualBaseRent: 1,
  leaseStartDate: "2026-01-01",
  leaseEndDate: "2036-01-01",
  indexationRule: { method: "consumer_price_index" },
  operator: { name: "Operator" },
  guarantees: [],
  ownerCapex: 1,
  requiredYield: 0.06,
  sources,
};

const operatingHotelInput: OperatingHotelInput = {
  roomCount: 1,
  availableRoomNights: 365,
  occupancyRate: 0.7,
  adr: 100,
  foodAndBeverageRevenue: 1,
  otherRevenue: 1,
  personnelCosts: 1,
  energyCosts: 1,
  otherOperatingCosts: 1,
  managementFee: 1,
  franchiseFee: 1,
  gop: 1,
  ffeReserve: 1,
  normalizedOperatingCashResult: 1,
  stabilizationPeriodMonths: 12,
  renovationAndRepositioningCosts: 1,
  valueSplit: {
    realEstate: 1,
    inventoryAndFfe: 1,
    operations: 1,
    goodwill: 1,
  },
  sources,
  operatingIncomeClassification: "hotel_operations",
};

type AdapterShape<T> = PropositionInputAdapter<T>;
const adapterShapeIsGeneric: AdapterShape<RenovateAndSellInput> | undefined = undefined;

const forbiddenComputedFields = [
  "totalInvestment",
  "roi",
  "bar",
  "nar",
  "residualValue",
  "residualMaximumPurchasePrice",
] as const;

describe("sector proposition input contracts", () => {
  it("exports all four contracts", () => {
    expect(renovateInput).toBeDefined();
    expect(rooftopInput).toBeDefined();
    expect(leasedHotelInput).toBeDefined();
    expect(operatingHotelInput).toBeDefined();
    expect(adapterShapeIsGeneric).toBeUndefined();
  });

  it("requires an explicit operating-hotel value split", () => {
    expect(operatingHotelInput.valueSplit).toEqual({
      realEstate: 1,
      inventoryAndFfe: 1,
      operations: 1,
      goodwill: 1,
    });
    expect(operatingHotelInput.operatingIncomeClassification).toBe("hotel_operations");
  });

  it("separates existing and added rooftop-extension values", () => {
    expect(rooftopInput.existingBuilding.propertyValue).toBe(1);
    expect(rooftopInput.addedBuilding.saleValue).toBe(1);
    expect(rooftopInput.addedBuilding.addedGboM2).toBe(1);
  });

  it("contains no computed financial output fields", () => {
    for (const input of [renovateInput, rooftopInput, leasedHotelInput, operatingHotelInput]) {
      for (const field of forbiddenComputedFields) {
        expect(field in input).toBe(false);
      }
    }
  });
});
