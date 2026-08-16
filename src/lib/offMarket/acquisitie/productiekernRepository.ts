import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from './productiekernContract';

/**
 * Expliciete applicatiegrens voor BUILD A.
 *
 * UI en hooks mogen de nieuwe productiekern uitsluitend via deze interface
 * benaderen. Daarmee voorkomen we verspreide rechtstreekse Supabase-writes en
 * blijft de nieuwe flow volledig uitschakelbaar totdat migratie, RLS en
 * productieactivatie afzonderlijk zijn goedgekeurd.
 */
export interface AcquisitieProductiekernRepository {
  haalDossier(selectieId: string): Promise<AcquisitiedossierContract | null>;
  haalBrief(briefId: string): Promise<BriefContract | null>;
  haalBriefversies(briefId: string): Promise<BriefversieContract[]>;
  haalPrintbatch(batchId: string): Promise<PrintbatchContract | null>;
  haalPrintbatchBrieven(batchId: string): Promise<PrintbatchBriefContract[]>;
  haalActievePrintbatchIdVoorBriefversies(briefVersieIds: readonly string[]): Promise<string | null>;

  startVerwerking(input: {
    selectieId: string;
    actorId: string;
    operationKey: string;
  }): Promise<AcquisitiedossierContract>;

  reserveerBrief(input: {
    selectieId: string;
    signaalId: string;
    actorId: string;
    operationKey: string;
    jaar: number;
  }): Promise<BriefContract>;

  maakBriefversie(input: {
    briefId: string;
    actorId: string;
    operationKey: string;
    inhoudSnapshot: Record<string, unknown>;
    geadresseerdeSnapshot: Record<string, unknown>;
  }): Promise<BriefversieContract>;

  maakPrintbatch(input: {
    actorId: string;
    operationKey: string;
    datum: string;
  }): Promise<PrintbatchContract>;

  voegBriefversieToeAanBatch(input: {
    batchId: string;
    briefId: string;
    briefVersieId: string;
    actorId: string;
    operationKey: string;
  }): Promise<void>;

  markeerBatchGeprint(input: {
    batchId: string;
    actorId: string;
    operationKey: string;
    printdatum: string;
  }): Promise<PrintbatchContract>;

  markeerBriefGepost(input: {
    briefId: string;
    briefVersieId: string;
    batchId: string;
    actorId: string;
    operationKey: string;
    verzenddatum: string;
  }): Promise<void>;
}

export class ProductiekernNietGeactiveerdError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_NIET_GEACTIVEERD';

  constructor(handeling: string) {
    super(
      `Acquisitieproductiekern is niet geactiveerd; handeling "${handeling}" is geblokkeerd.`,
    );
    this.name = 'ProductiekernNietGeactiveerdError';
  }
}

/**
 * Fail-closed implementatie die standaard wordt gebruikt zolang BUILD A niet
 * expliciet voor productie is geactiveerd. Lees- én schrijfacties falen bewust,
 * zodat een ontbrekende configuratie nooit stil naar de nieuwe tabellen schrijft.
 */
export class UitgeschakeldeAcquisitieProductiekernRepository
implements AcquisitieProductiekernRepository {
  private geblokkeerd<T>(handeling: string): Promise<T> {
    return Promise.reject(new ProductiekernNietGeactiveerdError(handeling));
  }

  haalDossier(): Promise<AcquisitiedossierContract | null> {
    return this.geblokkeerd('haalDossier');
  }

  haalBrief(): Promise<BriefContract | null> {
    return this.geblokkeerd('haalBrief');
  }

  haalBriefversies(): Promise<BriefversieContract[]> {
    return this.geblokkeerd('haalBriefversies');
  }

  haalPrintbatch(): Promise<PrintbatchContract | null> {
    return this.geblokkeerd('haalPrintbatch');
  }

  haalPrintbatchBrieven(): Promise<PrintbatchBriefContract[]> {
    return this.geblokkeerd('haalPrintbatchBrieven');
  }

  haalActievePrintbatchIdVoorBriefversies(): Promise<string | null> {
    return this.geblokkeerd('haalActievePrintbatchIdVoorBriefversies');
  }

  startVerwerking(): Promise<AcquisitiedossierContract> {
    return this.geblokkeerd('startVerwerking');
  }

  reserveerBrief(): Promise<BriefContract> {
    return this.geblokkeerd('reserveerBrief');
  }

  maakBriefversie(): Promise<BriefversieContract> {
    return this.geblokkeerd('maakBriefversie');
  }

  maakPrintbatch(): Promise<PrintbatchContract> {
    return this.geblokkeerd('maakPrintbatch');
  }

  voegBriefversieToeAanBatch(): Promise<void> {
    return this.geblokkeerd('voegBriefversieToeAanBatch');
  }

  markeerBatchGeprint(): Promise<PrintbatchContract> {
    return this.geblokkeerd('markeerBatchGeprint');
  }

  markeerBriefGepost(): Promise<void> {
    return this.geblokkeerd('markeerBriefGepost');
  }
}

export const uitgeschakeldeAcquisitieProductiekernRepository =
  new UitgeschakeldeAcquisitieProductiekernRepository();
