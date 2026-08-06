import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import {
  meetProductiekernDossierPariteit,
  type ProductiekernDossierPariteitsmeting,
} from './productiekernDossierPariteitsmeting';
import {
  bouwProductiekernPariteitsrapport,
  type ProductiekernPariteitsrapport,
  type ProductiekernPariteitsrapportRegel,
} from './productiekernPariteitsrapport';
import {
  beoordeelProductiekernReadOnlyProef,
  type ProductiekernReadOnlyProefBesluit,
  type ProductiekernReadOnlyProefCriteria,
} from './productiekernReadOnlyProefBesluit';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';

export interface ProductiekernReadOnlyProefDossier {
  selectieId: string;
  legacyDossier: LegacyProductiedossierReadmodel;
}

export interface ProductiekernReadOnlyProefUitvoeringInput {
  dossiers: readonly ProductiekernReadOnlyProefDossier[];
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined;
  achterliggendeRepository: AcquisitieProductiekernRepository;
  criteria: ProductiekernReadOnlyProefCriteria;
}

export interface ProductiekernReadOnlyProefUitvoering {
  regels: ProductiekernPariteitsrapportRegel[];
  rapport: ProductiekernPariteitsrapport;
  besluit: ProductiekernReadOnlyProefBesluit;
}

function valideerUniekeSelecties(
  dossiers: readonly ProductiekernReadOnlyProefDossier[],
): void {
  const gezien = new Set<string>();
  for (const dossier of dossiers) {
    if (gezien.has(dossier.selectieId)) {
      throw new Error(`Selectie ${dossier.selectieId} komt dubbel voor in de read-only proef.`);
    }
    gezien.add(dossier.selectieId);
  }
}

/**
 * Voert een volledige, uitsluitend lezende productiekernproef uit.
 *
 * De uitvoering meet dossiers sequentieel, zodat de proef voorspelbaar blijft
 * en de database niet door onbeperkte parallelle reads wordt belast. De functie
 * schrijft niets, activeert niets en zet geen featureflag. Dubbele selectie-ID's
 * worden vooraf geweigerd om misleidende rapportages te voorkomen.
 */
export async function voerProductiekernReadOnlyProefUit(
  input: ProductiekernReadOnlyProefUitvoeringInput,
): Promise<ProductiekernReadOnlyProefUitvoering> {
  valideerUniekeSelecties(input.dossiers);

  const regels: ProductiekernPariteitsrapportRegel[] = [];
  for (const dossier of input.dossiers) {
    const meting: ProductiekernDossierPariteitsmeting =
      await meetProductiekernDossierPariteit({
        selectieId: dossier.selectieId,
        legacyDossier: dossier.legacyDossier,
        bewijs: input.bewijs,
        achterliggendeRepository: input.achterliggendeRepository,
      });

    regels.push({
      selectieId: dossier.selectieId,
      meting,
    });
  }

  const rapport = bouwProductiekernPariteitsrapport(regels);
  const besluit = beoordeelProductiekernReadOnlyProef(rapport, input.criteria);

  return { regels, rapport, besluit };
}
