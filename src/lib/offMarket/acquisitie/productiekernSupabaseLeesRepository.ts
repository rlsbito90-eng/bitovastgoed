import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import { bewaakBriefversieLeesIntegriteit } from './productiekernBriefversieLeesIntegriteit';
import {
  ProductiekernNietGeactiveerdError,
  type AcquisitieProductiekernRepository,
} from './productiekernRepository';
import {
  mapAcquisitiedossierRij,
  mapBriefRij,
  mapBriefversieRij,
  mapPrintbatchRij,
} from './productiekernSupabaseRijMapper';

export interface ProductiekernSupabaseLeesTransport {
  haalEen(
    tabel: string,
    filters: Readonly<Record<string, string>>,
  ): Promise<Record<string, unknown> | null>;
  haalMeerdere(
    tabel: string,
    filters: Readonly<Record<string, string>>,
    volgorde?: Readonly<{ kolom: string; oplopend: boolean }>,
  ): Promise<Record<string, unknown>[]>;
}

/**
 * Concrete read-only repository boven een smal Supabase-transport.
 *
 * De adapter bevat bewust geen import van de globale Supabase-client en geen
 * writepad. De app moet deze repository via de bestaande bewijs- en leespoort
 * samenstellen; alle schrijfmethoden blijven ook daarna fail-closed.
 */
export class SupabaseProductiekernLeesRepository
implements AcquisitieProductiekernRepository {
  constructor(private readonly transport: ProductiekernSupabaseLeesTransport) {}

  async haalDossier(selectieId: string): Promise<AcquisitiedossierContract | null> {
    const rij = await this.transport.haalEen(
      'off_market_acquisitie_dossiers',
      { selectie_id: selectieId },
    );
    return rij ? mapAcquisitiedossierRij(rij) : null;
  }

  async haalBrief(briefId: string): Promise<BriefContract | null> {
    const rij = await this.transport.haalEen('off_market_brieven', { id: briefId });
    return rij ? mapBriefRij(rij) : null;
  }

  async haalBriefversies(briefId: string): Promise<BriefversieContract[]> {
    const rijen = await this.transport.haalMeerdere(
      'off_market_brief_versies',
      { brief_id: briefId },
      { kolom: 'versienummer', oplopend: true },
    );
    return bewaakBriefversieLeesIntegriteit(rijen.map(mapBriefversieRij));
  }

  async haalPrintbatch(batchId: string): Promise<PrintbatchContract | null> {
    const rij = await this.transport.haalEen('off_market_printbatches', { id: batchId });
    return rij ? mapPrintbatchRij(rij) : null;
  }

  private schrijfpadGeblokkeerd<T>(handeling: string): Promise<T> {
    return Promise.reject(new ProductiekernNietGeactiveerdError(handeling));
  }

  startVerwerking(): Promise<AcquisitiedossierContract> {
    return this.schrijfpadGeblokkeerd('startVerwerking');
  }
  reserveerBrief(): Promise<BriefContract> {
    return this.schrijfpadGeblokkeerd('reserveerBrief');
  }
  maakBriefversie(): Promise<BriefversieContract> {
    return this.schrijfpadGeblokkeerd('maakBriefversie');
  }
  maakPrintbatch(): Promise<PrintbatchContract> {
    return this.schrijfpadGeblokkeerd('maakPrintbatch');
  }
  voegBriefversieToeAanBatch(): Promise<void> {
    return this.schrijfpadGeblokkeerd('voegBriefversieToeAanBatch');
  }
  markeerBatchGeprint(): Promise<PrintbatchContract> {
    return this.schrijfpadGeblokkeerd('markeerBatchGeprint');
  }
  markeerBriefGepost(): Promise<void> {
    return this.schrijfpadGeblokkeerd('markeerBriefGepost');
  }
}
