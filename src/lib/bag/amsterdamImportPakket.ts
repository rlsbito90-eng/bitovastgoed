export const AMSTERDAM_IMPORTPAKKET_CONTRACTVERSIE = 'bag-amsterdam-importpakket/1';
export const AMSTERDAM_IMPORT_SCHEMAVERSIE = 'bag-2a3b-private-schema-kandidaat';

export interface AmsterdamImportBestandsTelling {
  bestand: string;
  tabel: string;
  regels: number;
  sha256: string;
}

export interface AmsterdamImportGateInvoer {
  datasetVersie: string;
  scopeCode: string;
  geselecteerdAantal: number;
  selectieChecksum: string;
  bronSha256: string;
  bestanden: readonly AmsterdamImportBestandsTelling[];
  samenvatting: {
    ontvangen: number;
    verwerkt: number;
    adapterFouten: number;
    stagingFouten: number;
    objecten: number;
    voorkomens: number;
    relatiesBron: number;
    relatiesUniek: number;
    geometrieen: number;
    overgeslagenGeometrieen: number;
    ontbrekendeVoorkomenkoppelingen: number;
    ambigueVoorkomenkoppelingen: number;
  };
}

export type AmsterdamImportGateCode =
  | 'dataverlies'
  | 'ontbrekende_relaties'
  | 'ambigue_koppelingen'
  | 'geometrieverlies'
  | 'quarantaine';

export interface AmsterdamImportManifest {
  contractversie: string;
  schemaversie: string;
  datasetVersie: string;
  scopeCode: string;
  bronSha256: string;
  selectieChecksum: string;
  geselecteerdAantal: number;
  bestanden: AmsterdamImportBestandsTelling[];
  tellingen: AmsterdamImportGateInvoer['samenvatting'];
  quarantaine: number;
  databaseImportUitgevoerd: false;
  besluit: 'GO' | 'STOP';
  stopCondities: Array<{ code: AmsterdamImportGateCode; reden: string }>;
}

/** Fail-closed poort tussen de staging-export en een latere, aparte database-import. */
export function evalueerAmsterdamImportPakket(invoer: AmsterdamImportGateInvoer): AmsterdamImportManifest {
  const s = invoer.samenvatting;
  const stopCondities: AmsterdamImportManifest['stopCondities'] = [];

  if (s.verwerkt !== invoer.geselecteerdAantal || s.ontvangen !== invoer.geselecteerdAantal) {
    stopCondities.push({
      code: 'dataverlies',
      reden: `Closure selecteerde ${invoer.geselecteerdAantal} records; ontvangen ${s.ontvangen}, verwerkt ${s.verwerkt}.`,
    });
  }
  if (s.objecten <= 0) {
    stopCondities.push({
      code: 'dataverlies',
      reden: 'Geen objecten in de staginglaag aangetroffen.',
    });
  }
  if (s.voorkomens !== s.verwerkt) {
    stopCondities.push({
      code: 'dataverlies',
      reden: `Staging bevat ${s.voorkomens} voorkomens tegenover ${s.verwerkt} verwerkte objectrecords.`,
    });
  }
  if (s.voorkomens < s.objecten) {
    stopCondities.push({
      code: 'dataverlies',
      reden: `Minder voorkomens (${s.voorkomens}) dan objecten (${s.objecten}).`,
    });
  }
  if (s.relatiesBron > 0 && s.relatiesUniek === 0) {
    stopCondities.push({ code: 'ontbrekende_relaties', reden: 'Bronrelaties aanwezig maar geen unieke relaties geëxporteerd.' });
  }
  if (s.relatiesBron === 0) {
    stopCondities.push({ code: 'ontbrekende_relaties', reden: 'Geen enkele relatie in de staginglaag aangetroffen.' });
  }
  if (s.ambigueVoorkomenkoppelingen > 0) {
    stopCondities.push({
      code: 'ambigue_koppelingen',
      reden: `${s.ambigueVoorkomenkoppelingen} geometrieën konden niet eenduidig aan een voorkomen worden gekoppeld.`,
    });
  }
  if (s.ontbrekendeVoorkomenkoppelingen > 0 || s.overgeslagenGeometrieen > 0) {
    stopCondities.push({
      code: 'geometrieverlies',
      reden: `${s.overgeslagenGeometrieen} geometrieën overgeslagen, waarvan ${s.ontbrekendeVoorkomenkoppelingen} zonder voorkomenkoppeling.`,
    });
  }
  if (s.adapterFouten > 0 || s.stagingFouten > 0) {
    stopCondities.push({
      code: 'quarantaine',
      reden: `${s.adapterFouten} adapterfouten en ${s.stagingFouten} stagingfouten in quarantaine.`,
    });
  }

  return {
    contractversie: AMSTERDAM_IMPORTPAKKET_CONTRACTVERSIE,
    schemaversie: AMSTERDAM_IMPORT_SCHEMAVERSIE,
    datasetVersie: invoer.datasetVersie,
    scopeCode: invoer.scopeCode,
    bronSha256: invoer.bronSha256,
    selectieChecksum: invoer.selectieChecksum,
    geselecteerdAantal: invoer.geselecteerdAantal,
    bestanden: [...invoer.bestanden],
    tellingen: s,
    quarantaine: s.adapterFouten + s.stagingFouten + s.overgeslagenGeometrieen,
    databaseImportUitgevoerd: false,
    besluit: stopCondities.length === 0 ? 'GO' : 'STOP',
    stopCondities,
  };
}
