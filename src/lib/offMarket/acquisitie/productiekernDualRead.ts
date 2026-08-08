import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';

export type ProductiekernLeesbron = 'legacy' | 'productiekern';

export interface ProductiekernDualReadResultaat {
  bron: ProductiekernLeesbron;
  dossier: LegacyProductiedossierReadmodel;
  productiekernDossierBeschikbaar: boolean;
  waarschuwingen: string[];
}

export interface ProductiekernDualReadInput {
  selectieId: string;
  legacyDossier: LegacyProductiedossierReadmodel;
  productiekernRepository: Pick<AcquisitieProductiekernRepository, 'haalDossier'>;
  productiekernLezenActief: boolean;
}

export class ProductiekernDossierMismatchError extends Error {
  constructor(
    readonly verwachtSelectieId: string,
    readonly ontvangenSelectieId: string,
  ) {
    super(
      `Productiekern-repository retourneerde selectie ${ontvangenSelectieId} `
      + `terwijl ${verwachtSelectieId} was aangevraagd.`,
    );
    this.name = 'ProductiekernDossierMismatchError';
  }
}

/**
 * Veilige overgangsstrategie voor BUILD A.
 *
 * - Legacy blijft de primaire leesbron zolang productiekern-lezen niet expliciet
 *   is geactiveerd.
 * - Een gedeactiveerde of ontbrekende productiekern mag nooit de bestaande UI
 *   blokkeren.
 * - Onverwachte repositoryfouten worden niet verstopt: alleen de bekende
 *   fail-closed activatiefout resulteert in een gecontroleerde legacy-fallback.
 * - Een repositoryresultaat voor een andere selectie wordt hard geweigerd om
 *   vermenging van dossiers en gegevenslekken tussen selecties te voorkomen.
 * - Deze helper voert uitsluitend reads uit en combineert geen velden uit twee
 *   concurrerende waarheden.
 */
export async function leesProductiedossierDualRead(
  input: ProductiekernDualReadInput,
): Promise<ProductiekernDualReadResultaat> {
  if (!input.productiekernLezenActief) {
    return {
      bron: 'legacy',
      dossier: input.legacyDossier,
      productiekernDossierBeschikbaar: false,
      waarschuwingen: [],
    };
  }

  try {
    const productiekernDossier = await input.productiekernRepository.haalDossier(
      input.selectieId,
    );

    if (!productiekernDossier) {
      return {
        bron: 'legacy',
        dossier: input.legacyDossier,
        productiekernDossierBeschikbaar: false,
        waarschuwingen: [
          'Productiekern-lezen is actief, maar er bestaat nog geen productiekern-dossier; legacy blijft leidend.',
        ],
      };
    }

    if (productiekernDossier.selectieId !== input.selectieId) {
      throw new ProductiekernDossierMismatchError(
        input.selectieId,
        productiekernDossier.selectieId,
      );
    }

    return {
      bron: 'productiekern',
      dossier: {
        ...input.legacyDossier,
        dossier: productiekernDossier,
        waarschuwingen: [
          ...input.legacyDossier.waarschuwingen,
          'Productiekern-dossier is leidend; legacy brieven en audit blijven uitsluitend compatibiliteitsdata.',
        ],
      },
      productiekernDossierBeschikbaar: true,
      waarschuwingen: [],
    };
  } catch (error) {
    if (error instanceof ProductiekernNietGeactiveerdError) {
      return {
        bron: 'legacy',
        dossier: input.legacyDossier,
        productiekernDossierBeschikbaar: false,
        waarschuwingen: [
          'Productiekern-repository is fail-closed uitgeschakeld; legacy blijft leidend.',
        ],
      };
    }

    throw error;
  }
}
