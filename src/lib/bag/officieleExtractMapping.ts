export const BAG_EXTRACT_MAPPING_VERSIE = 'v20200601' as const;

export const BAG_OBJECTTYPEN = [
  'Ligplaats',
  'Nummeraanduiding',
  'OpenbareRuimte',
  'Pand',
  'Standplaats',
  'Verblijfsobject',
  'Woonplaats',
] as const;

export type BagObjecttype = (typeof BAG_OBJECTTYPEN)[number];

export const BAG_NAMESPACE_MAPPING = {
  objecten: 'www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601',
  objectenRef: 'www.kadaster.nl/schemas/lvbag/imbag/objecten-ref/v20200601',
  historie: 'www.kadaster.nl/schemas/lvbag/imbag/historie/v20200601',
  kenmerkInOnderzoek: 'www.kadaster.nl/schemas/lvbag/imbag/kenmerkinonderzoek/v20200601',
  datatypenAlgemeen: 'www.kadaster.nl/schemas/lvbag/imbag/datatypenalgemeen/v20200601',
  datatypenNEN3610: 'www.kadaster.nl/schemas/lvbag/imbag/datatypennen3610/v20200601',
  nen5825: 'www.kadaster.nl/schemas/lvbag/imbag/nen5825/v20200601',
  extractDeelbestand: 'http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601',
  extractMutaties: 'http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-mutaties-lvc/v20200601',
  extractLevering: 'http://www.kadaster.nl/schemas/lvbag/extract-levering/v20200601',
  extractSelecties: 'http://www.kadaster.nl/schemas/lvbag/extract-selecties/v20200601',
  gwrDeelbestand: 'www.kadaster.nl/schemas/lvbag/gem-wpl-rel/gwr-deelbestand-lvc/v20200601',
  gwrProduct: 'www.kadaster.nl/schemas/lvbag/gem-wpl-rel/gwr-producten-lvc/v20200601',
  gwrBagTypes: 'www.kadaster.nl/schemas/lvbag/gem-wpl-rel/bag-types/v20200601',
  gml: 'http://www.opengis.net/gml/3.2',
  xlink: 'http://www.w3.org/1999/xlink',
} as const;

export const BAG_BESTANDSFAMILIES = {
  actief: ['LIG', 'NUM', 'OPR', 'PND', 'STA', 'VBO', 'WPL'],
  inOnderzoek: ['IOLIG', 'IONUM', 'IOOPR', 'IOPND', 'IOSTA', 'IOVBO', 'IOWPL'],
  inactief: ['IALIG', 'IANUM', 'IAOPR', 'IAPND', 'IASTA', 'IAVBO', 'IAWPL'],
  nietBag: ['NBLIG', 'NBNUM', 'NBOPR', 'NBPND', 'NBSTA', 'NBVBO', 'NBWPL'],
  gemeenteWoonplaatsRelatie: ['GEM-WPL-RELATIE'],
} as const;

export interface BagOfficieleInspectieSamenvatting {
  xsdBestanden: number;
  xmlBestanden: number;
  genesteZipBestanden: number;
  totaalUitgepakteBestanden: number;
  objectTellingen: Record<BagObjecttype, number>;
  xsdSha256: string;
  proefbestandSha256: string;
}

export const BAG_ASSEN_INSPECTIE_2021: BagOfficieleInspectieSamenvatting = {
  xsdBestanden: 18,
  xmlBestanden: 45,
  genesteZipBestanden: 33,
  totaalUitgepakteBestanden: 96,
  objectTellingen: {
    Ligplaats: 12,
    Nummeraanduiding: 44_524,
    OpenbareRuimte: 1_135,
    Pand: 66_904,
    Standplaats: 29,
    Verblijfsobject: 55_436,
    Woonplaats: 7,
  },
  xsdSha256: '8c174dfca4f8dd436d6dc54e66e8cf6a0d3e73f7cd30929775e04353e351eed2',
  proefbestandSha256: 'a821e6f63ca7767942f572315643174a07b175cd23e5d3abc7d95fb372bc33b6',
};

export function valideerOfficieleBagMapping(): string[] {
  const fouten: string[] = [];

  if (BAG_OBJECTTYPEN.length !== 7) fouten.push('De mapping bevat niet exact zeven BAG-objecttypen.');
  if (!BAG_NAMESPACE_MAPPING.gml.endsWith('/3.2')) fouten.push('De GML 3.2-namespace ontbreekt.');
  if (BAG_ASSEN_INSPECTIE_2021.xsdBestanden <= 0) fouten.push('Er zijn geen XSD-bestanden vastgesteld.');
  if (BAG_ASSEN_INSPECTIE_2021.xmlBestanden <= 0) fouten.push('Er zijn geen XML-proefbestanden vastgesteld.');

  for (const objecttype of BAG_OBJECTTYPEN) {
    if (BAG_ASSEN_INSPECTIE_2021.objectTellingen[objecttype] <= 0) {
      fouten.push(`Objecttype ${objecttype} ontbreekt in het officiële proefbestand.`);
    }
  }

  return fouten;
}
