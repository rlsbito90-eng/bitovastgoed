export type BagBronRecord =
  | {
      type: 'pand';
      identificatie: string;
      bouwjaar?: number | null;
      status?: string | null;
      geometrieWkt?: string | null;
    }
  | {
      type: 'verblijfsobject';
      identificatie: string;
      pandIds: string[];
      nummeraanduidingIds: string[];
      gebruiksdoelen?: string[];
      oppervlakte?: number | null;
      status?: string | null;
    }
  | {
      type: 'nummeraanduiding';
      identificatie: string;
      openbareRuimteNaam?: string | null;
      huisnummer?: number | null;
      huisletter?: string | null;
      huisnummertoevoeging?: string | null;
      postcode?: string | null;
      woonplaatsNaam?: string | null;
      status?: string | null;
    };

export interface GenormaliseerdPand {
  identificatie: string;
  bouwjaar: number | null;
  status: string | null;
  geometrieWkt: string | null;
}

export interface GenormaliseerdVerblijfsobject {
  identificatie: string;
  gebruiksdoelen: string[];
  oppervlakte: number | null;
  status: string | null;
}

export interface GenormaliseerdeNummeraanduiding {
  identificatie: string;
  adres: string;
  postcode: string | null;
  woonplaatsNaam: string | null;
  status: string | null;
}

export interface BagPandVboRelatie {
  pandId: string;
  verblijfsobjectId: string;
}

export interface BagVboAdresRelatie {
  verblijfsobjectId: string;
  nummeraanduidingId: string;
}

export type BagParserAfwijzingscode =
  | 'ontbrekende_identificatie'
  | 'ongeldig_bouwjaar'
  | 'ongeldige_oppervlakte'
  | 'ontbrekend_pand'
  | 'ontbrekende_nummeraanduiding'
  | 'onvolledig_adres'
  | 'duplicaat_record';

export interface BagParserAfwijzing {
  recordType: BagBronRecord['type'];
  identificatie: string | null;
  code: BagParserAfwijzingscode;
  reden: string;
}

export interface BagParserResultaat {
  panden: GenormaliseerdPand[];
  verblijfsobjecten: GenormaliseerdVerblijfsobject[];
  nummeraanduidingen: GenormaliseerdeNummeraanduiding[];
  pandVboRelaties: BagPandVboRelatie[];
  vboAdresRelaties: BagVboAdresRelatie[];
  afwijzingen: BagParserAfwijzing[];
  checkpoint: {
    verwerkt: number;
    laatstVerwerkteIndex: number | null;
  };
}

function tekst(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniekeTeksten(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
}

function adresVan(record: Extract<BagBronRecord, { type: 'nummeraanduiding' }>): string | null {
  const straat = tekst(record.openbareRuimteNaam);
  if (!straat || !Number.isInteger(record.huisnummer) || (record.huisnummer ?? 0) <= 0) return null;
  const huisletter = tekst(record.huisletter) ?? '';
  const toevoeging = tekst(record.huisnummertoevoeging);
  return `${straat} ${record.huisnummer}${huisletter}${toevoeging ? `-${toevoeging}` : ''}`;
}

function sorteerResultaat(resultaat: BagParserResultaat): BagParserResultaat {
  const opId = <T extends { identificatie: string }>(a: T, b: T) => a.identificatie.localeCompare(b.identificatie);
  resultaat.panden.sort(opId);
  resultaat.verblijfsobjecten.sort(opId);
  resultaat.nummeraanduidingen.sort(opId);
  resultaat.pandVboRelaties.sort((a, b) => `${a.pandId}|${a.verblijfsobjectId}`.localeCompare(`${b.pandId}|${b.verblijfsobjectId}`));
  resultaat.vboAdresRelaties.sort((a, b) => `${a.verblijfsobjectId}|${a.nummeraanduidingId}`.localeCompare(`${b.verblijfsobjectId}|${b.nummeraanduidingId}`));
  resultaat.afwijzingen.sort((a, b) => `${a.recordType}|${a.identificatie ?? ''}|${a.code}`.localeCompare(`${b.recordType}|${b.identificatie ?? ''}|${b.code}`));
  return resultaat;
}

export function parseBagFixture(records: BagBronRecord[], startIndex = 0): BagParserResultaat {
  const panden = new Map<string, GenormaliseerdPand>();
  const vbos = new Map<string, GenormaliseerdVerblijfsobject>();
  const adressen = new Map<string, GenormaliseerdeNummeraanduiding>();
  const ruweVboRelaties: Array<{ vboId: string; pandIds: string[]; adresIds: string[] }> = [];
  const afwijzingen: BagParserAfwijzing[] = [];

  for (let index = startIndex; index < records.length; index += 1) {
    const record = records[index];
    const identificatie = tekst(record.identificatie);
    if (!identificatie) {
      afwijzingen.push({ recordType: record.type, identificatie: null, code: 'ontbrekende_identificatie', reden: 'Het BAG-record bevat geen identificatie.' });
      continue;
    }

    if (record.type === 'pand') {
      if (panden.has(identificatie)) {
        afwijzingen.push({ recordType: record.type, identificatie, code: 'duplicaat_record', reden: 'Het pand komt meer dan één keer voor in dezelfde parserrun.' });
        continue;
      }
      if (record.bouwjaar != null && (!Number.isInteger(record.bouwjaar) || record.bouwjaar < 1000 || record.bouwjaar > 2200)) {
        afwijzingen.push({ recordType: record.type, identificatie, code: 'ongeldig_bouwjaar', reden: 'Het bouwjaar valt buiten de toegestane technische bandbreedte.' });
        continue;
      }
      panden.set(identificatie, {
        identificatie,
        bouwjaar: record.bouwjaar ?? null,
        status: tekst(record.status),
        geometrieWkt: tekst(record.geometrieWkt),
      });
      continue;
    }

    if (record.type === 'nummeraanduiding') {
      if (adressen.has(identificatie)) {
        afwijzingen.push({ recordType: record.type, identificatie, code: 'duplicaat_record', reden: 'De nummeraanduiding komt meer dan één keer voor in dezelfde parserrun.' });
        continue;
      }
      const adres = adresVan(record);
      if (!adres) {
        afwijzingen.push({ recordType: record.type, identificatie, code: 'onvolledig_adres', reden: 'Openbare ruimte of geldig huisnummer ontbreekt.' });
        continue;
      }
      adressen.set(identificatie, {
        identificatie,
        adres,
        postcode: tekst(record.postcode)?.replace(/\s+/g, '').toUpperCase() ?? null,
        woonplaatsNaam: tekst(record.woonplaatsNaam),
        status: tekst(record.status),
      });
      continue;
    }

    if (vbos.has(identificatie)) {
      afwijzingen.push({ recordType: record.type, identificatie, code: 'duplicaat_record', reden: 'Het verblijfsobject komt meer dan één keer voor in dezelfde parserrun.' });
      continue;
    }
    if (record.oppervlakte != null && (!Number.isFinite(record.oppervlakte) || record.oppervlakte <= 0)) {
      afwijzingen.push({ recordType: record.type, identificatie, code: 'ongeldige_oppervlakte', reden: 'De gebruiksoppervlakte moet positief en numeriek zijn.' });
      continue;
    }
    vbos.set(identificatie, {
      identificatie,
      gebruiksdoelen: uniekeTeksten(record.gebruiksdoelen),
      oppervlakte: record.oppervlakte ?? null,
      status: tekst(record.status),
    });
    ruweVboRelaties.push({
      vboId: identificatie,
      pandIds: uniekeTeksten(record.pandIds),
      adresIds: uniekeTeksten(record.nummeraanduidingIds),
    });
  }

  const pandVboRelaties: BagPandVboRelatie[] = [];
  const vboAdresRelaties: BagVboAdresRelatie[] = [];
  for (const relatie of ruweVboRelaties) {
    for (const pandId of relatie.pandIds) {
      if (!panden.has(pandId)) {
        afwijzingen.push({ recordType: 'verblijfsobject', identificatie: relatie.vboId, code: 'ontbrekend_pand', reden: `Gekoppeld pand ${pandId} ontbreekt in de parserrun.` });
        continue;
      }
      pandVboRelaties.push({ pandId, verblijfsobjectId: relatie.vboId });
    }
    for (const nummeraanduidingId of relatie.adresIds) {
      if (!adressen.has(nummeraanduidingId)) {
        afwijzingen.push({ recordType: 'verblijfsobject', identificatie: relatie.vboId, code: 'ontbrekende_nummeraanduiding', reden: `Gekoppelde nummeraanduiding ${nummeraanduidingId} ontbreekt in de parserrun.` });
        continue;
      }
      vboAdresRelaties.push({ verblijfsobjectId: relatie.vboId, nummeraanduidingId });
    }
  }

  return sorteerResultaat({
    panden: [...panden.values()],
    verblijfsobjecten: [...vbos.values()],
    nummeraanduidingen: [...adressen.values()],
    pandVboRelaties,
    vboAdresRelaties,
    afwijzingen,
    checkpoint: {
      verwerkt: Math.max(0, records.length - startIndex),
      laatstVerwerkteIndex: records.length > startIndex ? records.length - 1 : null,
    },
  });
}

export function parserResultaatFingerprint(resultaat: BagParserResultaat): string {
  return JSON.stringify({
    panden: resultaat.panden,
    verblijfsobjecten: resultaat.verblijfsobjecten,
    nummeraanduidingen: resultaat.nummeraanduidingen,
    pandVboRelaties: resultaat.pandVboRelaties,
    vboAdresRelaties: resultaat.vboAdresRelaties,
    afwijzingen: resultaat.afwijzingen,
  });
}
