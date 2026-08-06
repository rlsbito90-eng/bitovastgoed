import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import { stelProductiekernLezenSamen } from './productiekernLeesSamenstelling';
import {
  leesProductiedossierDualRead,
  type ProductiekernDualReadResultaat,
} from './productiekernDualRead';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';

export interface ProductiekernDualReadSamenstellingInput {
  selectieId: string;
  legacyDossier: LegacyProductiedossierReadmodel;
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined;
  achterliggendeRepository: AcquisitieProductiekernRepository;
}

/**
 * Enige toegestane samenstelling voor een toekomstige dual-read vanuit de app.
 *
 * De caller levert bewijs aan, geen losse activatieboolean. Daardoor kan de
 * productiekern nooit als primaire leesbron worden gekozen zonder dat de
 * centrale leespoort alle vereiste bewijzen expliciet groen heeft beoordeeld.
 * De onderliggende repository blijft bovendien read-only gedecoreerd.
 */
export async function leesProductiedossierMetBewijs(
  input: ProductiekernDualReadSamenstellingInput,
): Promise<ProductiekernDualReadResultaat> {
  const samenstelling = stelProductiekernLezenSamen(
    input.bewijs,
    input.achterliggendeRepository,
  );

  return leesProductiedossierDualRead({
    selectieId: input.selectieId,
    legacyDossier: input.legacyDossier,
    productiekernRepository: samenstelling.repository,
    productiekernLezenActief: samenstelling.activatie.lezenActief,
  });
}
