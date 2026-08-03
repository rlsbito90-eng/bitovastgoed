export interface BagRdViewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BagViewportAanvraag {
  scopeCode: string;
  viewport: BagRdViewport;
  limiet: number;
}

export interface BagPandZoekAanvraag {
  scopeCode: string;
  naIdentificatie: string | null;
  limiet: number;
}

export interface BagQueryValidatie {
  geldig: boolean;
  fouten: string[];
}

const SCOPE_CODE = /^[A-Za-z0-9_-]{1,64}$/;

export function valideerViewportAanvraag(
  aanvraag: BagViewportAanvraag,
): BagQueryValidatie {
  const fouten: string[] = [];
  const { scopeCode, viewport, limiet } = aanvraag;
  const waarden = [viewport.minX, viewport.minY, viewport.maxX, viewport.maxY];

  if (!SCOPE_CODE.test(scopeCode)) fouten.push('De BAG-scopecode is ongeldig.');
  if (!Number.isInteger(limiet) || limiet < 1 || limiet > 2_500) {
    fouten.push('De viewportlimiet moet tussen 1 en 2.500 liggen.');
  }
  if (waarden.some(waarde => !Number.isFinite(waarde))) {
    fouten.push('Alle viewportcoördinaten moeten eindig zijn.');
  } else if (
    viewport.minX < -10_000
    || viewport.maxX > 300_000
    || viewport.minY < 275_000
    || viewport.maxY > 630_000
    || viewport.minX >= viewport.maxX
    || viewport.minY >= viewport.maxY
  ) {
    fouten.push('De viewport valt buiten de begrensde RD New-zone.');
  }

  return { geldig: fouten.length === 0, fouten };
}

export function valideerPandZoekAanvraag(
  aanvraag: BagPandZoekAanvraag,
): BagQueryValidatie {
  const fouten: string[] = [];

  if (!SCOPE_CODE.test(aanvraag.scopeCode)) {
    fouten.push('De BAG-scopecode is ongeldig.');
  }
  if (!Number.isInteger(aanvraag.limiet) || aanvraag.limiet < 1 || aanvraag.limiet > 250) {
    fouten.push('De zoeklimiet moet tussen 1 en 250 liggen.');
  }
  if (aanvraag.naIdentificatie !== null && !aanvraag.naIdentificatie.trim()) {
    fouten.push('Een opgegeven keysetcursor mag niet leeg zijn.');
  }

  return { geldig: fouten.length === 0, fouten };
}
