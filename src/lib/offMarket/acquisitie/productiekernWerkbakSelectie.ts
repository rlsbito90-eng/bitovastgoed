import type { AcquisitiedossierContract } from './productiekernContract';
import type { OperationeleWerkbak } from './operationeleWerkbak';

export type ProductiekernWerkbakSelectie = OperationeleWerkbak | 'alles';

/**
 * Selecteert uitsluitend op de formele `primaireWerkbak` van een
 * Acquisitiedossier. Een ontbrekend dossier wordt hier nooit impliciet als
 * `nieuwe_selectie` geïnterpreteerd.
 */
export function selecteerDossiersVoorWerkbak(
  dossiers: readonly AcquisitiedossierContract[],
  werkbak: ProductiekernWerkbakSelectie,
): AcquisitiedossierContract[] {
  if (werkbak === 'alles') return [...dossiers];
  return dossiers.filter((dossier) => dossier.primaireWerkbak === werkbak);
}

export function selectieIdsVoorWerkbak(
  dossiers: readonly AcquisitiedossierContract[],
  werkbak: ProductiekernWerkbakSelectie,
): string[] {
  return selecteerDossiersVoorWerkbak(dossiers, werkbak)
    .map((dossier) => dossier.selectieId);
}
