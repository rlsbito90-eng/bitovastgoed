import type { AcquisitiedossierContract } from './productiekernContract';

export type DossierVergelijkingsveld = keyof AcquisitiedossierContract;

export interface DossierVeldAfwijking {
  veld: DossierVergelijkingsveld;
  legacyWaarde: AcquisitiedossierContract[DossierVergelijkingsveld];
  productiekernWaarde: AcquisitiedossierContract[DossierVergelijkingsveld];
}

export interface ProductiekernDossierVergelijking {
  gelijk: boolean;
  kritiekeAfwijking: boolean;
  afwijkingen: DossierVeldAfwijking[];
}

const KRITIEKE_VELDEN = new Set<DossierVergelijkingsveld>([
  'selectieId',
  'signaalId',
  'objectId',
]);

const VELDEN: DossierVergelijkingsveld[] = [
  'selectieId',
  'signaalId',
  'objectId',
  'verwerkingGestartOp',
  'verwerkingGestartDoor',
  'primaireWerkbak',
  'volgendeActieOp',
  'volgendeActieOmschrijving',
];

/**
 * Vergelijkt legacy en productiekern zonder een van beide te wijzigen.
 *
 * Identiteitsvelden gelden als kritisch: een afwijking daarin mag nooit stil
 * worden geaccepteerd tijdens dual-read of een latere backfillcontrole.
 * Procesvelden worden wel gerapporteerd, maar kunnen tijdens een gecontroleerde
 * overgang bewust verschillen.
 */
export function vergelijkProductiekernDossier(
  legacy: AcquisitiedossierContract,
  productiekern: AcquisitiedossierContract,
): ProductiekernDossierVergelijking {
  const afwijkingen = VELDEN.flatMap((veld): DossierVeldAfwijking[] => {
    if (Object.is(legacy[veld], productiekern[veld])) return [];
    return [{
      veld,
      legacyWaarde: legacy[veld],
      productiekernWaarde: productiekern[veld],
    }];
  });

  return {
    gelijk: afwijkingen.length === 0,
    kritiekeAfwijking: afwijkingen.some(({ veld }) => KRITIEKE_VELDEN.has(veld)),
    afwijkingen,
  };
}
