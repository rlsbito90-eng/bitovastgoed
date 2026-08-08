import type { AcquisitiedossierContract } from './productiekernContract';

export class ProductiekernDossierLeesIntegriteitError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_DOSSIER_LEESINTEGRITEIT';

  constructor(reden: string) {
    super(`Acquisitiedossier-readintegriteit geschonden: ${reden}`);
    this.name = 'ProductiekernDossierLeesIntegriteitError';
  }
}

export function bewaakDossierLeesIntegriteit(
  dossier: AcquisitiedossierContract,
): AcquisitiedossierContract {
  const isNieuw = dossier.primaireWerkbak === 'nieuwe_selectie';

  if (isNieuw && dossier.verwerkingGestartOp !== null) {
    throw new ProductiekernDossierLeesIntegriteitError(
      'nieuwe selectie heeft al een verwerkingsdatum',
    );
  }
  if (!isNieuw && dossier.verwerkingGestartOp === null) {
    throw new ProductiekernDossierLeesIntegriteitError(
      'actieve werkbak mist een verwerkingsdatum',
    );
  }
  if (dossier.verwerkingGestartDoor !== null && dossier.verwerkingGestartOp === null) {
    throw new ProductiekernDossierLeesIntegriteitError(
      'verwerker is vastgelegd zonder verwerkingsdatum',
    );
  }
  const heeftActiedatum = dossier.volgendeActieOp !== null;
  const heeftActieomschrijving = Boolean(dossier.volgendeActieOmschrijving?.trim());
  if (heeftActiedatum !== heeftActieomschrijving) {
    throw new ProductiekernDossierLeesIntegriteitError(
      'volgende actie en actiedatum zijn niet samen vastgelegd',
    );
  }
  if (dossier.primaireWerkbak === 'afgehandeld' && heeftActiedatum) {
    throw new ProductiekernDossierLeesIntegriteitError(
      'afgehandeld dossier bevat nog een volgende actie',
    );
  }

  return dossier;
}
