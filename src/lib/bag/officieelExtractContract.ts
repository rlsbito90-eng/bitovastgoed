export const BAG_EXTRACT_IMBAG_VERSIE = 'v20180601' as const;
export const BAG_EXTRACT_KOPPELVLAK_VERSIE = '1.9' as const;

export type BagExtractObjecttype =
  | 'pand'
  | 'verblijfsobject'
  | 'nummeraanduiding'
  | 'openbare_ruimte'
  | 'woonplaats'
  | 'standplaats'
  | 'ligplaats';

export type BagExtractBestandsrol =
  | 'objectgegevens'
  | 'gemeente_woonplaats_relatie'
  | 'manifest_of_header'
  | 'onbekend';

export interface BagExtractBroncontract {
  formaat: 'xml_verzameling';
  bevatHistorie: true;
  imbagVersie: typeof BAG_EXTRACT_IMBAG_VERSIE;
  koppelvlakVersie: typeof BAG_EXTRACT_KOPPELVLAK_VERSIE;
  objecttypen: readonly BagExtractObjecttype[];
  gemeenteWoonplaatsRelatieApart: true;
  landelijkOfPerGemeente: true;
}

export const OFFICIEEL_BAG_EXTRACT_BRONCONTRACT: BagExtractBroncontract = {
  formaat: 'xml_verzameling',
  bevatHistorie: true,
  imbagVersie: BAG_EXTRACT_IMBAG_VERSIE,
  koppelvlakVersie: BAG_EXTRACT_KOPPELVLAK_VERSIE,
  objecttypen: [
    'pand',
    'verblijfsobject',
    'nummeraanduiding',
    'openbare_ruimte',
    'woonplaats',
    'standplaats',
    'ligplaats',
  ],
  gemeenteWoonplaatsRelatieApart: true,
  landelijkOfPerGemeente: true,
};

export type Contractzekerheid = 'bevestigd' | 'xsd_nodig' | 'proefbestand_nodig';

export interface BagExtractMappingpunt {
  sleutel: string;
  zekerheid: Contractzekerheid;
  toelichting: string;
}

export const BAG_EXTRACT_MAPPINGPUNTEN: readonly BagExtractMappingpunt[] = [
  {
    sleutel: 'bestandssamenstelling',
    zekerheid: 'bevestigd',
    toelichting: 'Een levering bestaat uit een verzameling XML-bestanden.',
  },
  {
    sleutel: 'historie',
    zekerheid: 'bevestigd',
    toelichting: 'Het BAG Extract levert de gehele BAG inclusief historie.',
  },
  {
    sleutel: 'gwr_bijlage',
    zekerheid: 'bevestigd',
    toelichting: 'De Gemeente-Woonplaats-Relatietabel wordt als afzonderlijke bijlage geleverd.',
  },
  {
    sleutel: 'exacte_namespace_uris',
    zekerheid: 'xsd_nodig',
    toelichting: 'Namespace-URI’s mogen pas uit de officiële XSD-set worden overgenomen.',
  },
  {
    sleutel: 'exacte_xml_paden',
    zekerheid: 'xsd_nodig',
    toelichting: 'Element- en attribuutpaden per objecttype vereisen de officiële XSD-set.',
  },
  {
    sleutel: 'zip_en_bestandsnamen',
    zekerheid: 'proefbestand_nodig',
    toelichting: 'Bestandsnamen, ZIP-nesting en chunkstrategie worden pas op proefbestanden vastgelegd.',
  },
  {
    sleutel: 'gml_geometrievarianten',
    zekerheid: 'xsd_nodig',
    toelichting: 'Ondersteunde GML-constructies en CRS-afhandeling moeten uit schema en proefdata volgen.',
  },
];

export function magProductieAdapterBouwen(mappingpunten: readonly BagExtractMappingpunt[]): boolean {
  return mappingpunten.every((punt) => punt.zekerheid === 'bevestigd');
}

export function openMappingpunten(mappingpunten: readonly BagExtractMappingpunt[]): BagExtractMappingpunt[] {
  return mappingpunten.filter((punt) => punt.zekerheid !== 'bevestigd');
}
