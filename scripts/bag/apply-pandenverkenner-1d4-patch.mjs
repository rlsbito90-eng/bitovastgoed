import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(`Patchanker ontbreekt in ${path}: ${before.slice(0, 120)}`);
    }
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('src/components/bag/BagServicePandenlijst.tsx', [
  [
    "import { zoekPandenViaServiceV3 } from '@/lib/bag/queryTransport';",
    "import { haalCbsGebiedsopties, zoekPandenViaServiceV4 } from '@/lib/bag/queryTransport';\nimport type { BagCbsGebiedsoptie } from '@/lib/bag/queryService';",
  ],
  [
    "import BagScopeStatus from './BagScopeStatus';",
    "import BagScopeStatus from './BagScopeStatus';\nimport BagGebiedsfilters from './BagGebiedsfilters';",
  ],
  [
    "  statussen: string[];\n  bouwjaarVan: string;",
    "  statussen: string[];\n  wijkCodes: string[];\n  buurtCodes: string[];\n  bouwjaarVan: string;",
  ],
  [
    "  statussen: [],\n  bouwjaarVan: '',",
    "  statussen: [],\n  wijkCodes: [],\n  buurtCodes: [],\n  bouwjaarVan: '',",
  ],
  [
    "  const [serverFilters, setServerFilters] = useState<ServerFilters>(LEGE_SERVER_FILTERS);",
    "  const [serverFilters, setServerFilters] = useState<ServerFilters>(LEGE_SERVER_FILTERS);\n  const [gebiedsopties, setGebiedsopties] = useState<BagCbsGebiedsoptie[]>([]);\n  const [gebiedenLaden, setGebiedenLaden] = useState(false);",
  ],
  [
    "  useEffect(() => {\n    const controleerScroll = () => setToonNaarBoven(window.scrollY > 500);",
    "  useEffect(() => {\n    let actief = true;\n    setGebiedenLaden(true);\n    void haalCbsGebiedsopties(scopeCode)\n      .then(resultaat => { if (actief) setGebiedsopties(resultaat.rows); })\n      .catch(error => { if (actief) toast.error(error instanceof Error ? error.message : 'Wijken en buurten laden mislukt.'); })\n      .finally(() => { if (actief) setGebiedenLaden(false); });\n    return () => { actief = false; };\n  }, [scopeCode]);\n\n  useEffect(() => {\n    const controleerScroll = () => setToonNaarBoven(window.scrollY > 500);",
  ],
  [
    "      const resultaat = await zoekPandenViaServiceV3<BagServicePandV2Rij>({",
    "      const resultaat = await zoekPandenViaServiceV4<BagServicePandV2Rij>({",
  ],
  [
    "        statussen: serverFilters.statussen,\n        vboOppervlakteSomVan:",
    "        statussen: serverFilters.statussen,\n        wijkCodes: serverFilters.wijkCodes,\n        buurtCodes: serverFilters.buurtCodes,\n        vboOppervlakteSomVan:",
  ],
  [
    "      <div className=\"mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6\">",
    "      <BagGebiedsfilters\n        opties={gebiedsopties}\n        wijkCodes={serverFilters.wijkCodes}\n        buurtCodes={serverFilters.buurtCodes}\n        onWijkCodesChange={wijkCodes => setServerFilters(previous => ({ ...previous, wijkCodes }))}\n        onBuurtCodesChange={buurtCodes => setServerFilters(previous => ({ ...previous, buurtCodes }))}\n        laden={gebiedenLaden}\n      />\n\n      <div className=\"mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6\">",
  ],
  [
    "placeholder=\"Filter geladen pagina lokaal op adres, plaats, postcode of BAG-ID\"",
    "placeholder=\"Filter geladen pagina lokaal op adres, wijk, buurt, postcode of BAG-ID\"",
  ],
  [
    "Binnen Pandstatus en Gebruiksfunctie geldt OF; tussen verschillende filtergroepen geldt EN.",
    "Binnen Pandstatus, Wijk, Buurt en Gebruiksfunctie geldt OF; tussen verschillende filtergroepen geldt EN.",
  ],
  [
    "[pand.postcode,pand.plaats,pand.bouwjaar?`Bouwjaar ${pand.bouwjaar}`:null,pand.oppervlakte!==null?`${Math.round(pand.oppervlakte)} m² GBO`:null,`${pand.aantalVerblijfsobjecten} VBO${pand.aantalVerblijfsobjecten === 1 ? '' : '’s'}`]",
    "[pand.postcode,pand.plaats,pand.wijkNaam,pand.buurtNaam,pand.bouwjaar?`Bouwjaar ${pand.bouwjaar}`:null,pand.oppervlakte!==null?`${Math.round(pand.oppervlakte)} m² GBO`:null,`${pand.aantalVerblijfsobjecten} VBO${pand.aantalVerblijfsobjecten === 1 ? '' : '’s'}`]",
  ],
]);

patch('supabase/functions/bag-query-service/index.ts', [
  [
    "function textArray(value: unknown, label: string): string[] {\n  if (value == null) return [];\n  if (!Array.isArray(value) || value.length > MAX_MULTISELECT_OPTIES) {\n    throw new TypeError(`${label} mag maximaal ${MAX_MULTISELECT_OPTIES} opties bevatten`);",
    "function textArray(value: unknown, label: string, maximaal = MAX_MULTISELECT_OPTIES): string[] {\n  if (value == null) return [];\n  if (!Array.isArray(value) || value.length > maximaal) {\n    throw new TypeError(`${label} mag maximaal ${maximaal} opties bevatten`);",
  ],
  [
    "  throw new TypeError('Onbekende BAG-queryactie');",
    `  if (body.action === 'gebiedsopties') {
    const scope = scopeCode(body.scopeCode);
    return sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE bag_reader');
      return tx\`SELECT * FROM bag_service.cbs_gebiedsopties(\${scope})\`;
    });
  }
  if (body.action === 'search_v4') {
    const scope = scopeCode(body.scopeCode);
    const limit = integer(body.limit ?? 100, 1, 250, 'Zoeklimiet');
    const cursor = body.cursor == null ? null : String(body.cursor).trim();
    if (cursor !== null && (!cursor || cursor.length > 128)) throw new TypeError('Ongeldige keysetcursor');
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
      return tx\`SELECT * FROM bag_service.zoek_panden_v4(
        \${scope}, \${cursor}, \${limit}, \${bouwjaarVan}, \${bouwjaarTot}, \${statussen},
        \${vboSomVan}, \${vboSomTot}, \${vboMaxVan}, \${vboMaxTot},
        \${vboAantalVan}, \${vboAantalTot}, \${gebruiksdoelen}, \${isGemengd}, \${vboModus},
        \${wijkCodes}, \${buurtCodes}
      )\`;
    });
  }
  throw new TypeError('Onbekende BAG-queryactie');`,
  ],
]);

console.log('Pandenverkenner 1D.4 patch toegepast.');
