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

export type BagVboModus = 'alle' | 'met_vbo' | 'zonder_vbo';

export interface BagPandZoekAanvraagV2 extends BagPandZoekAanvraag {
  bouwjaarVan: number | null;
  bouwjaarTot: number | null;
  status: string | null;
  vboOppervlakteSomVan: number | null;
  vboOppervlakteSomTot: number | null;
  vboOppervlakteMaxVan: number | null;
  vboOppervlakteMaxTot: number | null;
  vboAantalVan: number | null;
  vboAantalTot: number | null;
  gebruiksdoel: string | null;
  isGemengd: boolean | null;
  vboModus: BagVboModus;
}

export interface BagPandZoekAanvraagV3 extends BagPandZoekAanvraag {
  bouwjaarVan: number | null;
  bouwjaarTot: number | null;
  statussen: string[];
  vboOppervlakteSomVan: number | null;
  vboOppervlakteSomTot: number | null;
  vboOppervlakteMaxVan: number | null;
  vboOppervlakteMaxTot: number | null;
  vboAantalVan: number | null;
  vboAantalTot: number | null;
  gebruiksdoelen: string[];
  isGemengd: boolean | null;
  vboModus: BagVboModus;
}

export interface BagPandZoekAanvraagV4 extends BagPandZoekAanvraagV3 {
  wijkCodes: string[];
  buurtCodes: string[];
}

export interface BagWgs84Viewport {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export type BagKaartAanvraagV2 = Omit<BagPandZoekAanvraagV4, 'naIdentificatie' | 'limiet'> & {
  viewport: BagWgs84Viewport;
  limiet: number;
};

export interface BagCbsGebiedsoptie {
  cbs_gebiedsjaar: number;
  wijk_code: string;
  wijk_naam: string;
  buurt_code: string;
  buurt_naam: string;
}

export interface BagQueryValidatie {
  geldig: boolean;
  fouten: string[];
}

const SCOPE_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const VBO_MODI = new Set<BagVboModus>(['alle', 'met_vbo', 'zonder_vbo']);
const MAX_MULTISELECT_OPTIES = 16;
const MAX_WIJKSELECTIE = 64;
const MAX_BUURTSELECTIE = 128;
const WIJK_CODE = /^WK([0-9]{4})[A-Z0-9]{2}$/;
const BUURT_CODE = /^BU([0-9]{4})[A-Z0-9]{4}$/;

function valideerOptioneelGeheelGetal(
  waarde: number | null,
  min: number,
  max: number,
  label: string,
  fouten: string[],
): void {
  if (waarde === null) return;
  if (!Number.isInteger(waarde) || waarde < min || waarde > max) {
    fouten.push(`${label} moet tussen ${min} en ${max} liggen.`);
  }
}

function valideerOptioneelGetal(
  waarde: number | null,
  min: number,
  max: number,
  label: string,
  fouten: string[],
): void {
  if (waarde === null) return;
  if (!Number.isFinite(waarde) || waarde < min || waarde > max) {
    fouten.push(`${label} moet tussen ${min} en ${max} liggen.`);
  }
}

function valideerTekstSelectie(
  waarden: string[],
  label: string,
  fouten: string[],
  maximaal = MAX_MULTISELECT_OPTIES,
): void {
  if (!Array.isArray(waarden) || waarden.length > maximaal) {
    fouten.push(`${label} mag maximaal ${maximaal} opties bevatten.`);
    return;
  }
  if (waarden.some(waarde => typeof waarde !== 'string' || !waarde.trim() || waarde.length > 128)) {
    fouten.push(`${label} bevat een ongeldige optie.`);
  }
  if (new Set(waarden.map(waarde => waarde.trim())).size !== waarden.length) {
    fouten.push(`${label} bevat dubbele opties.`);
  }
}

function valideerGebiedscodes(
  waarden: string[],
  scopeCode: string,
  type: 'wijk' | 'buurt',
  fouten: string[],
): void {
  const max = type === 'wijk' ? MAX_WIJKSELECTIE : MAX_BUURTSELECTIE;
  valideerTekstSelectie(waarden, type === 'wijk' ? 'Wijkselectie' : 'Buurtselectie', fouten, max);
  const patroon = type === 'wijk' ? WIJK_CODE : BUURT_CODE;
  if (waarden.some((waarde) => {
    const match = patroon.exec(waarde);
    return !match || match[1] !== scopeCode;
  })) {
    fouten.push(`De ${type}selectie bevat een code buiten de actieve BAG-scope.`);
  }
}

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

export function valideerKaartAanvraagV2(
  aanvraag: BagKaartAanvraagV2,
): BagQueryValidatie {
  const fouten = [...valideerPandZoekAanvraagV4({
    ...aanvraag,
    naIdentificatie: null,
    limiet: 100,
  }).fouten];
  const { viewport, limiet } = aanvraag;
  const waarden = [viewport.minLon, viewport.minLat, viewport.maxLon, viewport.maxLat];
  if (!Number.isInteger(limiet) || limiet < 1 || limiet > 1_500) {
    fouten.push('De kaartlimiet moet tussen 1 en 1.500 liggen.');
  }
  if (waarden.some(waarde => !Number.isFinite(waarde))) {
    fouten.push('Alle kaartcoördinaten moeten eindig zijn.');
  } else if (
    viewport.minLon < 3.0
    || viewport.maxLon > 8.0
    || viewport.minLat < 50.0
    || viewport.maxLat > 54.5
    || viewport.minLon >= viewport.maxLon
    || viewport.minLat >= viewport.maxLat
  ) {
    fouten.push('De kaartviewport valt buiten de begrensde Nederlandse WGS84-zone.');
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

function valideerGemeenschappelijkeV2Velden(
  aanvraag: Omit<BagPandZoekAanvraagV2, 'status' | 'gebruiksdoel'>,
  fouten: string[],
): void {
  valideerOptioneelGeheelGetal(aanvraag.bouwjaarVan, 1000, 3000, 'Bouwjaar vanaf', fouten);
  valideerOptioneelGeheelGetal(aanvraag.bouwjaarTot, 1000, 3000, 'Bouwjaar tot', fouten);
  valideerOptioneelGetal(aanvraag.vboOppervlakteSomVan, 0, 100_000_000, 'VBO-oppervlakte som vanaf', fouten);
  valideerOptioneelGetal(aanvraag.vboOppervlakteSomTot, 0, 100_000_000, 'VBO-oppervlakte som tot', fouten);
  valideerOptioneelGetal(aanvraag.vboOppervlakteMaxVan, 0, 10_000_000, 'VBO-oppervlakte max vanaf', fouten);
  valideerOptioneelGetal(aanvraag.vboOppervlakteMaxTot, 0, 10_000_000, 'VBO-oppervlakte max tot', fouten);
  valideerOptioneelGeheelGetal(aanvraag.vboAantalVan, 0, 100_000, 'VBO-aantal vanaf', fouten);
  valideerOptioneelGeheelGetal(aanvraag.vboAantalTot, 0, 100_000, 'VBO-aantal tot', fouten);
  if (!VBO_MODI.has(aanvraag.vboModus)) fouten.push('De VBO-modus is ongeldig.');

  if (aanvraag.bouwjaarVan !== null && aanvraag.bouwjaarTot !== null && aanvraag.bouwjaarVan > aanvraag.bouwjaarTot) {
    fouten.push('Bouwjaar vanaf mag niet hoger zijn dan bouwjaar tot.');
  }
  if (aanvraag.vboOppervlakteSomVan !== null && aanvraag.vboOppervlakteSomTot !== null && aanvraag.vboOppervlakteSomVan > aanvraag.vboOppervlakteSomTot) {
    fouten.push('VBO-oppervlakte som vanaf mag niet hoger zijn dan tot.');
  }
  if (aanvraag.vboOppervlakteMaxVan !== null && aanvraag.vboOppervlakteMaxTot !== null && aanvraag.vboOppervlakteMaxVan > aanvraag.vboOppervlakteMaxTot) {
    fouten.push('VBO-oppervlakte max vanaf mag niet hoger zijn dan tot.');
  }
  if (aanvraag.vboAantalVan !== null && aanvraag.vboAantalTot !== null && aanvraag.vboAantalVan > aanvraag.vboAantalTot) {
    fouten.push('VBO-aantal vanaf mag niet hoger zijn dan tot.');
  }
}

export function valideerPandZoekAanvraagV2(
  aanvraag: BagPandZoekAanvraagV2,
): BagQueryValidatie {
  const fouten = [...valideerPandZoekAanvraag(aanvraag).fouten];
  valideerGemeenschappelijkeV2Velden(aanvraag, fouten);

  if (aanvraag.status !== null && (!aanvraag.status.trim() || aanvraag.status.length > 128)) {
    fouten.push('De pandstatus is ongeldig.');
  }
  if (aanvraag.gebruiksdoel !== null && (!aanvraag.gebruiksdoel.trim() || aanvraag.gebruiksdoel.length > 128)) {
    fouten.push('Het gebruiksdoel is ongeldig.');
  }
  return { geldig: fouten.length === 0, fouten };
}

export function valideerPandZoekAanvraagV3(
  aanvraag: BagPandZoekAanvraagV3,
): BagQueryValidatie {
  const fouten = [...valideerPandZoekAanvraag(aanvraag).fouten];
  valideerGemeenschappelijkeV2Velden(aanvraag, fouten);
  valideerTekstSelectie(aanvraag.statussen, 'Pandstatusselectie', fouten);
  valideerTekstSelectie(aanvraag.gebruiksdoelen, 'Gebruiksfunctieselectie', fouten);
  return { geldig: fouten.length === 0, fouten };
}

export function valideerPandZoekAanvraagV4(
  aanvraag: BagPandZoekAanvraagV4,
): BagQueryValidatie {
  const fouten = [...valideerPandZoekAanvraagV3(aanvraag).fouten];
  valideerGebiedscodes(aanvraag.wijkCodes, aanvraag.scopeCode, 'wijk', fouten);
  valideerGebiedscodes(aanvraag.buurtCodes, aanvraag.scopeCode, 'buurt', fouten);
  return { geldig: fouten.length === 0, fouten };
}
