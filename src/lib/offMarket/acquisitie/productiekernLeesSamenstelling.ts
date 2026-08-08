import {
  bepaalProductieLeesActivatie,
  type ProductieLeesActivatieBewijs,
} from './productieLeesActivatiePoort';
import type { ProductiekernLeesActivatieBesluit } from './productiekernLeesActivatieBesluit';
import { maakGepoorteProductiekernLeesRepository } from './gepoorteProductiekernLeesRepository';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';

export interface ProductiekernLeesSamenstelling {
  activatie: ProductiekernLeesActivatieBesluit;
  repository: AcquisitieProductiekernRepository;
}

/**
 * Omgevingsneutrale composition seam nadat een afzonderlijke poort zijn bewijs
 * al heeft beoordeeld. De repositorydecorator blijft de runtimehandhaving doen.
 */
export function stelProductiekernLezenSamenMetBesluit(
  activatie: ProductiekernLeesActivatieBesluit,
  achterliggend: AcquisitieProductiekernRepository,
): ProductiekernLeesSamenstelling {
  return {
    activatie,
    repository: maakGepoorteProductiekernLeesRepository(
      activatie,
      achterliggend,
    ),
  };
}

/**
 * Productiespecifieke convenience-route voor de read-only dual-readfase.
 *
 * Productiebewijs wordt hier eerst door de productie-readpoort beoordeeld en
 * daarna via dezelfde omgevingsneutrale runtimegrens samengesteld.
 */
export function stelProductiekernLezenSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  achterliggend: AcquisitieProductiekernRepository,
): ProductiekernLeesSamenstelling {
  return stelProductiekernLezenSamenMetBesluit(
    bepaalProductieLeesActivatie(bewijs),
    achterliggend,
  );
}
