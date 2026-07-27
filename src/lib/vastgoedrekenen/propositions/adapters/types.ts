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

/** Marker contracts; BUILD 2A.1B adds the sector-specific fields. */
export interface RenovateAndSellInput {
  sources?: SourceReference[];
}

export interface RooftopExtensionInput {
  sources?: SourceReference[];
}

export interface LeasedHotelInput {
  sources?: SourceReference[];
}

export interface OperatingHotelValueSplit {
  realEstate: number;
  inventoryAndFfe: number;
  operations: number;
  goodwill: number;
}

export interface OperatingHotelInput {
  valueSplit: OperatingHotelValueSplit;
  sources?: SourceReference[];
}
