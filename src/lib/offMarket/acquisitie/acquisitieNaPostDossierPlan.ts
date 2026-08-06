import type { AcquisitieNaPostProjectie } from './acquisitieNaPostProjectie';
import type { OperationeleWerkbak } from './operationeleWerkbak';

export interface AcquisitieNaPostDossierCommando {
  selectieId: string;
  primaireWerkbak: OperationeleWerkbak;
  volgendeActieOp: string | null;
  volgendeActieOmschrijving: string;
  actorId: string;
  operationKey: string;
}

/**
 * Zet een volledig verzoende na-postprojectie om naar één expliciet
 * dossiercommando. De functie schrijft niets en accepteert geen vrije status.
 */
export function bouwAcquisitieNaPostDossierPlan(input: {
  selectieId: string;
  projectie: AcquisitieNaPostProjectie;
  actorId: string;
  operationKey: string;
}): AcquisitieNaPostDossierCommando {
  const selectieId = input.selectieId.trim();
  const actorId = input.actorId.trim();
  const operationKey = input.operationKey.trim();

  if (!selectieId) throw new Error('Selectie-ID is verplicht voor de dossierprojectie.');
  if (!actorId) throw new Error('Actor is verplicht voor de dossierprojectie.');
  if (!operationKey) throw new Error('Operation key is verplicht voor de dossierprojectie.');
  if (operationKey.length > 200) throw new Error('Operation key mag maximaal 200 tekens bevatten.');

  const volgendeActieOp = input.projectie.volgendeOpvolgdatum;
  if ((input.projectie.werkbak === 'wachten' || input.projectie.werkbak === 'opvolgen')
      && !volgendeActieOp) {
    throw new Error('Werkbak wachten of opvolgen vereist een opvolgdatum.');
  }
  if (input.projectie.werkbak === 'geprint_posten' && volgendeActieOp !== null) {
    throw new Error('Onvolledig geposte selectie mag nog geen opvolgdatum krijgen.');
  }

  const volgendeActieOmschrijving = input.projectie.werkbak === 'geprint_posten'
    ? 'Rond de resterende postregistraties af.'
    : input.projectie.werkbak === 'wachten'
      ? 'Wacht tot de geplande opvolgdatum.'
      : 'Volg de geposte acquisitiebrief op.';

  return {
    selectieId,
    primaireWerkbak: input.projectie.werkbak,
    volgendeActieOp,
    volgendeActieOmschrijving,
    actorId,
    operationKey,
  };
}
