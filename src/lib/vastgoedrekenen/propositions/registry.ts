import { PROPOSITION_DEFINITIONS } from "./definitions";
import {
  PROPOSITION_SECTION_IDS,
  PROPOSITION_TYPES,
  type DispositionType,
  type InterventionType,
  type PropositionDefinition,
  type PropositionSectionId,
  type PropositionType,
} from "./types";

const typeSet = new Set<string>(PROPOSITION_TYPES);
const sectionSet = new Set<string>(PROPOSITION_SECTION_IDS);

export const PROPOSITION_REGISTRY: Readonly<Record<PropositionType, PropositionDefinition>> =
  Object.freeze(
    Object.fromEntries(
      PROPOSITION_DEFINITIONS.map((definition) => [definition.type, definition]),
    ) as Record<PropositionType, PropositionDefinition>,
  );

export function resolvePropositionType(value: unknown): PropositionType {
  return typeof value === "string" && typeSet.has(value)
    ? (value as PropositionType)
    : "legacy_generic";
}

export function getPropositionDefinition(value: unknown): PropositionDefinition {
  return PROPOSITION_REGISTRY[resolvePropositionType(value)];
}

export function getVisibleSectionsForProposition(value: unknown): PropositionSectionId[] {
  const definition = getPropositionDefinition(value);
  const hidden = new Set(definition.sections.hiddenByDefault ?? []);
  return [
    ...definition.sections.required,
    ...definition.sections.recommended,
    ...definition.sections.optional,
  ].filter(
    (section, index, all) =>
      sectionSet.has(section) && !hidden.has(section) && all.indexOf(section) === index,
  );
}

export function getPropositionLabel(value: unknown): string {
  return getPropositionDefinition(value).label;
}

export function isInterventionAllowed(
  value: unknown,
  intervention: InterventionType,
): boolean {
  return getPropositionDefinition(value).allowedInterventions.includes(intervention);
}

export function isDispositionAllowed(
  value: unknown,
  disposition: DispositionType,
): boolean {
  return getPropositionDefinition(value).allowedDispositions.includes(disposition);
}
