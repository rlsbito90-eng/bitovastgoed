import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Patroon niet gevonden in ${path}: ${from.slice(0, 120)}`);
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

patch('src/lib/bag/queryService.ts', [
  [
`export interface BagPandZoekAanvraagV4 extends BagPandZoekAanvraagV3 {
  wijkCodes: string[];
  buurtCodes: string[];
}
`,
`export interface BagPandZoekAanvraagV4 extends BagPandZoekAanvraagV3 {
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
`,
  ],
  [
`export function valideerPandZoekAanvraag(
  aanvraag: BagPandZoekAanvraag,
): BagQueryValidatie {`,
`export function valideerKaartAanvraagV2(
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
): BagQueryValidatie {`,
  ],
]);

patch('src/lib/bag/queryTransport.ts', [
  [
`  valideerPandZoekAanvraagV4,
  valideerViewportAanvraag,
  type BagCbsGebiedsoptie,`,
`  valideerPandZoekAanvraagV4,
  valideerViewportAanvraag,
  valideerKaartAanvraagV2,
  type BagCbsGebiedsoptie,
  type BagKaartAanvraagV2,`,
  ],
  [
`export async function haalCbsGebiedsopties(scopeCode: string): Promise<BagTransportResultaat<BagCbsGebiedsoptie>> {`,
`export async function haalPandenOpKaartV2<T>(aanvraag: BagKaartAanvraagV2): Promise<BagTransportResultaat<T>> {
  const validatie = valideerKaartAanvraagV2(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  return invoke<T>({
    action: 'viewport_v2',
    scopeCode: aanvraag.scopeCode,
    minLon: aanvraag.viewport.minLon,
    minLat: aanvraag.viewport.minLat,
    maxLon: aanvraag.viewport.maxLon,
    maxLat: aanvraag.viewport.maxLat,
    limit: aanvraag.limiet,
    bouwjaarVan: aanvraag.bouwjaarVan,
    bouwjaarTot: aanvraag.bouwjaarTot,
    statussen: aanvraag.statussen,
    vboOppervlakteSomVan: aanvraag.vboOppervlakteSomVan,
    vboOppervlakteSomTot: aanvraag.vboOppervlakteSomTot,
    vboOppervlakteMaxVan: aanvraag.vboOppervlakteMaxVan,
    vboOppervlakteMaxTot: aanvraag.vboOppervlakteMaxTot,
    vboAantalVan: aanvraag.vboAantalVan,
    vboAantalTot: aanvraag.vboAantalTot,
    gebruiksdoelen: aanvraag.gebruiksdoelen,
    isGemengd: aanvraag.isGemengd,
    vboModus: aanvraag.vboModus,
    wijkCodes: aanvraag.wijkCodes,
    buurtCodes: aanvraag.buurtCodes,
  }, { retryBijNetwerkfout: true });
}

export async function haalCbsGebiedsopties(scopeCode: string): Promise<BagTransportResultaat<BagCbsGebiedsoptie>> {`,
  ],
]);

patch('supabase/functions/bag-query-service/index.ts', [
  [
`  if (body.action === 'search') {
`,
`  if (body.action === 'viewport_v2') {
    const scope = scopeCode(body.scopeCode);
    const minLon = coordinate(body.minLon);
    const minLat = coordinate(body.minLat);
    const maxLon = coordinate(body.maxLon);
    const maxLat = coordinate(body.maxLat);
    const limit = integer(body.limit ?? 1500, 1, 1500, 'Kaartlimiet');
    if (minLon < 3.0 || maxLon > 8.0 || minLat < 50.0 || maxLat > 54.5 || minLon >= maxLon || minLat >= maxLat) {
      throw new TypeError('Kaartviewport valt buiten de begrensde Nederlandse WGS84-zone');
    }
    const bouwjaarVan = optionalInteger(body.bouwjaarVan, 1000, 3000, 'Bouwjaar vanaf');
    const bouwjaarTot = optionalInteger(body.bouwjaarTot, 1000, 3000, 'Bouwjaar tot');
    const statussen = textArray(body.statussen, 'pandstatusselectie');
    const wijkCodes = textArray(body.wijkCodes, 'wijkselectie', 64);
    const buurtCodes = textArray(body.buurtCodes, 'buurtselectie', 128);
    if (wijkCodes.some(code => !/^WK[0-9]{4}[A-Z0-9]{2}$/.test(code) || code.slice(2, 6) !== scope)) throw new TypeError('Ongeldige wijkselectie');
    if (buurtCodes.some(code => !/^BU[0-9]{4}[A-Z0-9]{4}$/.test(code) || code.slice(2, 6) !== scope)) throw new TypeError('Ongeldige buurtselectie');
    const vboSomVan = optionalNumber(body.vboOppervlakteSomVan, 0, 100_000_000, 'VBO-oppervlakte som vanaf');
    const vboSomTot = optionalNumber(body.vboOppervlakteSomTot, 0, 100_000_000, 'VBO-oppervlakte som tot');
    const vboMaxVan = optionalNumber(body.vboOppervlakteMaxVan, 0, 10_000_000, 'VBO-oppervlakte max vanaf');
    const vboMaxTot = optionalNumber(body.vboOppervlakteMaxTot, 0, 10_000_000, 'VBO-oppervlakte max tot');
    const vboAantalVan = optionalInteger(body.vboAantalVan, 0, 100_000, 'VBO-aantal vanaf');
    const vboAantalTot = optionalInteger(body.vboAantalTot, 0, 100_000, 'VBO-aantal tot');
    const gebruiksdoelen = textArray(body.gebruiksdoelen, 'gebruiksfunctieselectie');
    const isGemengd = optionalBoolean(body.isGemengd, 'isGemengd');
    const vboModus = body.vboModus == null ? 'alle' : String(body.vboModus).trim();
    if (!VBO_MODI.has(vboModus)) throw new TypeError('Ongeldige VBO-modus');
    validateRanges(bouwjaarVan, bouwjaarTot, vboSomVan, vboSomTot, vboMaxVan, vboMaxTot, vboAantalVan, vboAantalTot);
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx\`SELECT * FROM bag_service.panden_in_viewport_v2(
        \${scope}, \${minLon}, \${minLat}, \${maxLon}, \${maxLat}, \${limit},
        \${bouwjaarVan}, \${bouwjaarTot}, \${statussen},
        \${vboSomVan}, \${vboSomTot}, \${vboMaxVan}, \${vboMaxTot},
        \${vboAantalVan}, \${vboAantalTot}, \${gebruiksdoelen}, \${isGemengd}, \${vboModus},
        \${wijkCodes}, \${buurtCodes}
      )\`;
    });
  }
  if (body.action === 'search') {
`,
  ],
]);

patch('src/components/bag/BagServicePandenlijst.tsx', [
  [
`import BagGebiedsfilters from './BagGebiedsfilters';
`,
`import BagGebiedsfilters from './BagGebiedsfilters';
import BagPandenKaart from './BagPandenKaart';
import type { BagKaartFilters } from '@/lib/bag/kaartModel';
`,
  ],
  [
`  const context = { bestaandeBagIds, bestaandeAdresSleutels, maximaalAantal: 250 };
`,
`  const kaartFilters = useMemo<BagKaartFilters>(() => ({
    bouwjaarVan: optioneelGetal(serverFilters.bouwjaarVan),
    bouwjaarTot: optioneelGetal(serverFilters.bouwjaarTot),
    statussen: serverFilters.statussen,
    wijkCodes: serverFilters.wijkCodes,
    buurtCodes: serverFilters.buurtCodes,
    vboOppervlakteSomVan: optioneelGetal(serverFilters.vboSomVan),
    vboOppervlakteSomTot: optioneelGetal(serverFilters.vboSomTot),
    vboOppervlakteMaxVan: optioneelGetal(serverFilters.vboMaxVan),
    vboOppervlakteMaxTot: optioneelGetal(serverFilters.vboMaxTot),
    vboAantalVan: optioneelGetal(serverFilters.vboAantalVan),
    vboAantalTot: optioneelGetal(serverFilters.vboAantalTot),
    gebruiksdoelen: filters.gebruiksdoelen,
    isGemengd: filters.alleenGemengd ? true : null,
    vboModus: serverFilters.vboModus,
  }), [serverFilters, filters.gebruiksdoelen, filters.alleenGemengd]);

  const context = { bestaandeBagIds, bestaandeAdresSleutels, maximaalAantal: 250 };
`,
  ],
  [
`    <div ref={resultatenTopRef} />
`,
`    <BagPandenKaart scopeCode={scopeCode} filters={kaartFilters} />

    <div ref={resultatenTopRef} />
`,
  ],
]);

console.log('Pandenverkenner 1E.1 bronpatch toegepast');
