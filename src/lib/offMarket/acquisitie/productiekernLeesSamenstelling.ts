import {
  bepaalProductieLeesActivatie,
  type ProductieLeesActivatieBewijs,
  type ProductieLeesActivatieBesluit,
} from './productieLeesActivatiePoort';
import { maakGepoorteProductiekernLeesRepository } from './gepoorteProductiekernLeesRepository';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';

export interface ProductiekernLeesSamenstelling {
  activatie: ProductieLeesActivatieBesluit;
  repository: AcquisitieProductiekernRepository;
}

/**
 * Centrale samenstelling voor de toekomstige read-only productiekernfase.
 *
 * De applicatie levert uitsluitend bewijs aan. De activatiebeslissing en de
 * repositorydecorator worden hier gezamenlijk opgebouwd, zodat een losse
 * boolean of verkeerd bedrade featureflag de leespoort niet kan omzeilen.
 * Schrijven blijft door de decorator altijd geblokkeerd.
 */
export function stelProductiekernLezenSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  achterliggend: AcquisitieProductiekernRepository,
): ProductiekernLeesSamenstelling {
  const activatie = bepaalProductieLeesActivatie(bewijs);

  return {
    activatie,
    repository: maakGepoorteProductiekernLeesRepository(
      activatie,
      achterliggend,
    ),
  };
}
