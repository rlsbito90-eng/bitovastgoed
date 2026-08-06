import type { PrintbatchContract } from './productiekernContract';

export class ProductiekernPrintbatchLeesIntegriteitError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_PRINTBATCH_LEESINTEGRITEIT';

  constructor(reden: string) {
    super(`Printbatch-readintegriteit geschonden: ${reden}`);
    this.name = 'ProductiekernPrintbatchLeesIntegriteitError';
  }
}

export function bewaakPrintbatchLeesIntegriteit(
  batch: PrintbatchContract,
): PrintbatchContract {
  if (batch.documentversie < 1) {
    throw new ProductiekernPrintbatchLeesIntegriteitError(
      'documentversie moet minimaal 1 zijn',
    );
  }

  const geprint = batch.printdatum !== null;
  const verzonden = batch.verzenddatum !== null;

  if (verzonden && !geprint) {
    throw new ProductiekernPrintbatchLeesIntegriteitError(
      'verzenddatum bestaat zonder printdatum',
    );
  }
  if (batch.status === 'concept' && (geprint || verzonden)) {
    throw new ProductiekernPrintbatchLeesIntegriteitError(
      'conceptbatch bevat al productie- of verzenddatums',
    );
  }
  if (batch.status === 'geprint' && !geprint) {
    throw new ProductiekernPrintbatchLeesIntegriteitError(
      'geprinte batch mist printdatum',
    );
  }
  if (batch.status === 'gepost' && (!geprint || !verzonden)) {
    throw new ProductiekernPrintbatchLeesIntegriteitError(
      'geposte batch mist print- of verzenddatum',
    );
  }
  if (batch.status === 'geannuleerd') {
    if (batch.geannuleerdOp === null || !batch.annuleringsreden?.trim()) {
      throw new ProductiekernPrintbatchLeesIntegriteitError(
        'geannuleerde batch mist datum of reden',
      );
    }
  } else if (batch.geannuleerdOp !== null || batch.annuleringsreden !== null) {
    throw new ProductiekernPrintbatchLeesIntegriteitError(
      'actieve batch bevat annuleringsvelden',
    );
  }

  return batch;
}
