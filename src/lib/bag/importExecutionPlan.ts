import type { BagBronpakketManifest } from './sourceManifest';

export type BagImportFase =
  | 'bron_geaccepteerd'
  | 'staging_geladen'
  | 'integriteit_gevalideerd'
  | 'publicatie_gereed'
  | 'scope_activeerbaar';

export interface BagImportTranche {
  nummer: number;
  objectBereikVan: number;
  objectBereikTot: number;
  verwachtAantalObjecten: number;
}

export interface BagImportUitvoerplan {
  scopeCode: string;
  datasetversieId: string;
  verwachteObjecten: number;
  trancheGrootte: number;
  tranches: BagImportTranche[];
  hervattenVanafTranche: number;
  rollbackMarker: string;
  allowlistsGeblokkeerd: boolean;
}

export interface BagImportVoortgang {
  afgerondeTranches: number[];
  fase: BagImportFase;
  rollbackUitgevoerd: boolean;
}

export function maakBagImportUitvoerplan(input: {
  manifest: BagBronpakketManifest;
  datasetversieId: string;
  trancheGrootte?: number;
  afgerondeTranches?: number[];
}): BagImportUitvoerplan {
  const verwachteObjecten = input.manifest.verwachteTellingen.objecten;
  const trancheGrootte = Math.floor(input.trancheGrootte ?? 100_000);
  if (!Number.isInteger(trancheGrootte) || trancheGrootte <= 0) {
    throw new TypeError('Tranchegrootte moet een positief geheel getal zijn.');
  }

  const aantalTranches = Math.ceil(verwachteObjecten / trancheGrootte);
  const tranches = Array.from({ length: aantalTranches }, (_, index) => {
    const nummer = index + 1;
    const objectBereikVan = index * trancheGrootte + 1;
    const objectBereikTot = Math.min(nummer * trancheGrootte, verwachteObjecten);
    return {
      nummer,
      objectBereikVan,
      objectBereikTot,
      verwachtAantalObjecten: objectBereikTot - objectBereikVan + 1,
    };
  });

  const afgerond = new Set(input.afgerondeTranches ?? []);
  const eerstOpen = tranches.find(tranche => !afgerond.has(tranche.nummer));

  return {
    scopeCode: input.manifest.scopeCode,
    datasetversieId: input.datasetversieId,
    verwachteObjecten,
    trancheGrootte,
    tranches,
    hervattenVanafTranche: eerstOpen?.nummer ?? aantalTranches + 1,
    rollbackMarker: `${input.datasetversieId}:pre-publicatie`,
    allowlistsGeblokkeerd: true,
  };
}

export function beoordeelBagImportVoortgang(
  plan: BagImportUitvoerplan,
  voortgang: BagImportVoortgang,
): { gereedVoorVolgendeFase: boolean; blokkades: string[] } {
  const blokkades: string[] = [];
  const alleTranchesAfgerond = plan.tranches.every(tranche => voortgang.afgerondeTranches.includes(tranche.nummer));

  if (!plan.allowlistsGeblokkeerd) blokkades.push('Client- en serverallowlists moeten tijdens import geblokkeerd blijven.');
  if (voortgang.rollbackUitgevoerd) blokkades.push('Import is teruggedraaid en moet opnieuw vanaf de hervatmarker worden gestart.');
  if (voortgang.fase !== 'bron_geaccepteerd' && !alleTranchesAfgerond) {
    blokkades.push('Niet alle importtranches zijn afgerond.');
  }

  return { gereedVoorVolgendeFase: blokkades.length === 0, blokkades };
}
