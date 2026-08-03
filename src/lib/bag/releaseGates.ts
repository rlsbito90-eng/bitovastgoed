import type { BagDryRunRapport } from './importBatch';

export interface BagReleaseGateConfiguratie {
  verplichteObjecttypen: string[];
  maximaalFoutpercentage: number;
  minimaleRelatiedekking: number;
  vereisGeometrieen: boolean;
  verwachteDatasetVersie: string;
}

export interface BagReleaseGateResultaat {
  toegestaan: boolean;
  blokkades: string[];
  waarschuwingen: string[];
  metingen: {
    foutpercentage: number;
    relatiedekking: number;
    ontbrekendeObjecttypen: string[];
  };
}

export function beoordeelBagDryRun(
  rapport: BagDryRunRapport,
  configuratie: BagReleaseGateConfiguratie,
): BagReleaseGateResultaat {
  const blokkades: string[] = [];
  const waarschuwingen: string[] = [];
  const ontbrekendeObjecttypen = configuratie.verplichteObjecttypen
    .filter(type => (rapport.tellingen.perObjecttype[type] ?? 0) === 0)
    .sort();
  const foutpercentage = rapport.tellingen.ontvangen === 0
    ? 1
    : rapport.tellingen.geweigerd / rapport.tellingen.ontvangen;
  const relatiedekking = rapport.tellingen.voorkomens === 0
    ? 0
    : Math.min(1, rapport.tellingen.relaties / rapport.tellingen.voorkomens);

  if (rapport.datasetVersie !== configuratie.verwachteDatasetVersie) {
    blokkades.push('Datasetversie wijkt af van de expliciet verwachte bronversie.');
  }
  if (ontbrekendeObjecttypen.length) {
    blokkades.push(`Verplichte BAG-objecttypen ontbreken: ${ontbrekendeObjecttypen.join(', ')}.`);
  }
  if (rapport.tellingen.ontvangen !== rapport.tellingen.verwerkt) {
    blokkades.push('Het aantal ontvangen en verwerkte records sluit niet.');
  }
  if (foutpercentage > configuratie.maximaalFoutpercentage) {
    blokkades.push('Het foutpercentage ligt boven de ingestelde grens.');
  }
  if (relatiedekking < configuratie.minimaleRelatiedekking) {
    blokkades.push('De relatiedekking ligt onder de ingestelde grens.');
  }
  if (configuratie.vereisGeometrieen && rapport.tellingen.geometrieen === 0) {
    blokkades.push('Geometrieën zijn verplicht maar ontbreken volledig.');
  }
  if (rapport.fouten.length !== rapport.tellingen.geweigerd) {
    blokkades.push('Afwijzingen zijn niet één-op-één verantwoord in het foutenrapport.');
  }
  if (rapport.hervatbaarVanaf !== null) {
    blokkades.push('De dry-run is niet volledig afgerond.');
  }
  if (rapport.waarschuwingen.length) {
    waarschuwingen.push(...[...rapport.waarschuwingen].sort());
  }

  return {
    toegestaan: blokkades.length === 0,
    blokkades,
    waarschuwingen,
    metingen: { foutpercentage, relatiedekking, ontbrekendeObjecttypen },
  };
}
