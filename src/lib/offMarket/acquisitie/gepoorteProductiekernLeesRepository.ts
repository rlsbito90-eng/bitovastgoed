import type { ProductieLeesActivatieBesluit } from './productieLeesActivatiePoort';
import {
  ProductiekernNietGeactiveerdError,
  type AcquisitieProductiekernRepository,
} from './productiekernRepository';

/**
 * Repositorydecorator voor de toekomstige read-only overgangsfase.
 *
 * Alleen de vier leeshandelingen kunnen worden gedelegeerd en uitsluitend
 * wanneer de afzonderlijke leespoort expliciet actief is. Alle schrijfacties
 * blijven hard geblokkeerd, ook wanneer lezen is toegestaan.
 */
export class GepoorteProductiekernLeesRepository
implements AcquisitieProductiekernRepository {
  constructor(
    private readonly activatie: ProductieLeesActivatieBesluit,
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
  activatie: ProductieLeesActivatieBesluit,
  achterliggend: AcquisitieProductiekernRepository,
): AcquisitieProductiekernRepository {
  return new GepoorteProductiekernLeesRepository(activatie, achterliggend);
}
