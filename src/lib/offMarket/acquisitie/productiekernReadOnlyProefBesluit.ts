import type { ProductiekernPariteitsrapport } from './productiekernPariteitsrapport';

export interface ProductiekernReadOnlyProefEisen {
  minimaalAantalMetingen: number;
  maximaalAandeelProcesafwijkingen: number;
}

export interface ProductiekernReadOnlyProefBesluit {
  toegestaan: boolean;
  blokkades: string[];
  aandeelProcesafwijkingen: number;
}

/**
 * Neemt uitsluitend een besluit over een gecontroleerde read-only proef.
 *
 * Dit besluit activeert niets en schrijft niets. Het vertaalt een bestaand
 * pariteitsrapport en expliciete proefcriteria naar concrete blokkades. Een
 * productieactivatie of write-activatie valt nadrukkelijk buiten deze functie.
 */
export function beoordeelProductiekernReadOnlyProef(
  rapport: ProductiekernPariteitsrapport,
  eisen: ProductiekernReadOnlyProefEisen,
): ProductiekernReadOnlyProefBesluit {
  const blokkades: string[] = [];
  const aandeelProcesafwijkingen = rapport.totaal === 0
    ? 0
    : rapport.aantallen.procesafwijking / rapport.totaal;

  if (!Number.isInteger(eisen.minimaalAantalMetingen) || eisen.minimaalAantalMetingen < 1) {
    blokkades.push('Het minimale aantal metingen moet een positief geheel getal zijn.');
  }
  if (
    !Number.isFinite(eisen.maximaalAandeelProcesafwijkingen)
    || eisen.maximaalAandeelProcesafwijkingen < 0
    || eisen.maximaalAandeelProcesafwijkingen > 1
  ) {
    blokkades.push('Het maximale aandeel procesafwijkingen moet tussen 0 en 1 liggen.');
  }

  if (!rapport.veiligVoorReadOnlyProef) {
    blokkades.push('Het pariteitsrapport is niet veilig voor een read-only proef.');
  }
  if (rapport.totaal < eisen.minimaalAantalMetingen) {
    blokkades.push(
      `Er zijn ${rapport.totaal} metingen; minimaal ${eisen.minimaalAantalMetingen} vereist.`,
    );
  }
  if (aandeelProcesafwijkingen > eisen.maximaalAandeelProcesafwijkingen) {
    blokkades.push(
      `Het aandeel procesafwijkingen is ${aandeelProcesafwijkingen}; maximaal `
      + `${eisen.maximaalAandeelProcesafwijkingen} toegestaan.`,
    );
  }

  return {
    toegestaan: blokkades.length === 0,
    blokkades,
    aandeelProcesafwijkingen,
  };
}
