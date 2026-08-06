import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import { bewaakBriefLeesIntegriteit } from './productiekernBriefLeesIntegriteit';
import { bewaakBriefversieLeesIntegriteit } from './productiekernBriefversieLeesIntegriteit';
import { bewaakDossierLeesIntegriteit } from './productiekernDossierLeesIntegriteit';
import {
  bewaakBriefversiesVoorGevraagdeBrief,
  bewaakGevraagdeLeesIdentiteit,
} from './productiekernLeesIdentiteit';
import { bewaakPrintbatchLeesIntegriteit } from './productiekernPrintbatchLeesIntegriteit';
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
  haalEen(tabel: string, filters: Readonly<Record<string, string>>): Promise<Record<string, unknown> | null>;
  haalMeerdere(
    tabel: string,
    filters: Readonly<Record<string, string>>,
    volgorde?: Readonly<{ kolom: string; oplopend: boolean }>,
  ): Promise<Record<string, unknown>[]>;
}

export class SupabaseProductiekernLeesRepository implements AcquisitieProductiekernRepository {
  constructor(private readonly transport: ProductiekernSupabaseLeesTransport) {}

  async haalDossier(selectieId: string): Promise<AcquisitiedossierContract | null> {
    const rij = await this.transport.haalEen('off_market_acquisitie_dossiers', { selectie_id: selectieId });
    if (!rij) return null;
    const dossier = bewaakDossierLeesIntegriteit(mapAcquisitiedossierRij(rij));
    bewaakGevraagdeLeesIdentiteit('Acquisitiedossier', selectieId, dossier.selectieId);
    return dossier;
  }

  async haalBrief(briefId: string): Promise<BriefContract | null> {
    const rij = await this.transport.haalEen('off_market_brieven', { id: briefId });
    if (!rij) return null;
    const brief = bewaakBriefLeesIntegriteit(mapBriefRij(rij));
    bewaakGevraagdeLeesIdentiteit('Brief', briefId, brief.id);
    return brief;
  }

  async haalBriefversies(briefId: string): Promise<BriefversieContract[]> {
    const rijen = await this.transport.haalMeerdere(
      'off_market_brief_versies',
      { brief_id: briefId },
      { kolom: 'versienummer', oplopend: true },
    );
    const versies = bewaakBriefversieLeesIntegriteit(rijen.map(mapBriefversieRij));
    bewaakBriefversiesVoorGevraagdeBrief(briefId, versies.map((versie) => versie.briefId));
    return versies;
  }

  async haalPrintbatch(batchId: string): Promise<PrintbatchContract | null> {
    const rij = await this.transport.haalEen('off_market_printbatches', { id: batchId });
    if (!rij) return null;
    const batch = bewaakPrintbatchLeesIntegriteit(mapPrintbatchRij(rij));
    bewaakGevraagdeLeesIdentiteit('Printbatch', batchId, batch.id);
    return batch;
  }

  private schrijfpadGeblokkeerd<T>(handeling: string): Promise<T> {
    return Promise.reject(new ProductiekernNietGeactiveerdError(handeling));
  }

  startVerwerking(): Promise<AcquisitiedossierContract> { return this.schrijfpadGeblokkeerd('startVerwerking'); }
  reserveerBrief(): Promise<BriefContract> { return this.schrijfpadGeblokkeerd('reserveerBrief'); }
  maakBriefversie(): Promise<BriefversieContract> { return this.schrijfpadGeblokkeerd('maakBriefversie'); }
  maakPrintbatch(): Promise<PrintbatchContract> { return this.schrijfpadGeblokkeerd('maakPrintbatch'); }
  voegBriefversieToeAanBatch(): Promise<void> { return this.schrijfpadGeblokkeerd('voegBriefversieToeAanBatch'); }
  markeerBatchGeprint(): Promise<PrintbatchContract> { return this.schrijfpadGeblokkeerd('markeerBatchGeprint'); }
  markeerBriefGepost(): Promise<void> { return this.schrijfpadGeblokkeerd('markeerBriefGepost'); }
}
