import type { ProductiekernLeesActivatieBesluit } from './productiekernLeesActivatieBesluit';
import {
  ProductiekernNietGeactiveerdError,
  type AcquisitieProductiekernRepository,
} from './productiekernRepository';

/**
 * Repositorydecorator voor een expliciet vrijgegeven read-only overgangsfase.
 *
 * Alleen de expliciete leeshandelingen kunnen worden gedelegeerd en uitsluitend
 * wanneer de aangeleverde omgevingspoort lezen heeft vrijgegeven. Alle
 * schrijfacties blijven hard geblokkeerd, ook wanneer lezen is toegestaan.
 */
export class GepoorteProductiekernLeesRepository
implements AcquisitieProductiekernRepository {
  constructor(
    private readonly activatie: ProductiekernLeesActivatieBesluit,
    private readonly achterliggend: AcquisitieProductiekernRepository,
  ) {}

  private eisLeestoegang(handeling: string): void {
    if (!this.activatie.lezenActief) {
      throw new ProductiekernNietGeactiveerdError(handeling);
    }
  }

  private blokkeerSchrijven(handeling: string): never {
    throw new ProductiekernNietGeactiveerdError(handeling);
  }

  haalDossier(selectieId: string) {
    this.eisLeestoegang('haalDossier');
    return this.achterliggend.haalDossier(selectieId);
  }

  haalBrief(briefId: string) {
    this.eisLeestoegang('haalBrief');
    return this.achterliggend.haalBrief(briefId);
  }

  haalBriefversies(briefId: string) {
    this.eisLeestoegang('haalBriefversies');
    return this.achterliggend.haalBriefversies(briefId);
  }

  haalPrintbatch(batchId: string) {
    this.eisLeestoegang('haalPrintbatch');
    return this.achterliggend.haalPrintbatch(batchId);
  }

  haalPrintbatchBrieven(batchId: string) {
    this.eisLeestoegang('haalPrintbatchBrieven');
    return this.achterliggend.haalPrintbatchBrieven(batchId);
  }

  startVerwerking(): never {
    return this.blokkeerSchrijven('startVerwerking');
  }

  reserveerBrief(): never {
    return this.blokkeerSchrijven('reserveerBrief');
  }

  maakBriefversie(): never {
    return this.blokkeerSchrijven('maakBriefversie');
  }

  maakPrintbatch(): never {
    return this.blokkeerSchrijven('maakPrintbatch');
  }

  voegBriefversieToeAanBatch(): never {
    return this.blokkeerSchrijven('voegBriefversieToeAanBatch');
  }

  markeerBatchGeprint(): never {
    return this.blokkeerSchrijven('markeerBatchGeprint');
  }

  markeerBriefGepost(): never {
    return this.blokkeerSchrijven('markeerBriefGepost');
  }
}

export function maakGepoorteProductiekernLeesRepository(
  activatie: ProductiekernLeesActivatieBesluit,
  achterliggend: AcquisitieProductiekernRepository,
): AcquisitieProductiekernRepository {
  return new GepoorteProductiekernLeesRepository(activatie, achterliggend);
}
