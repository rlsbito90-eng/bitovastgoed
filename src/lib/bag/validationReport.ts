import type { BagImportUitvoerplan, BagImportVoortgang } from './importExecutionPlan';
import type { BagBronpakketValidatie } from './sourceManifest';

export interface BagAmsterdamValidatierapport {
  scopeCode: '0363';
  datasetversieId: string;
  bronGeldig: boolean;
  bronFouten: string[];
  bronWaarschuwingen: string[];
  totaalBronBytes: number;
  totaalTranches: number;
  afgerondeTranches: number;
  fase: BagImportVoortgang['fase'];
  rollbackUitgevoerd: boolean;
  allowlistsGeblokkeerd: boolean;
  publicatieToegestaan: boolean;
  blokkades: string[];
}

export function bouwAmsterdamValidatierapport(input: {
  bronvalidatie: BagBronpakketValidatie;
  plan: BagImportUitvoerplan;
  voortgang: BagImportVoortgang;
  integriteitGeldig: boolean;
}): BagAmsterdamValidatierapport {
  const blokkades: string[] = [];
  if (input.plan.scopeCode !== '0363') blokkades.push('Alleen scope 0363 is toegestaan voor dit Amsterdam-rapport.');
  if (!input.bronvalidatie.geldig) blokkades.push('Bronpakket is niet geldig.');
  if (!input.integriteitGeldig) blokkades.push('Integriteitsvalidatie is niet geslaagd.');
  if (input.voortgang.rollbackUitgevoerd) blokkades.push('Dataset is teruggedraaid.');
  if (!input.plan.allowlistsGeblokkeerd) blokkades.push('Allowlists zijn te vroeg geactiveerd.');
  const afgerondeTranches = input.plan.tranches.filter(tranche => input.voortgang.afgerondeTranches.includes(tranche.nummer)).length;
  if (afgerondeTranches !== input.plan.tranches.length) blokkades.push('Niet alle tranches zijn afgerond.');
  if (input.voortgang.fase !== 'publicatie_gereed') blokkades.push('Importfase is nog niet publicatie_gereed.');

  return {
    scopeCode: '0363',
    datasetversieId: input.plan.datasetversieId,
    bronGeldig: input.bronvalidatie.geldig,
    bronFouten: [...input.bronvalidatie.fouten],
    bronWaarschuwingen: [...input.bronvalidatie.waarschuwingen],
    totaalBronBytes: input.bronvalidatie.totaalBytes,
    totaalTranches: input.plan.tranches.length,
    afgerondeTranches,
    fase: input.voortgang.fase,
    rollbackUitgevoerd: input.voortgang.rollbackUitgevoerd,
    allowlistsGeblokkeerd: input.plan.allowlistsGeblokkeerd,
    publicatieToegestaan: blokkades.length === 0,
    blokkades,
  };
}
