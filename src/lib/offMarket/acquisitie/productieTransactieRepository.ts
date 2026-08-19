import type {
  BatchDocumentenRegistrerenInput,
  BatchDocumentversieVernieuwenInput,
  BatchGeprintMarkerenInput,
  BriefDefinitiefMakenInput,
  BriefGepostMarkerenInput,
} from './productieTransactieContract';

export interface BriefDefinitiefResultaat {
  briefId: string;
  briefnummer: string;
}

/**
 * Afzonderlijke repositorygrens voor kritieke, atomische productiehandelingen.
 * Een implementatie mag deze acties uitsluitend via beveiligde databasefuncties
 * uitvoeren; losse multi-statement clientwrites zijn niet toegestaan.
 */
export interface AcquisitieProductieTransactieRepository {
  maakBriefDefinitief(
    input: BriefDefinitiefMakenInput,
  ): Promise<BriefDefinitiefResultaat>;

  registreerBatchdocumenten(
    input: BatchDocumentenRegistrerenInput,
  ): Promise<void>;

  vernieuwBatchdocumenten(
    input: BatchDocumentversieVernieuwenInput,
  ): Promise<void>;

  markeerBatchGeprint(
    input: BatchGeprintMarkerenInput,
  ): Promise<void>;

  markeerBriefGepost(
    input: BriefGepostMarkerenInput,
  ): Promise<void>;
}

export class ProductieTransactiesNietGeactiveerdError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIETRANSACTIES_NIET_GEACTIVEERD';

  constructor(handeling: string) {
    super(`Transactionele productiehandeling "${handeling}" is niet geactiveerd.`);
    this.name = 'ProductieTransactiesNietGeactiveerdError';
  }
}

/** Standaardimplementatie: iedere kritieke handeling blijft geblokkeerd. */
export class UitgeschakeldeAcquisitieProductieTransactieRepository
implements AcquisitieProductieTransactieRepository {
  private geblokkeerd<T>(handeling: string): Promise<T> {
    return Promise.reject(new ProductieTransactiesNietGeactiveerdError(handeling));
  }

  maakBriefDefinitief(): Promise<BriefDefinitiefResultaat> {
    return this.geblokkeerd('maakBriefDefinitief');
  }

  registreerBatchdocumenten(): Promise<void> {
    return this.geblokkeerd('registreerBatchdocumenten');
  }

  vernieuwBatchdocumenten(): Promise<void> {
    return this.geblokkeerd('vernieuwBatchdocumenten');
  }

  markeerBatchGeprint(): Promise<void> {
    return this.geblokkeerd('markeerBatchGeprint');
  }

  markeerBriefGepost(): Promise<void> {
    return this.geblokkeerd('markeerBriefGepost');
  }
}

export const uitgeschakeldeAcquisitieProductieTransactieRepository =
  new UitgeschakeldeAcquisitieProductieTransactieRepository();
