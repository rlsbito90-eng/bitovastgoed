import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import { vergelijkProductiekernDossier, type ProductiekernDossierVergelijking } from './productiekernDossierVergelijking';
import { stelProductiekernLezenSamen } from './productiekernLeesSamenstelling';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';

export type ProductiekernPariteitsstatus =
  | 'niet_geactiveerd'
  | 'productiekern_dossier_ontbreekt'
  | 'gelijk'
  | 'procesafwijking'
  | 'kritieke_afwijking';

export interface ProductiekernDossierPariteitsmeting {
  status: ProductiekernPariteitsstatus;
  vergelijking: ProductiekernDossierVergelijking | null;
  waarschuwingen: string[];
}

export interface ProductiekernDossierPariteitsmetingInput {
  selectieId: string;
  legacyDossier: LegacyProductiedossierReadmodel;
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined;
  achterliggendeRepository: AcquisitieProductiekernRepository;
}

/**
 * Meet read-only de pariteit tussen legacy en productiekern.
 *
 * De meting wijzigt geen primaire leesbron en schrijft niets. Zonder volledig
 * leesbewijs wordt de achterliggende repository niet aangeroepen. Kritieke
 * identiteitsafwijkingen worden afzonderlijk geclassificeerd zodat zij nooit
 * als normale procesdrift kunnen worden geïnterpreteerd.
 */
export async function meetProductiekernDossierPariteit(
  input: ProductiekernDossierPariteitsmetingInput,
): Promise<ProductiekernDossierPariteitsmeting> {
  const samenstelling = stelProductiekernLezenSamen(
    input.bewijs,
    input.achterliggendeRepository,
  );

  if (!samenstelling.activatie.lezenActief) {
    return {
      status: 'niet_geactiveerd',
      vergelijking: null,
      waarschuwingen: samenstelling.activatie.ontbrekendBewijs,
    };
  }

  const productiekernDossier = await samenstelling.repository.haalDossier(input.selectieId);
  if (!productiekernDossier) {
    return {
      status: 'productiekern_dossier_ontbreekt',
      vergelijking: null,
      waarschuwingen: [
        'Er bestaat nog geen productiekern-dossier voor deze selectie.',
      ],
    };
  }

  const vergelijking = vergelijkProductiekernDossier(
    input.legacyDossier.dossier,
    productiekernDossier,
  );

  return {
    status: vergelijking.kritiekeAfwijking
      ? 'kritieke_afwijking'
      : vergelijking.gelijk
        ? 'gelijk'
        : 'procesafwijking',
    vergelijking,
    waarschuwingen: vergelijking.kritiekeAfwijking
      ? ['Kritieke identiteitafwijking tussen legacy en productiekern.']
      : [],
  };
}
