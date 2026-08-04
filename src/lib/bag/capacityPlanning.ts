export interface BagCapaciteitsBaseline {
  scopeCode: string;
  objecten: number;
  voorkomens: number;
  relaties: number;
  geometrieen: number;
  opslagBytes: number;
}

export interface BagCapaciteitsRaming {
  scopeCode: string;
  schaalfactor: number;
  objecten: number;
  voorkomens: number;
  relaties: number;
  geometrieen: number;
  totaalRijen: number;
  opslagBytes: number;
  aanbevolenVrijeRuimteBytes: number;
  trancheNodig: boolean;
}

export const ASSEN_CAPACITEITSBASELINE: BagCapaciteitsBaseline = {
  scopeCode: '0106',
  objecten: 128_745,
  voorkomens: 168_047,
  relaties: 160_351,
  geometrieen: 122_375,
  opslagBytes: 253_902_848,
};

export const BAG_OPSLAG_VEILIGHEIDSFACTOR = 2;
export const BAG_TRANCHE_GRENS_RIJEN = 2_000_000;

function rondOmhoog(value: number): number {
  return Math.ceil(Math.max(0, value));
}

export function raamBagScopeCapaciteit(
  scopeCode: string,
  verwachteObjecten: number,
  baseline: BagCapaciteitsBaseline = ASSEN_CAPACITEITSBASELINE,
): BagCapaciteitsRaming {
  if (!Number.isFinite(verwachteObjecten) || verwachteObjecten <= 0) {
    throw new TypeError('Verwachte objecttelling moet een positief eindig getal zijn.');
  }

  const schaalfactor = verwachteObjecten / baseline.objecten;
  const objecten = rondOmhoog(verwachteObjecten);
  const voorkomens = rondOmhoog(baseline.voorkomens * schaalfactor);
  const relaties = rondOmhoog(baseline.relaties * schaalfactor);
  const geometrieen = rondOmhoog(baseline.geometrieen * schaalfactor);
  const opslagBytes = rondOmhoog(baseline.opslagBytes * schaalfactor);
  const totaalRijen = objecten + voorkomens + relaties + geometrieen;

  return {
    scopeCode,
    schaalfactor,
    objecten,
    voorkomens,
    relaties,
    geometrieen,
    totaalRijen,
    opslagBytes,
    aanbevolenVrijeRuimteBytes: rondOmhoog(opslagBytes * BAG_OPSLAG_VEILIGHEIDSFACTOR),
    trancheNodig: totaalRijen > BAG_TRANCHE_GRENS_RIJEN,
  };
}

export function beoordeelBagImportGoNoGo(input: {
  bronGevalideerd: boolean;
  vrijeRuimteBytes: number;
  raming: BagCapaciteitsRaming;
  rollbackGetest: boolean;
  clientScopeToegestaan: boolean;
  serverScopeToegestaan: boolean;
}): { toegestaan: boolean; blokkades: string[] } {
  const blokkades: string[] = [];
  if (!input.bronGevalideerd) blokkades.push('Officiele bronbestanden en tellingen zijn nog niet gevalideerd.');
  if (input.vrijeRuimteBytes < input.raming.aanbevolenVrijeRuimteBytes) blokkades.push('Onvoldoende vrije databaseruimte inclusief veiligheidsmarge.');
  if (!input.rollbackGetest) blokkades.push('Rollback- en herstartprocedure is nog niet getest.');
  if (input.clientScopeToegestaan || input.serverScopeToegestaan) blokkades.push('De nieuwe scope mag voor de import nog niet querybaar zijn.');
  return { toegestaan: blokkades.length === 0, blokkades };
}
