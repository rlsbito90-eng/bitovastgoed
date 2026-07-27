import { describe, expect, it } from "vitest";
import {
  PROPOSITION_DEFINITIONS,
  PROPOSITION_REGISTRY,
  PROPOSITION_SECTION_IDS,
  PROPOSITION_TYPES,
  getPropositionDefinition,
  getVisibleSectionsForProposition,
  resolveLegacyStrategy,
  resolvePropositionType,
} from "./index";

describe("proposition architecture", () => {
  it("defines every proposition type exactly once", () => {
    const codes = PROPOSITION_DEFINITIONS.map((definition) => definition.type);
    expect(codes).toHaveLength(PROPOSITION_TYPES.length);
    expect(new Set(codes).size).toBe(PROPOSITION_TYPES.length);
    expect(Object.keys(PROPOSITION_REGISTRY).sort()).toEqual([...PROPOSITION_TYPES].sort());
  });

  it("requires a schema version, a disposition and a leading method for non-legacy propositions", () => {
    for (const definition of PROPOSITION_DEFINITIONS) {
      expect(definition.schemaVersion).toBeGreaterThan(0);
      expect(definition.allowedDispositions.length).toBeGreaterThan(0);
      if (definition.type !== "legacy_generic") {
        expect(definition.leadingValuationMethods.length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back safely to legacy_generic", () => {
    expect(resolvePropositionType(undefined)).toBe("legacy_generic");
    expect(resolvePropositionType("unknown")).toBe("legacy_generic");
    expect(getPropositionDefinition("unknown").type).toBe("legacy_generic");
  });

  it("uses only valid section ids", () => {
    const valid = new Set(PROPOSITION_SECTION_IDS);
    for (const definition of PROPOSITION_DEFINITIONS) {
      const sections = getVisibleSectionsForProposition(definition.type);
      expect(sections.every((section) => valid.has(section))).toBe(true);
    }
  });

  it("models rooftop extension as an intervention", () => {
    expect(getPropositionDefinition("rooftop_extension").allowedInterventions).toContain("rooftop_extension");
  });
});

describe("legacy strategy adapter", () => {
  it.each([
    ["behouden", "none", "hold"],
    ["verkopen leeg", "none", "sell_vacant"],
    ["verkopen verhuurd", "none", "sell_tenanted"],
    ["renoveren en verkopen", "renovate", "sell"],
    ["renoveren en aanhouden", "renovate", "hold"],
    ["transformeren en verkopen", "transform", "sell"],
    ["transformeren en aanhouden", "transform", "hold"],
    ["sloop nieuwbouw verkopen", "demolish_newbuild", "sell"],
    ["sloop nieuwbouw aanhouden", "demolish_newbuild", "hold"],
    ["later beslissen", "none", "defer"],
  ])("maps %s", (value, intervention, disposition) => {
    expect(resolveLegacyStrategy(value)).toMatchObject({ intervention, disposition, recognized: true });
  });

  it("does not crash or invent a destination for unknown values", () => {
    expect(resolveLegacyStrategy("onbekend")).toMatchObject({
      intervention: "none",
      disposition: "defer",
      recognized: false,
    });
  });
});
