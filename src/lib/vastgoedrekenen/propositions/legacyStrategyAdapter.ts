import type { DispositionType, InterventionType } from "./types";

export interface LegacyStrategyResolution {
  intervention: InterventionType;
  disposition: DispositionType;
  recognized: boolean;
  sourceValue?: string;
}

const normalizedMappings: Readonly<Record<string, Omit<LegacyStrategyResolution, "sourceValue">>> = {
  behouden: { intervention: "none", disposition: "hold", recognized: true },
  hold: { intervention: "none", disposition: "hold", recognized: true },
  verkopen_leeg: { intervention: "none", disposition: "sell_vacant", recognized: true },
  sell_vacant: { intervention: "none", disposition: "sell_vacant", recognized: true },
  verkopen_verhuurd: { intervention: "none", disposition: "sell_tenanted", recognized: true },
  sell_tenanted: { intervention: "none", disposition: "sell_tenanted", recognized: true },
  renoveren_en_verkopen: { intervention: "renovate", disposition: "sell", recognized: true },
  renovate_and_sell: { intervention: "renovate", disposition: "sell", recognized: true },
  renoveren_en_aanhouden: { intervention: "renovate", disposition: "hold", recognized: true },
  transformeren_en_verkopen: { intervention: "transform", disposition: "sell", recognized: true },
  transformeren_en_aanhouden: { intervention: "transform", disposition: "hold", recognized: true },
  sloop_nieuwbouw_verkopen: { intervention: "demolish_newbuild", disposition: "sell", recognized: true },
  sloop_nieuwbouw_aanhouden: { intervention: "demolish_newbuild", disposition: "hold", recognized: true },
  later_beslissen: { intervention: "none", disposition: "defer", recognized: true },
  defer: { intervention: "none", disposition: "defer", recognized: true },
};

function normalizeLegacyValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function resolveLegacyStrategy(value: unknown): LegacyStrategyResolution {
  if (typeof value !== "string" || value.trim() === "") {
    return { intervention: "none", disposition: "defer", recognized: false };
  }

  const sourceValue = value;
  const mapping = normalizedMappings[normalizeLegacyValue(value)];
  return mapping
    ? { ...mapping, sourceValue }
    : { intervention: "none", disposition: "defer", recognized: false, sourceValue };
}
